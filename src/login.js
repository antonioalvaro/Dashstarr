const q = new URLSearchParams(location.search);
const user = document.getElementById('user');
const pass = document.getElementById('pass');

document.getElementById('title').textContent = q.get('failed')
  ? 'Wrong username or password'
  : `Log in to ${q.get('name') || q.get('host')}`;
if (q.get('failed')) document.getElementById('head').classList.add('failed');
document.getElementById('sub').textContent = q.get('realm') ? `${q.get('host')}  ·  ${q.get('realm')}` : q.get('host');
document.getElementById('warn').hidden = !q.get('insecure');
user.value = q.get('user') || '';
(user.value ? pass : user).focus();

document.getElementById('f').addEventListener('submit', (e) => {
  e.preventDefault();
  window.login.submit(user.value, pass.value, document.getElementById('remember').checked);
});
document.getElementById('cancel').addEventListener('click', () => window.login.cancel());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.login.cancel(); });
