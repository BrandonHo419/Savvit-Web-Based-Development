import { safeHttpUrl } from '../content.js';
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
    const container = document.getElementById('modalUserProfile');
    if (!container) return;
    container.replaceChildren();
    const name = user.display_name || user.username || `User${user.user_id}`;
    const avatarUrl = safeHttpUrl(user.avatar_url);
    const avatar = document.createElement(avatarUrl ? 'img' : 'div');
    avatar.className = 'avatar avatar-fallback';
    if (avatarUrl) {
        avatar.src = avatarUrl;
        avatar.alt = `${name}'s avatar`;
    } else {
        avatar.textContent = generateAvatarFallback(name);
    }
    const label = document.createElement('strong');
    label.textContent = name;
    container.append(avatar, label);
}
