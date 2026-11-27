const grid = document.getElementById('grid');
const quickProtocol = document.getElementById('quickProtocol');
const address = document.getElementById('address');
const editor = document.getElementById('editor');
const editName = document.getElementById('editName');
const editProtocol = document.getElementById('editProtocol');
const editAddress = document.getElementById('editAddress');
const editError = document.getElementById('editError');
const editPreviewThumb = document.getElementById('editPreviewThumb');
const editPreviewLabel = document.getElementById('editPreviewLabel');
const editColors = document.getElementById('editColors');
const editCustomColor = document.getElementById('editCustomColor');
const editCustomLabel = editCustomColor.closest('.color-custom');
const editIconSearch = document.getElementById('editIconSearch');
const editIconCount = document.getElementById('editIconCount');
const editIconGrid = document.getElementById('editIconGrid');

let servers = [];
let selectedId = null;
let editingId = null;
let draggedId = null;
let selectedIcon = window.DashIcons.DEFAULT_ICON;
let selectedColor = '';
const status = {}; // id -> true / false (missing = checking)
let openIds = [];  // servers with a connection open right now
let ts = { enabled: false, running: false, peers: [] };

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

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

function moveServer(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const fromIdx = servers.findIndex((s) => s.id === fromId);
  const toIdx = servers.findIndex((s) => s.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = servers.splice(fromIdx, 1);
  servers.splice(toIdx, 0, moved);
  render();
  window.api.reorder(servers.map((s) => s.id));
}

function clearDragState() {
  draggedId = null;
  for (const t of grid.querySelectorAll('.tile.dragging, .tile.drag-over')) {
    t.classList.remove('dragging', 'drag-over');
  }
}

function render() {
  grid.textContent = '';
  for (const s of servers) {
    const isOpen = openIds.includes(s.id);
    const tile = el('div', 'tile' + (s.id === selectedId ? ' selected' : '') + (isOpen ? ' open' : ''));
    tile.tabIndex = 0;
    tile.dataset.id = s.id;
    tile.draggable = true;
    const thumb = el('div', 'thumb', window.DashIcons.iconSvg(s.icon, 1.6));
    thumb.style.background = window.DashIcons.resolveColor(s.color, s.id);
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
    tile.addEventListener('dragstart', (e) => {
      draggedId = s.id;
      tile.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', s.id);
      }
    });
    tile.addEventListener('dragover', (e) => {
      if (!draggedId || draggedId === s.id) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      tile.classList.add('drag-over');
    });
    tile.addEventListener('dragleave', () => {
      tile.classList.remove('drag-over');
    });
    tile.addEventListener('drop', (e) => {
      e.preventDefault();
      tile.classList.remove('drag-over');
      const fromId = draggedId || e.dataTransfer?.getData('text/plain');
      clearDragState();
      moveServer(fromId, s.id);
    });
    tile.addEventListener('dragend', clearDragState);
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

function splitAddress(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(https?:\/\/)(.*)$/i);
  if (m) return { protocol: m[1].toLowerCase(), host: m[2] };
  return { protocol: 'http://', host: s };
}

function syncProtocolInput(selectEl, inputEl) {
  const m = inputEl.value.match(/^\s*(https?:\/\/)(.*)$/i);
  if (m) {
    selectEl.value = m[1].toLowerCase();
    inputEl.value = m[2];
  }
}

address.addEventListener('input', () => syncProtocolInput(quickProtocol, address));
editAddress.addEventListener('input', () => syncProtocolInput(editProtocol, editAddress));

document.getElementById('quick').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = address.value.trim();
  if (!value) return;
  const full = /^https?:\/\//i.test(value) ? value : `${quickProtocol.value}${value}`;
  const r = await window.api.quickConnect(full);
  if (r && r.error) {
    address.classList.remove('shake');
    void address.offsetWidth;
    address.classList.add('shake');
    return;
  }
  address.value = '';
});

// ---- Add / edit dialog ----

function renderColorSwatches() {
  for (const existing of editColors.querySelectorAll('.swatch:not(.auto)')) existing.remove();
  for (const color of window.DashIcons.PALETTE) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.color = color;
    btn.title = color;
    btn.style.background = color;
    editColors.insertBefore(btn, editCustomLabel);
  }
  editColors.addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    selectedColor = btn.dataset.color || '';
    updateColorSelection();
    updatePreview();
  });
}

function updateColorSelection() {
  const norm = window.DashIcons.normalizeColor(selectedColor);
  let matchedPreset = false;
  for (const btn of editColors.querySelectorAll('.swatch')) {
    const isMatch = (btn.dataset.color || '') === norm;
    btn.classList.toggle('selected', isMatch);
    if (isMatch && norm) matchedPreset = true;
  }
  editCustomLabel.classList.toggle('selected', !!norm && !matchedPreset);
  editCustomColor.value = norm || window.DashIcons.resolveColor('', editingId || 'new');
}

