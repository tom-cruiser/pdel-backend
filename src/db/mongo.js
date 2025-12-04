const { MongoClient } = require('mongodb');
const config = require('../config');
const logger = require('../utils/logger');

let client;
let db;

async function connect() {
  if (db) return db;
  if (!config.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment');
  }
  const maxAttempts = 5;
  const baseDelayMs = 2000;
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Fail faster when the server is not reachable so we can retry quickly
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  };

  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      attempt += 1;
      logger.info(`MongoDB: attempting connection (attempt ${attempt}/${maxAttempts})`);
      client = new MongoClient(config.MONGODB_URI, options);
      await client.connect();
      db = client.db();
      logger.info('✅ MongoDB connected');
      return db;
    } catch (err) {
      lastErr = err;
      logger.warn(`MongoDB connect attempt ${attempt} failed: ${err && err.message ? err.message : err}`);
      // exponential-ish backoff
      const delay = baseDelayMs * attempt;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  // all attempts failed
  logger.error('MongoDB: all connection attempts failed');
  throw lastErr;
  return db;
}

function getCollections() {
  if (!db) throw new Error('MongoDB not connected; call connect() first');
  return {
    profiles: db.collection('profiles'),
    courts: db.collection('courts'),
    bookings: db.collection('bookings'),
    coaches: db.collection('coaches'),
    messages: db.collection('messages'),
    gallery_images: db.collection('gallery_images'),
  };
}

module.exports = {
  connect,
  getCollections,
};
