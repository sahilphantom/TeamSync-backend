const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');
const { channelValidation } = require('../middleware/validation');

// Create a new channel
exports.createChannel = async (req, res) => {
  try {
    // Validate data
    const { error } = channelValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member of the workspace
    const isMember = workspace.members.some(
      member => member.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if channel name already exists in workspace
    const existingChannel = await Channel.findOne({
      workspace: workspace._id,
      name: req.body.name
    });

    if (existingChannel) {
      return res.status(400).json({ message: 'Channel name already exists' });
    }

    // Create channel
    const channel = new Channel({
      name: req.body.name,
      description: req.body.description,
      workspace: workspace._id,
      createdBy: req.user._id,
      isPrivate: req.body.isPrivate || false,
      members: req.body.isPrivate ? [req.user._id] : workspace.members.map(m => m.user)
    });

    await channel.save();

    // Add channel to workspace
    workspace.channels.push(channel._id);
    await workspace.save();

    const populatedChannel = await Channel.findById(channel._id)
      .populate('createdBy', 'username avatar')
      .populate('members', 'username avatar status');

    res.status(201).json({
      message: 'Channel created successfully',
      channel: populatedChannel
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get channels in workspace
exports.getWorkspaceChannels = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member of the workspace
    const isMember = workspace.members.some(
      member => member.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const channels = await Channel.find({
      workspace: workspace._id,
      $or: [
        { isPrivate: false },
        { isPrivate: true, members: req.user._id }
      ]
    })
      .populate('createdBy', 'username avatar')
      .populate('members', 'username avatar status');

    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get channel by ID
exports.getChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate('createdBy', 'username avatar')
      .populate('members', 'username avatar status')
      .populate('workspace', 'name');

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if user has access to the channel
    const hasAccess = channel.members.some(
      member => member._id.toString() === req.user._id.toString()
    );

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(channel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update channel
exports.updateChannel = async (req, res) => {
  try {
    const { error } = channelValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if user is the creator or workspace admin
    const workspace = await Workspace.findById(channel.workspace);
    const workspaceMember = workspace.members.find(
      m => m.user.toString() === req.user._id.toString()
    );

    const isCreator = channel.createdBy.toString() === req.user._id.toString();
    const isAdmin = workspaceMember && workspaceMember.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only channel creator or workspace admin can update the channel' });
    }

    channel.name = req.body.name;
    channel.description = req.body.description;
    channel.topic = req.body.topic || '';
    await channel.save();

    const populatedChannel = await Channel.findById(channel._id)
      .populate('createdBy', 'username avatar')
      .populate('members', 'username avatar status');

    res.json({
      message: 'Channel updated successfully',
      channel: populatedChannel
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add member to channel
exports.addMemberToChannel = async (req, res) => {
  try {
    const { userId } = req.body;
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if user has permission to add members
    const workspace = await Workspace.findById(channel.workspace);
    const workspaceMember = workspace.members.find(
      m => m.user.toString() === req.user._id.toString()
    );

    const isCreator = channel.createdBy.toString() === req.user._id.toString();
    const isAdmin = workspaceMember && workspaceMember.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only channel creator or workspace admin can add members' });
    }

    // Check if user is already a member
    const isAlreadyMember = channel.members.some(
      member => member.toString() === userId
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Check if user is a member of the workspace
    const isWorkspaceMember = workspace.members.some(
      member => member.user.toString() === userId
    );

    if (!isWorkspaceMember) {
      return res.status(400).json({ message: 'User is not a member of the workspace' });
    }

    // Add user to channel
    channel.members.push(userId);
    await channel.save();

    const populatedChannel = await Channel.findById(channel._id)
      .populate('members', 'username avatar status');

    res.json({
      message: 'Member added successfully',
      channel: populatedChannel
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};