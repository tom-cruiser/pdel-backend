const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");
const config = require("../config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    // Prefer a nodemailer transport backed by SendGrid's HTTP API when API key is present.
    if (config.SENDGRID_API_KEY) {
      const options = { auth: { api_key: config.SENDGRID_API_KEY } };
      this.transporter = nodemailer.createTransport(sgTransport(options));
      logger.info("📧 Email service: SendGrid (nodemailer transport) configured");
      // verify() may work for this transport; wrap in try/catch
      this.verifyConnection();
      return;
    }

    // SMTP fallback for local development
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      logger: true,
      debug: true,
      connectionTimeout: 10000,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
    logger.info("📧 Email service: SMTP fallback configured");
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      if (this.transporter && typeof this.transporter.verify === "function") {
        await this.transporter.verify();
        logger.info("✅ Email service connected successfully");
      }
    } catch (error) {
      logger.error("❌ Email service connection failed:", {
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : undefined,
      });
      try {
        logger.info("Email transport config", {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          user: config.SMTP_USER,
        });
      } catch (e) {
        logger.debug("Failed to log SMTP config", e && e.message);
      }
    }
  }

  async sendEmail(to, subject, html, text = "") {
    try {
      const mailOptions = {
        from: `Court Booking System <${config.FROM_EMAIL}>`,
        to,
        subject,
        text,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Email sent to ${to}: ${subject}`);
      return { success: true, messageId: result && result.messageId ? result.messageId : "ok" };
    } catch (error) {
      logger.error("❌ Failed to send email:", error);
      return { success: false, error: error && error.message ? error.message : String(error) };
    }
  }

  async sendBookingConfirmation(booking, user) {
    const subject = `Booking Confirmation - ${booking.court_name} on ${booking.booking_date}`;
    const html = `
      <h2>Booking Confirmed! 🎾</h2>
      <p>Dear ${user.full_name},</p>
      <p>Your court booking has been confirmed:</p>
      <ul>
        <li><strong>Court:</strong> ${booking.court_name}</li>
        <li><strong>Date:</strong> ${booking.booking_date}</li>
        <li><strong>Time:</strong> ${booking.start_time} - ${
      booking.end_time
    }</li>
        <li><strong>Status:</strong> ${booking.status}</li>
      </ul>
      ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ""}
      <p>Please arrive 10 minutes before your scheduled time.</p>
    `;
    return this.sendEmail(user.email, subject, html);
  }

  async sendBookingNotificationToAdmin(booking, user) {
    const subject = `New Booking - ${booking.court_name}`;
    const html = `
      <h2>New Court Booking</h2>
      <p><strong>User:</strong> ${user.full_name} (${user.email})</p>
      <p><strong>Court:</strong> ${booking.court_name}</p>
      <p><strong>Date:</strong> ${booking.booking_date}</p>
      <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
    `;
    return this.sendEmail(config.ADMIN_EMAIL, subject, html);
  }

  async sendContactNotification(contact) {
    const subject = `New Contact Message from ${contact.name}`;
    const html = `
      <h2>New Contact Message</h2>
      <p><strong>From:</strong> ${contact.name}</p>
      <p><strong>Email:</strong> ${contact.email}</p>
      <p><strong>Message:</strong> ${contact.message}</p>
    `;
    return this.sendEmail(config.ADMIN_EMAIL, subject, html);
  }

  async sendContactConfirmation(contact) {
    const subject = "Message Received - Court Booking System";
    const html = `
      <h2>Thank You for Your Message</h2>
      <p>Dear ${contact.name},</p>
      <p>We have received your message and will respond shortly.</p>
    `;
    return this.sendEmail(contact.email, subject, html);
  }
}

module.exports = new EmailService();
