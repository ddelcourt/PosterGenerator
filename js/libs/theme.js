// ============ THEME ============
// Restores the saved theme and wires up the toggle button.
(function() {
  const btn  = document.getElementById('themeToggle');
  const body = document.querySelector('body');

  const apply = theme => {
    body.setAttribute('data-appearance', theme);
    btn.textContent = theme === 'dark' ? '🌙 Dark' : '☀️ Light';
    localStorage.setItem('theme', theme);
  };

  apply(localStorage.getItem('theme') || 'light');

  btn.addEventListener('click', () => {
    apply(body.getAttribute('data-appearance') === 'dark' ? 'light' : 'dark');
  });
})();
