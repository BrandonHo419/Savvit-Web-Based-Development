


import { state } from './state.js';
import { buildImageElement } from './board.js';
import { handlePinClick } from './view_modal.js';

// ----------Image Upload Preview--------------
document.getElementById('upload_img').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  state.uploaded_file = file;

  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();

    reader.onload = function () {
      const new_image = new Image();
      new_image.src = reader.result;
      state.pin_image_blob = reader.result;

      new_image.onload = function () {
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
    };

    reader.readAsDataURL(file);
  }

  event.target.value = ''; // allow re-selecting the same file
});

// -----------------Save Pin Button (modal)------------------------
document.querySelector('.save_pin').addEventListener('click', () => {
  const title = document.querySelector('#pin_title').value.trim();
  const description = document.querySelector('#pin_description').value.trim();
  const link_url = document.querySelector('#pin_destination').value.trim();

  if (!state.uploaded_file) return alert("Please select an image.");
  if (!title || !link_url) return alert("Title and destination are required.");

  const boardId = document.getElementById('board_id').value;
  const formData = new FormData();
  formData.append('image', state.uploaded_file);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('link_url', link_url);
  formData.append('user_id', state.userId);
  formData.append('visibility', 'public');
  formData.append('board_id', boardId);

  fetch('/pins', {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(result => {
      if (!result.pin_id) {
        return alert('Pin creation failed: no pin ID returned.');
      }

      create_pin({
        id: result.pin_id, // pass pin ID for later reference
        title,
        description,
        destination: link_url,
        img_blob: `/uploads/${result.fileName}`,
        board_id: boardId,
        user_id: state.userId
      });

      reset_modal();
    })
    .catch(error => {
      console.error('Upload failed:', error);
      alert('Failed to upload pin.');
    });
});


function createPinMetadataHTML(title, destination) {
  // Generates HTML structure for the pin's metadata
  return `
    <div class="pin_title">${title}</div>
    <div class="pin_modal">
      <div class="modal_head">
        <div class="save_card">Save</div>
      </div>
      <div class="modal_foot">
        <div class="destination">
          <div class="icon_container">
            <img src="./images/arrow-upper-right.png" alt="destination" class="icon">
          </div>
          <span>${destination}</span>
        </div>
        <div class="icon_container"><img src="./images/share.png" alt="share" class="icon"></div>
        <div class="icon_container"><i class="fa fa-trash icon" aria-hidden="true" alt="edit"></i></div>
      </div>
    </div>
    <div class="pin_image"></div>
  `;
}

export function create_pin(pin_details) {
  // Renders a pin card into the .pin_container area
  const new_pin = document.createElement('div');
  new_pin.classList.add('pin_card');
  new_pin.dataset.boardId = pin_details.board_id || '';
  new_pin.dataset.userId = pin_details.user_id || state.userId;
  new_pin.innerHTML = createPinMetadataHTML(pin_details.title, pin_details.destination);

  const image = buildImageElement(pin_details.img_blob, function () {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    if (aspectRatio > 1.2) new_pin.classList.add('landscape');
  });

  new_pin.querySelector('.pin_image').appendChild(image);

  const fullPinDetails = {
    ...pin_details,
    id: pin_details.pin_id || pin_details.id
  };

  new_pin.addEventListener('click', () => handlePinClick(fullPinDetails));
  document.querySelector('.pin_container').appendChild(new_pin);
}


const add_pin_modal = document.querySelector('.add_pin_modal');

// ---------------------------Open Add Pin Modal------------------
document.querySelector('.add_pin').addEventListener('click', () => {
  const modal = document.querySelector('.add_pin_modal');

  // Set modal board select to current activeBoardId
  const modalBoardSelect = document.getElementById('board_id');
  if (state.activeBoardId) {
    modalBoardSelect.value = state.activeBoardId;
  }

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
  // Clears the form inputs in the add pin modal
  document.querySelector('#pin_title').value = '';
  document.querySelector('#pin_description').value = '';
  document.querySelector('#pin_destination').value = '';
  document.querySelector('#board_id').value = '';
}

function clearPinImagePreview() {
  // Clears the uploaded image preview from the modal
  const imageContainer = document.querySelector('.add_pin_modal .pin_image');
  if (imageContainer) imageContainer.innerHTML = '';
  document.querySelector('#upload_img_label').style.display = 'block';
  state.pin_image_blob = null;
}

function hidePinModal() {
  const modal = document.querySelector('.add_pin_modal');
  modal.style.opacity = 0;
  modal.style.pointerEvents = 'none';
  modal.querySelector('.modal_pin').style.display = 'none';

  document.getElementById('uploadLinkPopup').style.display = 'none';
}

function reset_modal() {
  // Resets both form and UI of the Add Pin modal
  clearPinFormFields();
  clearPinImagePreview();
  hidePinModal();
}
