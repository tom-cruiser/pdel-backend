const app = require("./app");
const config = require("./config");
const mongo = require("./db/mongo");
const logger = require("./utils/logger");

const startServer = async () => {
  try {
    logger.info("🚀 Starting Court Booking Backend...");

    // Require MongoDB connection. This backend runs in MongoDB-only mode.
    if (process.env.MONGODB_URI) {
      try {
        await mongo.connect();
        logger.info("✅ MongoDB connected successfully");
      } catch (err) {
        logger.error("❌ MongoDB connection failed:", err);
        process.exit(1);
      }
    } else {
      logger.error("❌ MONGODB_URI is not configured. Set MONGODB_URI and restart.");
      process.exit(1);
    }

    // Start server
    app.listen(config.PORT, () => {
      logger.info(`✅ Server running on port ${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(
        `🌐 Health check: http://localhost:${config.PORT}/api/auth/health`
      );
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Error handlers
process.on("uncaughtException", (error) => {
  // Also print to console to ensure stack traces are visible in CI/dev logs
  console.error('Uncaught Exception:', error && error.stack ? error.stack : error);
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

startServer();
