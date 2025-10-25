const Blog = require("../Models/BlogsModel");
const Agent = require("../Models/AgentModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const blogsDir = path.join(__dirname, "..", "uploads", "Blogs");

    console.log("=== MULTER DESTINATION DEBUG ===");
    console.log("__dirname:", __dirname);
    console.log("Calculated blogsDir:", blogsDir);
    console.log("Directory exists:", fsSync.existsSync(blogsDir));

    if (!fsSync.existsSync(blogsDir)) {
      fsSync.mkdirSync(blogsDir, { recursive: true });
      console.log("Created directory:", blogsDir);
    }

    cb(null, blogsDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = unique + "-" + file.originalname;

    console.log("=== MULTER FILENAME DEBUG ===");
    console.log("Generated filename:", filename);
    console.log("Original name:", file.originalname);
    console.log("Field name:", file.fieldname);

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  console.log("=== FILE FILTER DEBUG ===");
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

// ✅ Updated multer to handle multiple files with specific field names
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit per file
}).fields([
  { name: "coverImage", maxCount: 1 },    // Cover image
  { name: "bodyImage1", maxCount: 1 },    // First body image
  { name: "bodyImage2", maxCount: 1 },    // Second body image
]);

// Helper function to create image data object
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

// Helper function to delete file safely
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

