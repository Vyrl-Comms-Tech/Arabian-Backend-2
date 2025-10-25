const mongoose = require("mongoose");

const podcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Podcast title is required"],
      trim: true,
      // maxlength: [200, "Podcast title cannot exceed 200 characters"],
    },
    shortDescription: {
      type: String,
      // required: [true, "Short description is required"],
      trim: true,
      // maxlength: [300, "Short description cannot exceed 300 characters"],
    },
    detailedDescription: {
      type: String,
      // required: [true, "Detailed description is required"],
      trim: true,
      // maxlength: [5000, "Detailed description cannot exceed 5000 characters"],
    },
    // Legacy description field (keeping for backward compatibility)
    description: {
      type: String,
      trim: true,
      // maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    coverPhoto: {
      type: String,
      required: [true, "Cover photo URL is required"],
      trim: true,
    },
    youtubeUrl: {
      type: String,
      required: [true, "YouTube URL is required"],
      trim: true,
    },
    category: {
      type: String,
      // required: [true, "Category is required"],
      trim: true,
      default: "General",
    },
    tags: {
      type: [String],
    },
    orderNumber: {
      type: Number,
      required: [true, "Order number is required"],
      min: [1, "Order number must be at least 1"],
      unique: true,
      index: true,
    },
    createdDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    whatsInside: {
      type: [String],
      // required: [true, "At least one point for what's inside is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
podcastSchema.index({
  title: "text",
  shortDescription: "text",
  detailedDescription: "text",
  tags: "text",
});
podcastSchema.index({ category: 1 });
podcastSchema.index({ createdDate: -1 });

// Middleware
podcastSchema.pre("save", function (next) {
  this.lastUpdated = new Date();

  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.map((tag) => tag.trim().toLowerCase()))];
  }

  // Clean up whatsInside points
  if (this.whatsInside && this.whatsInside.length > 0) {
    this.whatsInside = this.whatsInside
      .map((point) => point.trim())
      .filter((point) => point.length > 0);
  }

  // Set legacy description to shortDescription if not provided
  if (!this.description && this.shortDescription) {
    this.description = this.shortDescription;
  }

  next();
});

podcastSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

module.exports = mongoose.model("Podcast", podcastSchema);
