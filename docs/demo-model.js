(function (root) {
  'use strict';
  const KEY = 'savvit-portfolio-demo-v1';
  function samples() {
    return { version: 1, next: 10, boards: [
      { id: 1, name: 'Slow weekends', pins: [1, 2], created: 1 },
      { id: 2, name: 'Spaces to unwind', pins: [3, 4], created: 2 },
      { id: 3, name: 'The long way home', pins: [5, 6], created: 3 }
    ], pins: [
      { id: 1, title: 'A quieter morning', description: 'A little room to breathe. Coffee, a book, and no particular plans.', art: 'forest' },
      { id: 2, title: 'Follow the coast', description: 'Collecting colours for the next weekend away.', art: 'coast' },
      { id: 3, title: 'Afternoon light', description: 'Warm walls, simple shapes and a place to slow down.', art: 'arch' },
      { id: 4, title: 'Bring the outside in', description: 'Green corners and natural textures for a calmer workspace.', art: 'forest' },
      { id: 5, title: 'Somewhere by the sea', description: 'A reminder to take the scenic route.', art: 'coast' },
      { id: 6, title: 'A different perspective', description: 'Finding inspiration in everyday architecture.', art: 'arch' }
    ].map(p => ({ ...p, liked: false, comments: [] })) };
  }
  function valid(s) {
    return s && s.version === 1 && Number.isSafeInteger(s.next) && s.next > 0 && Array.isArray(s.boards) && Array.isArray(s.pins) &&
      s.boards.length <= 200 && s.pins.length <= 500 &&
      s.pins.every(p => Number.isSafeInteger(p.id) && p.id > 0 && typeof p.title === 'string' && p.title.length <= 120 && typeof p.description === 'string' && p.description.length <= 1000 && ['forest', 'coast', 'arch'].includes(p.art) && typeof p.liked === 'boolean' && Array.isArray(p.comments) && p.comments.length <= 100 && p.comments.every(c => typeof c === 'string' && c.length <= 500)) &&
      s.boards.every(b => Number.isSafeInteger(b.id) && b.id > 0 && typeof b.name === 'string' && b.name.length <= 80 && Number.isFinite(b.created) && Array.isArray(b.pins) && new Set(b.pins).size === b.pins.length && b.pins.every(id => s.pins.some(p => p.id === id))) &&
      new Set(s.boards.map(b => b.id)).size === s.boards.length && new Set(s.pins.map(p => p.id)).size === s.pins.length && [...s.boards, ...s.pins].every(x => x.id < s.next);
  }
  function create(storage) {
    let state = samples(), warning = '';
    try { const raw = storage.getItem(KEY); if (raw) { const saved = JSON.parse(raw); if (!valid(saved)) throw Error(); state = saved; } }
    catch { warning = 'Saved demo data could not be loaded. Samples are available; changes may last only for this visit.'; }
    function persist() { try { storage.setItem(KEY, JSON.stringify(state)); warning = ''; } catch { warning = 'Browser storage is unavailable or full. Changes will last only for this visit.'; } }
    function text(value, limit) { const result = String(value || '').trim(); if (!result || result.length > limit) throw Error(`Enter between 1 and ${limit} characters.`); return result; }
    function board(id) { const b = state.boards.find(b => b.id === id); if (!b) throw Error('Board not found.'); return b; }
    function pin(id) { const p = state.pins.find(p => p.id === id); if (!p) throw Error('Pin not found.'); return p; }
    return {
      get state() { return structuredClone(state); }, get warning() { return warning; },
      boards(query = '', order = 'newest') { return structuredClone(state.boards.filter(b => b.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => (order === 'name' ? a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) : (order === 'oldest' ? a.created - b.created : b.created - a.created)) || a.id - b.id)); },
      addBoard(name) { if (state.boards.length >= 200) throw Error('Demo limit reached: 200 boards. Reset the demo to start again.'); name = text(name, 80); const b = { id: state.next++, name, created: Date.now(), pins: [] }; state.boards.push(b); persist(); return b.id; },
      addPin(boardId, title, description, art) { const b = board(boardId); if (state.pins.length >= 500) throw Error('Demo limit reached: 500 pins.'); title = text(title, 120); description = String(description || '').trim(); if (description.length > 1000 || !['forest', 'coast', 'arch'].includes(art)) throw Error('Check the description and illustration.'); const p = { id: state.next++, title, description, art, liked: false, comments: [] }; state.pins.push(p); b.pins.push(p.id); persist(); return p.id; },
      like(id) { const p = pin(id); p.liked = !p.liked; persist(); },
      comment(id, value) { const p = pin(id); if (p.comments.length >= 100) throw Error('Demo comment limit reached.'); p.comments.push(text(value, 500)); persist(); },
      save(id, destination) { pin(id); const b = board(destination); if (b.pins.includes(id)) return false; b.pins.push(id); persist(); return true; },
      remove(id, from) { const b = board(from); const index = b.pins.indexOf(id); if (index < 0) return; b.pins.splice(index, 1); persist(); return { id, from, index }; },
      undo(change) { const b = board(change.from); pin(change.id); if (!b.pins.includes(change.id)) b.pins.splice(change.index, 0, change.id); persist(); },
      reset() { state = samples(); persist(); }
    };
  }
  const api = { create, samples, valid, KEY };
  if (typeof module !== 'undefined') module.exports = api; else root.SavvitDemo = api;
})(typeof window === 'undefined' ? globalThis : window);
