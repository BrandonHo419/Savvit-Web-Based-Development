import { apiFetch, getSession } from './api.js';

const grid = document.getElementById('collections-grid');
const status = document.getElementById('collections-status');
const retry = document.getElementById('collections-retry');
const form = document.getElementById('create-board-form');
const nameInput = document.getElementById('new-board-name');
const submit = document.getElementById('create-board-submit');
const createStatus = document.getElementById('create-board-status');
let loading = false;
let saving = false;
let ready = false;

function renderCollections(boards) {
    grid.replaceChildren();
    status.textContent = boards.length ? `${boards.length} ${boards.length === 1 ? 'board' : 'boards'}` : 'No boards yet. Create your first board below.';
    for (const board of boards) {
        const card = document.createElement('a');
        card.href = `/board.html?board_id=${encodeURIComponent(board.board_id)}`;
        card.className = 'collection-card collection-card-link';
        const info = document.createElement('div');
        info.className = 'collection-info';
        const title = document.createElement('h3');
        title.textContent = board.name;
        const count = document.createElement('p');
        const pins = Number(board.pin_count) || 0;
        count.textContent = `${pins} ${pins === 1 ? 'pin' : 'pins'}`;
        info.append(title, count);
        card.append(info);
        grid.append(card);
    }
}

async function loadBoards() {
    if (loading) return;
    loading = true;
    retry.hidden = true;
    grid.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading your boards…';
    try {
        const session = await getSession({ refresh: true });
        if (!session) { window.location.replace('/login.html'); return; }
        ready = true;
        nameInput.disabled = false;
        submit.disabled = saving;
        const response = await apiFetch(`/boards/users/${session.user_id}/boards`);
        if (response.status === 401) { window.location.replace('/login.html'); return; }
        if (!response.ok) throw new Error();
        renderCollections(await response.json());
    } catch {
        status.textContent = 'Unable to load your boards. Please try again.';
        retry.hidden = false;
    } finally {
        loading = false;
        grid.setAttribute('aria-busy', 'false');
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || saving) return;
    const name = nameInput.value.trim();
    if (!name) { createStatus.textContent = 'Enter a board name.'; nameInput.focus(); return; }
    saving = true;
    submit.disabled = true;
    createStatus.textContent = 'Creating your board…';
    try {
        const response = await apiFetch('/boards', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
        });
        if (response.status === 401 || response.status === 403) {
            throw new Error('Your session changed. Sign in again if needed, then retry.');
        }
        if (!response.ok) throw new Error('Unable to create your board. Please try again.');
        const board = await response.json();
        window.location.assign(`/board.html?board_id=${encodeURIComponent(board.board_id)}`);
    } catch (error) {
        createStatus.textContent = error.message || 'Unable to create your board. Please try again.';
    } finally { saving = false; submit.disabled = false; }
});
retry.addEventListener('click', loadBoards);
loadBoards();
