import { apiFetch } from '../api.js';
import { canDeleteOriginal } from './reference_removal.js';

export function setupPinEditing(modal, pin, state, onSaved) {
  const section = modal.querySelector('#pin-editing');
  section.hidden = !canDeleteOriginal(pin, state);
  section.open = false;
  const form = modal.querySelector('#pin-edit-form');
  const title = modal.querySelector('#edit-pin-title');
  const description = modal.querySelector('#edit-pin-description');
  const destination = modal.querySelector('#edit-pin-url');
  const status = modal.querySelector('#pin-edit-status');
  let saving = false;
  for (const field of form.elements) field.disabled = false;
  const reset = () => {
    title.value = pin.title || '';
    description.value = pin.description || '';
    destination.value = pin.destination || '';
    status.textContent = '';
  };
  reset();
  form.onreset = event => { event.preventDefault(); if (!saving) reset(); };
  form.onsubmit = async event => {
    event.preventDefault();
    if (section.hidden || saving) return;
    saving = true;
    for (const field of form.elements) field.disabled = true;
    status.textContent = 'Saving changes…';
    try {
      const response = await apiFetch(`/pins/${encodeURIComponent(pin.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.value.trim(), description: description.value.trim(), link_url: destination.value.trim() })
      });
      if (!response.ok) throw new Error('Unable to save changes. Check your entries and access, then retry.');
      const updated = await response.json();
      Object.assign(pin, { title: updated.title, description: updated.description, destination: updated.link_url });
      if (modal.dataset.pinId === String(pin.id)) {
        onSaved();
        status.textContent = 'Changes saved.';
      }
    } catch (error) {
      if (modal.dataset.pinId === String(pin.id)) status.textContent = error.message;
    } finally {
      saving = false;
      if (modal.dataset.pinId === String(pin.id)) {
        for (const field of form.elements) field.disabled = false;
      }
    }
  };
}
