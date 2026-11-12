import { apiFetch, getSession } from './api.js';

export function setupSiteManagement(session, refreshUsers) {
  const ownerPanel = document.getElementById('owner-controls');
  ownerPanel.hidden = session.role !== 'owner';
  const stats = document.getElementById('site-statistics');
  const refresh = document.getElementById('refresh-statistics');
  let loading = false;
  async function loadStats() {
    if (loading) return;
    loading = refresh.disabled = true;
    stats.textContent = 'Loading site statistics…';
    try {
      const response = await apiFetch('/users/admin/summary');
      if (!response.ok) throw new Error();
      const summary = await response.json();
      stats.textContent = `${summary.accounts} accounts · ${summary.boards} boards · ${summary.originals} original pins · ${summary.saved_references} saved references · ${summary.comments} comments · ${summary.replies} replies`;
    } catch { stats.textContent = 'Unable to load site statistics. Please refresh to retry.'; }
    finally { loading = refresh.disabled = false; }
  }
  refresh.addEventListener('click', loadStats);
  loadStats();
  if (session.role !== 'owner') return;
  const form = document.getElementById('account-access-form');
  const status = document.getElementById('account-access-status');
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const id = document.getElementById('account-id').value;
    const role = document.getElementById('account-role').value;
    const title = document.getElementById('account-title').value || null;
    if (!window.confirm('Apply this role and title? Admin access allows viewing account information and managing regular users.')) return;
    pending = true;
    for (const field of form.elements) field.disabled = true;
    status.textContent = 'Updating account…';
    try {
      const current = await getSession({ refresh: true });
      if (current?.role !== 'owner') throw new Error();
      const response = await apiFetch(`/users/admin/accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, team_title: title })
      });
      if (!response.ok) throw new Error();
      status.textContent = 'Role and title updated.';
      refreshUsers();
    } catch { status.textContent = 'Unable to update this account. Check the ID and your owner access, then retry.'; }
    finally {
      pending = false;
      for (const field of form.elements) field.disabled = false;
    }
  });
}
