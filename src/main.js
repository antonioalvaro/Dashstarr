const {
  app, BrowserWindow, WebContentsView, ipcMain, Menu, dialog, session, powerSaveBlocker, shell,
  powerMonitor, systemPreferences,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const store = require('./store');
const tailscale = require('./tailscale');

// ---------------------------------------------------------------------------
// Startup switches (must run before the app is ready)
// ---------------------------------------------------------------------------

// Selkies decodes video with WebCodecs, which browsers only allow on https or
// localhost. For plain http servers we tell Chromium to treat those exact
// addresses as secure. The list is read at launch, so a new http address needs
// one restart (the app offers it).
const secureHttpOrigins = store
  .listServers()
  .map((s) => store.normalize(s.address))
  .filter((u) => u && u.startsWith('http:'))
  .map((u) => new URL(u).origin);
if (secureHttpOrigins.length) {
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', [...new Set(secureHttpOrigins)].join(','));
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ---------------------------------------------------------------------------
// Window and tabs
// One window. Home is shown when nothing is selected. Each connection is a
// view in the same window; the tab bar only appears with 2+ connections.
// ---------------------------------------------------------------------------

const TABBAR_HEIGHT = 38;
const APP_ICON = path.join(__dirname, 'assets', 'icon.png');
const IS_MAC = process.platform === 'darwin';
const linuxIcon = IS_MAC ? {} : { icon: APP_ICON };
let mainWin = null;
let homeView = null;
const tabs = new Map(); // server id -> { id, view, url, origin, name, loading, popups, blocker }
let order = [];         // server ids in tab order
let active = null;      // server id, or null for Home
let htmlFullscreen = false;
let weMadeFullscreen = false;
let quitting = false;
let forceCloseWindow = false;
const allPopups = new Set(); // every open pop-up window (even if kept open after its connection closes)
let popupsToCloseOnMainClose = [];
const SAFE_EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:']);

const livePopupsFor = (tab) => [...tab.popups].filter((p) => !p.isDestroyed());
const liveAllPopups = () => [...allPopups].filter((p) => !p.isDestroyed());

function lockDownInternalView(wc) {
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
}

const webPrefs = (extra) => ({ contextIsolation: true, sandbox: true, ...extra });

function ensureWindow() {
  if (mainWin) return mainWin;
  mainWin = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 520,
    minHeight: 380,
    title: 'Dashstarr',
    show: false,
    ...linuxIcon,
    webPreferences: webPrefs({ preload: path.join(__dirname, 'preload-tabs.js') }),
  });
  mainWin.loadFile(path.join(__dirname, 'tabs.html')); // the tab bar lives in the window itself
  lockDownInternalView(mainWin.webContents);

  homeView = new WebContentsView({ webPreferences: webPrefs({ preload: path.join(__dirname, 'preload-home.js') }) });
  homeView.webContents.loadFile(path.join(__dirname, 'home.html'));
  lockDownInternalView(homeView.webContents);
  mainWin.contentView.addChildView(homeView);

  mainWin.on('resize', layout);
  mainWin.on('enter-full-screen', layout);
  mainWin.on('leave-full-screen', () => {
    weMadeFullscreen = false;
    if (htmlFullscreen) {
      htmlFullscreen = false;
      tabs.get(active)?.view.webContents.executeJavaScript('document.fullscreenElement && document.exitFullscreen()', true).catch(() => {});
    }
    layout();
  });
  mainWin.on('focus', () => { if (!active) refreshStatus(); });
  mainWin.on('close', (e) => {
    popupsToCloseOnMainClose = [];
    const force = forceCloseWindow;
    forceCloseWindow = false;
    if (quitting) return;
    if (!force && active && tabs.has(active)) {
      e.preventDefault();
      closeTab(active);
      return;
    }
    if (tabs.size === 0) return;
    if (!confirmClose(tabs.size, 'Close the window?')) {
      e.preventDefault();
      return;
    }
    const tabsWithPopups = [];
    const tabPopups = [];
    for (const t of tabs.values()) {
      const live = livePopupsFor(t);
      if (live.length) {
        tabsWithPopups.push(t);
        tabPopups.push(...live);
      }
    }
    if (tabPopups.length) {
      const label = tabsWithPopups.length === 1 ? `“${tabsWithPopups[0].name}”` : 'these connections';
      const choice = confirmClosePopups(label, tabPopups.length, tabsWithPopups.length > 1);
      if (choice === 'cancel') {
        e.preventDefault();
        return;
      }
      if (choice === 'close') popupsToCloseOnMainClose = tabPopups;
    }
  });
  mainWin.on('closed', () => {
    const toClose = popupsToCloseOnMainClose;
    popupsToCloseOnMainClose = [];
    for (const popup of toClose) if (!popup.isDestroyed()) popup.close();
    for (const t of tabs.values()) {
      t.popups.clear();
      if (!t.view.webContents.isDestroyed()) t.view.webContents.close();
      powerSaveBlocker.stop(t.blocker);
    }
    tabs.clear();
    order = [];
    active = null;
    htmlFullscreen = false;
    weMadeFullscreen = false;
    mainWin = null;
    homeView = null;
    buildMenu();
  });
  mainWin.once('ready-to-show', () => { if (!locked) mainWin.show(); });
  layout();
  return mainWin;
}

