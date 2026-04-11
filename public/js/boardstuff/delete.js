import { loadPinsForBoard } from './board.js';
import { state } from './state.js';

/**
 * Delete a pin by ID
 * @param {string} pinId - The ID of the pin to delete
 * @param {Function} onSuccess - Optional callback to run after successful deletion
 */
export async function deletePin(pinId, onSuccess) {
  try {
    const res = await fetch(`/pins/${pinId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: state.userId })
    });

    let responseBody;
    try {
      responseBody = await res.clone().json(); // clone() allows us to parse again if needed
    } catch (e) {
      responseBody = await res.text();
    }

    if (!res.ok) {
      const message = typeof responseBody === 'string'
        ? responseBody
        : responseBody?.error || 'Deletion failed.';
      throw new Error(message);
    }

    alert('Pin deleted.');
    onSuccess?.();

  } catch (err) {
    console.error('Pin deletion error:', err);
    alert('Failed to delete pin: ' + err.message);
  }
}

/**
 * Delete a board by ID
 * @param {string} boardId - The ID of the board to delete
 * @param {Function} onSuccess - Optional callback to run after successful deletion
 */
export async function deleteBoard(boardId, onSuccess = null) {
  if (!confirm('Are you sure you want to delete this board? All its pins will be lost.')) return;

  try {
    const res = await fetch(`/boards/${boardId}`, { method: 'DELETE' });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to delete board.');
    }

    // Optional DOM cleanup if necessary
    document.querySelector(`#board_select option[value="${boardId}"]`)?.remove();

    if (state.activeBoardId === boardId) {
      state.activeBoardId = null;
      document.querySelector('.pin_container').innerHTML = '';
    }

    if (typeof onSuccess === 'function') onSuccess();

    alert('Board deleted.');
  } catch (err) {
    console.error('Board deletion error:', err);
    alert('Could not delete board.');
  }
}
