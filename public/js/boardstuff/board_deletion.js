import { deleteBoard } from './delete.js';

export function setupBoardDeletion(board) {
  const button = document.getElementById('delete-board');
  const status = document.getElementById('delete-board-status');
  if (!button || !board.is_owner) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '';
    try {
      if (await deleteBoard(board.board_id)) window.location.assign('/home.html');
    } catch (error) {
      status.textContent = error.message || 'Unable to delete board. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}
