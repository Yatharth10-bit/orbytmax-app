function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('orbytmax-theme', theme); } catch (_) {}
}
let saved;
try { saved = localStorage.getItem('orbytmax-theme'); } catch (_) {}
setTheme(saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
document.getElementById('theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});
