const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const communityGuideSchema = new Schema(
  {
    // Guide Type
    guideType: {
      type: String,
      lowercase: true,
      trim: true,
    },

    // Main Cover Image (REQUIRED - Always present)
    coverImage: {
      filename: {
        type: String,
        required: [true, "Cover image filename is required"],
      },
      originalName: String,
      mimetype: String,
      size: Number,
      path: String,
    },

    // Google Maps URL (REQUIRED - Always present)
    googleMapUrl: {
      type: String,
      trim: true,
      required: [true, "Google Maps URL is required"],
    },

    // Flexible Media Blocks (2 blocks)
    mediaBlock1: {
      type: {
        type: String,
        enum: ["image", "video", "none"],
        default: "none",
      },
      image: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
      },
      video: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
      },
    },

    mediaBlock2: {
      type: {
        type: String,
        enum: ["image", "video", "none"],
        default: "none",
      },
      image: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
      },
      video: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
      },
    },

    // Content object containing all guide information
    content: {
      // Hero Section
      heroTitle: {
        type: String,
        trim: true,
        maxlength: [255, "Hero title cannot exceed 255 characters"],
      },
      heroText: {
        type: String,
        trim: true,
        maxlength: [2000, "Hero text cannot exceed 2000 characters"],
      },

      // Flexible Content Sections
      sections: [
        {
          type: {
            type: String,
            enum: ["h1", "h2", "h3", "p", "bullet", "cta_button"],
            required: true,
          },
          content: {
            type: String,
            required: true,
            trim: true,
          },
          // For CTA buttons
          buttonText: {
            type: String,
            trim: true,
          },
          buttonLink: {
            type: String,
            trim: true,
          },
          // For hyperlinks within content
          hyperlink: {
            text: String,
            url: String,
          },
        },
      ],
    },

    // Metadata
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save validation
communityGuideSchema.pre("save", function (next) {
  // Generate slug
  if (this.isModified("content.heroTitle") || this.isNew) {
    this.slug = this.content.heroTitle
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
    this.slug = this.slug + "-" + Date.now();
  }

  // Validate media blocks - cannot have two videos
  if (this.mediaBlock1.type === "video" && this.mediaBlock2.type === "video") {
    return next(
      new Error("Cannot have two video blocks. Only one video is allowed.")
    );
  }

  // Validate video files if type is video (Changed from videoUrl to video.filename)
  if (this.mediaBlock1.type === "video" && !this.mediaBlock1.video?.filename) {
    return next(new Error("Video file is required for media block 1"));
  }
  if (this.mediaBlock2.type === "video" && !this.mediaBlock2.video?.filename) {
    return next(new Error("Video file is required for media block 2"));
  }

  // Validate image data if type is image
  if (this.mediaBlock1.type === "image" && !this.mediaBlock1.image?.filename) {
    return next(new Error("Image is required for media block 1"));
  }
  if (this.mediaBlock2.type === "image" && !this.mediaBlock2.image?.filename) {
    return next(new Error("Image is required for media block 2"));
  }

  next();
});

// Virtual to get total sections count
communityGuideSchema.virtual("totalSectionsCount").get(function () {
  return this.content.sections?.length || 0;
});

// Virtual to get section types breakdown
communityGuideSchema.virtual("sectionBreakdown").get(function () {
  const breakdown = {
    h1: 0,
    h2: 0,
    h3: 0,
    p: 0,
    bullet: 0,
    cta_button: 0,
  };

  if (this.content.sections) {
    this.content.sections.forEach((section) => {
      if (breakdown.hasOwnProperty(section.type)) {
        breakdown[section.type]++;
      }
    });
  }

  return breakdown;
});

// Instance method to validate content structure
communityGuideSchema.methods.validateContent = function () {
  const errors = [];

  if (!this.content.heroTitle) {
    errors.push("Hero title is required");
  }

  if (!this.content.heroText) {
    errors.push("Hero text is required");
  }

  if (!this.googleMapUrl) {
    errors.push("Google Maps URL is required");
  }

  // Validate Google Maps URL format
  if (this.googleMapUrl && !this.googleMapUrl.includes("google.com/maps")) {
    errors.push("Invalid Google Maps URL format");
  }

  // Validate media blocks
  if (this.mediaBlock1.type === "video" && this.mediaBlock2.type === "video") {
    errors.push("Cannot have two video blocks");
  }

  // Validate CTA buttons have required fields
  if (this.content.sections) {
    this.content.sections.forEach((section, index) => {
      if (section.type === "cta_button") {
        if (!section.buttonText || !section.buttonLink) {
          errors.push(
            `CTA button at section ${
              index + 1
            } must have buttonText and buttonLink`
          );
        }
      }
    });
  }

  return errors;
};

// Instance method to get media block summary (Fixed to check video.filename instead of videoUrl)
communityGuideSchema.methods.getMediaBlocksSummary = function () {
  return {
    block1: {
      type: this.mediaBlock1.type,
      hasContent:
        this.mediaBlock1.type === "image"
          ? !!this.mediaBlock1.image?.filename
          : !!this.mediaBlock1.video?.filename,
    },
    block2: {
      type: this.mediaBlock2.type,
      hasContent:
        this.mediaBlock2.type === "image"
          ? !!this.mediaBlock2.image?.filename
          : !!this.mediaBlock2.video?.filename,
    },
  };
};

// Static method to find published guides
communityGuideSchema.statics.findPublished = function () {
  return this.find({ publishedAt: { $ne: null } }).sort({ publishedAt: -1 });
};

// Static method to find guides by tag
communityGuideSchema.statics.findByTag = function (tag) {
  return this.find({ tags: { $in: [tag.toLowerCase()] } }).sort({
    createdAt: -1,
  });
};

// Static method to search guides
communityGuideSchema.statics.search = function (searchTerm) {
  const regex = new RegExp(searchTerm, "i");
  return this.find({
    $or: [
      { "content.heroTitle": regex },
      { "content.heroText": regex },
      { "content.sections.content": regex },
      { tags: regex },
    ],
  }).sort({ createdAt: -1 });
};

// Indexes for better search performance
communityGuideSchema.index({
  "content.heroTitle": "text",
  "content.heroText": "text",
  "content.sections.content": "text",
  tags: "text",
});

communityGuideSchema.index({ publishedAt: -1 });
communityGuideSchema.index({ tags: 1 });
communityGuideSchema.index({ slug: 1 });

module.exports = mongoose.model("CommunityGuide", communityGuideSchema);