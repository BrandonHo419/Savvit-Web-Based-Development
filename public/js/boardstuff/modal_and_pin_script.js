import { uploadError } from '../upload-policy.js';
import { safeHttpUrl } from '../content.js';
import { apiFetch } from '../api.js';

import { state } from './state.js';
import { buildImageElement, loadPinsForBoard } from './board.js';
import { handlePinClick } from './view_modal.js';

function pinFeedback(message) {
  const status = document.getElementById('pin-create-status');
  if (status) status.textContent = message;
}

// ----------Image Upload Preview--------------
document.getElementById('upload_img').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  state.uploaded_file = null;
  state.pin_image_blob = null;
  document.querySelector('.add_pin_modal .pin_image').replaceChildren();
  document.querySelector('#upload_img_label').style.display = 'block';
  event.target.value = '';
  if (!file) return;
  const error = uploadError(file);
  if (error) return alert(error);
  state.uploaded_file = file;

  const reader = new FileReader();

  reader.onerror = () => {
    if (state.uploaded_file !== file) return;
    state.uploaded_file = null;
    alert('Unable to read this image. Please try another file.');
  };
  reader.onload = function () {
    if (state.uploaded_file !== file) return;
    const new_image = new Image();
    state.pin_image_blob = reader.result;

    new_image.onerror = () => {
      if (state.uploaded_file !== file) return;
      state.uploaded_file = null;
      state.pin_image_blob = null;
      alert('Unable to display this image. Please try another file.');
    };
    new_image.onload = function () {
      if (state.uploaded_file !== file) return;
      const image_container = document.querySelector('.add_pin_modal .pin_image');
      const maxWidth = 400;
      const aspectRatio = new_image.naturalWidth / new_image.naturalHeight;

      new_image.style.width = `${maxWidth}px`;
      new_image.style.height = `${maxWidth / aspectRatio}px`;
      new_image.style.borderRadius = '16px';
      new_image.style.objectFit = 'cover';
      new_image.style.display = 'block';

      image_container.innerHTML = '';
      image_container.appendChild(new_image);

      document.querySelector('#upload_img_label').style.display = 'none';

      const modal = document.querySelector('.add_pin_modal .modal_pin');
      modal.style.display = 'flex';
      modal.style.opacity = 1;
    };
    new_image.src = reader.result;
  };

  reader.readAsDataURL(file);
});

// -----------------Save Pin Button (modal)------------------------
const savePinButton = document.querySelector('.save_pin');
savePinButton.addEventListener('click', () => {
  if (savePinButton.disabled) return;
  const title = document.querySelector('#pin_title').value.trim();
  const description = document.querySelector('#pin_description').value.trim();
  const link_url = document.querySelector('#pin_destination').value.trim();

  const imageError = uploadError(state.uploaded_file);
  if (imageError) return pinFeedback(imageError);
  if (!title || title.length > 255) return pinFeedback('Enter a title of 1–255 characters.');
  if (description.length > 10000) return pinFeedback('Keep the description within 10,000 characters.');
  try {
    const destination = new URL(link_url);
    if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password || link_url.length > 2048) throw new Error();
  } catch { return pinFeedback('Enter a complete HTTP or HTTPS destination URL without credentials.'); }

  const boardId = document.getElementById('board_id').value;
  if (!boardId) return pinFeedback('Choose a board for this pin.');
  const formData = new FormData();
  formData.append('image', state.uploaded_file);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('link_url', link_url);
  formData.append('visibility', 'public');
  formData.append('board_id', boardId);

  savePinButton.disabled = true;
  const fields = document.querySelectorAll('.add_pin_modal input, .add_pin_modal select, #cancel-pin');
  fields.forEach(field => { field.disabled = true; });
  pinFeedback('Saving your pin…');
  apiFetch('/pins', {
    method: 'POST',
    body: formData
  })
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create pin');
      return result;
    })
    .then(result => {
      if (!result.pin_id) {
        throw new Error('Unable to confirm the new pin. Check the board before retrying.');
      }

      loadPinsForBoard(state.activeBoardId);

      savePinButton.disabled = false;
      reset_modal();
    })
    .catch(error => {
      pinFeedback(error.message || 'Failed to upload pin. Please retry.');
    })
    .finally(() => {
      savePinButton.disabled = false;
      fields.forEach(field => { field.disabled = false; });
    });
});

