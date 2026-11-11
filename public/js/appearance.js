(() => {
  const key = 'savvit-appearance-v1';
  const allowed = { theme: ['system', 'light', 'dark'], density: ['comfortable', 'compact'], textSize: ['standard', 'large'], motion: ['system', 'reduce'] };
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* Storage can be unavailable in private browsing. */ }
  if (typeof preferences !== 'object' || Array.isArray(preferences)) preferences = {};
  for (const [name, values] of Object.entries(allowed)) {
    if (!values.includes(preferences[name])) preferences[name] = values[0];
    document.documentElement.dataset[name] = preferences[name];
  }
  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main');
    if (!main) return;
    main.id ||= 'main-content';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'skip-link'; skip.href = `#${main.id}`; skip.textContent = 'Skip to content';
    document.body.prepend(skip);
    const appearance = document.createElement('details');
    appearance.className = 'appearance';
    const summary = document.createElement('summary'); summary.textContent = 'Appearance';
    const controls = document.createElement('div'); controls.className = 'appearance-controls';
    const labels = { theme: 'Theme', density: 'Content spacing', textSize: 'Text size', motion: 'Animations' };
    for (const [name, values] of Object.entries(allowed)) {
      const label = document.createElement('label'); label.textContent = labels[name];
      const select = document.createElement('select');
      for (const value of values) {
        const option = document.createElement('option'); option.value = value;
        option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
        select.append(option);
      }
      select.value = preferences[name];
      select.addEventListener('change', () => {
        preferences[name] = select.value;
        document.documentElement.dataset[name] = select.value;
        try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Keep the setting for this page even if storage is blocked. */ }
      });
      label.append(select); controls.append(label);
    }
    appearance.append(summary, controls); main.prepend(appearance);
    const top = document.createElement('a');
    top.className = 'back-to-top'; top.href = `#${main.id}`; top.textContent = 'Back to top ↑';
    main.append(top);
  });
})();
