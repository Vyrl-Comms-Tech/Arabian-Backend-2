const mongoose = require("mongoose");

const referralPropertySchema = new mongoose.Schema(
  {
    // Tracking Information
    tracking_code: {
      type: String,
      unique: true,
      // required: true,
      index: true,
    },

    // Referrer Information
    referrer: {
      full_name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
    },

    // Property Details
    property: {
      area: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // Referee Information
    referee: {
      full_name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      relationship: {
        type: String,
        required: true,
        // enum: ["Friend", "Family Member", "Colleague", "Neighbor", "Other"],
      },
      preferred_contact: {
        type: String,
        // enum: ["Email", "Phone", "WhatsApp"],
        default: "Phone",
      },
      best_time_contact: {
        type: String,
        // enum: ["Morning", "Afternoon", "Evening", "Anytime"],
        default: "Anytime",
      },
    },

    // Query Details
    query_details: {
      urgency_level: {
        type: String,
        // enum: ["Immediate", "Within 1 month", "Within 3 months", "No rush"],
        default: "No rush",
      },
      special_requirements: {
        type: String,
        default: null,
      },
    },

    // Progress Tracking
    query_progress: {
      status: {
        type: String,
        enum: [
          "Query Received",
          // 'Lead Sent to Sales',
          "Agent Assigned",
          "Contact Initiated",
          "Meeting Scheduled",
          "Property Shown",
          "Negotiation",
          "Deal Closed Collect Commission From Our Office",

          // If CLient Not Intrested
          "Client Not Interested",
          "Cancelled",
          // 'Commission Pending',
          // 'Commission Paid',
          // 'Query Cancelled'
        ],
        default: "Query Received",
      },

      notes: [
        {
          note: String,
          updated_by: String,
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      last_updated: {
        type: Date,
        default: Date.now,
      },
    },

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Generate tracking code before saving
referralPropertySchema.pre("save", async function (next) {
  if (!this.tracking_code) {
    this.tracking_code = await generateUniqueTrackingCode();
  }
  next();
});

// Helper function to generate unique 6-digit tracking code
async function generateUniqueTrackingCode() {
  let trackingCode;
  let isUnique = false;

  while (!isUnique) {
    // Generate 6-digit random number (100000 to 999999)
    trackingCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Use mongoose.model to get the model
    const ReferralProperty = mongoose.model("ReferralProperty");
    const existingCode = await ReferralProperty.findOne({
      tracking_code: trackingCode,
    });

    if (!existingCode) {
      isUnique = true;
    }
  }

  return trackingCode;
}
module.exports = mongoose.model("ReferralProperty", referralPropertySchema);
