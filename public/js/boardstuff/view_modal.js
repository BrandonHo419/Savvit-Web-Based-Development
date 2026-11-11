import { setupReferenceRemoval, canDeleteOriginal } from './reference_removal.js';
import { setupPinEditing } from './pin_editing.js';
import { safeHttpUrl } from '../content.js';
import { apiFetch } from '../api.js';

import { loadPinsForBoard } from './board.js';
import { state } from './state.js';
import { populateUserProfile } from './userProfile.js';
import { setupPinActions } from './pin_actions.js';
import { setupPinDiscussion } from './pin_discussion.js';

import { deletePin } from './delete.js';
let opening = 0;

// ----------------------Open Pin Modal (on pin click)-----------------------
function openPinModal(pin) {
  const modal = document.getElementById('viewModal');
  const modalImage = document.getElementById('modalImage');
  const description = modal.querySelector('.description');
  const deleteIcon = modal.querySelector('.action-btn .fa-trash')?.parentElement;

  modalImage.src = safeHttpUrl(pin.img_blob) || '/img/create.jpg';
  modalImage.alt = pin.title || 'Saved image';
  modal.querySelector('.pin_title').textContent = pin.title || 'Untitled pin';
  document.body.style.overflow = 'hidden';
  modal.style.display = 'flex';
  modal.focus();
  description.textContent = pin.description || 'No description';

  // Store pin ID
  modal.dataset.pinId = pin.id;
  setupPinEditing(modal, pin, state, () => openPinModal(pin));

  setupPinActions(modal, pin, state, () => {
    modal.style.display = 'none';
    modal.dataset.pinId = '';
    document.body.style.overflow = '';
    loadPinsForBoard(state.activeBoardId);
  });

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

  setupReferenceRemoval(modal, pin, state, () => {
    modal.style.display = 'none';
    modal.dataset.pinId = '';
    document.body.style.overflow = '';
    loadPinsForBoard(state.activeBoardId);
  });

  // Original deletion is available only while viewing the owned original board.
  if (deleteIcon) {
    if (!canDeleteOriginal(pin, state)) {
      deleteIcon.style.display = 'none';
    } else {
      const newDeleteIcon = deleteIcon.cloneNode(true);
      newDeleteIcon.style.display = 'flex';
      deleteIcon.replaceWith(newDeleteIcon);

      newDeleteIcon.addEventListener('click', async () => {
        if (newDeleteIcon.disabled) return;
        if (!confirm('Delete this original pin and all saved references to it? This cannot be undone.')) return;
        newDeleteIcon.disabled = true;
        await deletePin(pin.id, () => {
          if (!newDeleteIcon.isConnected) return;
          modal.style.display = 'none';
          modal.dataset.pinId = '';
          document.body.style.overflow = '';
          loadPinsForBoard(state.activeBoardId);
        });
        newDeleteIcon.disabled = false;
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

  setupPinDiscussion(modal, pin, state);

}

}





// -------------------Handle Pin Card Click------------------------
export function handlePinClick(pin) {
  const request = ++opening;
  const existingModal = document.getElementById('viewModal');

  if (!existingModal) {
    apiFetch('/view_modal.html')
      .then(res => {
        if (!res.ok) throw new Error('Pin details are unavailable');
        return res.text();
      })
      .then(html => {
        if (request !== opening) return;
        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = html; // Only the static, same-origin modal template is inserted.
        initializeModalEvents();
        openPinModal(pin);
      })
      .catch(error => {
        if (request !== opening) return;
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

  const closeModal = () => {
    modal.style.display = "none";
    document.body.style.overflow = '';
    modal.dataset.pinId = '';
    state.fromCollections = false;
    if (state.activeBoardId) {
      loadPinsForBoard(state.activeBoardId);
    }
  };
  modal.querySelector('.close-btn')?.addEventListener('click', closeModal);
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button, select, input, textarea, summary, a[href]')].filter(el => el.getClientRects().length && !el.disabled);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

}
