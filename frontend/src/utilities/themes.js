import { THEME_KEY } from '../constants';

export const getDarkTheme = () => {
  // check local storage and browser theme for a preference
  const local_theme = localStorage.getItem(THEME_KEY);
  if (local_theme) {
    return local_theme === 'dark';
  } else {
    let browser_preference = window.matchMedia('(prefers-color-scheme: dark)');
    return Boolean(browser_preference.matches);
  }
};

export const setDocumentDarkTheme = (theme = null) => {
  // Sets light theme on false, dark theme on true
  let set_dark = theme !== null ? theme : getDarkTheme();

  localStorage.setItem('theme', set_dark ? 'dark' : 'light');
  if (set_dark) {
    document.firstElementChild.classList.add('pf-v6-theme-dark');
  } else {
    document.firstElementChild.classList.remove('pf-v6-theme-dark');
  }
};
