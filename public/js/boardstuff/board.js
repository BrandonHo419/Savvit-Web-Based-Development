import { setupBoardSettings } from './board_settings.js';
import { apiFetch } from '../api.js';

import { state, onSessionReady } from './state.js';
import { create_pin } from './modal_and_pin_script.js';
import { deleteBoard } from './delete.js';

export function buildImageElement(src, onloadCallback) {
  const img = new Image();
  img.src = src;
  img.onload = onloadCallback;
  img.style.width = '100%';
  img.style.height = 'auto';
  img.style.objectFit = 'cover';
  img.style.display = 'block';
  return img;
}

onSessionReady(async () => {
  const params = new URLSearchParams(window.location.search);
  const boardIdFromURL = params.get('board_id');

  if (boardIdFromURL) {
    state.activeBoardId = boardIdFromURL;
  }

  if (document.getElementById('board-status')) {
    if (!boardIdFromURL) throw new Error('A board ID is required');
    const response = await apiFetch(`/boards/${boardIdFromURL}`);
    if (!response.ok) {
      document.getElementById('welcome-title').textContent = 'Board unavailable';
      document.getElementById('board-status').textContent = 'This board does not exist or you do not have access.';
      return;
    }
    const board = await response.json();
    document.getElementById('welcome-title').textContent = board.name;
    document.getElementById('welcome-subtitle').textContent = board.description || `${board.visibility} board`;
    document.querySelector('.add_pin').style.display = board.is_owner ? 'flex' : 'none';
    state.canEditBoard = board.is_owner;
    setupBoardSettings(board);
  }
  await fetchBoards(boardIdFromURL);

  document.getElementById('board_select').addEventListener('change', (e) => {
    window.location.href = `/board.html?board_id=${encodeURIComponent(e.target.value)}`;
  });

  document.getElementById('create_board_btn').addEventListener('click', () => {
    document.querySelector('.create_board_modal').style.display = 'flex';
  });

  document.getElementById('cancel_board_btn').addEventListener('click', () => {
    document.querySelector('.create_board_modal').style.display = 'none';
    document.getElementById('new_board_name').value = '';
  });

  document.getElementById('submit_board_btn').addEventListener('click', async () => {
    const name = document.getElementById('new_board_name').value.trim();
    if (!name) return alert('Please enter a board name');

    try {
      const res = await apiFetch('/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      const result = await res.json();
      console.log('Board creation response:', result);

      if (res.ok) {
        alert('Board created!');
        document.getElementById('new_board_name').value = '';
        document.querySelector('.create_board_modal').style.display = 'none';

        window.location.href = `/board.html?board_id=${result.board_id}`;
      } else {
        alert('Error creating board: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error during board creation:', err);
      alert('Failed to create board. See console for details.');
    }
  });


  // Upload Link setup
  document.querySelector('.upload_link')?.addEventListener('click', upload_link);
});

function fetchBoards(selectedBoardId = null) {
  return apiFetch(`/boards/users/${state.userId}/boards`)
    .then(res => {
      if (!res.ok) throw new Error('Unable to load board content');
      return res.json();
    })
    .then(boards => {
      const boardModalSelect = document.getElementById('board_id');
      const boardNavSelect = document.getElementById('board_select');

      boardModalSelect.innerHTML = '<option value="" disabled selected>Select Board</option>';
      boardNavSelect.innerHTML = '<option value="" disabled selected>Select Board</option>';

      boards.forEach(board => {
        const option1 = document.createElement('option');
        option1.value = board.board_id;
        option1.textContent = board.name;
        boardModalSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = board.board_id;
        option2.textContent = board.name;
        boardNavSelect.appendChild(option2);
      });

      if (selectedBoardId) {
        boardModalSelect.value = selectedBoardId;
        boardNavSelect.value = selectedBoardId;

        const newOption = boardModalSelect.querySelector(`option[value="${selectedBoardId}"]`);
        if (newOption) newOption.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // ✅ Load pins and show the add pin button
        loadPinsForBoard(selectedBoardId);
        const addPinButton = document.querySelector('.add_pin');
        if (addPinButton) addPinButton.style.display = state.canEditBoard ? 'flex' : 'none';
      }
    })
    .catch(err => console.error('Failed to load boards:', err));
}

export function loadPinsForBoard(boardId) {
  const status = document.getElementById('board-status');
  if (status) status.textContent = 'Loading pins…';
  return apiFetch(`/boards/${boardId}/pins`)
    .then(res => {
      if (!res.ok) throw new Error('Unable to load board content');
      return res.json();
    })
    .then(pins => {
      const container = document.querySelector('.pin_container');
      if (!container) return;
      container.replaceChildren();
      if (status) status.textContent = pins.length ? `${pins.length} visible pins` : 'No visible pins yet. Add an image pin or save one from another board.';

      pins.forEach(pin => {
        state.pinLikes[pin.pin_id] = pin.is_liked === 1;

        create_pin({
          id: pin.pin_id,
          title: pin.title,
          description: pin.description,
          destination: pin.link_url,
          img_blob: pin.image_url,
          board_id: pin.board_id,
          user_id: pin.user_id,
          username: pin.username,
          is_liked: pin.is_liked === 1,
          like_count: pin.like_count || 0
        });
      });
    })
    .catch(err => {
      console.error('Error loading pins for board:', err);
      document.querySelector('.pin_container')?.replaceChildren();
      if (status) status.textContent = 'Unable to load pins. Reload the page to try again.';
    });
}

function upload_link() {
  const popup = document.getElementById('uploadLinkPopup');
  document.getElementById('uploadLinkInput').value = '';
  popup.style.display = 'flex';
  document.getElementById('uploadLinkInput').focus();
}

document.getElementById('closeUploadPopup').addEventListener('click', () => {
  document.getElementById('uploadLinkPopup').style.display = 'none';
});

// document.querySelectorAll('.delete-board-btn').forEach(btn => {
//   btn.addEventListener('click', () => {
//     const boardId = btn.dataset.boardId;
//     deleteBoard(boardId, () => {
//       location.reload(); // Or update dropdown/grid dynamically
//     });
//   });
// });

document.getElementById('confirmUploadLink').addEventListener('click', () => {
  const url = document.getElementById('uploadLinkInput').value.trim();
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid URL');
    document.getElementById('pin_destination').value = parsed.href;
    document.getElementById('uploadLinkPopup').style.display = 'none';
  } catch {
    alert('Enter a complete HTTP or HTTPS destination URL. An image upload is still required.');
  }
});
