const user = document.getElementById('user');
const pass = document.getElementById('pass');
const err = document.getElementById('err');
const go = document.getElementById('go');
const touch = document.getElementById('touch');

async function tryTouchId() {
  const r = await window.lock.touchId();
  if (!r.ok) pass.focus();
}

window.lock.info().then((info) => {
  user.hidden = !info.needUser;
  document.getElementById('sub').textContent = info.needUser
    ? 'Enter your username and password to continue.'
    : 'Enter your password to continue.';
  (info.needUser ? user : pass).focus();
  if (info.touchId) {
    touch.hidden = false;
    touch.addEventListener('click', tryTouchId);
    tryTouchId();
  }
});

document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  go.disabled = true;
  const r = await window.lock.unlock(user.value, pass.value);
  go.disabled = false;
  if (r.ok) return;
  err.textContent = r.error || '';
  pass.value = '';
  const fields = document.getElementById('fields');
  fields.classList.remove('shake');
  void fields.offsetWidth;
  fields.classList.add('shake');
  pass.focus();
});
