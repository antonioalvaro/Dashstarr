const password = document.getElementById('password');
const confirmInput = document.getElementById('confirm');
const touchRow = document.getElementById('touchRow');
const touch = document.getElementById('touch');
const err = document.getElementById('err');
const go = document.getElementById('go');

window.quickLock.info().then((info) => {
  if (info.touchIdAvailable) {
    touchRow.hidden = false;
    touch.checked = true;
  }
  password.focus();
});

document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  err.textContent = '';
  go.disabled = true;
  const r = await window.quickLock.submit({
    password: password.value,
    confirm: confirmInput.value,
    touchId: touch.checked,
  });
  go.disabled = false;
  if (r && r.error) {
    err.textContent = r.error;
    password.focus();
  }
});

document.getElementById('cancel').addEventListener('click', () => window.quickLock.cancel());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.quickLock.cancel(); });
