const Joi = require("joi");
const { formatResponse } = require("../utils/helpers");

// Validation schemas
const schemas = {
  booking: Joi.object({
    court_id: Joi.string().required(),
    booking_date: Joi.date().iso().required(),
    start_time: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    end_time: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    notes: Joi.string().max(500).allow("", null),
    // Optional coach information (frontend may include these fields).
    // Coaches may use short IDs (e.g. 'c1') or UUIDs, so accept any non-empty
    // string, or null/empty when not provided.
    coach_id: Joi.string().allow("", null),
    coach_name: Joi.string().max(100).allow("", null),
    // Membership status is required and must be either 'member' or 'non_member'
    membership_status: Joi.string().valid('member', 'non_member').required(),
  }),

  message: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    email: Joi.string().email().required(),
    message: Joi.string().min(1).max(1000).required(),
  }),

  profile: Joi.object({
    full_name: Joi.string().max(100).allow("", null),
    phone: Joi.string().max(20).allow("", null),
  }),

  court: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    color: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .required(),
    description: Joi.string().max(500).allow("", null),
    is_active: Joi.boolean(),
  }),

  gallery: Joi.object({
    title: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow("", null),
  }),
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Validation failed",
            error.details[0].message
          )
        );
    }
    next();
  };
};

module.exports = {
  validate,
  schemas,
};
