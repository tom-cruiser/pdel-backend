const Joi = require("joi");

// Test the booking validation schema
const bookingSchema = Joi.object({
  court_id: Joi.string().required(),
  booking_date: Joi.alternatives().try(
    Joi.date().iso(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).required(),
  start_time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required(),
  end_time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required(),
  notes: Joi.string().max(500).allow("", null),
  coach_id: Joi.string().allow("", null),
  coach_name: Joi.string().max(100).allow("", null),
  membership_status: Joi.string().valid('member', 'non_member').required(),
});

// Test cases
const testCases = [
  {
    name: "Valid booking with date string",
    data: {
      court_id: "12345",
      booking_date: "2026-01-07",
      start_time: "10:00",
      end_time: "11:30",
      notes: "",
      coach_id: null,
      coach_name: null,
      membership_status: "member"
    }
  },
  {
    name: "Valid booking with ISO date",
    data: {
      court_id: "12345",
      booking_date: "2026-01-07T00:00:00.000Z",
      start_time: "10:00",
      end_time: "11:30",
      notes: null,
      coach_id: null,
      coach_name: null,
      membership_status: "non_member"
    }
  },
  {
    name: "Missing membership_status",
    data: {
      court_id: "12345",
      booking_date: "2026-01-07",
      start_time: "10:00",
      end_time: "11:30",
      notes: null,
      coach_id: null,
      coach_name: null
    }
  },
  {
    name: "Empty membership_status",
    data: {
      court_id: "12345",
      booking_date: "2026-01-07",
      start_time: "10:00",
      end_time: "11:30",
      notes: null,
      coach_id: null,
      coach_name: null,
      membership_status: ""
    }
  }
];

console.log("Testing booking validation schema:\n");

testCases.forEach(test => {
  const { error } = bookingSchema.validate(test.data);
  console.log(`${test.name}:`);
  if (error) {
    console.log(`  ❌ FAILED: ${error.details[0].message}`);
    console.log(`  Field: ${error.details[0].path.join('.')}`);
  } else {
    console.log(`  ✅ PASSED`);
  }
  console.log();
});
