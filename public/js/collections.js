import { state } from './boardstuff/state.js';


function renderCollections(boards) {
  const grid = document.getElementById('collections-grid');
  if (!grid) return;
  grid.innerHTML = '';

  boards.forEach(board => {
    const card = document.createElement('div');
    card.className = 'collection-card';

    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'collection-thumb';

    const info = document.createElement('div');
    info.className = 'collection-info';
    info.innerHTML = `
      <h4>${board.name}</h4>
      <p>${board.pin_count || 0} Pins</p>
    `;


    card.appendChild(info);
    grid.appendChild(card);

    //  Removed: Thumbnail fetch and display logic

    // Clicking anywhere on the card navigates to board page
    card.addEventListener('click', () => {
      window.location.href = `/board.html?board_id=${board.board_id}`;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!state.userId) {
    console.error('User ID is not defined');
    return;
  }

  fetch(`/boards/users/${state.userId}/boards`)
    .then(res => res.json())
    .then(renderCollections)
    .catch(err => console.error('Failed to fetch collections:', err));
});
