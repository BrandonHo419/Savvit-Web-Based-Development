// this is userprofile for comments and posts

// Generates a fallback avatar using initials from a name or username
export function generateAvatarFallback(nameOrUsername) {
    if (!nameOrUsername) return 'U';
    const words = nameOrUsername.trim().split(' ');
    let initials = words.map(w => w[0]).join('').toUpperCase();
    if (initials.length < 2 && words[0].length > 1) {
        initials = words[0].slice(0, 2).toUpperCase(); // e.g., "alice" → "AL"
    }
    return initials.slice(0, 2);
}

// Populates user profile information in a modal
export function populateUserProfile(user) {
    // Get the user profile container element
    const userProfile = document.getElementById('modalUserProfile');
    // Exit if container element is not found
    if (!userProfile) return;

    // Determine display name, falling back to username or user_id
    const rawName = user.display_name || user.username || `User${user.user_id}`;
    // Get first word of name for display
    const firstWord = rawName.trim().split(' ')[0];
    // Truncate first word to 9 characters with ellipsis if longer
    const displayName = firstWord.length > 10 ? firstWord.slice(0, 9) + '…' : firstWord;
    // Get avatar URL from user object
    const avatarURL = user.avatar_url;
    // Construct profile link using user ID
    const profileLink = `/users/${user.user_id}`;

    // Generate avatar HTML: use image if avatarURL exists, otherwise use fallback initials
    const avatarHTML = avatarURL
        ? `<img src="${avatarURL}" class="avatar" alt="${displayName}'s avatar" onerror="this.style.display='none';">`
        : `<div class="avatar avatar-fallback">${generateAvatarFallback(displayName)}</div>`;

    // Update user profile container with avatar, name, and follow button
    userProfile.innerHTML = `
        <a href="${profileLink}" class="user-link avatar-wrapper">
            ${avatarHTML}
        </a>
        <div class="user-info">
            <strong title="${firstWord}">${displayName}</strong>
            <button class="follow-btn">Follow</button>
        </div>
    `;
}
