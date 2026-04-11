// Import required modules
const express = require('express'); // Web framework for Node.js
const router = express.Router(); // Create Express router instance
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path'); // Utility for handling file paths

// Import pin controller for handling route logic
const pinController = require('../controllers/pinController');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    // Specify destination folder for uploaded files
    destination: function (req, file, cb) {
        cb(null, 'public/uploads'); // Save files to public/uploads directory
    },
    // Define filename for uploaded files
    filename: function (req, file, cb) {
        // Use file extension or default to .png
        const ext = path.extname(file.originalname) || '.png';
        // Generate unique filename using timestamp
        cb(null, Date.now() + ext);
    }
});

// Initialize Multer with storage configuration
const upload = multer({ storage });

// POST route for creating a new pin with an image upload
router.post('/', upload.single('image'), pinController.createPin);

// Route to get all pins
router.get('/', pinController.getAllPins);

// Route to get a specific pin by ID
router.get('/:id', pinController.getPinById);

// Route to toggle like status for a specific pin
router.post('/:id/like', pinController.toggleLike);

// Route to save a pin to a board
router.post('/:id/save', pinController.saveToBoard);

// Route to move a pin to a different board
router.put('/:id/move', pinController.movePinToBoard);

// Route to add a comment to a specific pin
router.post('/:pin_id/comments', pinController.addComment);

// Route to get comments and their replies for a specific pin
router.get('/:pin_id/comments', pinController.getCommentsWithReplies);

// Route to add a reply to a specific comment
router.post('/comments/:comment_id/replies', pinController.addReply);

// Route to create a pin from YouTube video data
router.post('/youtube', pinController.createYouTubePin);
router.post('/pixabay', pinController.createPixabayPin);
router.delete('/:id', pinController.deletePin);
module.exports = router;

// Export router for use in main application
module.exports = router;
