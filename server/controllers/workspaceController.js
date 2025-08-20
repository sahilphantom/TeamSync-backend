const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const User = require('../models/User');
const { workspaceValidation } = require('../middleware/validation');

// Create a new workspace
exports.createWorkspace = async (req, res) => {
  try {
    // Validate data
    const { error } = workspaceValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Create workspace
    const workspace = new Workspace({
      name: req.body.name,
      description: req.body.description,
      owner: req.user._id,
      members: [{
        user: req.user._id,
        role: 'admin'
      }]
    });

    await workspace.save();

    // Create general channel
    const generalChannel = new Channel({
      name: 'general',
      description: 'Company-wide announcements and work-based matters',
      workspace: workspace._id,
      createdBy: req.user._id,
      members: [req.user._id]
    });

    await generalChannel.save();

    // Add channel to workspace
    workspace.channels.push(generalChannel._id);
    await workspace.save();

    // Add workspace to user
    await User.findByIdAndUpdate(req.user._id, {
      $push: { workspaces: workspace._id }
    });

    const populatedWorkspace = await Workspace.findById(workspace._id)
      .populate('owner', 'username email avatar')
      .populate('members.user', 'username email avatar status');

    res.status(201).json({
      message: 'Workspace created successfully',
      workspace: populatedWorkspace
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's workspaces
exports.getUserWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      'members.user': req.user._id
    })
      .populate('owner', 'username email avatar')
      .populate('members.user', 'username email avatar status')
      .populate('channels', 'name isPrivate');

    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get workspace by ID
exports.getWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('owner', 'username email avatar')
      .populate('members.user', 'username email avatar status')
      .populate({
        path: 'channels',
        select: 'name description isPrivate topic members',
        populate: {
          path: 'members',
          select: 'username avatar status'
        }
      });

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member
    const isMember = workspace.members.some(
      member => member.user._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update workspace
exports.updateWorkspace = async (req, res) => {
  try {
    const { error } = workspaceValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is admin
    const member = workspace.members.find(
      m => m.user.toString() === req.user._id.toString()
    );

    if (!member || member.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update the workspace' });
    }

    workspace.name = req.body.name;
    workspace.description = req.body.description;
    await workspace.save();

    res.json({
      message: 'Workspace updated successfully',
      workspace
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Invite user to workspace
exports.inviteToWorkspace = async (req, res) => {
  try {
    const { email } = req.body;
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is admin
    const member = workspace.members.find(
      m => m.user.toString() === req.user._id.toString()
    );

    if (!member || member.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can invite users' });
    }

    // Find user by email
    const userToInvite = await User.findOne({ email });

    if (!userToInvite) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member
    const isAlreadyMember = workspace.members.some(
      m => m.user.toString() === userToInvite._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Add user to workspace
    workspace.members.push({
      user: userToInvite._id,
      role: 'member'
    });

    await workspace.save();

    // Add workspace to user's workspaces
    await User.findByIdAndUpdate(userToInvite._id, {
      $push: { workspaces: workspace._id }
    });

    const populatedWorkspace = await Workspace.findById(workspace._id)
      .populate('members.user', 'username email avatar status');

    res.json({
      message: 'User invited successfully',
      workspace: populatedWorkspace
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join workspace with invite code
exports.joinWorkspace = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const workspace = await Workspace.findOne({ inviteCode });

    if (!workspace) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    // Check if user is already a member
    const isAlreadyMember = workspace.members.some(
      m => m.user.toString() === req.user._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'You are already a member' });
    }

    // Add user to workspace
    workspace.members.push({
      user: req.user._id,
      role: 'member'
    });

    await workspace.save();

    // Add workspace to user's workspaces
    await User.findByIdAndUpdate(req.user._id, {
      $push: { workspaces: workspace._id }
    });

    res.json({
      message: 'Joined workspace successfully',
      workspace
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};