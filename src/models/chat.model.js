/**
 * Chat and Message Models
 * Defines the structure for chat conversations and messages
 */

const { ObjectId } = require('mongodb');

/**
 * Chat Room Schema
 * Represents a conversation between two or more users
 */
const chatSchema = {
  participants: [], // Array of user profile IDs (ObjectId)
  lastMessage: {
    content: '', // Last message content
    senderId: null, // ObjectId of sender
    timestamp: null, // Date of last message
  },
  unreadCount: {}, // Object mapping userId -> unread count
  createdAt: null, // Date
  updatedAt: null, // Date
};

/**
 * Message Schema
 * Represents an individual message in a chat
 */
const messageSchema = {
  chatId: null, // ObjectId reference to chat
  senderId: null, // ObjectId reference to sender's profile
  content: '', // Message text content
  type: 'text', // 'text', 'image', 'file' etc
  readBy: [], // Array of user IDs who have read this message
  createdAt: null, // Date
  updatedAt: null, // Date
};

/**
 * Create a new chat room
 */
function createChat(participants) {
  const now = new Date();
  return {
    participants: participants.map(id => id.toString()), // Store as strings (UUIDs)
    lastMessage: {
      content: '',
      senderId: null,
      timestamp: null,
    },
    unreadCount: participants.reduce((acc, id) => {
      acc[id.toString()] = 0;
      return acc;
    }, {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new message
 */
function createMessage(chatId, senderId, content, type = 'text') {
  const now = new Date();
  return {
    chatId: new ObjectId(chatId), // chatId is MongoDB ObjectId
    senderId: senderId.toString(), // senderId is UUID string
    content,
    type,
    readBy: [senderId.toString()], // Sender has "read" their own message
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  chatSchema,
  messageSchema,
  createChat,
  createMessage,
};
