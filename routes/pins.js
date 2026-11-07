// Import required modules
const express = require('express'); // Web framework for Node.js
const router = express.Router(); // Create Express router instance
const { imageUpload } = require('../middleware/imageUpload');

// Import pin controller for handling route logic
const pinController = require('../controllers/pinController');
const { boardAccess, pinAccess, commentAccess } = require('../middleware/authorization');
const ownDestination = boardAccess(req => req.body?.board_id, { ownerOnly: true });
const readPin = pinAccess(req => req.params.id || req.params.pin_id);
const ownPin = pinAccess(req => req.params.id, { ownerOnly: true });

// Parse and validate the upload before checking the multipart destination.
router.post('/', imageUpload, ownDestination, pinController.createPin);

// Route to get all pins
router.get('/', pinController.getAllPins);

// Route to get a specific pin by ID
router.get('/:id', readPin, pinController.getPinById);

// Route to toggle like status for a specific pin
router.post('/:id/like', readPin, pinController.toggleLike);

// Route to save a pin to a board
router.post('/:id/save', readPin, ownDestination, pinController.saveToBoard);

// Route to move a pin to a different board
router.put('/:id/move', ownPin, ownDestination, pinController.movePinToBoard);

// Route to add a comment to a specific pin
router.post('/:pin_id/comments', readPin, pinController.addComment);

// Route to get comments and their replies for a specific pin
router.get('/:pin_id/comments', readPin, pinController.getCommentsWithReplies);

// Route to add a reply to a specific comment
router.post('/comments/:comment_id/replies', commentAccess, pinController.addReply);

// Route to create a pin from YouTube video data
router.post('/youtube', ownDestination, pinController.createYouTubePin);
router.post('/pixabay', ownDestination, pinController.createPixabayPin);
router.delete('/:id', ownPin, pinController.deletePin);
module.exports = router;

// Export router for use in main application
module.exports = router;
