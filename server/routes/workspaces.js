const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const auth = require('../middleware/auth');

router.post('/', auth, workspaceController.createWorkspace);
router.get('/', auth, workspaceController.getUserWorkspaces);
router.get('/:id', auth, workspaceController.getWorkspace);
router.put('/:id', auth, workspaceController.updateWorkspace);
router.post('/:id/invite', auth, workspaceController.inviteToWorkspace);
router.post('/join', auth, workspaceController.joinWorkspace);

module.exports = router;