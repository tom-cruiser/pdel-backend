const express = require("express");
const authController = require("../controllers/auth.controller");

const router = express.Router();

// Public health check
router.get("/health", authController.healthCheck);

// Local development password login
router.post("/local-login", authController.localLogin);

// Register a new local user (Mongo-only)
router.post("/register", authController.register);

// Mode/info endpoint
router.get("/mode", authController.mode);

module.exports = router;
