
import { state } from './state.js';
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

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const boardIdFromURL = params.get('board_id');

  if (boardIdFromURL) {
    state.activeBoardId = boardIdFromURL;
  }

  fetchBoards(boardIdFromURL); // pass the selectedBoardId

  document.getElementById('board_select').addEventListener('change', (e) => {
    state.activeBoardId = e.target.value;
    console.log('Board selected:', state.activeBoardId);

    const addPinButton = document.querySelector('.add_pin');
    addPinButton.style.display = state.activeBoardId ? 'flex' : 'none';

    loadPinsForBoard(state.activeBoardId);
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
      const res = await fetch('/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, user_id: state.userId })
      });

      const result = await res.json();
      console.log('Board creation response:', result);

      if (res.ok) {
        alert('Board created!');
        document.getElementById('new_board_name').value = '';
        document.querySelector('.create_board_modal').style.display = 'none';

        await fetchBoards(result.board_id);
        document.getElementById('board_id').value = result.board_id;
      } else {
        alert('Error creating board: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error during board creation:', err);
      alert('Failed to create board. See console for details.');
    }
  });

  document.getElementById('board_id').addEventListener('change', (e) => {
    const newBoardId = e.target.value;
    state.activeBoardId = newBoardId;

    const globalSelect = document.getElementById('board_select');
    globalSelect.value = newBoardId;

    loadPinsForBoard(newBoardId);
  });

  // Upload Link setup
  document.querySelector('.upload_link')?.addEventListener('click', upload_link);
});

function fetchBoards(selectedBoardId = null) {
  fetch(`/boards/users/${state.userId}/boards`)
    .then(res => res.json())
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
        if (addPinButton) addPinButton.style.display = 'flex';
      }
    })
    .catch(err => console.error('Failed to load boards:', err));
}

export function loadPinsForBoard(boardId) {
  fetch(`/boards/${boardId}/pins?user_id=${state.userId}`)
    .then(res => res.json())
    .then(pins => {
      const container = document.querySelector('.pin_container');
      if (!container) return;
      container.innerHTML = '';

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
          is_liked: pin.is_liked === 1,
          like_count: pin.like_count || 0
        });
      });
    })
    .catch(err => console.error('Error loading pins for board:', err));
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

document.getElementById('confirmUploadLink').addEventListener('click', async () => {
  const url = document.getElementById('uploadLinkInput').value.trim();
  const preview = document.getElementById('link_preview');
  preview.innerHTML = '';

  window.iframeMode = false;
  window.iframeSource = '';

  if (!url) {
    preview.innerHTML = '<div style="padding:10px;">Please enter a valid link.</div>';
    return;
  }

  const isImage = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);
  const isHttp = /^https?:\/\//.test(url);

  if (isImage) {
    const img = new Image();
    img.src = url;
    img.alt = 'Image Preview';
    img.onerror = () => {
      preview.innerHTML = '<div style="padding:10px;">Could not load image preview.</div>';
    };
    preview.appendChild(img);
    state.pin_image_blob = url;
  } else if (isHttp) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.width = '100%';
    iframe.height = '200';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '10px';
    preview.appendChild(iframe);

    window.iframeMode = true;
    window.iframeSource = url;

    try {
      const res = await fetch(`/link-preview?url=${encodeURIComponent(url)}`);
      const meta = await res.json();
      if (meta.title) document.getElementById('pin_title').value = meta.title;
      if (meta.description) document.getElementById('pin_description').value = meta.description;
    } catch (err) {
      console.warn('Metadata fetch failed');
    }
  }

  document.getElementById('pin_destination').value = url;
  document.getElementById('uploadLinkPopup').style.display = 'none';
});


