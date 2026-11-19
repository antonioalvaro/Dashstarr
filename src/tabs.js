const PALETTE = ['#0a84ff', '#bf5af2', '#40c8e0', '#ff9f0a', '#ff375f', '#30d158', '#5e5ce6', '#ff453a'];
function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const strip = document.getElementById('tabs');
const home = document.getElementById('home');
home.addEventListener('click', () => window.tabsApi.home());

let lastState = '';

window.tabsApi.onTabs(({ tabs, active }) => {
  home.classList.toggle('on', !active);
  // Only rebuild when something changed, so a click in progress isn't interrupted.
  const state = JSON.stringify({ tabs, active });
  if (state === lastState) return;
  lastState = state;
  strip.textContent = '';
  for (const t of tabs) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (t.id === active ? ' active' : '');
    tab.title = t.name;
    const mark = document.createElement('span');
    if (t.loading) {
      mark.className = 'spin';
    } else {
      mark.className = 'chip';
      mark.style.background = colorFor(t.id);
    }
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = t.name;
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Close connection';
    // Close on press, before anything else can redraw the tab.
    x.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (e.button === 0) window.tabsApi.close(t.id);
    });
    tab.append(mark, name, x);
    tab.addEventListener('mousedown', (e) => {
      if (e.button === 1) window.tabsApi.close(t.id); // middle click
      else if (e.button === 0) window.tabsApi.activate(t.id);
    });
    strip.append(tab);
  }
});
