const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketHandler = (socket, io) => {
  console.log('User connected:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        socket.userId = user._id;
        
        // Update user status to online
        user.status = 'online';
        user.lastSeen = new Date();
        await user.save();
        
        // Join user to their rooms (workspaces and channels)
        user.workspaces.forEach(workspaceId => {
          socket.join(`workspace:${workspaceId}`);
        });
        
        socket.emit('authenticated', { success: true });
        
        // Notify others that user is online
        user.workspaces.forEach(workspaceId => {
          socket.to(`workspace:${workspaceId}`).emit('user_online', {
            userId: user._id,
            status: 'online'
          });
        });
      }
    } catch (error) {
      socket.emit('authentication_error', { message: 'Authentication failed' });
    }
  });

  // Join a channel room
  socket.on('join_channel', (channelId) => {
    socket.join(`channel:${channelId}`);
    console.log(`User joined channel: ${channelId}`);
  });

  // Leave a channel room
  socket.on('leave_channel', (channelId) => {
    socket.leave(`channel:${channelId}`);
    console.log(`User left channel: ${channelId}`);
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { channelId, isDirect, recipientId } = data;
    
    if (isDirect && recipientId) {
      socket.to(`user:${recipientId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: true
      });
    } else if (channelId) {
      socket.to(`channel:${channelId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: true
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const { channelId, isDirect, recipientId } = data;
    
    if (isDirect && recipientId) {
      socket.to(`user:${recipientId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: false
      });
    } else if (channelId) {
      socket.to(`channel:${channelId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: false
      });
    }
  });

  // Handle new messages
  socket.on('new_message', (message) => {
    if (message.isDirect) {
      // Direct message
      socket.to(`user:${message.recipient}`).emit('new_message', message);
    } else {
      // Channel message
      socket.to(`channel:${message.channel}`).emit('new_message', message);
    }
  });

  // Handle message updates
  socket.on('message_updated', (data) => {
    const { message, channelId, isDirect, recipientId } = data;
    
    if (isDirect && recipientId) {
      socket.to(`user:${recipientId}`).emit('message_updated', message);
    } else if (channelId) {
      socket.to(`channel:${channelId}`).emit('message_updated', message);
    }
  });

  // Handle message deletion
  socket.on('message_deleted', (data) => {
    const { messageId, channelId, isDirect, recipientId } = data;
    
    if (isDirect && recipientId) {
      socket.to(`user:${recipientId}`).emit('message_deleted', { messageId });
    } else if (channelId) {
      socket.to(`channel:${channelId}`).emit('message_deleted', { messageId });
    }
  });

  // Handle reactions
  socket.on('reaction_added', (data) => {
    const { messageId, reaction, channelId, isDirect, recipientId } = data;
    
    if (isDirect && recipientId) {
      socket.to(`user:${recipientId}`).emit('reaction_added', {
        messageId,
        reaction
      });
    } else if (channelId) {
      socket.to(`channel:${channelId}`).emit('reaction_added', {
        messageId,
        reaction
      });
    }
  });

  socket.on('reaction_removed', (data) => {
    const { messageId, reaction, channelId, isDirect, recipientId } = data;
    
    if (isDirect && recipientId) {
      socket.to(`user:${recipientId}`).emit('reaction_removed', {
        messageId,
        reaction
      });
    } else if (channelId) {
      socket.to(`channel:${channelId}`).emit('reaction_removed', {
        messageId,
        reaction
      });
    }
  });

  // Handle user status changes
  socket.on('status_change', async (data) => {
    const { status } = data;
    
    try {
      const user = await User.findById(socket.userId);
      if (user) {
        user.status = status;
        await user.save();
        
        // Notify all workspaces the user is in
        user.workspaces.forEach(workspaceId => {
          socket.to(`workspace:${workspaceId}`).emit('user_status_changed', {
            userId: user._id,
            status
          });
        });
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      try {
        const user = await User.findById(socket.userId);
        if (user) {
          user.status = 'offline';
          user.lastSeen = new Date();
          await user.save();
          
          // Notify others that user is offline
          user.workspaces.forEach(workspaceId => {
            socket.to(`workspace:${workspaceId}`).emit('user_offline', {
              userId: user._id,
              status: 'offline',
              lastSeen: user.lastSeen
            });
          });
        }
      } catch (error) {
        console.error('Error updating user status on disconnect:', error);
      }
    }
  });
};

module.exports = { socketHandler };