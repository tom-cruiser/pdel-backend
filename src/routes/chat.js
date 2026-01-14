/**
 * Chat Routes
 * API endpoints for chat operations
 */

const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All chat routes require authentication
router.use(authMiddleware);

// Get all chats for current user
router.get("/", chatController.getUserChats);

// Get all users
router.get("/users", chatController.getAllUsers);

// Search for users
router.get("/users/search", chatController.searchUsers);

// Get or create a chat with another user
router.post("/", chatController.getOrCreateChat);

// Get specific chat by ID
router.get("/:chatId", chatController.getChatById);

// Get messages for a chat
router.get("/:chatId/messages", chatController.getChatMessages);

// Send a message (prefer Socket.IO for real-time)
router.post("/:chatId/messages", chatController.sendMessage);

// Mark messages as read
router.post("/:chatId/read", chatController.markMessagesAsRead);

// Delete a chat
router.delete("/:chatId", chatController.deleteChat);

module.exports = router;
