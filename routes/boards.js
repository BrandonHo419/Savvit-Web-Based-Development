const express = require('express');
const router = express.Router();

const boardController = require('../controllers/boardController');

// Routes
router.get('/users/:user_id/boards', boardController.getBoardsForUser);
router.post('/', boardController.createBoard);
router.get('/:board_id/pins', boardController.getPinsForBoard);

module.exports = router;