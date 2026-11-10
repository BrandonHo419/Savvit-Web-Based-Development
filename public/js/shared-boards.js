import { getSession, apiFetch } from './api.js';

export async function initSharedBoards() {
  const form = document.getElementById('shared-board-search');
  const query = document.getElementById('board-query');
  const list = document.getElementById('shared-board-list');
  const status = document.getElementById('discovery-status');
  const previous = document.getElementById('previous-page');
  const next = document.getElementById('next-page');
  const label = document.getElementById('page-label');
  const retry = document.getElementById('discovery-retry');
  let page = 1;
  let search = '';
  let sequence = 0;

  async function load() {
    const requestId = ++sequence;
    previous.disabled = next.disabled = true;
    retry.hidden = true;
    list.replaceChildren();
    list.setAttribute('aria-busy', 'true');
    label.textContent = '';
    status.textContent = 'Loading shared boards…';
    try {
      const session = await getSession();
      if (!session) { window.location.href = '/login.html'; return; }
      const params = new URLSearchParams({ q: search, page: String(page) });
      const response = await apiFetch(`/boards/shared?${params}`);
      if (requestId !== sequence) return;
      if (response.status === 401) { window.location.href = '/login.html'; return; }
      if (!response.ok) throw new Error('Unable to load shared boards. Please try again.');
      const result = await response.json();
      if (requestId !== sequence) return;
      for (const board of result.boards) {
        const card = document.createElement('a');
        card.className = 'board-card';
        card.href = `/board.html?board_id=${encodeURIComponent(board.board_id)}`;
        const title = document.createElement('h2');
        title.textContent = board.name;
        const owner = document.createElement('p');
        owner.textContent = `By ${board.owner_name}`;
        const description = document.createElement('p');
        description.textContent = (board.description || 'No description yet.').slice(0, 240);
        const visibility = document.createElement('p');
        visibility.textContent = 'Semi-private · Viewing access';
        card.append(title, owner, description, visibility);
        list.appendChild(card);
      }
      status.textContent = result.boards.length ? `${result.boards.length} boards on this page.` : search ? 'No shared boards match your search.' : 'No boards shared with you on this page. Ask an owner to grant your username access to a semi-private board.';
      label.textContent = `Page ${result.page}`;
      previous.disabled = page <= 1;
      next.disabled = !result.has_more;
    } catch (error) {
      if (requestId !== sequence) return;
      status.textContent = error.message || 'Unable to load shared boards.';
      retry.hidden = false;
    } finally {
      if (requestId === sequence) list.setAttribute('aria-busy', 'false');
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    search = query.value.trim();
    page = 1;
    load();
  });
  previous.addEventListener('click', () => { if (!previous.disabled) { page--; load(); } });
  next.addEventListener('click', () => { if (!next.disabled) { page++; load(); } });
  retry.addEventListener('click', load);
  document.getElementById('shared-refresh').addEventListener('click', load);
  await load();
}

initSharedBoards();