function confirmClose(n, message, popups = 0) {
  let detail;
  if (n === 0 && popups > 0) {
    detail = popups === 1 ? 'A pop-up window is still open.' : `${popups} pop-up windows are still open.`;
  } else {
    detail = n === 1 ? 'A Selkies session is still open.' : `${n} Selkies sessions are still open.`;
  }
  const opts = {
    type: 'question',
    buttons: [message.startsWith('Quit') ? 'Quit' : 'Close', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message,
    detail,
  };
  const parent = mainWin && !mainWin.isDestroyed() ? mainWin : null;
  return (parent ? dialog.showMessageBoxSync(parent, opts) : dialog.showMessageBoxSync(opts)) === 0;
}

function confirmClosePopups(sourceLabel, count, multipleConnections = false) {
  const plural = count > 1;
  const opts = {
    type: 'question',
    buttons: [
      plural ? 'Close Pop-ups' : 'Close Pop-up',
      'Keep Open',
      'Cancel',
    ],
    defaultId: 0,
    cancelId: 2,
    message: plural
      ? `Close ${count} pop-up windows opened by ${sourceLabel}?`
      : `Close the pop-up window opened by ${sourceLabel}?`,
    detail: multipleConnections
      ? 'You can close these pop-up windows along with the window, or keep them open.'
      : plural
        ? 'You can close these pop-up windows along with this connection, or keep them open.'
        : 'You can close the pop-up window along with this connection, or keep it open.',
  };
  const parent = mainWin && !mainWin.isDestroyed() ? mainWin : null;
  const r = parent ? dialog.showMessageBoxSync(parent, opts) : dialog.showMessageBoxSync(opts);
  if (r === 0) return 'close';
  if (r === 1) return 'keep';
  return 'cancel';
}

function layout() {
  if (!mainWin || mainWin.isDestroyed()) return;
  const [w, h] = mainWin.getContentSize();
  const showBar = order.length >= 2 && !htmlFullscreen;
  const top = showBar ? TABBAR_HEIGHT : 0;
  const current = active ? tabs.get(active)?.view : homeView;
  for (const v of [homeView, ...order.map((id) => tabs.get(id).view)]) {
    if (v !== current) v.setVisible(false);
  }
  if (current) {
    current.setBounds({ x: 0, y: top, width: w, height: h - top });
    current.setVisible(true);
  }
  mainWin.setTitle(active ? tabs.get(active).name : 'Dashstarr');
  mainWin.webContents.send('tabs', {
    tabs: order.map((id) => {
      const t = tabs.get(id);
      return { id, name: t.name, icon: t.icon || '', color: t.color || '', loading: t.loading };
    }),
    active,
  });
  if (homeView && !homeView.webContents.isDestroyed()) homeView.webContents.send('open', order);
}

function activate(id) {
  ensureWindow();
  active = id && tabs.has(id) ? id : null;
  layout();
  const wc = active ? tabs.get(active).view.webContents : homeView.webContents;
  if (!locked) {
    if (!mainWin.isVisible()) mainWin.show();
    mainWin.focus();
    wc.focus();
  }
  if (!active) refreshStatus();
}

function showHome() {
  if (locked) return showLockWindow();
  ensureWindow();
  activate(null);
  mainWin.show();
  mainWin.focus();
}

function sendServers() {
  if (homeView && !homeView.webContents.isDestroyed()) homeView.webContents.send('servers', store.listServers());
}

function activeWebContents() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && focused !== mainWin) {
    return allPopups.has(focused) ? focused.webContents : null;
  }
  if (!mainWin || mainWin.isDestroyed()) return null;
  return active ? tabs.get(active)?.view.webContents : homeView?.webContents;
}

function tabForWebContents(wc) {
  if (!wc) return null;
  for (const [id, t] of tabs) {
    if (t.view.webContents === wc) return { id, ...t };
    for (const p of t.popups) {
      if (!p.isDestroyed() && p.webContents === wc) return { id, ...t };
    }
  }
  return null;
}

function openSession(id) {
  const server = store.getServer(id);
  if (!server) return;
  ensureWindow();

  if (tabs.has(id)) {
    activate(id);
    return;
  }

  const url = store.normalize(server.address);
  if (!url) return;
  const origin = new URL(url).origin;

  if (origin.startsWith('http:') && !secureHttpOrigins.includes(origin)) {
    const r = dialog.showMessageBoxSync(mainWin, {
      type: 'info',
      buttons: ['Restart Now', 'Connect Anyway', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Quick restart needed for this address',
      detail: `Selkies needs a secure connection for video decoding. For plain http addresses the app turns that on at startup, so it needs one restart for ${origin}. It will connect right after.`,
    });
    if (r === 2) return;
    if (r === 0) {
      store.setSettings({ ...store.getSettings(), pendingConnect: id });
      quitting = true;
      tailscale.stop();
      app.relaunch();
      app.exit(0);
      return;
    }
  }

  const view = new WebContentsView({ webPreferences: webPrefs({ backgroundThrottling: false, spellcheck: false }) });
  view.setBackgroundColor('#000000');
  view.setVisible(false);
  mainWin.contentView.addChildView(view);
  const wc = view.webContents;

  // Keep the stream smooth and the screen awake while a session is open.
  const tab = { id, view, url, origin, name: server.name, icon: server.icon || '', color: server.color || '', loading: true, popups: new Set(), blocker: powerSaveBlocker.start('prevent-display-sleep') };
  tabs.set(id, tab);
  order.push(id);

  handlePopups(wc, tab);
  wc.on('did-fail-load', (_e, code, desc, _failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted (normal during redirects)
    let why = desc;
    if (tailscale.isTailnetHost(new URL(url).hostname) && !tailscale.state.running) {
      const homeKey = IS_MAC ? 'Cmd+0' : 'Ctrl+0';
      why = `This is a Tailscale address. Turn on Tailscale from the Home screen (${homeKey}), or start the Tailscale app on this device.`;
    }
    wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorPage(server.name, why, url)));
  });
  let lastCrash = 0;
  wc.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || !tabs.has(id)) return;
    const now = Date.now();
    if (now - lastCrash < 5000) {
      wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorPage(server.name, `Renderer crashed (${details.reason}).`, url)));
      return;
    }
    lastCrash = now;
    wc.loadURL(url);
  });
  wc.on('did-start-loading', () => { tab.loading = true; layout(); });
  wc.on('did-stop-loading', () => { tab.loading = false; layout(); });

  // Selkies' fullscreen button: hide the tab bar and fill the screen.
  wc.on('enter-html-full-screen', () => {
    htmlFullscreen = true;
    if (mainWin && !mainWin.isFullScreen()) { weMadeFullscreen = true; mainWin.setFullScreen(true); }
    layout();
  });
  wc.on('leave-html-full-screen', () => {
    htmlFullscreen = false;
    if (mainWin && weMadeFullscreen) { weMadeFullscreen = false; mainWin.setFullScreen(false); }
    layout();
  });

  wc.loadURL(url);
  activate(id);
  buildMenu();
  store.updateServer({ id, lastConnected: Date.now() });
  sendServers();
}

