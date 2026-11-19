const $ = (id) => document.getElementById(id);
let wasEnabled = false;

function refresh() {
  $('opts').hidden = !$('enabled').checked;
  $('currentBox').hidden = !wasEnabled;
  $('lockNow').hidden = !wasEnabled;
  $('pwLabel').textContent = wasEnabled ? 'New password (leave empty to keep the current one)' : 'Password';
}

async function load() {
  const s = await window.settings.get();
  wasEnabled = s.lock.enabled;
  $('enabled').checked = s.lock.enabled;
  $('user').value = s.lock.user;
  $('timeout').value = String(s.lock.timeoutMin);
  if (!$('timeout').value) $('timeout').value = '0';
  $('sleep').checked = s.lock.lockOnSleep;
  $('touchRow').hidden = !s.touchIdAvailable;
  $('touch').checked = s.lock.touchId;
  $('password').value = '';
  $('confirm').value = '';
  $('current').value = '';
  refresh();
}

$('enabled').addEventListener('change', refresh);
$('lockNow').addEventListener('click', () => window.settings.lockNow());

$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await window.settings.saveLock({
    enabled: $('enabled').checked,
    user: $('user').value,
    password: $('password').value,
    confirm: $('confirm').value,
    currentPassword: $('current').value,
    timeoutMin: Number($('timeout').value),
    lockOnSleep: $('sleep').checked,
    touchId: $('touch').checked,
  });
  const msg = $('msg');
  msg.className = 'msg ' + (r.error ? 'error' : 'ok');
  msg.textContent = r.error || r.message || '';
  if (!r.error) load();
});

load();
