const bookingsService = require("../services/bookings.service");
const { formatResponse } = require("../utils/helpers");
const logger = require('../utils/logger');

const bookingsController = {
  async createBooking(req, res, next) {
    try {
      const booking = await bookingsService.createBooking(
        req.body,
        req.user.id
      );
      res
        .status(201)
        .json(formatResponse(true, booking, "Booking created successfully"));
    } catch (error) {
      next(error);
    }
  },

  async getMyBookings(req, res, next) {
    try {
      const upcoming = req.query.upcoming !== "false";
      const bookings = await bookingsService.getUserBookings(
        req.user.id,
        upcoming
      );
      res.json(formatResponse(true, bookings));
    } catch (error) {
      next(error);
    }
  },

  async getAvailability(req, res, next) {
    try {
      const courtId = req.query.court_id;
      const date = req.query.date;
      if (!courtId || !date) {
        return res.status(400).json(formatResponse(false, null, 'court_id and date are required'));
      }
      const bookings = await bookingsService.getBookingsForCourtAndDate(courtId, date);

      // Public availability: add cache headers so browsers and CDNs can cache briefly
      // and reduce load. Also log anonymous requests for telemetry.
      res.set('Cache-Control', 'public, max-age=20, stale-while-revalidate=10');
      if (!req.user) {
        try {
          logger.info({
            event: 'availability.request',
            anon: true,
            ip: req.ip,
            courtId,
            date,
            results: Array.isArray(bookings) ? bookings.length : 0,
          });
        } catch (e) {
          // swallow logging errors
        }
      }

      res.json(formatResponse(true, bookings));
    } catch (error) {
      next(error);
    }
  },

  async getAllBookings(req, res, next) {
    try {
      const filters = {
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        court_id: req.query.court_id,
      };
      const bookings = await bookingsService.getAllBookings(filters);
      res.json(formatResponse(true, bookings));
    } catch (error) {
      next(error);
    }
  },

  async getBooking(req, res, next) {
    try {
      const bookings = await bookingsService.getUserBookings(
        req.user.id,
        false
      );
      const booking = bookings.find((b) => b.id === req.params.id);

      if (!booking) {
        return res
          .status(404)
          .json(formatResponse(false, null, "Booking not found"));
      }

      res.json(formatResponse(true, booking));
    } catch (error) {
      next(error);
    }
  },

  async updateBooking(req, res, next) {
    try {
      const booking = await bookingsService.updateBooking(
        req.params.id,
        req.body,
        req.user.id,
        req.profile.is_admin
      );
      res.json(formatResponse(true, booking, "Booking updated successfully"));
    } catch (error) {
      next(error);
    }
  },

  async cancelBooking(req, res, next) {
    try {
      const booking = await bookingsService.cancelBooking(
        req.params.id,
        req.user.id,
        req.profile.is_admin
      );
      res.json(formatResponse(true, booking, "Booking cancelled successfully"));
    } catch (error) {
      next(error);
    }
  },

  async deleteBooking(req, res, next) {
    try {
      const result = await bookingsService.deleteBooking(
        req.params.id,
        req.user.id,
        req.profile.is_admin
      );
      res.json(formatResponse(true, result, "Booking deleted successfully"));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = bookingsController;