// Links and window.open() from a session open in an independent pop-up window inside the
// app (same session, so logins and Tailscale carry over), not pinned on top of the main window.
function handlePopups(wc, tab) {
  wc.setWindowOpenHandler(({ url: target, features }) => {
    if (locked) return { action: 'deny' };
    // Use the size the page asked for (window.open(url, name, 'width=600,height=400')).
    const want = (key) => Number((features || '').match(new RegExp(`(?:^|,)\\s*${key}\\s*=\\s*(\\d+)`))?.[1]) || 0;
    let protocol = '';
    try { protocol = new URL(target).protocol; } catch { /* ignore */ }
    if (target === 'about:blank' || protocol === 'http:' || protocol === 'https:' || protocol === 'blob:' || protocol === 'data:') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: want('width') || 1100,
          height: want('height') || 760,
          minWidth: 320,
          minHeight: 240,
          autoHideMenuBar: true,
          ...linuxIcon,
          webPreferences: webPrefs({ backgroundThrottling: false, spellcheck: false }),
        },
      };
    }
    // Only forward safe external link schemes (mailto:, tel:) to the system.
    if (SAFE_EXTERNAL_PROTOCOLS.has(protocol)) shell.openExternal(target);
    return { action: 'deny' };
  });
  wc.on('did-create-window', (popup) => {
    allPopups.add(popup);
    const attached = !!(tab && tabs.get(tab.id) === tab);
    if (attached) tab.popups.add(popup);
    popup.on('closed', () => {
      allPopups.delete(popup);
      if (tab) tab.popups.delete(popup);
    });
    if (locked) {
      popup.webContents.setAudioMuted(true);
      popup.hide();
      hiddenWins.push(popup);
    }
    handlePopups(popup.webContents, attached ? tab : null); // pop-ups can open pop-ups too
  });
}

function closeTab(id) {
  const t = tabs.get(id);
  if (!t || !mainWin) return false;
  const popups = livePopupsFor(t);
  if (popups.length) {
    const choice = confirmClosePopups(`“${t.name}”`, popups.length);
    if (choice === 'cancel') return false;
    if (choice === 'close') {
      for (const popup of popups) if (!popup.isDestroyed()) popup.close();
    }
  }
  t.popups.clear();
  const idx = order.indexOf(id);
  if (!mainWin.isDestroyed()) mainWin.contentView.removeChildView(t.view);
  if (!t.view.webContents.isDestroyed()) t.view.webContents.close();
  powerSaveBlocker.stop(t.blocker);
  tabs.delete(id);
  order = order.filter((x) => x !== id);
  buildMenu();
  if (active === id) {
    // Go to the neighbouring connection, or Home when it was the last one.
    activate(order.length ? order[Math.min(idx, order.length - 1)] : null);
  } else {
    layout();
  }
  return true;
}

function cycleTab(step) {
  if (!order.length) return;
  const i = active ? order.indexOf(active) : -1;
  activate(order[(i + step + order.length) % order.length]);
}

ipcMain.on('tab:activate', (_e, id) => activate(id));
ipcMain.on('tab:close', (_e, id) => closeTab(id));
ipcMain.on('tab:home', () => activate(null));
ipcMain.on('tab:context-menu', (_e, id) => {
  const t = tabs.get(id);
  if (!t || !mainWin) return;
  const items = [
    { label: 'Close Connection', click: () => closeTab(id) },
  ];
  if (order.length > 1) {
    items.push({
      label: 'Close Other Connections',
      click: () => {
        for (const otherId of order.filter((x) => x !== id)) {
          if (!closeTab(otherId)) break;
        }
      },
    });
  }
  items.push(
    { type: 'separator' },
    { label: 'Reload', click: () => { if (!t.view.webContents.isDestroyed()) t.view.webContents.reload(); } },
  );
  Menu.buildFromTemplate(items).popup({ window: mainWin });
});

