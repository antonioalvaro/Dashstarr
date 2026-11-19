// Saved servers, trusted certificates and logins, kept in the app's userData folder.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = (name) => path.join(app.getPath('userData'), name);

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

function write(name, value) {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, name);
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, dest);
}

/** "192.168.1.50:8080" -> "http://192.168.1.50:8080/". Returns null if it isn't a usable address. */
function normalize(address) {
  let s = String(address || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try {
    const u = new URL(s);
    return u.hostname ? u.href : null;
  } catch {
    return null;
  }
}

/** "host:port" used to key logins and trusted certificates. */
function hostKey(url) {
  const u = new URL(url);
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  return `${u.hostname}:${port}`;
}

// ---- Servers ----

function listServers() {
  return read('servers.json', []);
}

function saveServers(list) {
  write('servers.json', list);
}

function addServer({ name, address }) {
  const url = normalize(address);
  if (!url) return { error: "That address doesn't look right. Try 192.168.1.50:8080 or https://myserver:3001" };
  const server = {
    id: crypto.randomUUID(),
    name: (name || '').trim() || new URL(url).hostname,
    address: address.trim(),
    lastConnected: null,
  };
  saveServers([...listServers(), server]);
  return server;
}

function updateServer(changes) {
  const list = listServers();
  const i = list.findIndex((s) => s.id === changes.id);
  if (i < 0) return { error: 'Server not found' };
  const next = { ...list[i], ...changes };
  const url = normalize(next.address);
  if (!url) return { error: "That address doesn't look right. Try 192.168.1.50:8080 or https://myserver:3001" };
  next.address = next.address.trim();
  next.name = (next.name || '').trim() || new URL(url).hostname;
  list[i] = next;
  saveServers(list);
  return next;
}

function removeServer(id) {
  saveServers(listServers().filter((s) => s.id !== id));
}

function getServer(id) {
  return listServers().find((s) => s.id === id) || null;
}

// ---- Settings (trusted certs, pending connect after restart) ----

function getSettings() {
  return read('settings.json', { trustedCerts: {} });
}

function setSettings(s) {
  write('settings.json', s);
}

function isTrusted(key, fingerprint) {
  return getSettings().trustedCerts?.[key] === fingerprint;
}

function trust(key, fingerprint) {
  const s = getSettings();
  s.trustedCerts = { ...(s.trustedCerts || {}), [key]: fingerprint };
  setSettings(s);
}

// ---- App lock (password stored as a salted scrypt hash) ----

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function getLock() {
  return getSettings().lock || { enabled: false };
}

function setLock(lock) {
  setSettings({ ...getSettings(), lock });
}

function verifyPassword(password) {
  const l = getLock();
  if (!l.hash || !l.salt) return false;
  const got = crypto.scryptSync(String(password || ''), l.salt, 64);
  const expected = Buffer.from(String(l.hash), 'hex');
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}

function verifyLock(user, password) {
  const l = getLock();
  const userOk = !l.user || String(user || '').trim().toLowerCase() === l.user.toLowerCase();
  const passOk = verifyPassword(password); // always run, so timing doesn't reveal the username
  return userOk && passOk;
}

// ---- Logins (encrypted with the macOS Keychain via safeStorage) ----

function getCredential(key) {
  const all = read('logins.json', {});
  if (!all[key] || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return JSON.parse(safeStorage.decryptString(Buffer.from(all[key], 'base64')));
  } catch {
    return null;
  }
}

function saveCredential(key, user, pass) {
  if (!safeStorage.isEncryptionAvailable()) return;
  const all = read('logins.json', {});
  all[key] = safeStorage.encryptString(JSON.stringify({ user, pass })).toString('base64');
  write('logins.json', all);
}

function deleteCredential(key) {
  const all = read('logins.json', {});
  if (!(key in all)) return;
  delete all[key];
  write('logins.json', all);
}

module.exports = {
  normalize, hostKey,
  listServers, addServer, updateServer, removeServer, getServer,
  getSettings, setSettings, isTrusted, trust,
  hashPassword, getLock, setLock, verifyPassword, verifyLock,
  getCredential, saveCredential, deleteCredential,
};
