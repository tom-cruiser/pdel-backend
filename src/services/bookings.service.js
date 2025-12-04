const emailService = require("./email.service");
const mongo = require("../db/mongo");
const config = require('../config');
let pool;
if (!config.MONGODB_URI) {
  pool = require('../db').pool;
}

class BookingsService {
  async createBooking(bookingData, userId) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { bookings, profiles, courts } = mongo.getCollections();

      // Normalize booking_date to a YYYY-MM-DD string to avoid mismatched
      // types (Date vs string) causing incorrect queries.
      const bookingDateStr = bookingData.booking_date instanceof Date
        ? bookingData.booking_date.toISOString().slice(0, 10)
        : String(bookingData.booking_date);

      // Check availability: overlapping times. Use a simple range query on times.
      const timeOverlap = await bookings.findOne({
        court_id: bookingData.court_id,
        booking_date: bookingDateStr,
        status: { $ne: 'cancelled' },
        start_time: { $lt: bookingData.end_time },
        end_time: { $gt: bookingData.start_time },
      });

      if (timeOverlap) {
        try {
          // Log a concise conflict message to assist debugging in hosted logs
          console.info('Booking conflict detected', {
            conflict_id: timeOverlap._id || timeOverlap.id,
            court_id: timeOverlap.court_id,
            booking_date: timeOverlap.booking_date,
            start_time: timeOverlap.start_time,
            end_time: timeOverlap.end_time,
          });
        } catch (e) {
          // ignore logging errors
        }
        throw new Error('Time slot not available');
      }

      // If the user selected a coach, ensure the coach is available (not already booked)
      if (bookingData.coach_id) {
        const coachOverlap = await bookings.findOne({
          coach_id: bookingData.coach_id,
          booking_date: bookingDateStr,
          status: { $ne: 'cancelled' },
          start_time: { $lt: bookingData.end_time },
          end_time: { $gt: bookingData.start_time },
        });

        if (coachOverlap) {
          try {
            console.info('Coach conflict detected', {
              conflict_id: coachOverlap._id || coachOverlap.id,
              coach_id: coachOverlap.coach_id,
              booking_date: coachOverlap.booking_date,
              start_time: coachOverlap.start_time,
              end_time: coachOverlap.end_time,
            });
          } catch (e) {}
          throw new Error('Coach not available');
        }
        // Ensure coach exists in coaches collection (create if missing)
        try {
          const coachesService = require('./coaches.service');
          if (bookingData.coach_name) {
            await coachesService.createIfMissing(bookingData.coach_id, bookingData.coach_name);
          } else {
            // create with null name if not present
            await coachesService.createIfMissing(bookingData.coach_id, null);
          }
        } catch (e) {
          // non-fatal: if coaches collection is missing or fails, continue
          console.warn('Failed to ensure coach exists:', e && e.message);
        }
      }

      const booking = {
        _id: require('crypto').randomUUID(),
        user_id: userId,
        court_id: bookingData.court_id,
        booking_date: bookingDateStr,
        start_time: bookingData.start_time,
        end_time: bookingData.end_time,
        notes: bookingData.notes,
        // optional coach information
        coach_id: bookingData.coach_id || null,
        coach_name: bookingData.coach_name || null,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await bookings.insertOne(booking);

      const user = await profiles.findOne({ _id: userId });
      const court = await courts.findOne({ _id: bookingData.court_id });
      booking.court_name = court?.name;

      if (user) {
        emailService.sendBookingConfirmation(booking, user);
        emailService.sendBookingNotificationToAdmin(booking, user);
      }

      return booking;
    }
  }

  async getUserBookings(userId, upcoming = true) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { bookings, courts } = mongo.getCollections();
      const filter = { user_id: userId };
      if (upcoming) filter.booking_date = { $gte: new Date().toISOString().slice(0, 10) };
      const docs = await bookings.find(filter).sort({ booking_date: 1, start_time: 1 }).toArray();
      // join court names
      for (const b of docs) {
        const c = await courts.findOne({ _id: b.court_id });
        b.court_name = c?.name;
        // include a small courts object for frontend convenience
        b.courts = { name: c?.name, color: c?.color };
      }
      return docs;
    }
  }

  async getBookingsForCourtAndDate(courtId, date) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { bookings } = mongo.getCollections();
      // Ensure we query with the normalized YYYY-MM-DD string
      const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
      const docs = await bookings.find({
        court_id: courtId,
        booking_date: dateStr,
        status: { $ne: 'cancelled' }
      }).project({ start_time: 1, end_time: 1, _id: 1, user_id: 1 }).toArray();
      return docs;
    }
    return [];
  }

  async getAllBookings(filters = {}) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { bookings, profiles, courts } = mongo.getCollections();
      const query = {};
      if (filters.court_id) query.court_id = filters.court_id;
      if (filters.date_from || filters.date_to) {
        query.booking_date = {};
        if (filters.date_from) query.booking_date.$gte = filters.date_from;
        if (filters.date_to) query.booking_date.$lte = filters.date_to;
      }

      const docs = await bookings.find(query).sort({ booking_date: -1, start_time: -1 }).toArray();
      // attach profiles and courts
      for (const b of docs) {
        const p = await profiles.findOne({ _id: b.user_id });
        const c = await courts.findOne({ _id: b.court_id });
        b.profiles = p ? { full_name: p.full_name, email: p.email, phone: p.phone } : null;
        b.courts = c ? { name: c.name, color: c.color } : null;
      }
      return docs;
    }
    return [];
  }

  async updateBooking(id, updates, userId, isAdmin = false) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { bookings } = mongo.getCollections();

      if (!isAdmin) {
        const ownership = await bookings.findOne({ _id: id });
        if (!ownership || ownership.user_id !== userId) throw new Error('Not authorized');
      }

      // Normalize booking_date in updates if provided
      if (updates.booking_date instanceof Date) {
        updates.booking_date = updates.booking_date.toISOString().slice(0, 10);
      }

      const updateDoc = {
        ...(updates.court_id !== undefined && { court_id: updates.court_id }),
        ...(updates.booking_date !== undefined && { booking_date: updates.booking_date }),
        ...(updates.start_time !== undefined && { start_time: updates.start_time }),
        ...(updates.end_time !== undefined && { end_time: updates.end_time }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.coach_id !== undefined && { coach_id: updates.coach_id }),
        ...(updates.coach_name !== undefined && { coach_name: updates.coach_name }),
        ...(updates.status !== undefined && { status: updates.status }),
        updated_at: new Date(),
      };
      const res = await bookings.findOneAndUpdate(
        { _id: id },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );
      return res.value;
    }
  }

  async cancelBooking(id, userId, isAdmin = false) {
    return this.updateBooking(id, { status: "cancelled" }, userId, isAdmin);
  }
}

module.exports = new BookingsService();