function updatePreview() {
  const iconId = window.DashIcons.resolveIcon(selectedIcon);
  const color = window.DashIcons.resolveColor(selectedColor, editingId || 'new');
  editPreviewThumb.style.background = color;
  editPreviewThumb.innerHTML = window.DashIcons.iconSvg(iconId, 1.75);
  const entry = window.DashIcons.ICON_MAP[iconId];
  editPreviewLabel.textContent = `${entry ? entry.label : iconId}  ·  ${selectedColor ? selectedColor.toUpperCase() : 'Auto color'}`;
}

const ICON_PAGE_SIZE = 120;
let filteredIcons = window.DashIcons.ICONS;
let renderedIconCount = 0;

function appendIconBatch() {
  const existingMore = editIconGrid.querySelector('.icon-more');
  if (existingMore) existingMore.remove();
  const nextEnd = Math.min(renderedIconCount + ICON_PAGE_SIZE, filteredIcons.length);
  const frag = document.createDocumentFragment();
  for (let i = renderedIconCount; i < nextEnd; i++) {
    const ic = filteredIcons[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn' + (ic.id === selectedIcon ? ' selected' : '');
    btn.dataset.icon = ic.id;
    btn.title = `${ic.label} (${ic.id})`;
    btn.setAttribute('aria-label', ic.label);
    btn.setAttribute('aria-selected', ic.id === selectedIcon ? 'true' : 'false');
    btn.innerHTML = window.DashIcons.iconSvg(ic.id, 1.75);
    frag.append(btn);
  }
  renderedIconCount = nextEnd;
  if (renderedIconCount < filteredIcons.length) {
    const remaining = filteredIcons.length - renderedIconCount;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'icon-more';
    more.textContent = `Show more (${remaining.toLocaleString()} remaining)`;
    more.addEventListener('click', appendIconBatch);
    frag.append(more);
  }
  editIconGrid.append(frag);
}

function renderIconGrid(filter = '') {
  const q = String(filter || '').trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  let matches;
  if (terms.length) {
    matches = window.DashIcons.ICONS.filter((ic) => {
      const hay = ic.search || `${ic.id} ${ic.label} ${ic.tags}`.toLowerCase();
      for (const term of terms) {
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  } else {
    matches = window.DashIcons.ICONS;
    const sel = window.DashIcons.ICON_MAP[selectedIcon];
    if (sel) {
      const idx = matches.indexOf(sel);
      if (idx >= ICON_PAGE_SIZE) {
        matches = [sel, ...matches.slice(0, idx), ...matches.slice(idx + 1)];
      }
    }
  }
  filteredIcons = matches;
  renderedIconCount = 0;
  editIconGrid.textContent = '';
  editIconGrid.scrollTop = 0;
  if (editIconCount) {
    const total = window.DashIcons.ICONS.length.toLocaleString();
    editIconCount.textContent = q
      ? `${matches.length.toLocaleString()} of ${total}`
      : `${total} icons`;
  }
  if (!matches.length) {
    const empty = el('div', 'icon-empty');
    empty.textContent = 'No matching Tabler icons';
    editIconGrid.append(empty);
    return;
  }
  appendIconBatch();
}

renderColorSwatches();
editIconGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.icon-btn');
  if (!btn) return;
  selectedIcon = btn.dataset.icon;
  for (const b of editIconGrid.querySelectorAll('.icon-btn')) {
    const active = b.dataset.icon === selectedIcon;
    b.classList.toggle('selected', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  updatePreview();
});
editIconGrid.addEventListener('scroll', () => {
  if (renderedIconCount >= filteredIcons.length) return;
  if (editIconGrid.scrollTop + editIconGrid.clientHeight >= editIconGrid.scrollHeight - 80) {
    appendIconBatch();
  }
});
editCustomColor.addEventListener('input', () => {
  selectedColor = window.DashIcons.normalizeColor(editCustomColor.value);
  updateColorSelection();
  updatePreview();
});
editIconSearch.addEventListener('input', () => renderIconGrid(editIconSearch.value));
editIconSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

function openEditor(id, preset) {
  editingId = id;
  const s = servers.find((x) => x.id === id);
  document.getElementById('editTitle').textContent = s ? 'Edit Server' : 'Add Server';
  editName.value = s ? s.name : preset?.name || '';
  const { protocol, host } = splitAddress(s ? s.address : preset?.address || '');
  editProtocol.value = (!s && preset?.protocol) || protocol;
  editAddress.value = host;
  selectedIcon = window.DashIcons.resolveIcon(s ? s.icon : preset?.icon);
  selectedColor = window.DashIcons.normalizeColor(s ? s.color : preset?.color);
  editIconSearch.value = '';
  updateColorSelection();
  renderIconGrid();
  updatePreview();
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
  const rawAddr = editAddress.value.trim();
  const fullAddr = rawAddr ? (/^https?:\/\//i.test(rawAddr) ? rawAddr : `${editProtocol.value}${rawAddr}`) : '';
  const data = { name: editName.value, address: fullAddr, icon: selectedIcon, color: selectedColor };
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
window.api.onAdd(() => openEditor(null));
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
  tsPill.title = ts.error || (ts.running && ts.self ? `This device on Tailscale: ${ts.self.name} (${ts.self.ip})` : '');

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
      hint: 'Choose http:// or https:// and type the Selkies port after the colon, e.g. 3001 (https) or 8080.',
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
