import { safeHttpUrl } from '../content.js';
import { apiFetch } from '../api.js';

import { loadPinsForBoard } from './board.js';
import { state } from './state.js';
import { populateUserProfile } from './userProfile.js';
import { loadComments, attachReplyHandler } from './comment.js';

import { deletePin } from './delete.js';

// ----------------------Open Pin Modal (on pin click)-----------------------
function openPinModal(pin) {
  const modal = document.getElementById('viewModal');
  const modalImage = document.getElementById('modalImage');
  const description = modal.querySelector('.description');
  const commentSection = modal.querySelector('.comment-section'); // Wrap comments in a parent div
  const commentList = modal.querySelector('#comment-list');
  const commentCount = modal.querySelector('#comment-count');
  const likeBtn = modal.querySelector('#likeButton');
  const shareBtn = modal.querySelector('#shareButton');
  const deleteIcon = modal.querySelector('.action-btn .fa-trash')?.parentElement;

  modalImage.src = safeHttpUrl(pin.img_blob) || '/img/create.jpg';
  modalImage.alt = pin.title || 'Saved image';
  modal.querySelector('.pin_title').textContent = pin.title || 'Untitled pin';
  document.body.style.overflow = 'hidden';
  modal.style.display = 'flex';
  modal.focus();
  // Description
  const maxDescriptionLength = 300;
  const fullDescription = pin.description || 'No description';
  description.textContent = fullDescription.length > maxDescriptionLength
    ? fullDescription.slice(0, maxDescriptionLength) + '…'
    : fullDescription;

  // Store pin ID
  modal.dataset.pinId = pin.id;

  // User info
  populateUserProfile({
    user_id: pin.user_id,
    username: pin.username,
    display_name: pin.display_name,
    avatar_url: pin.user_avatar_url
  });

  // Handle board selection
  const boardSelect = document.querySelector('#boardSelect');
  if (boardSelect) {
    boardSelect.value = state.activeBoardId || '';
    if (!boardSelect.value) boardSelect.selectedIndex = 0;

  }

  // Trash icon visibility
  if (deleteIcon) {
    if (Number(pin.user_id) !== Number(state.userId) || !pin.board_id) {
      deleteIcon.style.display = 'none';
    } else {
      const newDeleteIcon = deleteIcon.cloneNode(true);
      newDeleteIcon.style.display = 'flex';
      deleteIcon.replaceWith(newDeleteIcon);

      newDeleteIcon.addEventListener('click', () => {
        if (!confirm('Are you sure you want to delete this pin?')) return;
        deletePin(pin.id, () => {
          modal.style.display = 'none';
          document.body.style.overflow = '';
          loadPinsForBoard(state.activeBoardId);
        });
      });
    }
  }
      // Open modal

  // Read-only check
 const isReadOnly = pin.board_id == null;
  // Set destination URL (required for save later)
  const pinLink = modal.querySelector('.pin_link');
  if (pinLink) {
    const url = safeHttpUrl(pin.destination);
    pinLink.hidden = !url;
    if (url) pinLink.href = url;
    else pinLink.removeAttribute('href');
  }
  modal.dataset.destination = pin.destination || '';

const commentsSection = modal.querySelector('#comments-section');
const addCommentSection = modal.querySelector('.add-comment');
const toggleBtn = modal.querySelector('#toggle-comments');
const leftActions = modal.querySelector('.left-actions');

if (isReadOnly) {
  if (commentsSection) commentsSection.style.display = 'none';
  if (addCommentSection) addCommentSection.style.display = 'none';
  if (toggleBtn) toggleBtn.style.display = 'none';
  if (leftActions) leftActions.style.display = 'none';
} else {
  if (commentsSection) commentsSection.style.display = 'block';
  if (addCommentSection) addCommentSection.style.display = 'flex';
  if (toggleBtn) toggleBtn.style.display = 'inline-block';
  if (leftActions) leftActions.style.display = 'flex';

  loadComments(pin.id);
  setupLikeButton(pin);
}

}





