/**
 * Socket.IO Event Handlers
 * Manages real-time chat communications
 */

const logger = require("../utils/logger");
const chatService = require("../services/chat.service");

// Store active user connections: userId -> socketId
const activeUsers = new Map();

/**
 * Initialize Socket.IO handlers
 */
function initializeSocketHandlers(io) {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth.userId;
      if (!userId) {
        return next(new Error("Authentication error: userId required"));
      }
      
      // Attach userId to socket
      socket.userId = userId;
      next();
    } catch (error) {
      logger.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    logger.info(`User connected: ${userId} (socket: ${socket.id})`);

    // Store user connection
    activeUsers.set(userId, socket.id);

    // Emit online status to other users
    socket.broadcast.emit("user:online", { userId });

    // Join user to their personal room
    socket.join(userId);

    // Handle user joining a chat
    socket.on("chat:join", async (chatId) => {
      try {
        logger.info(`User ${userId} joining chat ${chatId}`);
        socket.join(`chat:${chatId}`);
        
        // Mark messages as read
        await chatService.markMessagesAsRead(chatId, userId);
        
        // Notify other participants that messages were read
        socket.to(`chat:${chatId}`).emit("messages:read", {
          chatId,
          userId,
        });
      } catch (error) {
        logger.error("Error joining chat:", error);
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    // Handle user leaving a chat
    socket.on("chat:leave", (chatId) => {
      logger.info(`User ${userId} leaving chat ${chatId}`);
      socket.leave(`chat:${chatId}`);
    });

    // Handle sending a message
    socket.on("message:send", async (data) => {
      try {
        const { chatId, content, type = "text" } = data;
        
        logger.info(`User ${userId} sending message to chat ${chatId}`);

        // Save message to database
        const message = await chatService.sendMessage(chatId, userId, content, type);

        // Emit message to all users in the chat
        io.to(`chat:${chatId}`).emit("message:new", {
          chatId,
          message,
        });

        // Send notification to offline users or users not in this chat room
        const chat = await chatService.getChatById(chatId);
        const otherParticipants = chat.participants.filter(
          (p) => p.toString() !== userId
        );

        otherParticipants.forEach((participantId) => {
          const participantSocketId = activeUsers.get(participantId.toString());
          if (participantSocketId) {
            // Notify user about new message (for notification badge)
            io.to(participantId.toString()).emit("message:notification", {
              chatId,
              senderId: userId,
              preview: content.substring(0, 50),
              timestamp: message.createdAt,
            });
          }
        });
      } catch (error) {
        logger.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicator
    socket.on("typing:start", ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit("typing:start", {
        chatId,
        userId,
      });
    });

    socket.on("typing:stop", ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit("typing:stop", {
        chatId,
        userId,
      });
    });

    // Handle marking messages as read
    socket.on("messages:read", async ({ chatId }) => {
      try {
        await chatService.markMessagesAsRead(chatId, userId);
        
        // Notify other participants
        socket.to(`chat:${chatId}`).emit("messages:read", {
          chatId,
          userId,
        });
      } catch (error) {
        logger.error("Error marking messages as read:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);
      activeUsers.delete(userId);
      
      // Emit offline status to other users
      socket.broadcast.emit("user:offline", { userId });
    });
  });

  return io;
}

module.exports = initializeSocketHandlers;
