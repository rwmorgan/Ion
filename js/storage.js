// ===== ION — localStorage persistence =====
const Store = (() => {
  const KEY = 'ion_designs_v1';
  const SETTINGS = 'ion_settings_v1';

  function loadDesigns() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveDesigns(designs) {
    try { localStorage.setItem(KEY, JSON.stringify(designs)); } catch (e) {}
  }
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS)) || {}; } catch (e) { return {}; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch (e) {}
  }
  return { loadDesigns, saveDesigns, loadSettings, saveSettings };
})();
