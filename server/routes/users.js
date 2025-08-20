const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/:id', auth, userController.getUserProfile);
router.put('/profile', auth, upload.single('avatar'), userController.updateProfile);
router.put('/notifications', auth, userController.updateNotificationPreferences);
router.get('/search/users', auth, userController.searchUsers);
router.get('/workspace/:workspaceId/online', auth, userController.getOnlineUsers);

module.exports = router;