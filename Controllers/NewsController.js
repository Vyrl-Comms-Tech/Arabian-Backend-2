// controllers/NewsController.js
const News = require("../Models/NewsModel");
const Agent = require("../Models/AgentModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

// === Multer storage (uploads/News) ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const newsDir = path.join(__dirname, "..", "uploads", "News");

    console.log("=== MULTER DESTINATION DEBUG (NEWS) ===");
    console.log("__dirname:", __dirname);
    console.log("Calculated newsDir:", newsDir);
    console.log("Directory exists:", fsSync.existsSync(newsDir));

    if (!fsSync.existsSync(newsDir)) {
      fsSync.mkdirSync(newsDir, { recursive: true });
      console.log("Created directory:", newsDir);
    }

    cb(null, newsDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = unique + "-" + file.originalname;

    console.log("=== MULTER FILENAME DEBUG (NEWS) ===");
    console.log("Generated filename:", filename);
    console.log("Original name:", file.originalname);
    console.log("Field name:", file.fieldname);

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  console.log("=== FILE FILTER DEBUG (NEWS) ===");
  console.log("File mimetype:", file.mimetype);
  console.log("File fieldname:", file.fieldname);

  if (file.mimetype.startsWith("image/")) {
    console.log("File accepted");
    cb(null, true);
  } else {
    console.log("File rejected - not an image");
    cb(new Error("Only image files are allowed!"), false);
  }
};

// ✅ Same fields as blog: coverImage + two body images
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB per file
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "bodyImage1", maxCount: 1 },
  { name: "bodyImage2", maxCount: 1 },
]);

// Helpers
const createImageData = (file) => {
  if (!file) return null;
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
  };
};

const deleteFileSafely = async (filePath) => {
  if (!filePath) return;
  try {
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
      console.log("Deleted file:", filePath);
    }
  } catch (err) {
    console.log("Could not delete file:", filePath, err.message);
  }
};