// -------------------Handle Pin Card Click------------------------
export function handlePinClick(pin) {
  const existingModal = document.getElementById('viewModal');

  if (!existingModal) {
    apiFetch('/view_modal.html')
      .then(res => {
        if (!res.ok) throw new Error('Pin details are unavailable');
        return res.text();
      })
      .then(html => {
        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = html; // Only the static, same-origin modal template is inserted.
        initializeModalEvents();
        openPinModal(pin);
      })
      .catch(error => {
        console.error('Unable to open pin:', error);
        alert('Unable to open this pin. Please reload and try again.');
      });
  } else {
    openPinModal(pin);
  }
}

// ------------------MODAL EVENT INITIALIZATION---------------------------
function initializeModalEvents() {
  const modal = document.getElementById('viewModal');
  if (!modal) return;

  const boardSelect = modal.querySelector('#boardSelect');

  apiFetch(`/boards/users/${state.userId}/boards`)
    .then(res => res.json())
    .then(boards => {
      boardSelect.innerHTML = '<option value="" disabled>Select Board</option>';
      boards.forEach(board => {
        const option = document.createElement('option');
        option.value = board.board_id;
        option.textContent = board.name;
        boardSelect.appendChild(option);
      });

      if (state.activeBoardId) {
        boardSelect.value = state.activeBoardId;
        if (!boardSelect.value) {
          boardSelect.selectedIndex = 0;
        }
      }
    })
    .catch(err => console.error('Failed to populate modal boardSelect:', err));


  const closeModal = () => {
    modal.style.display = "none";
    document.body.style.overflow = '';
    state.fromCollections = false;
    if (state.activeBoardId) {
      loadPinsForBoard(state.activeBoardId);
    }
  };
  modal.querySelector('.close-btn')?.addEventListener('click', closeModal);
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button, select, input, a[href]')].filter(el => el.getClientRects().length && !el.disabled);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

  const modalImg = modal.querySelector("#modalImage");
  const viewLargerBtn = modal.querySelector(".view-larger-btn");
  let zoomed = false;

  viewLargerBtn?.addEventListener("click", () => {
    zoomed = !zoomed;
    modalImg.style.transform = zoomed ? "scale(1.5)" : "scale(1)";
    modalImg.style.transition = "transform 0.3s";
    modalImg.style.cursor = zoomed ? "move" : "default";
  });

  modal.querySelector(".explore-btn")?.addEventListener("click", () => {
    alert("Explore related pins feature coming soon!");
  });

  const saveBtn = modal.querySelector(".save-btn");

  saveBtn?.addEventListener("click", async () => {
  if (saveBtn.disabled) return;

  saveBtn.disabled = true;
  // saveBtn.innerHTML = "<span class='spinner'></span> Saving…"; // optional spinner
  saveBtn.textContent = "Saving...";

  const pinId = modal.dataset.pinId;
  const boardId = boardSelect?.value;

  if (!pinId || !boardId) {
    alert("Missing pin or board.");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
    return;
  }

  const isYouTubePin = pinId.startsWith('yt_');
  const isPixabayPin = pinId.startsWith('pb_');
  let realPinId = pinId;

  try {
    if (isYouTubePin) {
      const pinData = {
        id: pinId,
        title: modal.querySelector('.pin_title')?.textContent || 'YouTube Video',
        description: modal.querySelector('.description')?.textContent || '',
        destination: `https://www.youtube.com/watch?v=${pinId.replace('yt_', '')}`,
        img_blob: modalImg?.src || '',
        board_id: boardId
      };

      const createRes = await apiFetch('/pins/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinData)
      });

      const responseText = await createRes.text();
      const createResult = JSON.parse(responseText);

      if (!createRes.ok || !createResult.pin_id) {
        throw new Error(createResult.error || 'Failed to save YouTube pin.');
      }

      realPinId = createResult.pin_id;
    }

    else if (isPixabayPin) {
      const pinData = {
        id: pinId,
        title: modal.querySelector('.pin_title')?.textContent || 'Pixabay Image',
        description: modal.querySelector('.description')?.textContent || '',
        destination:
          modal.querySelector('.pin_link')?.href || modal.dataset.destination || '',
        img_blob: modalImg?.src || '',
        board_id: boardId
      };

      const createRes = await apiFetch('/pins/pixabay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinData)
      });

      const responseText = await createRes.text();
      const createResult = JSON.parse(responseText);

      if (!createRes.ok || !createResult.pin_id) {
        throw new Error(createResult.error || 'Failed to save Pixabay pin.');
      }

      realPinId = createResult.pin_id;
    }

    const res = await apiFetch(`/pins/${realPinId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: boardId })
    });

    const result = await res.json();
    if (res.ok) {
      alert("Pin saved!");
      modal.style.display = "none";
      document.body.style.overflow = '';
      loadPinsForBoard(state.activeBoardId);
    } else {
      throw new Error(result.error || "Failed to save pin.");
    }

  } catch (err) {
    console.error("Save failed:", err);
    alert(err.message || "An error occurred while saving the pin.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
    // saveBtn.innerHTML = "Save"; // if using spinner above
  }
});

  modal.querySelector("#shareButton")?.addEventListener("click", () => {
    alert("Share feature coming soon!");
  });


  modal.querySelectorAll(".reply-btn").forEach(attachReplyHandler);

  modal.querySelector("#postComment")?.addEventListener('click', async () => {
    const input = modal.querySelector("#commentInput");
    const text = input.value.trim();
    const pinId = modal.dataset.pinId;

    if (!text || !pinId) return;

    try {
      const res = await apiFetch(`/pins/${pinId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });

      if (res.ok) {
        input.value = '';
        loadComments(pinId);
      } else {
        alert('Failed to post comment.');
      }
    } catch (err) {
      console.error('Comment failed:', err);
    }
  });
}
// ------------------LIKE BUTTON SETUP---------------------------

