const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, upload.array('files', 5), messageController.sendMessage);
router.get('/channel/:channelId', auth, messageController.getChannelMessages);
router.get('/direct/:userId', auth, messageController.getDirectMessages);
router.put('/:id', auth, messageController.updateMessage);
router.delete('/:id', auth, messageController.deleteMessage);
router.post('/:id/reactions', auth, messageController.addReaction);
router.delete('/:id/reactions', auth, messageController.removeReaction);

module.exports = router;