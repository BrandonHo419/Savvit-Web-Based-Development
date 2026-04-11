//COMMENT LOADING & REPLY LOGIC

// --- COMMENT HANDLING ---
// Load Comments for a Pin
import { state } from './state.js';
import { generateAvatarFallback } from './userProfile.js';

export async function loadComments(pinId) {
  try {
    const res = await fetch(`/pins/${pinId}/comments`);
    const comments = await res.json();

    // get comment list and count elements
    const commentList = document.getElementById('comment-list');
    const commentCount = document.getElementById('comment-count');
    commentList.innerHTML = '';

    //
    comments.forEach(comment => {
      const username = comment.user_username || `User${comment.user_id}`;
      const displayName = comment.display_name || username;
      const avatarUrl = comment.user_avatar_url;

      const commentEl = document.createElement('div');
      commentEl.className = 'comment';
      commentEl.dataset.commentId = comment.comment_id;

      const avatarHTML = avatarUrl
        ? `<img src="${avatarUrl}" class="small-avatar" alt="${displayName}'s avatar">`
        : `<div class="small-avatar avatar-fallback">${generateAvatarFallback(displayName)}</div>`;

      const repliesHTML = comment.replies.map(reply => {
        const replyUsername = reply.user_username || `User${reply.user_id}`;
        const replyName = reply.display_name || replyUsername;
        const replyAvatar = reply.user_avatar_url;

        const replyAvatarHTML = replyAvatar
          ? `<img src="${replyAvatar}" class="small-avatar" alt="${replyName}'s avatar">`
          : `<div class="small-avatar avatar-fallback">${generateAvatarFallback(replyName)}</div>`;

        return `
          <div class="reply">
            <div class="user-profile">
              <a href="/users/${reply.user_id}" class="reply-user-link">
                ${replyAvatarHTML}
                <strong>${replyName}</strong>
              </a>
              <span class="timestamp">${new Date(reply.created_at).toLocaleString()}</span>
            </div>
            <div class="reply-text">${reply.content}</div>
          </div>
        `;
      }).join('');

      commentEl.innerHTML = `
        <div class="user-profile">
          <a href="/users/${comment.user_id}" class="comment-user-link">
            ${avatarHTML}
            <strong>${displayName}</strong>
          </a>
          <span class="timestamp">${new Date(comment.created_at).toLocaleString()}</span>
        </div>
        <div class="comment-text">${comment.content}</div>
        <div class="replies">${repliesHTML}</div>
        <button class="reply-btn">Reply</button>
      `;

      commentList.appendChild(commentEl);
      attachReplyHandler(commentEl.querySelector('.reply-btn'));
    });

    commentCount.textContent = comments.length;
  } catch (err) {
    console.error("Failed to load comments:", err);
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
        const res = await fetch(`/pins/comments/${commentId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: replyText, user_id: state.userId })
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

