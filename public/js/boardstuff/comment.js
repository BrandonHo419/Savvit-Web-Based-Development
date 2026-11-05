import { apiFetch } from '../api.js';
//COMMENT LOADING & REPLY LOGIC

// --- COMMENT HANDLING ---
// Load Comments for a Pin

function renderComment(entry, className) {
  const container = document.createElement('div');
  container.className = className;
  const author = document.createElement('strong');
  author.textContent = entry.user_username || `User${entry.user_id}`;
  const time = document.createElement('span');
  time.className = 'timestamp';
  time.textContent = new Date(entry.created_at).toLocaleString();
  const content = document.createElement('p');
  content.className = `${className}-text`;
  content.textContent = entry.content;
  container.append(author, time, content);
  return container;
}

export async function loadComments(pinId) {
  const commentList = document.getElementById('comment-list');
  const commentCount = document.getElementById('comment-count');
  commentList.replaceChildren();
  commentCount.textContent = '0';
  try {
    const res = await apiFetch(`/pins/${pinId}/comments`);
    if (!res.ok) throw new Error('Unable to load comments');
    const comments = await res.json();
    if (String(document.getElementById('viewModal').dataset.pinId) !== String(pinId)) return;
    comments.forEach(comment => {
      const commentEl = renderComment(comment, 'comment');
      commentEl.dataset.commentId = comment.comment_id;
      const replies = document.createElement('div');
      replies.className = 'replies';
      (comment.replies || []).forEach(reply => replies.appendChild(renderComment(reply, 'reply')));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'reply-btn';
      button.textContent = 'Reply';
      commentEl.append(replies, button);
      commentList.appendChild(commentEl);
      attachReplyHandler(button);
    });
    commentCount.textContent = comments.length;
  } catch (err) {
    console.error('Failed to load comments:', err);
    if (String(document.getElementById('viewModal').dataset.pinId) === String(pinId)) {
      commentList.textContent = 'Unable to load comments.';
    }
  }
}
// -- Attach Reply Box to a Comment---------------------
export function attachReplyHandler(btn) {
  btn?.addEventListener("click", function () {
    const commentDiv = this.closest(".comment");
    const existingBox = commentDiv.querySelector(".reply-box");
    if (existingBox) return existingBox.remove(); // Toggle off if already exists

    const replyBox = document.createElement("div");
    replyBox.className = "reply-box";
    replyBox.innerHTML = `
      <input type="text" class="reply-input" placeholder="Reply...">
      <button class="send-reply"><i class="fas fa-paper-plane"></i></button>
    `;

    commentDiv.appendChild(replyBox);

    // Send reply to backend
    replyBox.querySelector(".send-reply")?.addEventListener("click", async () => {
      const replyText = replyBox.querySelector(".reply-input").value.trim();
      const pinId = document.getElementById('viewModal')?.dataset.pinId;
      const commentId = commentDiv.dataset.commentId;
      if (!replyText || !commentId) return;

      try {
        const res = await apiFetch(`/pins/comments/${commentId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: replyText })
        });

        if (res.ok) {
          replyBox.remove();
          loadComments(pinId); // Reload updated list
        } else {
          alert("Failed to reply.");
        }
      } catch (err) {
        console.error(" Reply failed:", err);
      }
    });
  });
}

