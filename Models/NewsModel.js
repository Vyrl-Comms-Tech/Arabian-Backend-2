// Models/NewsModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/** Content Item Schema */
const contentItemSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["paragraph", "bullet_point", "numbered_item"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    formatting: {
      type: String,
      enum: ["paragraph", "bullet", "numbered"],
      required: true,
    },
  },
  { _id: false }
);

/** Subsection Schema */
const subsectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "subsection" },
    heading: { type: String, required: true, trim: true },
    level: { type: Number, default: 3 },
    content: [contentItemSchema],
  },
  { _id: false }
);

/** Section Schema */
const sectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "section" },
    heading: { type: String, required: true, trim: true },
    level: { type: Number, enum: [2, 3], required: true },
    content: [contentItemSchema],
    subsections: [subsectionSchema],
  },
  { _id: false }
);

/** Reusable Image Schema */
const imageSchema = new Schema(
  {
    filename: { type: String, required: true },
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
  },
  { _id: false }
);

/** Main News Schema — mirrors Blog schema */
const newsSchema = new Schema(
  {
    originalId: { type: String },

    metadata: {
      title: { type: String, required: [true, "News title is required"], trim: true },
      description: { type: String, trim: true },
      author: { type: String, trim: true },
      tags: [{ type: String, trim: true, lowercase: true }],
      category: { type: String, trim: true },
      slug: { type: String, sparse: true, lowercase: true, index: true },
    },

    content: {
      title: { type: String, required: [true, "Content title is required"], trim: true },
      sections: [sectionSchema],
      wordCount: { type: Number, default: 0, min: 0 },
      readingTime: { type: Number, default: 0, min: 0 },
    },

    seo: {
      metaTitle: { type: String, trim: true },
      metaDescription: { type: String, trim: true },
      keywords: [{ type: String, trim: true, lowercase: true }],
    },

    // Denormalized author info (matches Blog schema)
    author: {
      agentId: { type: String, required: [true, "Agent ID is required"] },
      agentName: { type: String, required: [true, "Agent name is required"], trim: true },
      agentEmail: { type: String, required: [true, "Agent email is required"], trim: true, lowercase: true },
      agentImage: { type: String, default: null, trim: true },
    },

    // Cover image
    image: imageSchema,

    // ✅ Body images (identical shape to Blog)
    bodyImages: {
      image1: { type: imageSchema, default: null },
      image2: { type: imageSchema, default: null },
    },

    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/** Indexes (same as Blog) */
newsSchema.index({ "author.agentId": 1 });
newsSchema.index({ "author.agentEmail": 1 });
newsSchema.index({ createdAt: -1 });
newsSchema.index({ isPublished: 1 });
newsSchema.index({ "metadata.slug": 1 }, { sparse: true });
newsSchema.index({ status: 1 });
newsSchema.index({ "content.wordCount": 1 });
newsSchema.index({ "seo.keywords": 1 });

/** Virtual (kept identical; note: your agentId is a string, so this won’t populate unless you refactor) */
newsSchema.virtual("agentDetails", {
  ref: "Agent",
  localField: "author.agentId",
  foreignField: "_id",
  justOne: true,
});

/** Helper for unique slugs (prefix uses 'news-') */
async function generateUniqueSlug(title, NewsModel, excludeId = null) {
  if (!title) {
    return `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim("-");

  let slug = baseSlug;
  let counter = 1;

  // ensure uniqueness
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { "metadata.slug": slug };
    if (excludeId) query._id = { $ne: excludeId };

    const exists = await NewsModel.findOne(query);
    if (!exists) break;

    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
}

/** Pre-save (same behavior as Blog) */
newsSchema.pre("save", async function (next) {
  try {
    if (
      this.isModified("content.title") ||
      this.isModified("metadata.title") ||
      this.isNew ||
      !this.metadata.slug
    ) {
      const title = this.content.title || this.metadata.title;
      this.metadata.slug = await generateUniqueSlug(title, this.constructor, this._id);
    }

    if (this.isModified("content.title") && this.content.title) {
      this.metadata.title = this.content.title;
    } else if (this.isModified("metadata.title") && this.metadata.title) {
      this.content.title = this.metadata.title;
    }

    next();
  } catch (err) {
    next(err);
  }
});

/** Statics (mirrors Blog statics) */
newsSchema.statics.findByAgent = function (agentId) {
  return this.find({ "author.agentId": agentId }).sort({ createdAt: -1 });
};

newsSchema.statics.findPublishedByAgent = function (agentId) {
  return this.find({ "author.agentId": agentId, isPublished: true }).sort({ createdAt: -1 });
};

newsSchema.statics.searchByContent = function (searchTerm, options = {}) {
  const { limit = 10, skip = 0, publishedOnly = false } = options;
  const searchRegex = new RegExp(searchTerm, "i");

  const query = {
    $or: [
      { "content.title": searchRegex },
      { "metadata.title": searchRegex },
      { "seo.metaTitle": searchRegex },
      { "seo.metaDescription": searchRegex },
      { "content.sections.heading": searchRegex },
      { "content.sections.content.content": searchRegex },
      { "content.sections.subsections.heading": searchRegex },
      { "content.sections.subsections.content.content": searchRegex },
    ],
  };

  if (publishedOnly) query.isPublished = true;

  return this.find(query).sort({ createdAt: -1 }).limit(limit).skip(skip);
};

newsSchema.statics.findBySlug = function (slug) {
  return this.findOne({ "metadata.slug": slug });
};

/** Instance methods (mirrors Blog methods) */
newsSchema.methods.publish = function () {
  this.isPublished = true;
  this.status = "published";
  this.publishedAt = new Date();
  return this.save();
};

newsSchema.methods.unpublish = function () {
  this.isPublished = false;
  this.status = "draft";
  this.publishedAt = null;
  return this.save();
};

newsSchema.methods.archive = function () {
  this.status = "archived";
  this.isPublished = false;
  return this.save();
};

newsSchema.methods.getContentStats = function () {
  let bulletPoints = 0;
  let paragraphs = 0;
  let headings = 0;

  (this.content.sections || []).forEach((section) => {
    headings++;
    (section.content || []).forEach((item) => {
      if (item.type === "bullet_point") bulletPoints++;
      if (item.type === "paragraph") paragraphs++;
    });

    (section.subsections || []).forEach((subsection) => {
      headings++;
      (subsection.content || []).forEach((item) => {
        if (item.type === "bullet_point") bulletPoints++;
        if (item.type === "paragraph") paragraphs++;
      });
    });
  });

  return {
    wordCount: this.content.wordCount,
    readingTime: this.content.readingTime,
    headings,
    paragraphs,
    bulletPoints,
    sections: (this.content.sections || []).length,
  };
};

newsSchema.methods.getPlainText = function () {
  let text = (this.content?.title || "") + "\n\n";

  (this.content.sections || []).forEach((section) => {
    text += (section.heading || "") + "\n";
    (section.content || []).forEach((item) => {
      text += (item.content || "") + "\n";
    });

    (section.subsections || []).forEach((subsection) => {
      text += (subsection.heading || "") + "\n";
      (subsection.content || []).forEach((item) => {
        text += (item.content || "") + "\n";
      });
    });
    text += "\n";
  });

  return text.trim();
};

newsSchema.methods.updateSlug = async function (newTitle) {
  this.metadata.slug = await generateUniqueSlug(newTitle, this.constructor, this._id);
  return this.save();
};

/** Text parser, named for news (controller already calls this) */
newsSchema.statics.parseTextToNewsStructure = function (textContent) {
  const lines = (textContent || "").split("\n").filter((line) => line.trim());

  let title = "";
  let metaTitle = "";
  let metaDescription = "";
  let author = "";
  let tags = [];
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("Meta title:")) {
      metaTitle = line.replace("Meta title:", "").trim();
      continue;
    }

    if (line.startsWith("Meta description:")) {
      metaDescription = line.replace("Meta description:", "").trim();
      continue;
    }

    if (line.startsWith("Tags:")) {
      const tagsString = line.replace("Tags:", "").trim();
      tags = tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => tag.toLowerCase());
      continue;
    }

    if (line.startsWith("[Author:")) {
      author = line.replace("[Author:", "").replace("]", "").trim();
      continue;
    }

    if (line.includes("(H1)")) {
      title = line.replace("(H1)", "").trim();
      continue;
    }

    if (line.includes("(H2)")) {
      if (currentSubsection && currentSection) {
        currentSection.subsections.push(currentSubsection);
        currentSubsection = null;
      }
      if (currentSection) sections.push(currentSection);

      const heading = line.replace("(H2)", "").trim();
      currentSection = {
        id: `id_${Math.random().toString(36).substr(2, 9)}`,
        type: "section",
        heading,
        level: 2,
        content: [],
        subsections: [],
      };
      continue;
    }

    if (line.includes("(H3)")) {
      if (currentSubsection && currentSection) {
        currentSection.subsections.push(currentSubsection);
        currentSubsection = null;
      }
      if (currentSection) sections.push(currentSection);

      const heading = line.replace("(H3)", "").trim();
      currentSection = {
        id: `id_${Math.random().toString(36).substr(2, 9)}`,
        type: "section",
        heading,
        level: 2,
        content: [],
        subsections: [],
      };
      continue;
    }

    // Bullets
    if (line.startsWith("●") || line.startsWith("•") || line.startsWith("-")) {
      const content = line.replace(/^[●•-]\s*/, "").replace("(Bullet)", "").trim();
      if (content) {
        const contentItem = { type: "bullet_point", content, formatting: "bullet" };
        if (currentSubsection) currentSubsection.content.push(contentItem);
        else if (currentSection) currentSection.content.push(contentItem);
      }
      continue;
    }

    // Paragraphs
    if (line.includes("(P)") || line.includes("(p)")) {
      const content = line.replace(/\(P\)/g, "").replace(/\(p\)/g, "").trim();
      if (content) {
        const contentItem = { type: "paragraph", content, formatting: "paragraph" };
        if (currentSubsection) currentSubsection.content.push(contentItem);
        else if (currentSection) currentSection.content.push(contentItem);
      }
      continue;
    }

    if (line && !line.includes("(") && currentSection) {
      const contentItem = { type: "paragraph", content: line, formatting: "paragraph" };
      if (currentSubsection) currentSubsection.content.push(contentItem);
      else currentSection.content.push(contentItem);
    }
  }

  if (currentSubsection && currentSection) currentSection.subsections.push(currentSubsection);
  if (currentSection) sections.push(currentSection);

  let wordCount = 0;
  sections.forEach((section) => {
    (section.content || []).forEach((item) => {
      wordCount += (item.content || "").split(" ").length;
    });
    (section.subsections || []).forEach((subsection) => {
      (subsection.content || []).forEach((item) => {
        wordCount += (item.content || "").split(" ").length;
      });
    });
  });

  const slugBase = (title || metaTitle || "news")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim("-");

  return {
    id: `id_${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      title: title || metaTitle,
      description: metaDescription,
      author,
      tags,
      category: "",
      slug: `${slugBase}-${Date.now()}`,
    },
    content: {
      title: title || metaTitle,
      sections,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
    },
    seo: {
      metaTitle,
      metaDescription,
      keywords: tags.slice(0, 5),
    },
    status: "draft",
  };
};

module.exports = mongoose.models.News || mongoose.model("News", newsSchema);
