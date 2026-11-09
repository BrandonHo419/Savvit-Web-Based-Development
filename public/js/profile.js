import { getSession } from './api.js';

const status = document.getElementById('profile-status');
const retry = document.getElementById('profile-retry');
let loading = false;
async function loadProfile() {
    if (loading) return;
    loading = true;
    retry.hidden = true;
    status.textContent = 'Loading your account…';
    try {
        const session = await getSession({ refresh: true });
        if (!session) { window.location.replace('/login.html'); return; }
        document.getElementById('username').textContent = session.username;
        document.getElementById('email').textContent = session.email;
        document.getElementById('profile-details').hidden = false;
        status.textContent = '';
    } catch {
        status.textContent = 'Unable to load your account. Please try again.';
        retry.hidden = false;
    } finally { loading = false; }
}
retry.addEventListener('click', loadProfile);
loadProfile();
