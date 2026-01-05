const logger = require("../utils/logger");
const { formatResponse } = require("../utils/helpers");

const errorMiddleware = (error, req, res, next) => {
  logger.error("Error:", error);

  // Database errors
  if (error.code === "23505") {
    return res
      .status(409)
      .json(formatResponse(false, null, "Resource already exists"));
  }

  if (error.code === "23503") {
    return res
      .status(400)
      .json(formatResponse(false, null, "Referenced resource not found"));
  }

  // Custom application errors
  if (error.message.includes("not found")) {
    return res.status(404).json(formatResponse(false, null, error.message));
  }

  if (
    error.message.includes("not authorized") ||
    error.message.includes("access required")
  ) {
    return res.status(403).json(formatResponse(false, null, error.message));
  }

  if (
    error.message.includes("not available") ||
    error.message.includes("already booked") ||
    error.message.includes("must wait")
  ) {
    return res.status(409).json(formatResponse(false, null, error.message));
  }

  // Validation errors
  if (
    error.message.includes("is required") ||
    error.message.includes("must be") ||
    error.message.includes("invalid")
  ) {
    return res.status(400).json(formatResponse(false, null, error.message));
  }

  // Default server error
  res.status(500).json(formatResponse(false, null, "Internal server error"));
};

module.exports = errorMiddleware;
