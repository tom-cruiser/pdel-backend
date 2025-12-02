const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const pinoHttp = require("pino-http");

const logger = require("./utils/logger");
const errorMiddleware = require("./middleware/error.middleware");
const rateLimitMiddleware = require("./middleware/rateLimit.middleware");
const routes = require("./routes");

const app = express();

// Middleware
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",")
      : ["https://pdel-front.onrender.com/"],
    credentials: true,
  })
);
app.use(rateLimitMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Error middleware (must be last)
app.use(errorMiddleware);

module.exports = app;
