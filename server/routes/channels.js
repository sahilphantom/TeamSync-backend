const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const auth = require('../middleware/auth');

router.post('/:workspaceId', auth, channelController.createChannel);
router.get('/:workspaceId', auth, channelController.getWorkspaceChannels);
router.get('/:id', auth, channelController.getChannel);
router.put('/:id', auth, channelController.updateChannel);
router.post('/:id/members', auth, channelController.addMemberToChannel);

module.exports = router;