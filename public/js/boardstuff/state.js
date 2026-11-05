import { getSession } from '../api.js';

export const state = {
    pin_image_blob: null,      // Base64 image preview
    uploaded_file: null,       // Uploaded file object
    activeBoardId: null,       // Selected board ID
    userId: null,
    pinLikes: {},               // Like count mapping: { pinId: likeCount }
    fromCollections: false
};

export function onSessionReady(callback) {
    const run = async () => {
        try {
            const session = await getSession();
            if (!session) {
                window.location.replace('/login.html');
                return;
            }
            state.userId = session.user_id;
            await callback();
        } catch (error) {
            console.error('Session initialization failed:', error);
            alert('Unable to load your account. Please reload the page.');
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
}
