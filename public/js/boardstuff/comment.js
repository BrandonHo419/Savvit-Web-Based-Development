import { apiFetch } from '../api.js';

let sequence = 0;
const currentPin = id => String(document.getElementById('viewModal').dataset.pinId) === String(id);

function renderComment(entry, className) {
  const container = document.createElement('div');
  container.className = className;
  const author = document.createElement('strong');
  author.textContent = entry.user_username || `User${entry.user_id}`;
  const time = document.createElement('span');
  time.className = 'timestamp';
  const date = new Date(entry.created_at);
  time.textContent = Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
  const content = document.createElement('p');
  content.className = `${className}-text`;
  content.textContent = entry.content;
  container.append(author, time, content);
  return container;
}

export async function loadComments(pinId) {
  if (!currentPin(pinId)) return;
  const request = ++sequence;
  const list = document.getElementById('comment-list');
  const count = document.getElementById('comment-count');
  const status = document.getElementById('comments-status');
  const refresh = document.getElementById('comments-retry');
  refresh.disabled = true;
  list.replaceChildren();
  count.textContent = '…';
  status.textContent = 'Loading comments…';
  try {
    const response = await apiFetch(`/pins/${pinId}/comments`);
    if (!response.ok) throw new Error();
    const comments = await response.json();
    if (!currentPin(pinId) || request !== sequence) return;
    for (const comment of comments) {
      const element = renderComment(comment, 'comment');
      addReplyForm(element, pinId, comment.comment_id);
      const replies = comment.replies || [];
      // Flat reply rows keep long threads usable on narrow screens.
      for (const reply of replies) {
        const row = renderComment(reply, 'reply');
        if (reply.parent_reply_id) {
          const parent = replies.find(item => Number(item.reply_id) === Number(reply.parent_reply_id));
          const context = document.createElement('p');
          context.textContent = parent ? `Replying to ${parent.user_username || `User${parent.user_id}`}` : 'Replying to an earlier reply';
          row.prepend(context);
        }
        addReplyForm(row, pinId, comment.comment_id, reply.reply_id);
        element.appendChild(row);
      }
      list.appendChild(element);
    }
    count.textContent = comments.length;
    status.textContent = comments.length ? '' : 'No comments yet. Start the conversation.';
  } catch {
    if (!currentPin(pinId) || request !== sequence) return;
    count.textContent = '—';
    status.textContent = 'Unable to load comments. Please refresh to try again.';
  } finally {
    if (currentPin(pinId) && request === sequence) refresh.disabled = false;
  }
}

function addReplyForm(container, pinId, commentId, parentId = null) {
  const generation = sequence;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = parentId ? 'Reply to this reply' : 'Reply';
  toggle.setAttribute('aria-expanded', 'false');
  const form = document.createElement('form');
  form.hidden = true;
  form.className = 'reply-box';
  const label = document.createElement('label');
  label.textContent = 'Your reply';
  const input = document.createElement('textarea');
  input.maxLength = 2000;
  input.required = true;
  label.appendChild(input);
  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'Post reply';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  form.append(label, send, status);
  container.append(toggle, form);
  let busy = false;
  toggle.onclick = () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) input.focus();
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy || !currentPin(pinId) || generation !== sequence) return;
    const content = input.value.trim();
    if (!content || content.length > 2000) { status.textContent = 'Enter a reply of 1–2,000 characters.'; return; }
    busy = input.disabled = send.disabled = true;
    status.textContent = 'Posting reply…';
    try {
      const response = await apiFetch(`/pins/comments/${commentId}/replies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parent_reply_id: parentId })
      });
      if (!response.ok) throw new Error();
      if (currentPin(pinId) && generation === sequence) await loadComments(pinId);
    } catch {
      status.textContent = 'Unable to confirm your reply. Your draft is kept; check comments before retrying.';
    } finally { busy = input.disabled = send.disabled = false; }
  };
}
