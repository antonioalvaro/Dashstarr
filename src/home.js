const grid = document.getElementById('grid');
const address = document.getElementById('address');
const editor = document.getElementById('editor');
const editName = document.getElementById('editName');
const editAddress = document.getElementById('editAddress');
const editError = document.getElementById('editError');

let servers = [];
let selectedId = null;
let editingId = null;
const status = {}; // id -> true / false (missing = checking)
let openIds = [];  // servers with a connection open right now
let ts = { enabled: false, running: false, peers: [] };

const PALETTE = ['#0a84ff', '#bf5af2', '#40c8e0', '#ff9f0a', '#ff375f', '#30d158', '#5e5ce6', '#ff453a'];
const MONITOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 20.5h8M12 16.5v4"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function ago(ts) {
  const s = (ts - Date.now()) / 1000;
  const steps = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [604800, 'day'], [2629800, 'week'], [31557600, 'month'], [Infinity, 'year']];
  const div = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
  for (const [limit, unit] of steps) {
    if (Math.abs(s) < limit) return rtf.format(Math.round(s / div[unit]), unit);
  }
  return '';
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function render() {
  grid.textContent = '';
  for (const s of servers) {
    const isOpen = openIds.includes(s.id);
    const tile = el('div', 'tile' + (s.id === selectedId ? ' selected' : '') + (isOpen ? ' open' : ''));
    tile.tabIndex = 0;
    tile.dataset.id = s.id;
    const thumb = el('div', 'thumb', MONITOR);
    thumb.style.background = colorFor(s.id);
    if (isTailnetAddress(s.address)) {
      const badge = el('span', 'badge');
      badge.textContent = 'Tailscale';
      thumb.append(badge);
    }
    const name = el('div', 'name');
    name.textContent = s.name;
    const addr = el('div', 'addr');
    addr.textContent = s.address;
    const detail = el('div', 'detail');
    const dot = el('span', 'dot' + (isOpen ? ' connected' : s.id in status ? (status[s.id] ? ' online' : ' offline') : ''));
    const text = el('span');
    const state = isOpen ? 'Connected' : s.id in status ? (status[s.id] ? 'Online' : 'Offline') : 'Checking…';
    text.textContent = s.lastConnected && !isOpen ? `${state}  ·  ${ago(s.lastConnected)}` : state;
    detail.append(dot, text);
    tile.append(thumb, name, addr, detail);
    tile.title = s.address;

    tile.addEventListener('mousedown', () => select(s.id));
    tile.addEventListener('dblclick', () => window.api.connect(s.id));
    tile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      select(s.id);
      window.api.contextMenu(s.id);
    });
    grid.append(tile);
  }

  const add = el('div', 'tile add');
  add.tabIndex = 0;
  const thumb = el('div', 'thumb', PLUS);
  const name = el('div', 'name');
  name.textContent = 'Add Server';
  const addr = el('div', 'addr');
  addr.textContent = 'Save an IP or hostname';
  add.append(thumb, name, addr);
  add.addEventListener('click', () => openEditor(null));
  grid.append(add);
}

function select(id) {
  selectedId = id;
  for (const t of grid.querySelectorAll('.tile')) t.classList.toggle('selected', t.dataset.id === id);
}

// ---- Quick connect ----

document.getElementById('quick').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = address.value.trim();
  if (!value) return;
  const r = await window.api.quickConnect(value);
  if (r && r.error) {
    address.classList.remove('shake');
    void address.offsetWidth;
    address.classList.add('shake');
    return;
  }
  address.value = '';
});

// ---- Add / edit dialog ----

function openEditor(id, preset) {
  editingId = id;
  const s = servers.find((x) => x.id === id);
  document.getElementById('editTitle').textContent = s ? 'Edit Server' : 'Add Server';
  editName.value = s ? s.name : preset?.name || '';
  editAddress.value = s ? s.address : preset?.address || '';
  editError.textContent = preset?.hint || '';
  editError.style.color = preset?.hint ? 'var(--muted)' : '';
  editor.showModal();
  if (preset) {
    // Cursor after "host:" so you just type the Selkies port.
    editAddress.focus();
    editAddress.setSelectionRange(editAddress.value.length, editAddress.value.length);
  } else {
    (s ? editName : editAddress).focus();
  }
}

document.getElementById('editCancel').addEventListener('click', () => editor.close());

document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = { name: editName.value, address: editAddress.value };
  const r = editingId ? await window.api.update({ id: editingId, ...data }) : await window.api.add(data);
  if (r.error) {
    editError.style.color = '';
    editError.textContent = r.error;
    return;
  }
  editor.close();
  select(r.id);
});

// ---- Keyboard ----

