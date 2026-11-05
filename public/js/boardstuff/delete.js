import { apiFetch } from '../api.js';

/**
 * Delete a pin by ID
 * @param {string} pinId - The ID of the pin to delete
 * @param {Function} onSuccess - Optional callback to run after successful deletion
 */
export async function deletePin(pinId, onSuccess) {
  try {
    const res = await apiFetch(`/pins/${pinId}`, {
      method: 'DELETE'
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
  if (!window.confirm('Delete this board and its saved references? Original pins on other boards remain unchanged. Boards containing original pins cannot be deleted. This cannot be undone.')) return false;
  const res = await apiFetch(`/boards/${encodeURIComponent(boardId)}`, { method: 'DELETE' });
  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    throw new Error(result.error || 'Unable to delete board. Please try again.');
  }
  onSuccess?.();
  return true;
}
