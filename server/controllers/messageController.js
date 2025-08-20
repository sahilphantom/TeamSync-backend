const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');
const File = require('../models/File');
const { messageValidation } = require('../middleware/validation');

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    // Validate data
    const { error } = messageValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let channel, recipient;

    if (req.body.isDirect) {
      // Direct message
      recipient = await User.findById(req.body.recipient);
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
      }
    } else {
      // Channel message
      channel = await Channel.findById(req.body.channel);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }

      // Check if user is a member of the channel
      const isMember = channel.members.some(
        member => member.toString() === req.user._id.toString()
      );

      if (!isMember) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Create message
    const message = new Message({
      content: req.body.content,
      sender: req.user._id,
      channel: req.body.isDirect ? null : req.body.channel,
      recipient: req.body.isDirect ? req.body.recipient : null,
      isDirect: req.body.isDirect,
      thread: req.body.thread || null
    });

    // Handle file attachments
    if (req.files && req.files.length > 0) {
      const fileIds = req.files.map(file => file.id);
      message.files = fileIds;
    }

    await message.save();

    // Populate message with sender info
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar status')
      .populate('files')
      .populate('mentions', 'username avatar');

    res.status(201).json({
      message: 'Message sent successfully',
      message: populatedMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get messages in channel
exports.getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if user is a member of the channel
    const isMember = channel.members.some(
      member => member.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.find({ channel: channelId })
      .populate('sender', 'username avatar status')
      .populate('files')
      .populate('mentions', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ channel: channelId });

    res.json({
      messages,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get direct messages
exports.getDirectMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId, isDirect: true },
        { sender: userId, recipient: req.user._id, isDirect: true }
      ]
    })
      .populate('sender', 'username avatar status')
      .populate('files')
      .populate('mentions', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      $or: [
        { sender: req.user._id, recipient: userId, isDirect: true },
        { sender: userId, recipient: req.user._id, isDirect: true }
      ]
    });

    res.json({
      messages,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update message
exports.updateMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    // Check if message is too old to edit (e.g., 15 minutes)
    const editTimeLimit = 15 * 60 * 1000; // 15 minutes in milliseconds
    const isEditable = Date.now() - message.createdAt < editTimeLimit;

    if (!isEditable) {
      return res.status(400).json({ message: 'Message can no longer be edited' });
    }

    message.content = content;
    message.edited = {
      at: new Date(),
      by: req.user._id,
      isEdited: true
    };

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar status')
      .populate('files')
      .populate('mentions', 'username avatar');

    res.json({
      message: 'Message updated successfully',
      message: populatedMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender or has admin privileges
    const isSender = message.sender.toString() === req.user._id.toString();
    
    let isAdmin = false;
    if (message.channel) {
      const channel = await Channel.findById(message.channel);
      if (channel) {
        const workspace = await Workspace.findById(channel.workspace);
        const workspaceMember = workspace.members.find(
          m => m.user.toString() === req.user._id.toString()
        );
        isAdmin = workspaceMember && workspaceMember.role === 'admin';
      }
    }

    if (!isSender && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    await Message.findByIdAndDelete(req.params.id);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add reaction to message
exports.addReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      reaction => reaction.emoji === emoji
    );

    if (existingReaction) {
      // Check if user already added this reaction
      const userAlreadyReacted = existingReaction.users.some(
        user => user.toString() === req.user._id.toString()
      );

      if (userAlreadyReacted) {
        return res.status(400).json({ message: 'You already reacted with this emoji' });
      }

      // Add user to existing reaction
      existingReaction.users.push(req.user._id);
      existingReaction.count += 1;
    } else {
      // Create new reaction
      message.reactions.push({
        emoji,
        users: [req.user._id],
        count: 1
      });
    }

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('reactions.users', 'username avatar');

    res.json({
      message: 'Reaction added successfully',
      message: populatedMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove reaction from message
exports.removeReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Find the reaction
    const reactionIndex = message.reactions.findIndex(
      reaction => reaction.emoji === emoji
    );

    if (reactionIndex === -1) {
      return res.status(404).json({ message: 'Reaction not found' });
    }

    const reaction = message.reactions[reactionIndex];

    // Check if user has this reaction
    const userIndex = reaction.users.findIndex(
      user => user.toString() === req.user._id.toString()
    );

    if (userIndex === -1) {
      return res.status(400).json({ message: 'You have not reacted with this emoji' });
    }

    // Remove user from reaction
    reaction.users.splice(userIndex, 1);
    reaction.count -= 1;

    // Remove reaction if no users left
    if (reaction.users.length === 0) {
      message.reactions.splice(reactionIndex, 1);
    }

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('reactions.users', 'username avatar');

    res.json({
      message: 'Reaction removed successfully',
      message: populatedMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};