const express = require('express');
const router = express.Router();

const boardController = require('../controllers/boardController');
const sharing = require('../controllers/boardSharingController');
const { boardAccess } = require('../middleware/authorization');

// Routes
router.get('/shared', boardController.getSharedBoards);
router.get('/public', boardController.getPublicBoards);
router.get('/users/:user_id/boards', boardController.getBoardsForUser);
router.post('/', boardController.createBoard);
router.get('/:board_id/viewers', boardAccess(req => req.params.board_id, { ownerOnly: true }), sharing.listViewers);
router.post('/:board_id/viewers', boardAccess(req => req.params.board_id, { ownerOnly: true }), sharing.addViewer);
router.delete('/:board_id/viewers/:user_id', boardAccess(req => req.params.board_id, { ownerOnly: true }), sharing.removeViewer);
router.delete('/:board_id/pins/:pin_id/reference', boardAccess(req => req.params.board_id, { ownerOnly: true }), boardController.removeReference);
router.delete('/:board_id', boardAccess(req => req.params.board_id, { ownerOnly: true }), boardController.deleteBoard);
router.patch('/:board_id', boardAccess(req => req.params.board_id, { ownerOnly: true }), boardController.updateBoard);
router.get('/:board_id', boardAccess(req => req.params.board_id), boardController.getBoard);
router.get('/:board_id/pins', boardAccess(req => req.params.board_id), boardController.getPinsForBoard);

module.exports = router;