const createBlog = async (req, res) => {
  try {
    console.log("=== BLOG CREATION START ===");
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

    // Log all uploaded files
    if (req.files) {
      console.log("=== UPLOADED FILES DEBUG ===");
      if (req.files.coverImage) {
        console.log("Cover Image:", req.files.coverImage[0].filename);
      }
      if (req.files.bodyImage1) {
        console.log("Body Image 1:", req.files.bodyImage1[0].filename);
      }
      if (req.files.bodyImage2) {
        console.log("Body Image 2:", req.files.bodyImage2[0].filename);
      }
    }

    const { parsedData, agentId } = req.body;
    console.log(agentId, "Agent ID");

    // Validate required fields
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

    // Parse the data
    let blogData;
    try {
      if (typeof parsedData === "string") {
        console.log("Parsing string data...");
        if (parsedData.trim().startsWith("{")) {
          console.log("Detected JSON format");
          blogData = JSON.parse(parsedData);
        } else {
          console.log("Detected plain text format, using text parser");
          blogData = Blog.parseTextToBlogStructure(parsedData);
        }
      } else if (typeof parsedData === "object" && parsedData !== null) {
        console.log("Data already parsed as object");
        blogData = parsedData;
      } else {
        throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
      }
    } catch (parseError) {
      console.error("Parse error:", parseError.message);
      return res.status(400).json({
        success: false,
        message: "Failed to parse blog data",
        error: parseError.message,
        receivedType: typeof parsedData,
        receivedData: parsedData ? parsedData.substring(0, 200) : "null",
      });
    }

    console.log("=== PARSED BLOG DATA ===");
    console.log("Blog data keys:", Object.keys(blogData || {}));
    console.log("Content title:", blogData?.content?.title);
    console.log("Sections count:", blogData?.content?.sections?.length);

    // Validate parsed blog data structure
    if (!blogData || typeof blogData !== "object") {
      return res.status(400).json({
        success: false,
        message: "Parsed data must be an object",
        received: blogData,
      });
    }

    if (!blogData.content || !blogData.content.title) {
      return res.status(400).json({
        success: false,
        message: "Blog content and title are required",
        received: {
          hasContent: !!blogData.content,
          contentTitle: blogData.content?.title,
          blogDataKeys: Object.keys(blogData),
        },
      });
    }

    if (
      !blogData.content.sections ||
      !Array.isArray(blogData.content.sections)
    ) {
      return res.status(400).json({
        success: false,
        message: "Blog content sections are required and must be an array",
      });
    }

    // Find the agent
    console.log("Finding agent with custom agentId:", agentId);
    const agent = await Agent.findOne({ agentId: agentId });

    if (!agent) {
      const sampleAgents = await Agent.find(
        { isActive: true },
        "agentId agentName"
      ).limit(5);
      return res.status(404).json({
        success: false,
        message: "Agent not found",
        searchedFor: agentId,
        availableAgents: sampleAgents.map((a) => ({
          agentId: a.agentId,
          agentName: a.agentName,
        })),
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

    // ✅ Handle cover image upload
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
        path: "uploads/Blogs/placeholder.jpg",
      };
    }

    // ✅ Handle body images upload
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

    // Create the blog document
    const newBlog = new Blog({
      originalId:
        blogData.id ||
        `blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        title: blogData.metadata?.title || blogData.content?.title,
        description:
          blogData.metadata?.description || blogData.seo?.metaDescription || "",
        author: blogData.metadata?.author || agent.agentName,
        tags: blogData.metadata?.tags || [],
        category: blogData.metadata?.category || "",
        slug: blogData.metadata?.slug || null,
      },
      content: {
        title: blogData.content.title,
        sections: blogData.content.sections || [],
        wordCount: blogData.content.wordCount || 0,
        readingTime: blogData.content.readingTime || 0,
      },
      seo: {
        metaTitle: blogData.seo?.metaTitle || "",
        metaDescription: blogData.seo?.metaDescription || "",
        keywords: blogData.seo?.keywords || [],
      },
      author: {
        agentId: agent.agentId,
        agentName: agent.agentName,
        agentEmail: agent.email,
        agentImage: agent.imageUrl,
      },
      image: coverImageData,
      bodyImages: {
        image1: bodyImage1Data,
        image2: bodyImage2Data,
      },
      status: blogData.status || "draft",
      isPublished: blogData.status === "published" || false,
    });

    // Save the blog
    console.log("Saving blog to database...");
    const savedBlog = await newBlog.save();
    console.log("Blog saved with ID:", savedBlog._id);
    console.log("Body images saved:", {
      image1: savedBlog.bodyImages?.image1?.filename || "none",
      image2: savedBlog.bodyImages?.image2?.filename || "none",
    });

    // Add blog to agent's blogs array
    try {
      const blogForAgent = {
        blogId: savedBlog._id,
        title: savedBlog.content.title,
        slug: savedBlog.metadata.slug,
        image: savedBlog.image,
        isPublished: savedBlog.isPublished,
        publishedAt: savedBlog.publishedAt,
        createdAt: savedBlog.createdAt,
        updatedAt: savedBlog.updatedAt,
      };

      if (typeof agent.addOrUpdateBlog === "function") {
        agent.addOrUpdateBlog(blogForAgent);
        await agent.save({ validateBeforeSave: false });
        console.log("Blog added to agent successfully");
      }
    } catch (agentUpdateError) {
      console.log(
        "Warning: Could not update agent's blog array:",
        agentUpdateError.message
      );
    }

    console.log("=== BLOG CREATION SUCCESS ===");

    res.status(201).json({
      success: true,
      message: "Blog created successfully from parsed content",
      data: {
        blog: savedBlog,
        stats: savedBlog.getContentStats(),
        linkedAgent: {
          agentId: agent.agentId,
          agentName: agent.agentName,
          email: agent.email,
          imageUrl: agent.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error("=== BLOG CREATION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Delete all uploaded files if blog creation fails
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
      message: "Failed to create blog from parsed content",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const updateBlog = async (req, res) => {
  try {
    console.log("=== BLOG UPDATE START ===");
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

    if (req.files) {
      console.log("=== UPLOADED FILES DEBUG ===");
      if (req.files.coverImage) {
        console.log("New Cover Image:", req.files.coverImage[0].filename);
      }
      if (req.files.bodyImage1) {
        console.log("New Body Image 1:", req.files.bodyImage1[0].filename);
      }
      if (req.files.bodyImage2) {
        console.log("New Body Image 2:", req.files.bodyImage2[0].filename);
      }
    }

    const { blogId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } = req.body;

    console.log("BlogId:", blogId);
    console.log("New AgentId:", agentId);
    console.log("Remove Body Image 1:", removeBodyImage1);
    console.log("Remove Body Image 2:", removeBodyImage2);

    // Validate required fields
    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "blogId is required",
      });
    }

    // Find the blog to update
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
        blogId: blogId,
      });
    }

    console.log("Blog found:", blog.content?.title || blog.metadata?.title);
    console.log("Current blog author agentId:", blog.author.agentId);

    // Store old agent info for later cleanup
    const oldAgentId = blog.author.agentId;
    let agentChanged = false;

    // Handle agent change if new agentId is provided
    if (agentId && agentId !== oldAgentId) {
      console.log("=== AGENT CHANGE DETECTED ===");
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

      blog.author.agentId = newAgent.agentId;
      blog.author.agentName = newAgent.agentName;
      blog.author.agentEmail = newAgent.email;
      blog.author.agentImage = newAgent.imageUrl;

      agentChanged = true;
    }

    // Parse and update blog data if provided
    if (parsedData) {
      let updateData;

      try {
        if (typeof parsedData === "string") {
          console.log("Parsing string data...");
          if (parsedData.trim().startsWith("{")) {
            console.log("Detected JSON format");
            updateData = JSON.parse(parsedData);
          } else {
            console.log("Detected plain text format, using text parser");
            updateData = Blog.parseTextToBlogStructure(parsedData);
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
          message: "Failed to parse blog data",
          error: parseError.message,
          receivedType: typeof parsedData,
        });
      }

      console.log("=== PARSED UPDATE DATA ===");
      console.log("Update data keys:", Object.keys(updateData || {}));
      console.log("Content title:", updateData?.content?.title);
      console.log("Sections count:", updateData?.content?.sections?.length);

      // Update metadata fields if provided
      if (updateData.metadata) {
        if (updateData.metadata.title) {
          blog.metadata.title = updateData.metadata.title;
        }
        if (updateData.metadata.description !== undefined) {
          blog.metadata.description = updateData.metadata.description;
        }
        if (updateData.metadata.author) {
          blog.metadata.author = updateData.metadata.author;
        }
        if (updateData.metadata.tags) {
          blog.metadata.tags = Array.isArray(updateData.metadata.tags)
            ? updateData.metadata.tags
            : [];
        }
        if (updateData.metadata.category !== undefined) {
          blog.metadata.category = updateData.metadata.category;
        }
        if (updateData.metadata.slug !== undefined) {
          blog.metadata.slug = updateData.metadata.slug;
        }
      }

      // Update content fields if provided
      if (updateData.content) {
        if (updateData.content.title) {
          blog.content.title = updateData.content.title;
        }
        if (
          updateData.content.sections &&
          Array.isArray(updateData.content.sections)
        ) {
          blog.content.sections = updateData.content.sections;
        }
        if (updateData.content.wordCount !== undefined) {
          blog.content.wordCount = updateData.content.wordCount;
        }
        if (updateData.content.readingTime !== undefined) {
          blog.content.readingTime = updateData.content.readingTime;
        }
      }

      // Update SEO fields if provided
      if (updateData.seo) {
        if (updateData.seo.metaTitle !== undefined) {
          blog.seo.metaTitle = updateData.seo.metaTitle;
        }
        if (updateData.seo.metaDescription !== undefined) {
          blog.seo.metaDescription = updateData.seo.metaDescription;
        }
        if (updateData.seo.keywords) {
          blog.seo.keywords = Array.isArray(updateData.seo.keywords)
            ? updateData.seo.keywords
            : [];
        }
      }

      // Update status if provided
      if (updateData.status) {
        blog.status = updateData.status;

        if (updateData.status === "published" && !blog.isPublished) {
          blog.isPublished = true;
          blog.publishedAt = new Date();
        } else if (updateData.status === "draft" && blog.isPublished) {
          blog.isPublished = false;
          blog.publishedAt = null;
        }
      }
    }

    // ✅ Handle cover image update
    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      console.log("Updating cover image...");

      // Delete old cover image if it exists and isn't placeholder
      if (
        blog.image &&
        blog.image.path &&
        blog.image.filename !== "placeholder.jpg"
      ) {
        await deleteFileSafely(blog.image.path);
      }

      blog.image = createImageData(req.files.coverImage[0]);
      console.log("Cover image updated:", req.files.coverImage[0].filename);
    }

    // ✅ Handle body image 1 update or removal
    if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
      console.log("Removing body image 1...");
      if (blog.bodyImages?.image1?.path) {
        await deleteFileSafely(blog.bodyImages.image1.path);
      }
      blog.bodyImages.image1 = null;
      console.log("Body image 1 removed");
    } else if (req.files && req.files.bodyImage1 && req.files.bodyImage1[0]) {
      console.log("Updating body image 1...");
      
      // Delete old body image 1 if it exists
      if (blog.bodyImages?.image1?.path) {
        await deleteFileSafely(blog.bodyImages.image1.path);
      }

      if (!blog.bodyImages) {
        blog.bodyImages = {};
      }
      blog.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
      console.log("Body image 1 updated:", req.files.bodyImage1[0].filename);
    }

    // ✅ Handle body image 2 update or removal
    if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
      console.log("Removing body image 2...");
      if (blog.bodyImages?.image2?.path) {
        await deleteFileSafely(blog.bodyImages.image2.path);
      }
      blog.bodyImages.image2 = null;
      console.log("Body image 2 removed");
    } else if (req.files && req.files.bodyImage2 && req.files.bodyImage2[0]) {
      console.log("Updating body image 2...");
      
      // Delete old body image 2 if it exists
      if (blog.bodyImages?.image2?.path) {
        await deleteFileSafely(blog.bodyImages.image2.path);
      }

      if (!blog.bodyImages) {
        blog.bodyImages = {};
      }
      blog.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
      console.log("Body image 2 updated:", req.files.bodyImage2[0].filename);
    }

    // Save the updated blog
    console.log("Saving updated blog...");
    await blog.save();
    console.log("Blog saved successfully");

    // Prepare blog data for agent array
    const blogForAgent = {
      blogId: blog._id,
      title: blog.content?.title || blog.metadata?.title || "Untitled",
      slug: blog.metadata?.slug || "",
      image: blog.image,
      isPublished: blog.isPublished || false,
      publishedAt: blog.publishedAt || null,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };

    // Handle agent reassignment
    if (agentChanged) {
      console.log("=== HANDLING AGENT REASSIGNMENT ===");

      // Remove blog from old agent
      try {
        const oldAgent = await Agent.findOne({ agentId: oldAgentId });
        if (oldAgent) {
          oldAgent.blogs = oldAgent.blogs.filter(
            (b) => b.blogId.toString() !== blog._id.toString()
          );
          await oldAgent.save({ validateBeforeSave: false });
          console.log("Removed blog from old agent:", oldAgent.agentName);
        }
      } catch (oldAgentError) {
        console.log(
          "Warning: Could not remove blog from old agent:",
          oldAgentError.message
        );
      }

      // Add blog to new agent
      try {
        const newAgent = await Agent.findOne({ agentId: blog.author.agentId });
        if (newAgent && typeof newAgent.addOrUpdateBlog === "function") {
          newAgent.addOrUpdateBlog(blogForAgent);
          await newAgent.save({ validateBeforeSave: false });
          console.log("Added blog to new agent:", newAgent.agentName);
        }
      } catch (newAgentError) {
        console.log(
          "Warning: Could not add blog to new agent:",
          newAgentError.message
        );
      }
    } else {
      // No agent change, just update blog entry in current agent
      try {
        const currentAgent = await Agent.findOne({ agentId: blog.author.agentId });
        if (currentAgent && typeof currentAgent.addOrUpdateBlog === "function") {
          currentAgent.addOrUpdateBlog(blogForAgent);
          await currentAgent.save({ validateBeforeSave: false });
          console.log("Updated blog entry in current agent:", currentAgent.agentName);
        }
      } catch (agentError) {
        console.log(
          "Warning: Could not update agent's blog entry:",
          agentError.message
        );
      }
    }

    console.log("=== BLOG UPDATE SUCCESS ===");

    res.status(200).json({
      success: true,
      message: agentChanged 
        ? "Blog updated and reassigned to new agent successfully" 
        : "Blog updated successfully",
      data: {
        blog: blog,
        stats: blog.getContentStats ? blog.getContentStats() : undefined,
        linkedAgent: {
          agentId: blog.author.agentId,
          agentName: blog.author.agentName,
          email: blog.author.agentEmail,
        },
        agentChanged: agentChanged,
      },
    });
  } catch (error) {
    console.error("=== BLOG UPDATE ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Delete uploaded files if blog update fails
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
      message: "Failed to update blog",
      error: error.message,
      errorName: error.name,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const GetAllBlogs = async (req, res) => {
  try {
    console.log("Fetching all blogs for cards display...");

    const blogs = await Blog.find({})
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 });

    console.log(`Found ${blogs.length} blogs`);

    res.status(200).json({
      success: true,
      message: "All blogs fetched successfully",
      totalBlogs: blogs.length,
      data: blogs,
    });
  } catch (error) {
    console.error("Error fetching all blogs:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all blogs",
      error: error.message,
    });
  }
};

const getSingleBlog = async (req, res) => {
  try {
    const blogId = req.query.id;

    console.log("Blog ID:", blogId);

    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await Blog.findById(blogId).populate(
      "author.agentId",
      "agentName email imageUrl designation specialistAreas phone whatsapp description"
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error fetching blog:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

const getBlogsByTags = async (req, res) => {
  try {
    const { tags, limit = 6, excludeId } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags are required. Pass tags as comma-separated values.",
        example: "/api/blogs/by-tags?tags=dubai,uae,property&limit=6"
      });
    }

    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);

    const query = {
      'metadata.tags': { $in: tagsArray },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const blogs = await Blog.find(query)
      .populate('author.agentId', 'agentName email imageUrl designation')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const blogsWithScore = blogs.map(blog => {
      const matchingTags = blog.metadata.tags.filter(tag => 
        tagsArray.includes(tag.toLowerCase())
      );
      return {
        ...blog.toObject(),
        matchScore: matchingTags.length,
        matchingTags: matchingTags
      };
    });

    blogsWithScore.sort((a, b) => b.matchScore - a.matchScore);

    console.log(`Found ${blogsWithScore.length} blogs with matching tags`);

    res.status(200).json({
      success: true,
      message: "Blogs with matching tags fetched successfully",
      count: blogsWithScore.length,
      searchedTags: tagsArray,
      data: blogsWithScore
    });

  } catch (error) {
    console.error("Error fetching blogs by tags:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs by tags",
      error: error.message
    });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blogId = req.query.id || req.body.id;

    console.log("Blog ID for deletion:", blogId);

    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Remove blog from agent's blogs array
    const agent = await Agent.findById(blog.author.agentId);
    if (agent) {
      agent.removeBlog(blog._id);
      await agent.save();
      console.log(`✅ Blog removed from agent ${agent.agentName}`);
    }

    // ✅ Delete cover image
    if (blog.image && blog.image.path && blog.image.filename !== "placeholder.jpg") {
      await deleteFileSafely(blog.image.path);
    }

    // ✅ Delete body images
    if (blog.bodyImages?.image1?.path) {
      await deleteFileSafely(blog.bodyImages.image1.path);
      console.log("Deleted body image 1");
    }

    if (blog.bodyImages?.image2?.path) {
      await deleteFileSafely(blog.bodyImages.image2.path);
      console.log("Deleted body image 2");
    }

    // Delete the blog
    await Blog.findByIdAndDelete(blogId);

    res.status(200).json({
      success: true,
      message: "Blog and all associated images deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

const getBlogsByAgent = async (req, res) => {
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

    const blogs = await Blog.find(filter)
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalBlogs = await Blog.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Agent blogs fetched successfully",
      data: {
        blogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBlogs / limit),
          totalBlogs,
          hasNext: page * limit < totalBlogs,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching agent blogs:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent blogs",
      error: error.message,
    });
  }
};

const getAgentsWithBlogs = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const agentsWithBlogs = await Agent.findAgentsWithBlogs(parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Agents with blogs fetched successfully",
      data: agentsWithBlogs,
    });
  } catch (error) {
    console.error("Error fetching agents with blogs:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents with blogs",
      error: error.message,
    });
  }
};

const toggleBlogPublishStatus = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { publish } = req.body;

    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    let result;
    if (publish === true || publish === "true") {
      result = await blog.publish();
    } else {
      result = await blog.unpublish();
    }

    const agent = await Agent.findById(blog.author.agentId);
    if (agent) {
      const blogForAgent = {
        blogId: blog._id,
        title: blog.title,
        slug: blog.slug,
        isPublished: blog.isPublished,
        publishedAt: blog.publishedAt,
      };
      agent.addOrUpdateBlog(blogForAgent);
      await agent.save();
    }

    res.status(200).json({
      success: true,
      message: `Blog ${publish ? "published" : "unpublished"} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error toggling blog publish status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle blog publish status",
      error: error.message,
    });
  }
};

module.exports = {
  GetAllBlogs,
  getSingleBlog,
  getBlogsByTags,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogsByAgent,
  getAgentsWithBlogs,
  toggleBlogPublishStatus,
  upload,
};