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
// FIXED CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Log the incoming origin for debugging CORS issues.
    try {
      logger.debug({ origin }, "CORS origin check");
    } catch (e) {
      // swallow logging errors
    }

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Use `CLIENT_URL` env var as the source of truth for allowed origins.
    // `CLIENT_URL` can be a single URL, a comma-separated list, or contain wildcard entries like `*.example.com`.
    if (process.env.CLIENT_URL) {
      const clientUrls = process.env.CLIENT_URL.split(",").map(url => url.trim()).filter(Boolean);
      const isAllowed = clientUrls.some(u => {
        if (u.startsWith("*.")) {
          // wildcard entry: allow any subdomain of example.com when u is "*.example.com"
          const domain = u.slice(1); // ".example.com"
          return origin.endsWith(domain);
        }
        return origin === u;
      });

      if (isAllowed || process.env.NODE_ENV === 'development') {
        try {
          logger.debug({ origin, clientUrls, isAllowed }, "CORS clientUrl match");
        } catch (e) {}
        return callback(null, true);
      }
    }

    // Fallback: during development allow everything to make local testing easy
    if (process.env.NODE_ENV === 'development') return callback(null, true);

    // If we reach here the origin was not allowed
    try {
      logger.warn({ origin }, "CORS denied origin");
    } catch (e) {}
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
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