// === CREATE NEWS ===
const createNews = async (req, res) => {
  try {
    console.log("=== NEWS CREATION START ===");
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

    if (req.files) {
      console.log("=== UPLOADED FILES DEBUG (NEWS) ===");
      if (req.files.coverImage) console.log("Cover Image:", req.files.coverImage[0].filename);
      if (req.files.bodyImage1) console.log("Body Image 1:", req.files.bodyImage1[0].filename);
      if (req.files.bodyImage2) console.log("Body Image 2:", req.files.bodyImage2[0].filename);
    }

    const { parsedData, agentId } = req.body;
    console.log(agentId, "Agent ID");

    if (!parsedData) {
      return res.status(400).json({
        success: false,
        message: "parsedData is required",
        received: { parsedData, agentId },
      });
    }

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "agentId is required",
        received: { parsedData: "present", agentId },
      });
    }

    // Parse payload (JSON string or plain text → News structure)
    let newsData;
    try {
      if (typeof parsedData === "string") {
        console.log("Parsing string data...");
        if (parsedData.trim().startsWith("{")) {
          console.log("Detected JSON format");
          newsData = JSON.parse(parsedData);
        } else {
          console.log("Detected plain text format, using text parser (News)");
          newsData = News.parseTextToNewsStructure(parsedData);
        }
      } else if (typeof parsedData === "object" && parsedData !== null) {
        console.log("Data already parsed as object");
        newsData = parsedData;
      } else {
        throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
      }
    } catch (parseError) {
      console.error("Parse error:", parseError.message);
      return res.status(400).json({
        success: false,
        message: "Failed to parse news data",
        error: parseError.message,
        receivedType: typeof parsedData,
        receivedData: typeof parsedData === "string" ? parsedData.substring(0, 200) : "non-string",
      });
    }

    console.log("=== PARSED NEWS DATA ===");
    console.log("News data keys:", Object.keys(newsData || {}));
    console.log("Content title:", newsData?.content?.title);
    console.log("Sections count:", newsData?.content?.sections?.length);

    if (!newsData || typeof newsData !== "object") {
      return res.status(400).json({
        success: false,
        message: "Parsed data must be an object",
        received: newsData,
      });
    }

    if (!newsData.content || !newsData.content.title) {
      return res.status(400).json({
        success: false,
        message: "News content and title are required",
        received: {
          hasContent: !!newsData.content,
          contentTitle: newsData.content?.title,
          newsDataKeys: Object.keys(newsData),
        },
      });
    }

    if (!newsData.content.sections || !Array.isArray(newsData.content.sections)) {
      return res.status(400).json({
        success: false,
        message: "News content sections are required and must be an array",
      });
    }

    // Find active agent by custom agentId (string)
    console.log("Finding agent with custom agentId:", agentId);
    const agent = await Agent.findOne({ agentId: agentId });

    if (!agent) {
      const sampleAgents = await Agent.find({ isActive: true }, "agentId agentName").limit(5);
      return res.status(404).json({
        success: false,
        message: "Agent not found",
        searchedFor: agentId,
        availableAgents: sampleAgents.map((a) => ({ agentId: a.agentId, agentName: a.agentName })),
      });
    }

    if (!agent.isActive) {
      return res.status(400).json({
        success: false,
        message: "Agent is not active",
        agentId: agentId,
      });
    }

    console.log("Agent found:", agent.agentName);
    console.log("Agent Image URL:", agent.imageUrl);

    // Cover image (required in model; use placeholder if none uploaded)
    let coverImageData = null;
    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      console.log("Cover image uploaded:", req.files.coverImage[0].filename);
      coverImageData = createImageData(req.files.coverImage[0]);
    } else {
      console.log("No cover image uploaded, using placeholder");
      coverImageData = {
        filename: "placeholder.jpg",
        originalName: "placeholder.jpg",
        mimetype: "image/jpeg",
        size: 0,
        path: "uploads/News/placeholder.jpg",
      };
    }

    // Body images (to be inserted mid-article by client/UI)
    const bodyImage1Data =
      req.files && req.files.bodyImage1 && req.files.bodyImage1[0]
        ? createImageData(req.files.bodyImage1[0])
        : null;

    const bodyImage2Data =
      req.files && req.files.bodyImage2 && req.files.bodyImage2[0]
        ? createImageData(req.files.bodyImage2[0])
        : null;

    console.log("Body Image 1:", bodyImage1Data ? bodyImage1Data.filename : "Not provided");
    console.log("Body Image 2:", bodyImage2Data ? bodyImage2Data.filename : "Not provided");

    // Create news doc
    const newNews = new News({
      originalId:
        newsData.id ||
        `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        title: newsData.metadata?.title || newsData.content?.title,
        description: newsData.metadata?.description || newsData.seo?.metaDescription || "",
        author: newsData.metadata?.author || agent.agentName,
        tags: newsData.metadata?.tags || [],
        category: newsData.metadata?.category || "",
        slug: newsData.metadata?.slug || null,
      },
      content: {
        title: newsData.content.title,
        sections: newsData.content.sections || [],
        wordCount: newsData.content.wordCount || 0,
        readingTime: newsData.content.readingTime || 0,
      },
      seo: {
        metaTitle: newsData.seo?.metaTitle || "",
        metaDescription: newsData.seo?.metaDescription || "",
        keywords: newsData.seo?.keywords || [],
      },
      author: {
        agentId: agent.agentId,
        agentName: agent.agentName,
        agentEmail: agent.email,
        agentImage: agent.imageUrl,
      },
      image: coverImageData,
      // Store body images in a sibling field (same shape as blog)
      bodyImages: {
        image1: bodyImage1Data,
        image2: bodyImage2Data,
      },
      status: newsData.status || "draft",
      isPublished: newsData.status === "published" || false,
    });

    console.log("Saving news to database...");
    const savedNews = await newNews.save();
    console.log("News saved with ID:", savedNews._id);
    console.log("Body images saved:", {
      image1: savedNews.bodyImages?.image1?.filename || "none",
      image2: savedNews.bodyImages?.image2?.filename || "none",
    });

    // Link to agent (optional helper like blog’s addOrUpdateBlog)
    try {
      const newsForAgent = {
        newsId: savedNews._id,
        title: savedNews.content.title,
        slug: savedNews.metadata.slug,
        image: savedNews.image,
        isPublished: savedNews.isPublished,
        publishedAt: savedNews.publishedAt,
        createdAt: savedNews.createdAt,
        updatedAt: savedNews.updatedAt,
      };

      if (typeof agent.addOrUpdateNews === "function") {
        agent.addOrUpdateNews(newsForAgent);
        await agent.save({ validateBeforeSave: false });
        console.log("News added to agent successfully");
      }
    } catch (agentUpdateError) {
      console.log(
        "Warning: Could not update agent's news array:",
        agentUpdateError.message
      );
    }

    console.log("=== NEWS CREATION SUCCESS ===");

    res.status(201).json({
      success: true,
      message: "News created successfully from parsed content",
      data: {
        news: savedNews,
        stats: savedNews.getContentStats(),
        linkedAgent: {
          agentId: agent.agentId,
          agentName: agent.agentName,
          email: agent.email,
          imageUrl: agent.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error("=== NEWS CREATION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        await deleteFileSafely(req.files.coverImage[0].path);
      }
      if (req.files.bodyImage1 && req.files.bodyImage1[0]) {
        await deleteFileSafely(req.files.bodyImage1[0].path);
      }
      if (req.files.bodyImage2 && req.files.bodyImage2[0]) {
        await deleteFileSafely(req.files.bodyImage2[0].path);
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to create news from parsed content",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// === UPDATE NEWS ===
const updateNews = async (req, res) => {
  try {
    console.log("=== NEWS UPDATE START ===");
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

    if (req.files) {
      console.log("=== UPLOADED FILES DEBUG (NEWS) ===");
      if (req.files.coverImage) console.log("New Cover Image:", req.files.coverImage[0].filename);
      if (req.files.bodyImage1) console.log("New Body Image 1:", req.files.bodyImage1[0].filename);
      if (req.files.bodyImage2) console.log("New Body Image 2:", req.files.bodyImage2[0].filename);
    }

    const { newsId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } = req.body;

    console.log("NewsId:", newsId);
    console.log("New AgentId:", agentId);
    console.log("Remove Body Image 1:", removeBodyImage1);
    console.log("Remove Body Image 2:", removeBodyImage2);

    if (!newsId) {
      return res.status(400).json({
        success: false,
        message: "newsId is required",
      });
    }

    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
        newsId,
      });
    }

    console.log("News found:", news.content?.title || news.metadata?.title);
    console.log("Current news author agentId:", news.author.agentId);

    // Handle agent change
    const oldAgentId = news.author.agentId;
    let agentChanged = false;

    if (agentId && agentId !== oldAgentId) {
      console.log("=== AGENT CHANGE DETECTED (NEWS) ===");
      console.log("Old Agent ID:", oldAgentId);
      console.log("New Agent ID:", agentId);

      const newAgent = await Agent.findOne({ agentId: agentId });
      if (!newAgent) {
        return res.status(404).json({
          success: false,
          message: "New agent not found",
          requestedAgentId: agentId,
        });
      }

      if (!newAgent.isActive) {
        return res.status(400).json({
          success: false,
          message: "New agent is not active",
          agentId: agentId,
        });
      }

      console.log("New agent found:", newAgent.agentName);

      news.author.agentId = newAgent.agentId;
      news.author.agentName = newAgent.agentName;
      news.author.agentEmail = newAgent.email;
      news.author.agentImage = newAgent.imageUrl;

      agentChanged = true;
    }

    // Parse payload and update
    if (parsedData) {
      let updateData;

      try {
        if (typeof parsedData === "string") {
          console.log("Parsing string data...");
          if (parsedData.trim().startsWith("{")) {
            console.log("Detected JSON format");
            updateData = JSON.parse(parsedData);
          } else {
            console.log("Detected plain text format, using text parser (News)");
            updateData = News.parseTextToNewsStructure(parsedData);
          }
        } else if (typeof parsedData === "object" && parsedData !== null) {
          console.log("Data already parsed as object");
          updateData = parsedData;
        } else {
          throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
        }
      } catch (parseError) {
        console.error("Parse error:", parseError.message);
        return res.status(400).json({
          success: false,
          message: "Failed to parse news data",
          error: parseError.message,
          receivedType: typeof parsedData,
        });
      }

      console.log("=== PARSED UPDATE DATA (NEWS) ===");
      console.log("Update data keys:", Object.keys(updateData || {}));
      console.log("Content title:", updateData?.content?.title);
      console.log("Sections count:", updateData?.content?.sections?.length);

      // Metadata
      if (updateData.metadata) {
        if (updateData.metadata.title) news.metadata.title = updateData.metadata.title;
        if (updateData.metadata.description !== undefined) news.metadata.description = updateData.metadata.description;
        if (updateData.metadata.author) news.metadata.author = updateData.metadata.author;
        if (updateData.metadata.tags) {
          news.metadata.tags = Array.isArray(updateData.metadata.tags) ? updateData.metadata.tags : [];
        }
        if (updateData.metadata.category !== undefined) news.metadata.category = updateData.metadata.category;
        if (updateData.metadata.slug !== undefined) news.metadata.slug = updateData.metadata.slug;
      }

      // Content
      if (updateData.content) {
        if (updateData.content.title) news.content.title = updateData.content.title;
        if (updateData.content.sections && Array.isArray(updateData.content.sections)) {
          news.content.sections = updateData.content.sections;
        }
        if (updateData.content.wordCount !== undefined) news.content.wordCount = updateData.content.wordCount;
        if (updateData.content.readingTime !== undefined) news.content.readingTime = updateData.content.readingTime;
      }

      // SEO
      if (updateData.seo) {
        if (updateData.seo.metaTitle !== undefined) news.seo.metaTitle = updateData.seo.metaTitle;
        if (updateData.seo.metaDescription !== undefined) news.seo.metaDescription = updateData.seo.metaDescription;
        if (updateData.seo.keywords) {
          news.seo.keywords = Array.isArray(updateData.seo.keywords) ? updateData.seo.keywords : [];
        }
      }

      // Status
      if (updateData.status) {
        news.status = updateData.status;

        if (updateData.status === "published" && !news.isPublished) {
          news.isPublished = true;
          news.publishedAt = new Date();
        } else if (updateData.status === "draft" && news.isPublished) {
          news.isPublished = false;
          news.publishedAt = null;
        }
      }
    }

    // Cover image
    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      console.log("Updating cover image...");
      if (news.image && news.image.path && news.image.filename !== "placeholder.jpg") {
        await deleteFileSafely(news.image.path);
      }
      news.image = createImageData(req.files.coverImage[0]);
      console.log("Cover image updated:", req.files.coverImage[0].filename);
    }

    // Body image 1
    if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
      console.log("Removing body image 1...");
      if (news.bodyImages?.image1?.path) {
        await deleteFileSafely(news.bodyImages.image1.path);
      }
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image1 = null;
      console.log("Body image 1 removed");
    } else if (req.files && req.files.bodyImage1 && req.files.bodyImage1[0]) {
      console.log("Updating body image 1...");
      if (news.bodyImages?.image1?.path) {
        await deleteFileSafely(news.bodyImages.image1.path);
      }
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
      console.log("Body image 1 updated:", req.files.bodyImage1[0].filename);
    }

    // Body image 2
    if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
      console.log("Removing body image 2...");
      if (news.bodyImages?.image2?.path) {
        await deleteFileSafely(news.bodyImages.image2.path);
      }
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image2 = null;
      console.log("Body image 2 removed");
    } else if (req.files && req.files.bodyImage2 && req.files.bodyImage2[0]) {
      console.log("Updating body image 2...");
      if (news.bodyImages?.image2?.path) {
        await deleteFileSafely(news.bodyImages.image2.path);
      }
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
      console.log("Body image 2 updated:", req.files.bodyImage2[0].filename);
    }

    console.log("Saving updated news...");
    await news.save();
    console.log("News saved successfully");

    const newsForAgent = {
      newsId: news._id,
      title: news.content?.title || news.metadata?.title || "Untitled",
      slug: news.metadata?.slug || "",
      image: news.image,
      isPublished: news.isPublished || false,
      publishedAt: news.publishedAt || null,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
    };

    if (agentChanged) {
      console.log("=== HANDLING AGENT REASSIGNMENT (NEWS) ===");
      // Remove from old agent
      try {
        const oldAgent = await Agent.findOne({ agentId: oldAgentId });
        if (oldAgent) {
          if (Array.isArray(oldAgent.news)) {
            oldAgent.news = oldAgent.news.filter(
              (n) => n.newsId.toString() !== news._id.toString()
            );
          } else if (typeof oldAgent.removeNews === "function") {
            oldAgent.removeNews(news._id);
          }
          await oldAgent.save({ validateBeforeSave: false });
          console.log("Removed news from old agent:", oldAgent.agentName);
        }
      } catch (oldAgentError) {
        console.log("Warning: Could not remove news from old agent:", oldAgentError.message);
      }

      // Add to new agent
      try {
        const newAgent = await Agent.findOne({ agentId: news.author.agentId });
        if (newAgent && typeof newAgent.addOrUpdateNews === "function") {
          newAgent.addOrUpdateNews(newsForAgent);
          await newAgent.save({ validateBeforeSave: false });
          console.log("Added news to new agent:", newAgent.agentName);
        }
      } catch (newAgentError) {
        console.log("Warning: Could not add news to new agent:", newAgentError.message);
      }
    } else {
      // Update in current agent
      try {
        const currentAgent = await Agent.findOne({ agentId: news.author.agentId });
        if (currentAgent && typeof currentAgent.addOrUpdateNews === "function") {
          currentAgent.addOrUpdateNews(newsForAgent);
          await currentAgent.save({ validateBeforeSave: false });
          console.log("Updated news entry in current agent:", currentAgent.agentName);
        }
      } catch (agentError) {
        console.log("Warning: Could not update agent's news entry:", agentError.message);
      }
    }

    console.log("=== NEWS UPDATE SUCCESS ===");

    res.status(200).json({
      success: true,
      message: agentChanged
        ? "News updated and reassigned to new agent successfully"
        : "News updated successfully",
      data: {
        news,
        stats: news.getContentStats ? news.getContentStats() : undefined,
        linkedAgent: {
          agentId: news.author.agentId,
          agentName: news.author.agentName,
          email: news.author.agentEmail,
        },
        agentChanged,
      },
    });
  } catch (error) {
    console.error("=== NEWS UPDATE ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        await deleteFileSafely(req.files.coverImage[0].path);
      }
      if (req.files.bodyImage1 && req.files.bodyImage1[0]) {
        await deleteFileSafely(req.files.bodyImage1[0].path);
      }
      if (req.files.bodyImage2 && req.files.bodyImage2[0]) {
        await deleteFileSafely(req.files.bodyImage2[0].path);
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to update news",
      error: error.message,
      errorName: error.name,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// === LIST / GET ===
const GetAllNews = async (req, res) => {
  try {
    console.log("Fetching all news for cards display...");

    const newsItems = await News.find({})
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 });

    console.log(`Found ${newsItems.length} news items`);

    res.status(200).json({
      success: true,
      message: "All news fetched successfully",
      totalNews: newsItems.length,
      data: newsItems,
    });
  } catch (error) {
    console.error("Error fetching all news:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all news",
      error: error.message,
    });
  }
};

const getSingleNews = async (req, res) => {
  try {
    const newsId = req.query.id;

    console.log("News ID:", newsId);

    if (!newsId) {
      return res.status(400).json({
        success: false,
        message: "News ID is required",
      });
    }

    const news = await News.findById(newsId).populate(
      "author.agentId",
      "agentName email imageUrl designation specialistAreas phone whatsapp description"
    );

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "News fetched successfully",
      data: news,
    });
  } catch (error) {
    console.error("Error fetching news:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch news",
      error: error.message,
    });
  }
};

const getNewsByTags = async (req, res) => {
  try {
    const { tags, limit = 6, excludeId } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags are required. Pass tags as comma-separated values.",
        example: "/api/news/by-tags?tags=dubai,uae,property&limit=6",
      });
    }

    const tagsArray = tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);

    const query = { "metadata.tags": { $in: tagsArray } };
    if (excludeId) query._id = { $ne: excludeId };

    const items = await News.find(query)
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const withScore = items.map((n) => {
      const matchingTags = (n.metadata.tags || []).filter((t) =>
        tagsArray.includes(t.toLowerCase())
      );
      return {
        ...n.toObject(),
        matchScore: matchingTags.length,
        matchingTags,
      };
    });

    withScore.sort((a, b) => b.matchScore - a.matchScore);
    console.log(`Found ${withScore.length} news with matching tags`);

    res.status(200).json({
      success: true,
      message: "News with matching tags fetched successfully",
      count: withScore.length,
      searchedTags: tagsArray,
      data: withScore,
    });
  } catch (error) {
    console.error("Error fetching news by tags:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch news by tags",
      error: error.message,
    });
  }
};

// === DELETE ===
const deleteNews = async (req, res) => {
  try {
    const newsId = req.query.id || req.body.id;

    console.log("News ID for deletion:", newsId);

    if (!newsId) {
      return res.status(400).json({
        success: false,
        message: "News ID is required",
      });
    }

    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    // Remove from agent (if your Agent model supports it)
    const agent = await Agent.findById(news.author.agentId);
    if (agent) {
      if (typeof agent.removeNews === "function") {
        agent.removeNews(news._id);
      } else if (Array.isArray(agent.news)) {
        agent.news = agent.news.filter((n) => n.newsId.toString() !== news._id.toString());
      }
      await agent.save();
      console.log(`✅ News removed from agent ${agent.agentName}`);
    }

    // Delete images
    if (news.image && news.image.path && news.image.filename !== "placeholder.jpg") {
      await deleteFileSafely(news.image.path);
    }
    if (news.bodyImages?.image1?.path) {
      await deleteFileSafely(news.bodyImages.image1.path);
      console.log("Deleted body image 1");
    }
    if (news.bodyImages?.image2?.path) {
      await deleteFileSafely(news.bodyImages.image2.path);
      console.log("Deleted body image 2");
    }

    await News.findByIdAndDelete(newsId);

    res.status(200).json({
      success: true,
      message: "News and all associated images deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting news:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete news",
      error: error.message,
    });
  }
};

// === BY AGENT ===
const getNewsByAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { published, page = 1, limit = 10 } = req.query;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "Agent ID is required",
      });
    }

    let filter = { "author.agentId": agentId };
    if (published !== undefined) {
      filter.isPublished = published === "true";
    }

    const skip = (page - 1) * limit;

    const items = await News.find(filter)
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await News.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Agent news fetched successfully",
      data: {
        news: items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNews: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching agent news:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent news",
      error: error.message,
    });
  }
};

// === AGENTS WITH NEWS (optional aggregate on Agent) ===
const getAgentsWithNews = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // If you have a static like Agent.findAgentsWithNews(limit)
    if (typeof Agent.findAgentsWithNews === "function") {
      const agentsWithNews = await Agent.findAgentsWithNews(parseInt(limit));
      return res.status(200).json({
        success: true,
        message: "Agents with news fetched successfully",
        data: agentsWithNews,
      });
    }

    // Fallback (simple distinct)
    const agentIds = await News.distinct("author.agentId");
    const agents = await Agent.find({ agentId: { $in: agentIds } })
      .limit(parseInt(limit))
      .select("agentId agentName email imageUrl designation");

    res.status(200).json({
      success: true,
      message: "Agents with news fetched successfully",
      data: agents,
    });
  } catch (error) {
    console.error("Error fetching agents with news:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents with news",
      error: error.message,
    });
  }
};

// === PUBLISH / UNPUBLISH ===
const toggleNewsPublishStatus = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { publish } = req.body;

    if (!newsId) {
      return res.status(400).json({
        success: false,
        message: "News ID is required",
      });
    }

    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    let result;
    if (publish === true || publish === "true") {
      result = await news.publish();
    } else {
      result = await news.unpublish();
    }

    const agent = await Agent.findById(news.author.agentId);
    if (agent) {
      const newsForAgent = {
        newsId: news._id,
        title: news.content?.title || news.metadata?.title || "",
        slug: news.metadata?.slug || "",
        isPublished: news.isPublished,
        publishedAt: news.publishedAt,
      };
      if (typeof agent.addOrUpdateNews === "function") {
        agent.addOrUpdateNews(newsForAgent);
        await agent.save();
      }
    }

    res.status(200).json({
      success: true,
      message: `News ${publish ? "published" : "unpublished"} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error toggling news publish status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle news publish status",
      error: error.message,
    });
  }
};

module.exports = {
  GetAllNews,
  getSingleNews,
  getNewsByTags,
  createNews,
  updateNews,
  deleteNews,
  getNewsByAgent,
  getAgentsWithNews,
  toggleNewsPublishStatus,
  upload, // same multer field map as blog
};
