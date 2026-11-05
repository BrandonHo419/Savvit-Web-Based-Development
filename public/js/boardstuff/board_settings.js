import { apiFetch } from '../api.js';

export function setupBoardSettings(board) {
  const panel = document.getElementById('board-settings');
  if (!panel || !board.is_owner) return;
  const form = document.getElementById('board-settings-form');
  const name = document.getElementById('board-name');
  const description = document.getElementById('board-description');
  const visibility = document.getElementById('board-visibility');
  const status = document.getElementById('board-settings-status');
  const controls = Array.from(form.elements);
  let saved = { name: board.name || '', description: board.description || '', visibility: board.visibility };
  let saving = false;

  function restore() {
    name.value = saved.name;
    description.value = saved.description;
    visibility.value = saved.visibility;
  }
  restore();
  panel.hidden = false;
  form.addEventListener('reset', event => {
    event.preventDefault();
    if (saving) return;
    restore();
    status.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const values = { name: name.value.trim(), description: description.value.trim(), visibility: visibility.value };
    if (!values.name) {
      status.textContent = 'Enter a board name.';
      name.focus();
      return;
    }
    // Send only edited fields so another tab's unrelated settings are preserved.
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== saved[key]));
    if (!Object.keys(changes).length) {
      status.textContent = 'No changes to save.';
      return;
    }
    if (changes.visibility === 'public' && !window.confirm('Make this board and its original pins visible to other signed-in users?')) return;
    saving = true;
    controls.forEach(control => { control.disabled = true; });
    status.textContent = 'Saving…';
    try {
      const response = await apiFetch(`/boards/${board.board_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes)
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Unable to save settings. Please reload and try again.');
      }
      saved = values;
      restore();
      document.getElementById('welcome-title').textContent = saved.name;
      document.getElementById('welcome-subtitle').textContent = saved.description || `${saved.visibility} board`;
      for (const id of ['board_select', 'board_id']) {
        const select = document.getElementById(id);
        for (const option of select?.options || []) {
          if (String(option.value) === String(board.board_id)) option.textContent = saved.name;
        }
      }
      status.textContent = 'Board settings saved.';
    } catch (error) {
      status.textContent = error.message || 'Unable to save settings. Please try again.';
    } finally {
      saving = false;
      controls.forEach(control => { control.disabled = false; });
    }
  });
}