function createPinMetadataHTML() {
  return `
    <div class="pin_title"></div>
    <div class="pin_modal">
      <div class="modal_head">
        <div class="save_card">Save</div>
      </div>
      <div class="modal_foot">
        <div class="destination">
          <div class="icon_container">
            <img src="./img/arrow-upper-right.png" alt="destination" class="icon">
          </div>
          <span class="destination-text"></span>
        </div>


      </div>
    </div>
    <div class="pin_image"></div>
  `;
}

export function create_pin(pin_details) {
  const new_pin = document.createElement('div');
  new_pin.classList.add('pin_card');
  new_pin.dataset.boardId = pin_details.board_id || '';
  new_pin.dataset.userId = pin_details.user_id || state.userId;
  new_pin.innerHTML = createPinMetadataHTML();
  new_pin.querySelector('.pin_title').textContent = pin_details.title || 'Untitled pin';
  new_pin.querySelector('.destination-text').textContent = pin_details.destination || '';
  new_pin.tabIndex = 0;
  new_pin.setAttribute('role', 'button');
  new_pin.setAttribute('aria-label', `View ${pin_details.title || 'pin'}`);

  const image = buildImageElement(safeHttpUrl(pin_details.img_blob) || '/img/create.jpg', function () {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    if (aspectRatio > 1.2) new_pin.classList.add('landscape');
  });

  image.alt = pin_details.title || 'Saved pin';
  new_pin.querySelector('.pin_image').appendChild(image);

  const fullPinDetails = {
    ...pin_details,
    id: pin_details.pin_id || pin_details.id
  };

  new_pin.addEventListener('click', () => handlePinClick(fullPinDetails));
  new_pin.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePinClick(fullPinDetails);
    }
  });
  document.querySelector('.pin_container').appendChild(new_pin);
}

// ---------------------------Open Add Pin Modal------------------
document.querySelector('.add_pin').addEventListener('click', () => {
  const modal = document.querySelector('.add_pin_modal');

  // Set modal board select to current activeBoardId
  const modalBoardSelect = document.getElementById('board_id');
  if (state.activeBoardId) {
    modalBoardSelect.value = state.activeBoardId;
  }

  modal.style.display = 'block';
  modal.style.opacity = 1;
  modal.style.pointerEvents = 'all';
});
// ------------------------Dismiss Modal on Background Click-------------------
document.querySelector('.add_pin_modal').addEventListener('click', (event) => {
  if (event.target.classList.contains('add_pin_modal')) {
    reset_modal();
  }
});

// Reset Fields and Modal
function clearPinFormFields() {
  document.querySelector('#pin_title').value = '';
  document.querySelector('#pin_description').value = '';
  document.querySelector('#pin_destination').value = '';
  document.querySelector('#board_id').value = '';
}

function clearPinImagePreview() {
  const imageContainer = document.querySelector('.add_pin_modal .pin_image');
  if (imageContainer) imageContainer.innerHTML = '';
  document.querySelector('#upload_img_label').style.display = 'block';
  state.pin_image_blob = null;
  state.uploaded_file = null;
}

function hidePinModal() {
  const modal = document.querySelector('.add_pin_modal');
  modal.style.display = 'none';
  modal.style.opacity = 0;
  modal.style.pointerEvents = 'none';
  modal.querySelector('.modal_pin').style.display = 'none';

  document.getElementById('uploadLinkPopup').style.display = 'none';
}

function reset_modal() {
  if (savePinButton.disabled) return;
  pinFeedback('');
  clearPinFormFields();
  clearPinImagePreview();
  hidePinModal();
  document.querySelector('.add_pin').focus();
}

document.getElementById('cancel-pin')?.addEventListener('click', reset_modal);
