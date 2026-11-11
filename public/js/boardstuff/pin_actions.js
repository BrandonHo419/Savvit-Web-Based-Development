import { apiFetch } from '../api.js';
import { canDeleteOriginal } from './reference_removal.js';
const sessions = new WeakMap();

export function setupPinActions(modal, pin, state, onMoved) {
  const select = modal.querySelector('#boardSelect');
  const save = modal.querySelector('.save-btn');
  const move = modal.querySelector('#move-pin');
  const retry = modal.querySelector('#boards-retry');
  const status = modal.querySelector('#save-status');
  const origin = modal.querySelector('#original-board');
  const session = {};
  sessions.set(modal, session);
  const current = () => sessions.get(modal) === session && modal.dataset.pinId === String(pin.id);
  let busy = false;
  let sequence = 0;
  const owner = canDeleteOriginal(pin, state);
  move.hidden = !owner;
  origin.href = `/board.html?board_id=${encodeURIComponent(pin.board_id)}`;
  origin.textContent = Number(pin.board_id) === Number(state.activeBoardId) ? 'Original pin on this board' : 'Saved reference — open original board';

  async function loadBoards() {
    const request = ++sequence;
    select.disabled = save.disabled = move.disabled = true;
    select.replaceChildren();
    retry.hidden = true;
    status.textContent = 'Loading your destination boards…';
    try {
      const response = await apiFetch(`/boards/users/${state.userId}/boards`);
      if (!response.ok) throw new Error();
      const boards = await response.json();
      if (!current() || request !== sequence) return;
      for (const board of boards.filter(b => Number(b.board_id) !== Number(pin.board_id))) {
        const option = document.createElement('option');
        option.value = board.board_id;
        option.textContent = `${board.name || 'Untitled board'} (${board.visibility})`;
        select.appendChild(option);
      }
      const empty = !select.options.length;
      select.disabled = save.disabled = move.disabled = empty;
      status.textContent = empty ? 'Create another board on Home to save or move this pin.' : '';
    } catch {
      if (!current() || request !== sequence) return;
      status.textContent = 'Unable to load your boards. Please retry.';
      retry.hidden = false;
    }
  }
  async function submit(moving) {
    if (busy || !current() || select.disabled || !select.value || (moving && !owner)) return;
    const boardId = select.value;
    if (moving && !window.confirm('Move this original pin to the selected board? Its visibility and viewer access will follow that board. Saved references remain, but some viewers may lose access. Any existing reference on the old board remains.')) return;
    busy = true;
    select.disabled = save.disabled = move.disabled = true;
    status.textContent = moving ? 'Moving original…' : 'Saving reference…';
    try {
      const response = await apiFetch(`/pins/${encodeURIComponent(pin.id)}/${moving ? 'move' : 'save'}`, {
        method: moving ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: boardId })
      });
      if (!response.ok) throw new Error();
      if (!current()) return;
      if (moving) onMoved();
      else status.textContent = 'Reference saved. The original stays on its board. Saving again does not create a duplicate.';
    } catch {
      if (current()) status.textContent = moving ? 'Unable to move the original. Please retry.' : 'Unable to save the reference. Please retry.';
    } finally {
      busy = false;
      if (current()) select.disabled = save.disabled = move.disabled = false;
    }
  }
  save.onclick = () => submit(false);
  move.onclick = () => submit(true);
  retry.onclick = loadBoards;
  loadBoards();
}
