const express = require('express');
const router = express.Router();

const boardController = require('../controllers/boardController');
const { boardAccess } = require('../middleware/authorization');

// Routes
router.get('/users/:user_id/boards', boardController.getBoardsForUser);
router.post('/', boardController.createBoard);
router.get('/:board_id', boardAccess(req => req.params.board_id), boardController.getBoard);
router.get('/:board_id/pins', boardAccess(req => req.params.board_id), boardController.getPinsForBoard);

module.exports = router;
