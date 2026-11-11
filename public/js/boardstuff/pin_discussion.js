import { apiFetch } from '../api.js';
import { loadComments } from './comment.js';
const sessions = new WeakMap();

export function setupPinDiscussion(modal, pin, state) {
  const like = modal.querySelector('#likeButton');
  const count = modal.querySelector('#likeCount');
  const likeStatus = modal.querySelector('#like-status');
  const input = modal.querySelector('#commentInput');
  const post = modal.querySelector('#postComment');
  const status = modal.querySelector('#comment-status');
  const session = {};
  sessions.set(modal, session);
  const current = () => sessions.get(modal) === session && modal.dataset.pinId === String(pin.id);
  let liking = false, posting = false;
  like.disabled = post.disabled = input.disabled = false;
  likeStatus.textContent = status.textContent = input.value = '';
  function renderLike() {
    like.setAttribute('aria-pressed', String(Boolean(pin.is_liked)));
    like.classList.toggle('liked', Boolean(pin.is_liked));
    like.querySelector('i').className = pin.is_liked ? 'fas fa-heart' : 'far fa-heart';
    count.textContent = Number(pin.like_count) || 0;
  }
  renderLike();
  like.onclick = async () => {
    if (liking || !current()) return;
    liking = like.disabled = true;
    likeStatus.textContent = 'Updating like…';
    try {
      const response = await apiFetch(`/pins/${pin.id}/like`, { method: 'POST' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      pin.is_liked = Boolean(data.is_liked);
      pin.like_count = data.like_count;
      state.pinLikes[pin.id] = pin.is_liked;
      if (current()) { renderLike(); likeStatus.textContent = ''; }
    } catch {
      if (current()) likeStatus.textContent = 'Unable to confirm your like. Reopen this pin to check before trying again.';
    } finally { liking = false; if (current()) like.disabled = false; }
  };
  post.onclick = async () => {
    if (posting || !current()) return;
    const content = input.value.trim();
    if (!content || content.length > 2000) { status.textContent = 'Enter a comment of 1–2,000 characters.'; input.focus(); return; }
    posting = post.disabled = input.disabled = true;
    status.textContent = 'Posting comment…';
    try {
      const response = await apiFetch(`/pins/${pin.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error();
      if (current()) { input.value = ''; status.textContent = 'Comment posted.'; await loadComments(pin.id); }
    } catch {
      if (current()) status.textContent = 'Unable to confirm your comment. Refresh comments before retrying; your draft is kept.';
    } finally { posting = false; if (current()) post.disabled = input.disabled = false; }
  };
  modal.querySelector('#comments-retry').onclick = () => { if (current()) return loadComments(pin.id); };
  loadComments(pin.id);
}
