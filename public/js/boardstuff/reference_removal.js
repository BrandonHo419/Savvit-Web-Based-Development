import { apiFetch } from '../api.js';

export function canDeleteOriginal(pin, state) {
  return Boolean(state.canEditBoard && pin.board_id
    && Number(pin.user_id) === Number(state.userId)
    && Number(pin.board_id) === Number(state.activeBoardId));
}

export function setupReferenceRemoval(modal, pin, state, onRemoved) {
  const previous = modal.querySelector('#remove-reference');
  const status = modal.querySelector('#reference-status');
  const button = previous.cloneNode(true);
  previous.replaceWith(button);
  status.textContent = '';
  button.disabled = false;
  const boardId = state.activeBoardId;
  button.hidden = !state.canEditBoard || !boardId || !pin.board_id
    || Number(boardId) === Number(pin.board_id);
  if (button.hidden) return;

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    if (!window.confirm('Remove this saved reference from this board? The original pin will remain unchanged.')) return;
    button.disabled = true;
    status.textContent = 'Removing reference…';
    try {
      const response = await apiFetch(`/boards/${encodeURIComponent(boardId)}/pins/${encodeURIComponent(pin.id)}/reference`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Unable to remove this reference. Please try again.');
      // A different pin may have been opened while the request was in flight.
      if (button.isConnected) onRemoved();
    } catch (error) {
      if (button.isConnected) status.textContent = 'Unable to remove this reference. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}
