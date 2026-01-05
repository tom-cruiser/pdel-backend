const express = require("express");
const bookingsController = require("../controllers/bookings.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { validate, schemas } = require("../middleware/validate.middleware");
const rateLimit = require('express-rate-limit');

// Lightweight rate limiter for the public availability endpoint
const availabilityLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 30, // limit each IP to 30 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		error: 'Too many availability requests from this IP, please try again later.',
	},
});

const router = express.Router();

// Allow CORS preflight to succeed without authentication so browsers can
// send the Authorization header on the actual request.
router.options('*', (req, res) => res.sendStatus(200));

// Availability endpoint — return bookings for a court on a given date
// This is public so users can see free/occupied slots without signing in.
router.get('/availability', availabilityLimiter, bookingsController.getAvailability);

// All other routes require authentication
router.use(authMiddleware);

router.get("/", bookingsController.getMyBookings);
router.post("/", validate(schemas.booking), bookingsController.createBooking);
router.patch("/:id/cancel", bookingsController.cancelBooking);
router.get("/:id", bookingsController.getBooking);
router.put("/:id", validate(schemas.booking), bookingsController.updateBooking);
router.delete("/:id", bookingsController.deleteBooking);

module.exports = router;
