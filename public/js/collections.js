import { apiFetch } from './api.js';
import { state, onSessionReady } from './boardstuff/state.js';


function renderCollections(boards) {
  const grid = document.getElementById('collections-grid');
  if (!grid) return;
  grid.replaceChildren();
  const status = document.getElementById('collections-status');
  if (status) status.textContent = boards.length ? '' : 'No boards yet. Create your first board to start saving.';

  boards.forEach(board => {
    const card = document.createElement('a');
    card.href = `/board.html?board_id=${board.board_id}`;
    card.className = 'collection-card collection-card-link';

    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'collection-thumb';

    const info = document.createElement('div');
    info.className = 'collection-info';
    const title = document.createElement('h4');
    title.textContent = board.name;
    const count = document.createElement('p');
    count.textContent = `${board.pin_count || 0} Pins`;
    info.append(title, count);

    card.appendChild(info);
    grid.appendChild(card);

    //  Removed: Thumbnail fetch and display logic


  });
}

onSessionReady(() => {
  if (!state.userId) {
    console.error('User ID is not defined');
    return;
  }

  return apiFetch(`/boards/users/${state.userId}/boards`)
    .then(res => {
      if (!res.ok) throw new Error('Unable to load collections');
      return res.json();
    })
    .then(renderCollections)
    .catch(err => {
      console.error('Failed to fetch collections:', err);
      const status = document.getElementById('collections-status');
      if (status) status.textContent = 'Unable to load collections. Please reload.';
    });
});
