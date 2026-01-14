/**
 * Chat Controller
 * Handles HTTP requests for chat operations
 */

const chatService = require("../services/chat.service");
const logger = require("../utils/logger");

/**
 * Get all chats for the current user
 */
async function getUserChats(req, res, next) {
  try {
    const userId = req.user.id;
    const chats = await chatService.getUserChats(userId);
    
    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    logger.error("Error in getUserChats controller:", error);
    next(error);
  }
}

/**
 * Get or create a chat with another user
 */
async function getOrCreateChat(req, res, next) {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.body;

    logger.info(`getOrCreateChat controller: userId=${userId}, otherUserId=${otherUserId}, body=${JSON.stringify(req.body)}`);

    if (!otherUserId) {
      logger.error('otherUserId is missing or null');
      return res.status(400).json({
        success: false,
        error: "otherUserId is required",
      });
    }

    if (userId === otherUserId) {
      return res.status(400).json({
        success: false,
        error: "Cannot create chat with yourself",
      });
    }

    const chat = await chatService.getOrCreateChat(userId, otherUserId);
    logger.info(`Chat created/retrieved: ${chat._id}`);
    
    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    logger.error("Error in getOrCreateChat controller:", error);
    next(error);
  }
}

/**
 * Get a specific chat by ID
 */
async function getChatById(req, res, next) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const chat = await chatService.getChatById(chatId);

    // Verify user is a participant
    const isParticipant = chat.participants.some(
      (id) => id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    logger.error("Error in getChatById controller:", error);
    next(error);
  }
}

/**
 * Get messages for a chat
 */
async function getChatMessages(req, res, next) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    // Verify user is a participant
    const chat = await chatService.getChatById(chatId);
    const isParticipant = chat.participants.some(
      (id) => id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const messages = await chatService.getChatMessages(chatId, limit, skip);
    
    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error("Error in getChatMessages controller:", error);
    next(error);
  }
}

/**
 * Send a message (via HTTP, though Socket.IO is preferred)
 */
async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { content, type = "text" } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Message content is required",
      });
    }

    const message = await chatService.sendMessage(chatId, userId, content, type);

    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit("message:new", {
        chatId,
        message,
      });
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    logger.error("Error in sendMessage controller:", error);
    next(error);
  }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    await chatService.markMessagesAsRead(chatId, userId);

    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit("messages:read", {
        chatId,
        userId,
      });
    }

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    logger.error("Error in markMessagesAsRead controller:", error);
    next(error);
  }
}

/**
 * Search for users
 */
/**
 * Get all users (excluding current user)
 */
async function getAllUsers(req, res, next) {
  try {
    const userId = req.user.id;
    const users = await chatService.getAllUsers(userId);
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error("Error in getAllUsers controller:", error);
    next(error);
  }
}

async function searchUsers(req, res, next) {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters",
      });
    }

    const users = await chatService.searchUsers(q, userId);
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error("Error in searchUsers controller:", error);
    next(error);
  }
}

/**
 * Delete a chat
 */
async function deleteChat(req, res, next) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    await chatService.deleteChat(chatId, userId);

    res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    logger.error("Error in deleteChat controller:", error);
    next(error);
  }
}

module.exports = {
  getUserChats,
  getOrCreateChat,
  getChatById,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  getAllUsers,
  searchUsers,
  deleteChat,
};
