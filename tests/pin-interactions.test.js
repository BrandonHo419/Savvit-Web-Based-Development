const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(file, extra = {}) {
  const nodes = new Map();
  function element(tag = 'div') {
    return { tag, value: '', textContent: '', hidden: false, disabled: false, children: [], dataset: {}, attrs: {},
      classList: { toggle() {} },
      append(...children) { this.children.push(...children); },
      prepend(child) { this.children.unshift(child); },
      appendChild(child) { this.append(child); if (tag === 'select' && !this.value) this.value = String(child.value); },
      replaceChildren() { this.children = []; this.value = ''; },
      get options() { return this.children; },
      setAttribute(key, value) { this.attrs[key] = value; }, focus() {}, querySelector: get
    };
  }
  function get(id) {
    if (!nodes.has(id)) nodes.set(id, element(id === '#boardSelect' ? 'select' : 'div'));
    return nodes.get(id);
  }
  const modal = get('viewModal'); modal.dataset.pinId = '1';
  let respond = async () => ({ ok: true, json: async () => [] });
  const calls = [], refreshes = [];
  const ctx = vm.createContext({ document: { getElementById: get, createElement: element },
    apiFetch: async (...args) => { calls.push(args); return respond(...args); },
    window: { confirm: () => true }, canDeleteOriginal: () => true,
    loadComments: id => refreshes.push(id), ...extra });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/boardstuff', file), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export (async )?function/g, '$1function'), ctx);
  const pin = { id: 1, board_id: 10, user_id: 1, is_liked: false, like_count: 2 };
  const state = { activeBoardId: 10, userId: 1, canEditBoard: true, pinLikes: {} };
  return { get, ctx, modal, pin, state, calls, refreshes, respond(fn) { respond = fn; } };
}

test('save and move use distinct requests, exclude the original board, and block duplicate clicks', async () => {
  const ui = harness('pin_actions.js'); let moved = 0;
  ui.respond(async () => ({ ok: true, json: async () => [{ board_id: 10, name: 'Original' }, { board_id: 20, name: '<b>Destination</b>', visibility: 'private' }] }));
  ui.ctx.setupPinActions(ui.modal, ui.pin, ui.state, () => moved++);
  await tick();
  assert.equal(ui.get('#boardSelect').options.length, 1);
  assert.equal(ui.get('#boardSelect').options[0].textContent, '<b>Destination</b> (private)');
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = ui.get('.save-btn').onclick(); await ui.get('.save-btn').onclick();
  assert.equal(ui.calls.length, 2);
  assert.equal(ui.calls[1][0], '/pins/1/save');
  assert.equal(ui.calls[1][1].method, 'POST');
  assert.deepEqual(JSON.parse(ui.calls[1][1].body), { board_id: '20' });
  finish({ ok: true }); await pending;
  assert.match(ui.get('#save-status').textContent, /Reference saved/);
  assert.equal(moved, 0);
  ui.respond(async () => ({ ok: true }));
  await ui.get('#move-pin').onclick();
  assert.equal(ui.calls[2][0], '/pins/1/move');
  assert.equal(ui.calls[2][1].method, 'PUT');
  assert.equal(moved, 1);
});

test('destination failures recover, viewers cannot move, and stale board responses are ignored', async () => {
  const ui = harness('pin_actions.js', { canDeleteOriginal: () => false });
  ui.respond(async () => ({ ok: false }));
  ui.ctx.setupPinActions(ui.modal, ui.pin, ui.state, () => assert.fail('viewer moved pin'));
  await tick();
  assert.equal(ui.get('#boards-retry').hidden, false);
  assert.equal(ui.get('#move-pin').hidden, true);
  await ui.get('#move-pin').onclick(); assert.equal(ui.calls.length, 1);
  ui.respond(async () => ({ ok: true, json: async () => [] }));
  await ui.get('#boards-retry').onclick();
  assert.match(ui.get('#save-status').textContent, /Create another board/);
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const old = ui.get('#boards-retry').onclick();
  ui.modal.dataset.pinId = '2';
  ui.get('#save-status').textContent = 'New pin';
  finish({ ok: true, json: async () => [{ board_id: 30 }] }); await old;
  assert.equal(ui.get('#save-status').textContent, 'New pin');
});

