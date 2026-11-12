/**
 * Theme Management
 * Handles light/dark mode switching and persistence
 */

const Theme = (() => {
  const THEME_KEY = 'theme';
  const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
  };

  const init = () => {
    const saved = localStorage.getItem(THEME_KEY) || THEMES.LIGHT;
    set(saved);
  };

  const set = (theme) => {
    const body = document.querySelector('body');
    const isValid = Object.values(THEMES).includes(theme);
    theme = isValid ? theme : THEMES.LIGHT;
    
    body.setAttribute('data-appearance', theme);
    localStorage.setItem(THEME_KEY, theme);
    
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = theme === THEMES.DARK ? '☀️ Light' : '🌙 Dark';
    }
  };

  const toggle = () => {
    const body = document.querySelector('body');
    const current = body.getAttribute('data-appearance') || THEMES.LIGHT;
    const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    set(next);
  };

  const get = () => {
    return document.querySelector('body').getAttribute('data-appearance') || THEMES.LIGHT;
  };

  return {
    init,
    set,
    toggle,
    get,
    THEMES
  };
})();
