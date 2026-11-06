import { apiFetch } from '../api.js';

export async function setupBoardSharing(board) {
  const panel = document.getElementById('board-sharing');
  if (!panel || !board.is_owner) return;
  panel.hidden = false;
  const form = document.getElementById('board-sharing-form');
  const username = document.getElementById('viewer-username');
  const list = document.getElementById('board-viewers');
  const status = document.getElementById('sharing-status');
  const reload = document.getElementById('reload-viewers');
  const add = document.getElementById('add-viewer');
  const url = `/boards/${encodeURIComponent(board.board_id)}/viewers`;
  let busy = false;

  async function request(path, options) {
    const response = await apiFetch(path, options);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Unable to update viewers. Please reload and try again.');
    }
    return response;
  }

  async function load() {
    const response = await request(url);
    const { viewers } = await response.json();
    list.replaceChildren();
    for (const viewer of viewers) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = viewer.username;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Revoke access';
      remove.setAttribute('aria-label', `Revoke access for ${viewer.username}`);
      remove.addEventListener('click', () => run(async () => {
        if (!window.confirm(`Revoke viewing access for ${viewer.username}?`)) return;
        await request(`${url}/${encodeURIComponent(viewer.user_id)}`, { method: 'DELETE' });
        await load();
        status.textContent = 'Viewer grant revoked. Public visibility still permits signed-in access.';
      }));
      item.append(label, remove);
      list.appendChild(item);
    }
    status.textContent = viewers.length ? '' : 'No viewers have been granted access.';
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    add.disabled = reload.disabled = username.disabled = true;
    status.textContent = '';
    try { await action(); }
    catch (error) { status.textContent = error.message || 'Unable to load viewers. Please retry.'; }
    finally {
      busy = false;
      add.disabled = reload.disabled = username.disabled = false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    return run(async () => {
      if (!username.value.trim()) { status.textContent = 'Enter an exact username.'; return; }
      await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.value.trim() }) });
      username.value = '';
      await load();
      status.textContent = 'Viewer granted. Set visibility to Semi-private and share this board URL.';
    });
  });
  reload.addEventListener('click', () => run(load));
  await run(load);
}