function setupLikeButton(pin) {
  const likeBtn = document.getElementById('likeButton');
  const icon = likeBtn?.querySelector('i');

  if (!likeBtn || !icon) return;

  const pinId = pin.id;
  let isLiked = state.pinLikes[pinId] ?? pin.is_liked;
  let count = pin.like_count || 0;

  // Replace like button to clear old listeners
  const newLikeBtn = likeBtn.cloneNode(true);
  likeBtn.replaceWith(newLikeBtn);

  const newIcon = newLikeBtn.querySelector('i');
  const countDisplay = newLikeBtn.querySelector('#likeCount'); //  Fix: get count span from new node

  if (!newIcon || !countDisplay) return;

  // Set initial state
  newLikeBtn.classList.toggle('liked', isLiked);
  newIcon.classList.toggle('fas', isLiked);
  newIcon.classList.toggle('far', !isLiked);
  countDisplay.textContent = count;

  newLikeBtn.addEventListener('click', async () => {
    const optimisticLiked = !isLiked;
    const optimisticCount = count + (optimisticLiked ? 1 : -1);

    // Instant visual feedback
    newLikeBtn.classList.toggle('liked', optimisticLiked);
    newIcon.classList.toggle('fas', optimisticLiked);
    newIcon.classList.toggle('far', !optimisticLiked);
    countDisplay.textContent = optimisticCount;

    // Cache optimistic state
    state.pinLikes[pinId] = optimisticLiked;
    isLiked = optimisticLiked;
    count = optimisticCount;

    try {
      const res = await apiFetch(`/pins/${pinId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ like: optimisticLiked })
      });

      if (!res.ok) throw new Error('Server rejected like toggle');
      const data = await res.json();

      // Apply server-trusted state
      isLiked = data.is_liked;
      count = data.like_count;
      state.pinLikes[pinId] = isLiked;

      newLikeBtn.classList.toggle('liked', isLiked);
      newIcon.classList.toggle('fas', isLiked);
      newIcon.classList.toggle('far', !isLiked);
      countDisplay.textContent = count;

    } catch (err) {
      console.error('Failed to sync like:', err);

      // Revert UI on error
      isLiked = !optimisticLiked;
      count = optimisticCount + (isLiked ? 1 : -1);
      state.pinLikes[pinId] = isLiked;

      newLikeBtn.classList.toggle('liked', isLiked);
      newIcon.classList.toggle('fas', isLiked);
      newIcon.classList.toggle('far', !isLiked);
      countDisplay.textContent = count;
    }
  });
}







