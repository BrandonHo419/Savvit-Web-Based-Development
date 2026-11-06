import { getSession, apiFetch } from './api.js';

export function setupLogout() {
  const button = document.getElementById('confirm-logout');
  const status = document.getElementById('logout-status');
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Logging out…';
    try {
      const session = await getSession();
      if (session) {
        const response = await apiFetch('/users/logout', { method: 'POST' });
        if (!response.ok && response.status !== 401) throw new Error('Unable to log out. Please reload and try again.');
      }
      window.location.replace('/landingpage.html');
    } catch (error) {
      status.textContent = error.message || 'Unable to log out. Please try again.';
      button.disabled = false;
    }
  });
}
setupLogout();
