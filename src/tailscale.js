// Built-in Tailscale: runs the bundled tsnet helper and routes tailnet
// addresses (100.x, *.ts.net, device names) through its local proxy.
// Everything else keeps going direct.
const { app, session, shell } = require('electron');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROXY_USER = 'selkies'; // Kept for compatibility with the prebuilt helper binary.

function helperPath() {
  const override = process.env.DASHSTARR_HELPER || process.env.SB_HELPER;
  if (override) return override; // for development and tests
  const name = process.platform === 'darwin' ? 'dashstarr-tailscale' : `dashstarr-tailscale-${process.platform}`;
  const base = app.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(__dirname, '..', 'bin');
  return path.join(base, name);
}

function deviceName() {
  const host = os.hostname().split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  return `dashstarr-${host || 'mac'}`.slice(0, 63);
}

class Tailscale extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.token = crypto.randomBytes(24).toString('hex');
    this.port = 0;
    this.pacVersion = 0;
    this.peerKey = '';
    this.wantLogin = false;
    this.restarts = 0;
    this.probes = new Map();
    this.state = { enabled: false, running: false, state: 'Stopped', authURL: '', self: null, tailnet: '', peers: [], error: '' };
  }

  get available() {
    return fs.existsSync(helperPath());
  }

  update(changes) {
    Object.assign(this.state, changes);
    this.emit('change', this.state);
  }

  start() {
    if (this.proc) return;
    if (!this.available) {
      this.update({ enabled: false, error: 'The Tailscale helper is missing from this build.' });
      return;
    }
    const dir = path.join(app.getPath('userData'), 'tailscale');
    fs.mkdirSync(dir, { recursive: true });
    this.update({ enabled: true, state: 'Starting', error: '' });

    const proc = spawn(helperPath(), ['-dir', dir, '-hostname', deviceName()], {
      env: { ...process.env, SB_PROXY_TOKEN: this.token },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc = proc;
    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      try { this.onMessage(JSON.parse(line)); } catch { /* ignore non JSON */ }
    });
    proc.stderr.on('data', (d) => (process.env.DASHSTARR_DEBUG || process.env.SB_DEBUG) && process.stderr.write(d));
    proc.on('error', (err) => {
      if (this.proc === proc) {
        this.proc = null;
        this.port = 0;
        this.clearProxy();
        for (const resolve of this.probes.values()) resolve(false);
        this.probes.clear();
        this.update({ running: false, state: 'Stopped', authURL: '', peers: [], self: null, error: err.message });
      }
    });
    proc.on('exit', (code) => {
      if (this.proc !== proc) return;
      this.proc = null;
      this.port = 0;
      this.clearProxy();
      const wasEnabled = this.state.enabled;
      this.update({ running: false, state: 'Stopped', authURL: '', peers: [], self: null });
      for (const resolve of this.probes.values()) resolve(false);
      this.probes.clear();
      // Crashed while it should be on: try again a few times.
      if (wasEnabled && code !== 0 && this.restarts < 3) {
        this.restarts += 1;
        setTimeout(() => { if (this.state.enabled) this.start(); }, 2000);
      }
    });
  }

  stop() {
    this.update({ enabled: false });
    this.restarts = 0;
    this.peerKey = '';
    for (const resolve of this.probes.values()) resolve(false);
    this.probes.clear();
    if (!this.proc) return;
    const proc = this.proc;
    this.proc = null;
    proc.stdin.end(); // helper exits cleanly when stdin closes
    setTimeout(() => { if (proc.exitCode === null && proc.signalCode === null) proc.kill(); }, 3000);
    this.port = 0;
    this.clearProxy();
    this.update({ running: false, state: 'Stopped', authURL: '', peers: [], self: null });
  }

  send(cmd) {
    if (this.proc?.stdin.writable) this.proc.stdin.write(JSON.stringify(cmd) + '\n');
  }

  login() {
    if (!this.proc) this.start();
    this.wantLogin = true;
    if (this.state.authURL) this.openAuth(this.state.authURL);
    else this.send({ cmd: 'login' });
  }

  logout() {
    this.send({ cmd: 'logout' });
  }

  openAuth(url) {
    this.wantLogin = false;
    shell.openExternal(url);
  }

  /** True when the host should go through Tailscale (same rules as the PAC file). */
  isTailnetHost(host) {
    const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.\d+\.\d+$/.test(h)) return true;
    if (h.startsWith('fd7a:115c:a1e0:')) return true;
    if (h.endsWith('.ts.net')) return true;
    return this.state.peers.some((p) => (p.name || '').toLowerCase() === h || (p.dnsName || '').toLowerCase() === h);
  }

  /** Can we open a TCP connection to host:port over the tailnet? */
  probe(hostPort) {
    if (!this.proc || !this.state.running) return Promise.resolve(false);
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      this.probes.set(id, resolve);
      this.send({ cmd: 'probe', id, addr: hostPort });
      setTimeout(() => { if (this.probes.delete(id)) resolve(false); }, 6000);
    });
  }

  /** Answer Chromium's proxy login with the helper's random password. */
  proxyCredentials(authInfo) {
    if (!this.port || authInfo.host !== '127.0.0.1' || Number(authInfo.port) !== this.port) return null;
    return { user: PROXY_USER, pass: this.token };
  }

  applyProxy() {
    if (!this.port) return;
    this.pacVersion += 1;
    session.defaultSession.setProxy({ pacScript: `http://127.0.0.1:${this.port}/proxy.pac?v=${this.pacVersion}` })
      .then(() => session.defaultSession.closeAllConnections?.())
      .catch((e) => this.update({ error: `Proxy: ${e.message}` }));
  }

  clearProxy() {
    session.defaultSession.setProxy({ mode: 'direct' }).catch(() => {});
  }

  onMessage(m) {
    switch (m.type) {
      case 'proxy':
        this.port = m.port;
        this.applyProxy();
        break;
      case 'status': {
        const running = m.state === 'Running';
        if (running) this.restarts = 0;
        const peers = m.peers || [];
        // Device names feed the PAC file, so refresh it when they change.
        const key = peers.map((p) => p.name).sort().join(',') + '|' + (m.tailnet || '');
        if (key !== this.peerKey) {
          this.peerKey = key;
          this.applyProxy();
        }
        this.update({ running, state: m.state, authURL: m.authURL || '', self: m.self || null, tailnet: m.tailnet || '', peers, error: '' });
        if (this.wantLogin && m.authURL) this.openAuth(m.authURL);
        break;
      }
      case 'probe': {
        const resolve = this.probes.get(m.id);
        if (resolve) {
          this.probes.delete(m.id);
          resolve(!!m.ok);
        }
        break;
      }
      case 'error':
        this.update({ error: m.error });
        break;
      default:
    }
  }
}

module.exports = new Tailscale();
