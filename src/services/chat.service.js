/**
 * Chat Service
 * Handles business logic for chat and messaging
 */

const { ObjectId } = require("mongodb");
const mongo = require("../db/mongo");
const logger = require("../utils/logger");
const { createChat, createMessage } = require("../models/chat.model");

/**
 * Get or create a chat between users
 */
async function getOrCreateChat(user1Id, user2Id) {
  try {
    logger.info(`getOrCreateChat service: user1Id=${user1Id}, user2Id=${user2Id}`);
    const { chats, profiles } = mongo.getCollections();
    
    const participants = [user1Id, user2Id].sort();
    logger.info(`Sorted participants: ${JSON.stringify(participants)}`);

    // Check if chat already exists
    let chat = await chats.findOne({
      participants: { $all: participants },
      $expr: { $eq: [{ $size: "$participants" }, 2] },
    });

    if (!chat) {
      // Create new chat
      logger.info(`Creating new chat for participants: ${JSON.stringify(participants)}`);
      const newChat = createChat([user1Id, user2Id]);
      logger.info(`New chat object created: ${JSON.stringify(newChat)}`);
      const result = await chats.insertOne(newChat);
      chat = { _id: result.insertedId, ...newChat };
      logger.info(`Created new chat: ${result.insertedId}`);
    } else {
      logger.info(`Existing chat found: ${chat._id}`);
    }

    // Populate participant details
    logger.info(`Fetching participant details for: ${JSON.stringify(chat.participants)}`);
    const participantDetails = await profiles
      .find({ _id: { $in: chat.participants } })
      .project({ full_name: 1, email: 1 })
      .toArray();
    
    logger.info(`Found ${participantDetails.length} participant details`);

    return {
      ...chat,
      participantDetails,
    };
  } catch (error) {
    logger.error("Error in getOrCreateChat:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
}

/**
 * Get all chats for a user
 */
async function getUserChats(userId) {
  try {
    const { chats, profiles } = mongo.getCollections();
    
    const userChats = await chats
      .find({
        participants: userId,
      })
      .sort({ "lastMessage.timestamp": -1 })
      .toArray();

    // Populate participant details
    const chatsWithDetails = await Promise.all(
      userChats.map(async (chat) => {
        const otherParticipantIds = chat.participants.filter(
          (id) => id.toString() !== userId
        );

        const participants = await profiles
          .find({ _id: { $in: otherParticipantIds } })
          .project({ full_name: 1, email: 1 })
          .toArray();

        return {
          ...chat,
          participantDetails: participants,
          unreadCount: chat.unreadCount[userId] || 0,
        };
      })
    );

    return chatsWithDetails;
  } catch (error) {
    logger.error("Error in getUserChats:", error);
    throw error;
  }
}

/**
 * Get a specific chat by ID
 */
async function getChatById(chatId) {
  try {
    const { chats, profiles } = mongo.getCollections();
    
    const chat = await chats.findOne({ _id: new ObjectId(chatId) });
    
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Populate participant details
    const participants = await profiles
      .find({ _id: { $in: chat.participants } })
      .project({ full_name: 1, email: 1 })
      .toArray();

    return {
      ...chat,
      participantDetails: participants,
    };
  } catch (error) {
    logger.error("Error in getChatById:", error);
    throw error;
  }
}

/**
 * Get messages for a chat
 */
async function getChatMessages(chatId, limit = 50, skip = 0) {
  try {
    const { chat_messages, profiles } = mongo.getCollections();
    
    const messages = await chat_messages
      .find({ chatId: new ObjectId(chatId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate sender details
    const messagesWithSender = await Promise.all(
      messages.map(async (message) => {
        const sender = await profiles.findOne(
          { _id: message.senderId },
          { projection: { full_name: 1, email: 1 } }
        );

        return {
          ...message,
          sender,
        };
      })
    );

    return messagesWithSender.reverse(); // Return in chronological order
  } catch (error) {
    logger.error("Error in getChatMessages:", error);
    throw error;
  }
}

/**
 * Send a message in a chat
 */
async function sendMessage(chatId, senderId, content, type = "text") {
  try {
    const { chat_messages, chats } = mongo.getCollections();
    
    // Verify chat exists and user is participant
    const chat = await getChatById(chatId);
    const isParticipant = chat.participants.some(
      (id) => id.toString() === senderId
    );

    if (!isParticipant) {
      throw new Error("User is not a participant in this chat");
    }

    // Create and save message
    const message = createMessage(chatId, senderId, content, type);
    const result = await chat_messages.insertOne(message);

    // Update chat's last message and unread counts
    const updateData = {
      lastMessage: {
        content,
        senderId: senderId.toString(), // UUID string
        timestamp: new Date(),
      },
      updatedAt: new Date(),
    };

    // Increment unread count for other participants
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== senderId) {
        const key = `unreadCount.${participantId.toString()}`;
        updateData[key] = (chat.unreadCount[participantId.toString()] || 0) + 1;
      }
    });

    await chats.updateOne(
      { _id: new ObjectId(chatId) },
      { $set: updateData }
    );

    return { _id: result.insertedId, ...message };
  } catch (error) {
    logger.error("Error in sendMessage:", error);
    throw error;
  }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(chatId, userId) {
  try {
    const { chat_messages, chats } = mongo.getCollections();
    
    // Add user to readBy array for all unread messages
    await chat_messages.updateMany(
      {
        chatId: new ObjectId(chatId),
        readBy: { $ne: userId }, // UUID string
      },
      {
        $addToSet: { readBy: userId }, // UUID string
        $set: { updatedAt: new Date() },
      }
    );

    // Reset unread count for this user
    await chats.updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { [`unreadCount.${userId}`]: 0 } }
    );

    return true;
  } catch (error) {
    logger.error("Error in markMessagesAsRead:", error);
    throw error;
  }
}

/**
 * Search for users to start a chat with
 */
/**
 * Get all users (excluding current user)
 */
async function getAllUsers(currentUserId, limit = 100) {
  try {
    const { profiles } = mongo.getCollections();
    
    const users = await profiles
      .find({
        _id: { $ne: currentUserId },
      })
      .project({ full_name: 1, email: 1 })
      .limit(limit)
      .toArray();

    return users;
  } catch (error) {
    logger.error("Error in getAllUsers:", error);
    throw error;
  }
}

async function searchUsers(query, currentUserId, limit = 10) {
  try {
    const { profiles } = mongo.getCollections();
    
    const users = await profiles
      .find({
        _id: { $ne: currentUserId },
        $or: [
          { full_name: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      })
      .project({ full_name: 1, email: 1 })
      .limit(limit)
      .toArray();

    return users;
  } catch (error) {
    logger.error("Error in searchUsers:", error);
    throw error;
  }
}

/**
 * Delete a chat (for both users)
 */
async function deleteChat(chatId, userId) {
  try {
    const { chats, chat_messages } = mongo.getCollections();
    
    // Verify user is participant
    const chat = await getChatById(chatId);
    const isParticipant = chat.participants.some(
      (id) => id.toString() === userId
    );

    if (!isParticipant) {
      throw new Error("User is not a participant in this chat");
    }

    // Delete all messages
    await chat_messages.deleteMany({ chatId: new ObjectId(chatId) });

    // Delete chat
    await chats.deleteOne({ _id: new ObjectId(chatId) });

    return true;
  } catch (error) {
    logger.error("Error in deleteChat:", error);
    throw error;
  }
}

module.exports = {
  getOrCreateChat,
  getUserChats,
  getChatById,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  getAllUsers,
  searchUsers,
  deleteChat,
};
