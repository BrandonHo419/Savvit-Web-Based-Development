import { apiFetch, getSession } from './api.js';

const grid = document.getElementById('collections-grid');
const status = document.getElementById('collections-status');
const retry = document.getElementById('collections-retry');
const form = document.getElementById('create-board-form');
const nameInput = document.getElementById('new-board-name');
const submit = document.getElementById('create-board-submit');
const createStatus = document.getElementById('create-board-status');
const query = document.getElementById('collections-query');
const sort = document.getElementById('collections-sort');
const reset = document.getElementById('collections-reset');
let allBoards = [];
let loaded = false;
let loading = false;
let saving = false;
let ready = false;

function boardName(board) {
    return String(board.name ?? '').trim() || 'Untitled board';
}

function compareBoards(a, b) {
    const byId = String(a.board_id ?? '').localeCompare(String(b.board_id ?? ''), 'en', { numeric: true });
    const byName = boardName(a).localeCompare(boardName(b), 'en', { sensitivity: 'base' });
    if (sort.value === 'name') return byName || byId;
    const aDate = a.created_at ? Date.parse(a.created_at) : NaN;
    const bDate = b.created_at ? Date.parse(b.created_at) : NaN;
    // Unknown dates stay last in either direction.
    if (Number.isFinite(aDate) !== Number.isFinite(bDate)) return Number.isFinite(aDate) ? -1 : 1;
    const byDate = Number.isFinite(aDate) ? aDate - bDate : 0;
    return (sort.value === 'oldest' ? byDate : -byDate) || byId;
}

function renderCollections() {
    if (!loaded) return;
    const search = query.value.trim().toLowerCase();
    const boards = allBoards.filter(board => boardName(board).toLowerCase().includes(search)).sort(compareBoards);
    grid.replaceChildren();
    status.textContent = !allBoards.length ? '0 boards. No boards yet. Create your first board below.'
        : `${boards.length} of ${allBoards.length} boards${search ? ' match your search' : ''}.` +
          (boards.length ? '' : ' No boards match. Clear your search to see all your boards.');
    for (const board of boards) {
        const card = document.createElement('a');
        card.href = `/board.html?board_id=${encodeURIComponent(board.board_id)}`;
        card.className = 'collection-card collection-card-link';
        const info = document.createElement('div');
        info.className = 'collection-info';
        const title = document.createElement('h3');
        title.textContent = boardName(board);
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
    loaded = false;
    query.disabled = sort.disabled = reset.disabled = true;
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
        allBoards = await response.json();
        loaded = true;
        renderCollections();
        query.disabled = sort.disabled = reset.disabled = false;
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
query.addEventListener('input', renderCollections);
sort.addEventListener('change', renderCollections);
reset.addEventListener('click', () => {
    query.value = '';
    sort.value = 'newest';
    renderCollections();
    query.focus();
});
loadBoards();
