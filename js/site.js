// Theme switcher — vanilla JS replacement for the Claude Design prototype's
// React-based DCLogic component. Persists to localStorage('rn-theme').
// The default for first-time visitors is time-of-day based, computed by the
// inline <head> script before first paint; init() must inherit it, not recompute.
(function () {
  var STORAGE_KEY = 'rn-theme';

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('.tdot').forEach(function (btn) {
      btn.classList.toggle('on', btn.dataset.themeBtn === theme);
    });
  }

  function init() {
    var current = localStorage.getItem(STORAGE_KEY) || document.documentElement.dataset.theme || 'night';
    applyTheme(current);

    document.querySelectorAll('.tdot').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var theme = btn.dataset.themeBtn;
        localStorage.setItem(STORAGE_KEY, theme);
        applyTheme(theme);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