function errorPage(name, desc, url) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark">
  <style>body{font:14px -apple-system,sans-serif;display:flex;height:90vh;align-items:center;justify-content:center;text-align:center}
  p{color:gray}a{display:inline-block;margin-top:12px;padding:7px 18px;border-radius:7px;background:#0a84ff;color:#fff;text-decoration:none}</style>
  <div><h2>Can't reach ${esc(name)}</h2><p>${esc(desc)}</p><p>${esc(url)}</p><a href="${esc(url)}">Try Again</a></div>`;
}

// ---------------------------------------------------------------------------
// Basic auth login popup
// ---------------------------------------------------------------------------

const lastGiven = new Map();    // host:port -> time we last answered with a login
const pendingLogins = new Map(); // host:port -> Promise of {user, pass} or null
const loginWindows = new Map(); // webContents id -> resolve function
const lastUser = new Map();     // host:port -> username typed last

app.on('login', (event, webContents, details, authInfo, callback) => {
  event.preventDefault();
  if (authInfo.isProxy) {
    const cred = tailscale.proxyCredentials(authInfo);
    return cred ? callback(cred.user, cred.pass) : callback();
  }

  const key = `${authInfo.host}:${authInfo.port}`;
  // Asked again right after we answered: the login was wrong.
  const failed = Date.now() - (lastGiven.get(key) || 0) < 5000;
  const answer = (cred) => {
    if (!cred) return callback();
    lastGiven.set(key, Date.now());
    callback(cred.user, cred.pass);
  };

  const saved = store.getCredential(key);
  if (saved && !failed) return answer(saved);

  if (!pendingLogins.has(key)) {
    const tab = tabForWebContents(webContents);
    const senderWin = BrowserWindow.fromWebContents(webContents);
    const reqUrl = details?.url || tab?.url || '';
    const p = whenUnlocked().then(() => {
      const targetParent = (senderWin && !senderWin.isDestroyed() ? senderWin : null)
        || (mainWin && !mainWin.isDestroyed() ? mainWin : null);
      return askLogin(targetParent, {
        name: tab?.name || authInfo.host,
        host: key,
        realm: authInfo.realm || '',
        failed,
        user: lastUser.get(key) || saved?.user || '',
        insecure: authInfo.scheme === 'basic' && !reqUrl.startsWith('https:'),
      });
    }).then((result) => {
      if (result) {
        lastUser.set(key, result.user);
        if (result.remember) store.saveCredential(key, result.user, result.pass);
        else store.deleteCredential(key);
      }
      return result;
    }).finally(() => pendingLogins.delete(key));
    pendingLogins.set(key, p);
  }
  pendingLogins.get(key).then(answer);
});

function askLogin(parent, params) {
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      parent: parent || undefined,
      modal: !!parent,
      width: 400,
      height: 330,
      useContentSize: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'Log In',
      webPreferences: {
        preload: path.join(__dirname, 'preload-login.js'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    const id = w.webContents.id;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      loginWindows.delete(id);
      resolve(value);
      if (!w.isDestroyed()) w.close();
    };
    loginWindows.set(id, finish);
    w.on('closed', () => finish(null));
    w.loadFile(path.join(__dirname, 'login.html'), {
      query: {
        name: params.name, host: params.host, realm: params.realm,
        failed: params.failed ? '1' : '', user: params.user, insecure: params.insecure ? '1' : '',
      },
    });
    lockDownInternalView(w.webContents);
    w.once('ready-to-show', () => w.show());
  });
}

ipcMain.on('login:submit', (e, data) => {
  const finish = loginWindows.get(e.sender.id);
  if (!finish) return;
  if (!data) return finish(null);
  finish({ user: String(data.user || ''), pass: String(data.pass || ''), remember: !!data.remember });
});

// ---------------------------------------------------------------------------
// Self signed certificates
// ---------------------------------------------------------------------------

const trustedThisRun = new Set();
const pendingTrust = new Map();

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  let key;
  try { key = store.hostKey(url); } catch { return callback(false); }
  const fp = certificate.fingerprint;
  if (store.isTrusted(key, fp) || trustedThisRun.has(key + fp)) return callback(true);

  if (!pendingTrust.has(key)) {
    const opts = {
      type: 'warning',
      buttons: ['Always Trust', 'Continue Once', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: "This server's certificate isn't trusted",
      detail: `${key} is using a self signed or invalid certificate (${error}). Only continue if this is your own Selkies server.\n\n${fp}`,
    };
    const p = whenUnlocked()
      .then(() => {
        const senderWin = BrowserWindow.fromWebContents(webContents);
        const target = (senderWin && !senderWin.isDestroyed() ? senderWin : null)
          || (mainWin && !mainWin.isDestroyed() ? mainWin : null);
        return target ? dialog.showMessageBox(target, opts) : dialog.showMessageBox(opts);
      })
      .then(({ response }) => {
        if (response === 0) store.trust(key, fp);
        if (response < 2) trustedThisRun.add(key + fp);
        return response < 2;
      })
      .finally(() => pendingTrust.delete(key));
    pendingTrust.set(key, p);
  }
  pendingTrust.get(key).then((ok) => callback(ok));
});

// ---------------------------------------------------------------------------
// Online status for the home screen tiles
// ---------------------------------------------------------------------------

