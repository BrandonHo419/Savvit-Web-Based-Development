export const state = {
    pin_image_blob: null,      // Base64 image preview
    uploaded_file: null,       // Uploaded file object
    activeBoardId: null,       // Selected board ID
    userId: 1,                 // Currently logged-in user (replace dynamically as needed)
    pinLikes: {},               // Like count mapping: { pinId: likeCount }
    fromCollections: false
};
