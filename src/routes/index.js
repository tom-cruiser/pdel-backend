const express = require("express");
const authRoutes = require("./auth");
const profilesRoutes = require("./profiles");
const courtsRoutes = require("./courts");
const coachesRoutes = require("./coaches");
const bookingsRoutes = require("./booking");
const messagesRoutes = require("./messages");
const galleryRoutes = require("./gallery");
const adminRoutes = require("./admin");
const debugRoutes = require("./debug");
const chatRoutes = require("./chat");

const router = express.Router();

// Public routes
router.use("/auth", authRoutes);
router.use("/courts", courtsRoutes.publicRouter);
router.use('/coaches', coachesRoutes.publicRouter);
router.use("/gallery", galleryRoutes.publicRouter);
router.use("/messages", messagesRoutes.publicRouter);

// Protected routes
router.use("/profiles", profilesRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/chat", chatRoutes);

// Admin routes
router.use("/admin", adminRoutes);

// Debug routes (public) - small utility endpoints for admins
router.use('/debug', debugRoutes);

module.exports = router;