function probe(address) {
  return new Promise((resolve) => {
    const url = store.normalize(address);
    if (!url) return resolve(false);
    const u = new URL(url);
    if (tailscale.state.running && tailscale.isTailnetHost(u.hostname)) {
      const port = u.port || (u.protocol === 'https:' ? '443' : '80');
      const host = u.hostname.includes(':') ? `[${u.hostname}]` : u.hostname;
      tailscale.probe(`${host}:${port}`).then(resolve);
      return;
    }
    const mod = u.protocol === 'https:' ? https : http;
    // Any HTTP answer (including 401 from the Selkies login) means it's up.
    const req = mod.request(u, { method: 'HEAD', timeout: 4000, rejectUnauthorized: false }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

function refreshStatus() {
  if (!homeView || homeView.webContents.isDestroyed()) return;
  for (const s of store.listServers()) {
    probe(s.address).then((online) => {
      if (homeView && !homeView.webContents.isDestroyed()) homeView.webContents.send('status', { id: s.id, online });
    });
  }
}

// ---------------------------------------------------------------------------
// Home screen IPC
// ---------------------------------------------------------------------------

ipcMain.handle('servers:list', () => store.listServers());

ipcMain.handle('servers:add', (_e, data) => {
  const r = store.addServer(data);
  if (!r.error) { sendServers(); refreshStatus(); buildMenu(); }
  return r;
});

ipcMain.handle('servers:update', (_e, data) => {
  const r = store.updateServer(data);
  if (!r.error) {
    const t = tabs.get(r.id);
    if (t) {
      t.name = r.name;
      t.icon = r.icon || '';
      t.color = r.color || '';
      layout();
    }
    sendServers();
    refreshStatus();
    buildMenu();
  }
  return r;
});

ipcMain.handle('servers:remove', (_e, id) => removeWithConfirm(id));

ipcMain.handle('servers:reorder', (_e, ids) => {
  const list = store.reorderServers(ids);
  sendServers();
  buildMenu();
  return list;
});

ipcMain.handle('connect', (_e, id) => openSession(id));

ipcMain.handle('quick-connect', (_e, address) => {
  const url = store.normalize(address);
  if (!url) return { error: "That address doesn't look right" };
  let server = store.listServers().find((s) => store.normalize(s.address) === url);
  if (!server) {
    server = store.addServer({ name: '', address });
    sendServers();
    refreshStatus();
    buildMenu();
  }
  openSession(server.id);
  return server;
});

ipcMain.handle('status:refresh', () => refreshStatus());

ipcMain.on('context-menu', (_e, id) => {
  const server = store.getServer(id);
  if (!server || !mainWin) return;
  const isOpen = tabs.has(id);
  const items = isOpen
    ? [
      { label: 'Switch to Connection', click: () => openSession(id) },
      { label: 'Close Connection', click: () => closeTab(id) },
      { type: 'separator' },
    ]
    : [
      { label: 'Connect', click: () => openSession(id) },
    ];
  items.push(
    { label: 'Edit…', click: () => homeView?.webContents.send('edit', id) },
    {
      label: 'Duplicate',
      click: () => {
        store.addServer({ name: `${server.name} copy`, address: server.address, icon: server.icon, color: server.color });
        sendServers();
        refreshStatus();
        buildMenu();
      },
    },
    { type: 'separator' },
    { label: 'Remove…', click: () => removeWithConfirm(id) },
  );
  Menu.buildFromTemplate(items).popup({ window: mainWin });
});

function removeWithConfirm(id) {
  const server = store.getServer(id);
  if (!server) return false;
  const opts = {
    type: 'warning',
    buttons: ['Remove', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Remove “${server.name}”?`,
    detail: 'Its saved login will also be removed.',
  };
  const r = mainWin ? dialog.showMessageBoxSync(mainWin, opts) : dialog.showMessageBoxSync(opts);
  if (r !== 0) return false;
  if (tabs.has(id) && !closeTab(id)) return false;
  const url = store.normalize(server.address);
  if (url) store.deleteCredential(store.hostKey(url));
  store.removeServer(id);
  sendServers();
  buildMenu();
  return true;
}

// ---------------------------------------------------------------------------
// Tailscale
// ---------------------------------------------------------------------------

function setTailscale(on) {
  store.setSettings({ ...store.getSettings(), tailscaleEnabled: on });
  if (on) tailscale.start();
  else tailscale.stop();
}

tailscale.on('change', (state) => {
  if (homeView && !homeView.webContents.isDestroyed()) homeView.webContents.send('ts', state);
});

let lastPeerOnline = '';
tailscale.on('change', (state) => {
  // When the tailnet comes up or devices change, re-check the tiles.
  const key = state.running + '|' + state.peers.map((p) => p.name + p.online).join(',');
  if (key !== lastPeerOnline) {
    lastPeerOnline = key;
    refreshStatus();
  }
});

ipcMain.handle('ts:state', () => ({ ...tailscale.state, available: tailscale.available }));
ipcMain.on('ts:login', () => tailscale.login());
ipcMain.on('ts:enable', () => setTailscale(true));

ipcMain.on('ts:menu', () => {
  if (!mainWin) return;
  const st = tailscale.state;
  const items = [];
  if (!st.enabled) {
    items.push({ label: 'Turn On Tailscale', click: () => setTailscale(true) });
  } else {
    if (st.running && st.self) {
      items.push({ label: `Signed in${st.tailnet ? ` to ${st.tailnet}` : ''}`, enabled: false });
      items.push({ label: `This device: ${st.self.name} (${st.self.ip})`, enabled: false });
      items.push({ type: 'separator' });
      items.push({ label: 'Tailscale Admin Console', click: () => shell.openExternal('https://login.tailscale.com/admin/machines') });
      items.push({ label: 'Log Out', click: () => tailscale.logout() });
    } else {
      items.push({ label: 'Log In…', click: () => tailscale.login() });
    }
    items.push({ type: 'separator' });
    items.push({ label: 'Turn Off Tailscale', click: () => setTailscale(false) });
  }
  Menu.buildFromTemplate(items).popup({ window: mainWin });
});

// ---------------------------------------------------------------------------
// App lock
// ---------------------------------------------------------------------------

let locked = false;
let lockWin = null;
let quickLockWin = null;
let settingsWin = null;
let sessionLock = null; // one-time { salt, hash, touchId } set via Quick Lock
let hiddenWins = [];
let afterUnlock = [];
let failures = 0;
let blockedUntil = 0;

const lockEnabled = () => {
  const l = store.getLock();
  return !!(l.enabled && l.hash);
};
const activeLock = () => sessionLock || (lockEnabled() ? store.getLock() : null);
const touchIdAvailable = () => {
  try { return process.platform === 'darwin' && systemPreferences.canPromptTouchID(); } catch { return false; }
};
const whenUnlocked = () => (locked ? new Promise((resolve) => afterUnlock.push(resolve)) : Promise.resolve());

function allSessionContents() {
  const seen = new Set();
  const list = [];
  const push = (wc) => {
    if (wc && !wc.isDestroyed() && !seen.has(wc)) {
      seen.add(wc);
      list.push(wc);
    }
  };
  for (const t of tabs.values()) {
    push(t.view.webContents);
    for (const p of t.popups) if (!p.isDestroyed()) push(p.webContents);
  }
  for (const p of allPopups) if (!p.isDestroyed()) push(p.webContents);
  return list;
}

function lockApp(tempLock = null) {
  if (locked) return;
  if (tempLock) sessionLock = tempLock;
  if (!activeLock()) return;
  locked = true;
  if (quickLockWin && !quickLockWin.isDestroyed()) quickLockWin.destroy();
  quickLockWin = null;
  hiddenWins = BrowserWindow.getAllWindows().filter((w) => w !== lockWin && w.isVisible());
  for (const w of hiddenWins) w.hide();
  for (const wc of allSessionContents()) wc.setAudioMuted(true);
  buildMenu();
  showLockWindow();
}

function unlockApp() {
  locked = false;
  sessionLock = null;
  failures = 0;
  blockedUntil = 0;
  for (const wc of allSessionContents()) wc.setAudioMuted(false);
  for (const w of hiddenWins) if (!w.isDestroyed()) w.show();
  hiddenWins = [];
  buildMenu();
  // Bring the app back before removing the lock screen, so there's never a moment with no windows.
  const queued = afterUnlock;
  afterUnlock = [];
  for (const fn of queued) fn();
  if (!mainWin && liveAllPopups().length === 0) showHome();
  else if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) mainWin.show();
  if (mainWin && !mainWin.isDestroyed()) mainWin.focus();
  if (lockWin) { lockWin.destroy(); lockWin = null; }
}

function quickLock() {
  if (locked) return showLockWindow();
  if (lockEnabled()) return lockApp();
  if (quickLockWin && !quickLockWin.isDestroyed()) {
    quickLockWin.show();
    quickLockWin.focus();
    return;
  }
  const parent = mainWin && !mainWin.isDestroyed() ? mainWin : null;
  quickLockWin = new BrowserWindow({
    parent: parent || undefined,
    modal: !!parent,
    width: 360,
    height: touchIdAvailable() ? 310 : 275,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Quick Lock',
    show: false,
    ...linuxIcon,
    webPreferences: webPrefs({ preload: path.join(__dirname, 'preload-quicklock.js') }),
  });
  quickLockWin.loadFile(path.join(__dirname, 'quicklock.html'));
  lockDownInternalView(quickLockWin.webContents);
  quickLockWin.once('ready-to-show', () => { quickLockWin?.show(); quickLockWin?.focus(); });
  quickLockWin.on('closed', () => { quickLockWin = null; });
}

ipcMain.handle('quicklock:info', () => ({ touchIdAvailable: touchIdAvailable() }));

ipcMain.handle('quicklock:submit', (e, data) => {
  if (!quickLockWin || e.sender !== quickLockWin.webContents || locked) return { error: 'Not allowed.' };
  if (!data || typeof data !== 'object') return { error: 'Invalid input.' };
  const pass = String(data.password || '');
  const confirm = String(data.confirm || '');
  if (pass.length < 4) return { error: 'Use at least 4 characters for the password.' };
  if (pass !== confirm) return { error: "The passwords don't match." };
  const { salt, hash } = store.hashPassword(pass);
  lockApp({ salt, hash, touchId: !!data.touchId && touchIdAvailable() });
  return { ok: true };
});

ipcMain.on('quicklock:cancel', (e) => {
  if (quickLockWin && !quickLockWin.isDestroyed() && e.sender === quickLockWin.webContents) quickLockWin.close();
});

function showLockWindow() {
  if (lockWin) {
    lockWin.show();
    lockWin.focus();
    return;
  }
  lockWin = new BrowserWindow({
    width: 360,
    height: 440,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Dashstarr',
    show: false,
    ...linuxIcon,
    webPreferences: webPrefs({ preload: path.join(__dirname, 'preload-lock.js') }),
  });
  lockWin.loadFile(path.join(__dirname, 'lock.html'));
  lockDownInternalView(lockWin.webContents);
  lockWin.once('ready-to-show', () => { lockWin?.show(); lockWin?.focus(); });
  // Closing the lock screen hides it on macOS (click Dock icon to reopen) or minimizes it on Linux.
  lockWin.on('close', (e) => {
    if (locked && !quitting) {
      e.preventDefault();
      if (IS_MAC) lockWin.hide();
      else lockWin.minimize();
    }
  });
  lockWin.on('closed', () => { lockWin = null; });
}

function startLockWatchers() {
  // Auto-lock after the chosen minutes without keyboard or mouse activity.
  setInterval(() => {
    if (locked || !lockEnabled()) return;
    const mins = Number(store.getLock().timeoutMin) || 0;
    if (mins > 0 && powerMonitor.getSystemIdleTime() >= mins * 60) lockApp();
  }, 10000);
  const onSleep = () => { if (store.getLock().lockOnSleep) lockApp(); };
  powerMonitor.on('lock-screen', onSleep);
  powerMonitor.on('suspend', onSleep);
}

ipcMain.handle('lock:info', () => {
  const l = activeLock() || {};
  return { needUser: !!l.user, touchId: !!l.touchId && touchIdAvailable() };
});

ipcMain.handle('lock:unlock', (e, data) => {
  if (!lockWin || e.sender !== lockWin.webContents) return { ok: false };
  const now = Date.now();
  if (now < blockedUntil) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((blockedUntil - now) / 1000)} seconds.` };
  }
  const ok = sessionLock
    ? store.verifyHash(data?.pass, sessionLock.salt, sessionLock.hash)
    : store.verifyLock(data?.user, data?.pass);
  if (ok) {
    unlockApp();
    return { ok: true };
  }
  failures += 1;
  if (failures >= 5) blockedUntil = now + 30000 * (failures - 4); // 30 s, 60 s, 90 s...
  return { ok: false, error: activeLock()?.user ? 'Wrong username or password.' : 'Wrong password.' };
});

ipcMain.handle('lock:touchid', async (e) => {
  const l = activeLock();
  if (!lockWin || e.sender !== lockWin.webContents || !l?.touchId || !touchIdAvailable()) return { ok: false };
  try {
    await systemPreferences.promptTouchID('unlock Dashstarr');
    unlockApp();
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

// ---- Settings window ----

function openSettings() {
  if (locked) return;
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 460,
    height: 700,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Settings',
    show: false,
    ...linuxIcon,
    webPreferences: webPrefs({ preload: path.join(__dirname, 'preload-settings.js') }),
  });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  lockDownInternalView(settingsWin.webContents);
  settingsWin.once('ready-to-show', () => settingsWin?.show());
  settingsWin.on('closed', () => { settingsWin = null; });
}

ipcMain.handle('settings:get', () => {
  const l = store.getLock();
  return {
    lock: { enabled: lockEnabled(), user: l.user || '', timeoutMin: Number(l.timeoutMin) || 0, lockOnSleep: !!l.lockOnSleep, touchId: !!l.touchId },
    touchIdAvailable: touchIdAvailable(),
  };
});

ipcMain.handle('settings:saveLock', (e, d) => {
  if (!settingsWin || e.sender !== settingsWin.webContents || locked) return { error: 'Not allowed' };
  if (!d || typeof d !== 'object') return { error: 'Invalid settings.' };
  const wasEnabled = lockEnabled();
  if (wasEnabled && !store.verifyPassword(d.currentPassword)) return { error: 'Current password is wrong.' };

  if (!d.enabled) {
    store.setLock({ enabled: false });
    buildMenu();
    return { ok: true, message: 'App lock is off.' };
  }

  let { salt, hash } = store.getLock();
  if (d.password) {
    if (String(d.password).length < 4) return { error: 'Use at least 4 characters for the password.' };
    if (d.password !== d.confirm) return { error: "The passwords don't match." };
    ({ salt, hash } = store.hashPassword(d.password));
  } else if (!wasEnabled) {
    return { error: 'Choose a password.' };
  }
  store.setLock({
    enabled: true,
    user: String(d.user || '').trim(),
    salt,
    hash,
    timeoutMin: Math.max(0, Number(d.timeoutMin) || 0),
    lockOnSleep: !!d.lockOnSleep,
    touchId: !!d.touchId,
  });
  buildMenu();
  return { ok: true, message: 'Saved.' };
});

ipcMain.on('settings:lockNow', () => lockApp());

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function forgetLogin() {
  const tab = active ? tabs.get(active) : null;
  if (!tab) return;
  const key = store.hostKey(tab.url);
  store.deleteCredential(key);
  lastGiven.delete(key);
  session.defaultSession.clearAuthCache().catch(() => {});
  const msgOpts = {
    message: 'Saved login removed',
    detail: "You'll be asked for your username and password the next time you connect.",
  };
  if (mainWin && !mainWin.isDestroyed()) dialog.showMessageBox(mainWin, msgOpts);
  else dialog.showMessageBox(msgOpts);
}

function openAddService() {
  if (locked) return showLockWindow();
  showHome();
  if (!homeView || homeView.webContents.isDestroyed()) return;
  if (homeView.webContents.isLoading()) {
    homeView.webContents.once('did-finish-load', () => {
      if (homeView && !homeView.webContents.isDestroyed()) homeView.webContents.send('add');
    });
  } else {
    homeView.webContents.send('add');
  }
}

function buildMenu() {
  const tabKeys = Array.from({ length: 9 }, (_, i) => ({
    label: `Connection ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    visible: false,
    acceleratorWorksWhenHidden: true,
    click: () => { if (order[i]) activate(order[i]); },
  }));
  if (locked) {
    // Nothing that could reveal or reach the app while it's locked.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: IS_MAC
          ? [{ role: 'hide' }, { type: 'separator' }, { role: 'quit' }]
          : [{ role: 'quit' }],
      },
      { role: 'editMenu' },
    ]));
    return;
  }
  const servers = store.listServers();
  const connectionItems = servers.length
    ? servers.map((s) => ({
      label: String(s.name || s.address).replace(/&/g, '&&'),
      type: 'checkbox',
      checked: tabs.has(s.id),
      toolTip: s.address,
      click: () => openSession(s.id),
    }))
    : [{ label: 'No saved services', enabled: false }];
  connectionItems.push({ type: 'separator' }, { label: 'Add Service…', click: openAddService });

  const appSubmenu = [
    ...(IS_MAC ? [{ role: 'about' }, { type: 'separator' }] : []),
    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
    { label: 'Quick Lock', accelerator: 'CmdOrCtrl+Shift+L', click: quickLock },
    ...(IS_MAC ? [
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
    ] : []),
    { type: 'separator' },
    { role: 'quit' },
  ];

  const windowSubmenu = [
    {
      label: 'Close Connection',
      accelerator: 'CmdOrCtrl+W',
      click: () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused && focused !== mainWin) focused.close();
        else if (active) closeTab(active);
        else mainWin?.close();
      },
    },
    {
      label: 'Close Window',
      accelerator: 'CmdOrCtrl+Shift+W',
      click: () => {
        const target = BrowserWindow.getFocusedWindow() || mainWin;
        if (target === mainWin) forceCloseWindow = true;
        target?.close();
      },
    },
    { type: 'separator' },
    { role: 'minimize' },
    ...(IS_MAC ? [{ role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: appSubmenu },
    { role: 'editMenu' },
    {
      label: 'Connection',
      submenu: connectionItems,
    },
    {
      label: 'View',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+0', click: showHome },
        { label: 'Next Connection', accelerator: 'Ctrl+Tab', click: () => cycleTab(1) },
        { label: 'Previous Connection', accelerator: 'Ctrl+Shift+Tab', click: () => cycleTab(-1) },
        { label: 'Next Connection', accelerator: 'CmdOrCtrl+Shift+]', visible: false, acceleratorWorksWhenHidden: true, click: () => cycleTab(1) },
        { label: 'Previous Connection', accelerator: 'CmdOrCtrl+Shift+[', visible: false, acceleratorWorksWhenHidden: true, click: () => cycleTab(-1) },
        ...tabKeys,
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => activeWebContents()?.reload() },
        { label: 'Forget Saved Login', click: forgetLogin },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Developer Tools', accelerator: 'Alt+CmdOrCtrl+I', click: () => activeWebContents()?.toggleDevTools() },
      ],
    },
    {
      label: 'Window',
      submenu: windowSubmenu,
    },
  ]));
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  if (!IS_MAC) app.setDesktopName?.('dashstarr.desktop');
  const ses = session.defaultSession;
  // These are your own servers: allow mic, camera, clipboard, fullscreen, pointer lock etc.
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(true));
  ses.setPermissionCheckHandler(() => true);

  // Selkies file downloads go straight to ~/Downloads.
  ses.on('will-download', (_e, item) => {
    const dir = app.getPath('downloads');
    const name = path.basename(item.getFilename()) || 'download';
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let target = path.join(dir, name);
    for (let i = 1; fs.existsSync(target); i++) target = path.join(dir, `${base} (${i})${ext}`);
    item.setSavePath(target);
    item.once('done', (_ev, state) => {
      if (state === 'completed') app.dock?.downloadFinished(target);
    });
  });

  if (!app.isPackaged) app.dock?.setIcon(APP_ICON);
  if (store.getSettings().tailscaleEnabled) tailscale.start();
  const startUp = () => {
    showHome();
    const settings = store.getSettings();
    if (settings.pendingConnect) {
      const id = settings.pendingConnect;
      delete settings.pendingConnect;
      store.setSettings(settings);
      openSession(id);
    }
  };
  if (lockEnabled()) {
    locked = true;
    afterUnlock.push(startUp);
    buildMenu();
    showLockWindow();
  } else {
    buildMenu();
    startUp();
  }
  startLockWatchers();

  setInterval(() => { if (mainWin?.isVisible() && !active) refreshStatus(); }, 20000);
});

app.on('second-instance', () => {
  if (locked) return showLockWindow();
  ensureWindow();
  mainWin.show();
  mainWin.focus();
});
app.on('activate', () => {
  if (locked) showLockWindow();
  else if (!mainWin) showHome();
});
app.on('will-quit', () => tailscale.stop());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', (e) => {
  if (locked) {
    quitting = true; // no "sessions open" prompt behind the lock screen
    return;
  }
  const popups = liveAllPopups().length;
  if (quitting || (tabs.size === 0 && popups === 0)) return;
  if (confirmClose(tabs.size, 'Quit Dashstarr?', popups)) quitting = true;
  else e.preventDefault();
});