test('likes await server state, serialize clicks and keep counts on failure', async () => {
  const ui = harness('pin_discussion.js');
  ui.ctx.setupPinDiscussion(ui.modal, ui.pin, ui.state);
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = ui.get('#likeButton').onclick(); await ui.get('#likeButton').onclick();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.get('#likeCount').textContent, 2);
  finish({ ok: true, json: async () => ({ is_liked: true, like_count: 3 }) }); await pending;
  assert.equal(ui.get('#likeCount').textContent, 3);
  assert.equal(ui.get('#likeButton').attrs['aria-pressed'], 'true');
  ui.respond(async () => ({ ok: false })); await ui.get('#likeButton').onclick();
  assert.equal(ui.get('#likeCount').textContent, 3);
  assert.match(ui.get('#like-status').textContent, /Unable/);
});

test('comments preserve failed drafts, reject blanks and do not overwrite another pin', async () => {
  const ui = harness('pin_discussion.js');
  ui.ctx.setupPinDiscussion(ui.modal, ui.pin, ui.state);
  await ui.get('#postComment').onclick(); assert.equal(ui.calls.length, 0);
  ui.get('#commentInput').value = 'Draft';
  ui.respond(async () => ({ ok: false })); await ui.get('#postComment').onclick();
  assert.equal(ui.get('#commentInput').value, 'Draft');
  assert.equal(ui.get('#postComment').disabled, false);
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = ui.get('#postComment').onclick(); await ui.get('#postComment').onclick();
  assert.equal(ui.calls.length, 2);
  ui.modal.dataset.pinId = '2';
  ui.ctx.setupPinDiscussion(ui.modal, { ...ui.pin, id: 2 }, ui.state);
  ui.get('#commentInput').value = 'New draft';
  finish({ ok: true }); await pending;
  assert.equal(ui.get('#commentInput').value, 'New draft');
  assert.deepEqual(ui.refreshes, [1, 2]);
});

test('comment loading ignores stale results, reports failures and renders nested reply context safely', async () => {
  const ui = harness('comment.js');
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const old = ui.ctx.loadComments(1);
  ui.respond(async () => ({ ok: true, json: async () => [] }));
  await ui.ctx.loadComments(1);
  finish({ ok: false }); await old;
  assert.match(ui.get('comments-status').textContent, /No comments yet/);
  ui.respond(async () => ({ ok: false })); await ui.ctx.loadComments(1);
  assert.match(ui.get('comments-status').textContent, /Unable/);
  assert.equal(ui.get('comments-retry').disabled, false);
  ui.respond(async () => ({ ok: true, json: async () => [{ comment_id: 8, content: '<img onerror=bad>', replies: [
    { reply_id: 9, content: 'First', user_username: 'Sam' }, { reply_id: 10, parent_reply_id: 9, content: 'Second' }
  ] }] }));
  await ui.ctx.loadComments(1);
  const comment = ui.get('comment-list').children[0];
  assert.equal(comment.children[2].textContent, '<img onerror=bad>');
  const reply = comment.children.at(-1);
  assert.equal(reply.children[0].textContent, 'Replying to Sam');
  const form = reply.children.at(-1), input = form.children[0].children[0];
  input.value = 'Nested draft';
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const event = { preventDefault() {} };
  const pending = form.onsubmit(event); await form.onsubmit(event);
  assert.equal(ui.calls.at(-1)[0], '/pins/comments/8/replies');
  assert.deepEqual(JSON.parse(ui.calls.at(-1)[1].body), { content: 'Nested draft', parent_reply_id: 10 });
  finish({ ok: false }); await pending;
  assert.equal(input.value, 'Nested draft');
  assert.match(form.children[2].textContent, /Unable/);
});