document.addEventListener('keydown', (e) => {
  if (editor.open || document.activeElement === address) return;
  if (e.target && e.target.closest('button, input, textarea, select')) return;
  if (!selectedId) return;
  if (e.key === 'Enter') window.api.connect(selectedId);
  if (e.key === 'Backspace' || e.key === 'Delete') window.api.remove(selectedId);
});

// ---- Data from the main process ----

window.api.onServers((list) => {
  servers = list;
  if (!servers.some((s) => s.id === selectedId)) selectedId = null;
  render();
});
window.api.onStatus(({ id, online }) => {
  status[id] = online;
  render();
});
window.api.onEdit((id) => openEditor(id));
window.api.onOpen((ids) => {
  openIds = ids;
  render();
});

window.api.list().then((list) => {
  servers = list;
  render();
  window.api.refreshStatus();
});

// Keep "2 hr. ago" labels fresh.
setInterval(render, 60000);


// ---- Tailscale ----

const tsPill = document.getElementById('tsPill');
const tsLabel = document.getElementById('tsLabel');
const tsDot = tsPill.querySelector('.ts-dot');
const tsSection = document.getElementById('tsSection');
const tsBanner = document.getElementById('tsBanner');
const tsBannerText = document.getElementById('tsBannerText');
const tsBannerBtn = document.getElementById('tsBannerBtn');
const tsDevices = document.getElementById('tsDevices');
const tsHint = document.getElementById('tsHint');

tsPill.addEventListener('click', () => window.api.tsMenu());
tsBannerBtn.addEventListener('click', () => (ts.enabled ? window.api.tsLogin() : window.api.tsEnable()));

function hostOf(address) {
  let s = String(address || '').trim();
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try { return new URL(s).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return ''; }
}

function isTailnetAddress(address) {
  const h = hostOf(address);
  if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.\d+\.\d+$/.test(h)) return true;
  if (h.endsWith('.ts.net') || h.startsWith('fd7a:115c:a1e0:')) return true;
  return (ts.peers || []).some((p) => p.name.toLowerCase() === h || (p.dnsName || '').toLowerCase() === h);
}

function renderTs() {
  tsPill.hidden = ts.available === false;
  const needsLogin = ts.enabled && !ts.running && (ts.state === 'NeedsLogin' || ts.authURL);
  tsDot.className = 'ts-dot' + (ts.running ? ' on' : ts.enabled ? ' wait' : '');
  tsLabel.textContent = !ts.enabled ? 'Tailscale off'
    : ts.running ? 'Tailscale on'
    : needsLogin ? 'Tailscale: log in' : 'Tailscale: starting…';
  tsPill.title = ts.error || (ts.running && ts.self ? `This Mac on Tailscale: ${ts.self.name} (${ts.self.ip})` : '');

  tsSection.hidden = ts.available === false;
  tsDevices.textContent = '';
  tsHint.textContent = '';
  if (!ts.enabled) {
    tsBanner.hidden = false;
    tsBannerText.textContent = 'Reach your Selkies servers over Tailscale, no VPN app needed.';
    tsBannerBtn.textContent = 'Turn On Tailscale';
    return;
  }
  if (!ts.running) {
    tsBanner.hidden = !needsLogin;
    tsBannerText.textContent = 'Log in to Tailscale to see your devices.';
    tsBannerBtn.textContent = 'Log In';
    if (!needsLogin) tsHint.textContent = ts.error || 'Starting…';
    return;
  }
  tsBanner.hidden = true;
  const peers = ts.peers || [];
  const online = peers.filter((p) => p.online).length;
  tsHint.textContent = `${online} online${ts.tailnet ? `  ·  ${ts.tailnet}` : ''}`;
  if (!peers.length) {
    tsHint.textContent = 'No other devices on this tailnet yet';
    return;
  }
  for (const p of peers) {
    const row = el('div', 'device' + (p.online ? '' : ' offline'));
    const dot = el('span', 'dot' + (p.online ? ' online' : ''));
    const info = el('div', 'info');
    const dn = el('div', 'dn');
    dn.textContent = p.name;
    const meta = el('div', 'meta');
    meta.textContent = [p.ip, p.os].filter(Boolean).join('  ·  ');
    info.append(dn, meta);
    const add = el('button');
    add.type = 'button';
    add.textContent = 'Add';
    add.title = `Add ${p.dnsName || p.ip} as a Selkies server`;
    const host = p.dnsName || (p.ip && p.ip.includes(':') ? `[${p.ip}]` : p.ip);
    add.addEventListener('click', () => openEditor(null, {
      name: p.name,
      address: `${host}:`,
      hint: 'Type the Selkies port after the colon, e.g. 3001 (https) or 8080.',
    }));
    row.append(dot, info, add);
    row.title = p.dnsName || p.ip;
    tsDevices.append(row);
  }
}

window.api.onTs((state) => {
  ts = { ...ts, ...state };
  renderTs();
  render();
});
window.api.tsState().then((state) => {
  ts = state;
  renderTs();
  render();
});
