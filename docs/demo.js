(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let storage; try { storage = localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
  const store = SavvitDemo.create(storage);
  let current = null, selected = null, removed = null;
  function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function art(kind) { const el = node('div', undefined, `art ${kind}`); el.setAttribute('aria-hidden', 'true'); return el; }
  function announce(message) { $('notice').textContent = message; $('storage-warning').textContent = store.warning; }
  function render() {
    const state = store.state;
    current = state.boards.find(b => String(b.id) === location.hash.slice(1)) || null;
    $('heading').textContent = current ? current.name : 'Your boards';
    $('back').hidden = !current; $('create').textContent = current ? '+ New pin' : '+ New board';
    $('query').placeholder = current ? 'Find a pin…' : 'Find a board…';
    const query = $('query').value.trim().toLowerCase(), order = $('sort').value;
    let items, total;
    if (current) {
      const pins = current.pins.map(id => state.pins.find(p => p.id === id)); total = pins.length;
      items = pins.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(query)).sort((a, b) => (order === 'name' ? a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) : order === 'oldest' ? a.id - b.id : b.id - a.id) || a.id - b.id);
    } else { items = store.boards(query, order); total = state.boards.length; }
    $('count').textContent = `${items.length} of ${total} ${current ? 'pins' : 'boards'}`;
    $('grid').replaceChildren();
    if (!items.length) $('grid').append(node('p', total ? 'No matches. Try another search or clear your filters.' : 'A fresh start. Add your first pin with New pin.'));
    for (const item of items) {
      const card = node(current ? 'button' : 'a', undefined, 'card');
      if (current) { card.type = 'button'; card.dataset.pinId = item.id; card.addEventListener('click', () => openPin(item.id)); }
      else card.href = `#${item.id}`;
      const cover = current ? item.art : state.pins.find(p => p.id === item.pins[0])?.art || 'forest';
      const copy = node('div', undefined, 'card-copy'); copy.append(node('h3', current ? item.title : item.name), node('p', current ? (item.liked ? '♥ Liked · ' : '') + 'Open pin →' : `${item.pins.length} pins · Explore board →`));
      card.append(art(cover), copy); $('grid').append(card);
    }
    $('storage-warning').textContent = store.warning;
  }
  function dialog(id) { const el = $(id); el.returnFocus = document.activeElement; el.showModal(); }
  document.querySelectorAll('dialog').forEach(el => {
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => el.close()));
    el.addEventListener('close', () => { const target = el.returnFocus; const replacement = target?.dataset.pinId ? document.querySelector(`[data-pin-id="${Number(target.dataset.pinId)}"]`) : null; (target?.isConnected ? target : replacement || $('heading')).focus(); });
  });
  function updateDetail() {
    const p = store.state.pins.find(p => p.id === selected); if (!p) return;
    $('like').textContent = p.liked ? '♥ Liked' : '♡ Like'; $('like').setAttribute('aria-pressed', String(p.liked));
    $('comments').replaceChildren(...p.comments.map(c => node('li', c)));
    if (!p.comments.length) $('comments').append(node('li', 'No comments yet. Add the first one.'));
    $('storage-warning').textContent = store.warning;
    if (store.warning) $('detail-status').textContent = store.warning;
  }
  function openPin(id) {
    selected = id; const p = store.state.pins.find(p => p.id === id);
    $('detail-title').textContent = p.title; $('detail-description').textContent = p.description;
    $('detail-art').replaceChildren(art(p.art)); $('detail-status').textContent = ''; $('comment-error').textContent = ''; $('comment-form').reset();
    $('destination').replaceChildren(...store.state.boards.map(b => { const o = node('option', b.name); o.value = b.id; return o; }));
    updateDetail(); dialog('detail');
  }
  $('query').addEventListener('input', render); $('sort').addEventListener('change', render);
  $('filters').addEventListener('submit', e => e.preventDefault());
  $('filters').addEventListener('reset', () => { $('query').value = ''; $('sort').value = 'newest'; render(); $('query').focus(); });
  window.addEventListener('hashchange', () => { $('query').value = ''; $('sort').value = 'newest'; render(); $('heading').focus(); });
  $('create').addEventListener('click', () => { $('edit-form').reset(); $('editor-title').textContent = current ? 'New pin' : 'New board'; $('title-label').firstChild.textContent = current ? 'Pin title ' : 'Board name '; $('title-input').maxLength = current ? 120 : 80; $('pin-fields').hidden = !current; $('edit-error').textContent = ''; dialog('editor'); $('title-input').focus(); });
  $('edit-form').addEventListener('submit', e => { e.preventDefault(); try {
    if (current) { store.addPin(current.id, $('title-input').value, $('description').value, $('art').value); render(); }
    else location.hash = store.addBoard($('title-input').value);
    $('editor').close(); announce(current ? 'Pin created in this browser.' : 'Board created in this browser.');
  } catch (error) { $('edit-error').textContent = error.message; } });
  $('like').addEventListener('click', () => { store.like(selected); updateDetail(); render(); });
  $('save-form').addEventListener('submit', e => { e.preventDefault(); const saved = store.save(selected, Number($('destination').value)); render(); $('detail-status').textContent = store.warning || (saved ? 'Reference saved. The same pin now appears in both boards.' : 'This pin is already on that board.'); });
  $('comment-form').addEventListener('submit', e => { e.preventDefault(); try { store.comment(selected, $('comment').value); $('comment-form').reset(); $('comment-error').textContent = ''; updateDetail(); $('detail-status').textContent = store.warning || 'Comment added in this browser.'; } catch (error) { $('comment-error').textContent = error.message; } });
  $('remove').addEventListener('click', () => { removed = store.remove(selected, current.id); $('detail').close(); render(); $('heading').focus(); $('undo').hidden = false; announce('Removed from this board. Other saved references are unchanged.'); });
  $('undo').addEventListener('click', () => { if (removed) store.undo(removed); removed = null; $('undo').hidden = true; render(); $('heading').focus(); announce('Pin restored.'); });
  $('reset').addEventListener('click', () => dialog('reset-dialog'));
  $('confirm-reset').addEventListener('click', () => { store.reset(); removed = null; $('undo').hidden = true; $('query').value = ''; $('sort').value = 'newest'; location.hash = ''; $('reset-dialog').close(); render(); announce('Demo reset to the original samples.'); });
  let dark = matchMedia('(prefers-color-scheme: dark)').matches;
  try { const saved = storage.getItem('savvit-demo-theme'); if (saved) dark = saved === 'dark'; } catch { /* the demo still works without storage */ }
  function theme() { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('theme').setAttribute('aria-pressed', String(dark)); }
  $('theme').addEventListener('click', () => { dark = !dark; theme(); try { storage.setItem('savvit-demo-theme', dark ? 'dark' : 'light'); } catch { announce('Theme changed for this visit. Browser storage is unavailable.'); } });
  theme(); render();
})();
