// const Blog = require("../Models/BlogsModel");
// const Agent = require("../Models/AgentModel");
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs").promises;
// const fsSync = require("fs");

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const blogsDir = path.join(__dirname, "..", "uploads", "Blogs");

//     console.log("=== MULTER DESTINATION DEBUG ===");
//     console.log("__dirname:", __dirname);
//     console.log("Calculated blogsDir:", blogsDir);
//     console.log("Directory exists:", fsSync.existsSync(blogsDir));

//     if (!fsSync.existsSync(blogsDir)) {
//       fsSync.mkdirSync(blogsDir, { recursive: true });
//       console.log("Created directory:", blogsDir);
//     }

//     cb(null, blogsDir);
//   },
//   filename: (req, file, cb) => {
//     const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     const filename = unique + "-" + file.originalname;

//     console.log("=== MULTER FILENAME DEBUG ===");
//     console.log("Generated filename:", filename);
//     console.log("Original name:", file.originalname);
//     console.log("Field name:", file.fieldname);

//     cb(null, filename);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   console.log("=== FILE FILTER DEBUG ===");
//   console.log("File mimetype:", file.mimetype);
//   console.log("File fieldname:", file.fieldname);

//   if (file.mimetype.startsWith("image/")) {
//     console.log("File accepted");
//     cb(null, true);
//   } else {
//     console.log("File rejected - not an image");
//     cb(new Error("Only image files are allowed!"), false);
//   }
// };

// // ✅ Updated multer to handle multiple files with specific field names
// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit per file
// }).fields([
//   { name: "coverImage", maxCount: 1 },    // Cover image
//   { name: "bodyImage1", maxCount: 1 },    // First body image
//   { name: "bodyImage2", maxCount: 1 },    // Second body image
// ]);

// // Helper function to create image data object
// const createImageData = (file) => {
//   if (!file) return null;
  
//   return {
//     filename: file.filename,
//     originalName: file.originalname,
//     mimetype: file.mimetype,
//     size: file.size,
//     path: file.path,
//   };
// };

// // Helper function to delete file safely
// const deleteFileSafely = async (filePath) => {
//   if (!filePath) return;
  
//   try {
//     if (fsSync.existsSync(filePath)) {
//       await fs.unlink(filePath);
//       console.log("Deleted file:", filePath);
//     }
//   } catch (err) {
//     console.log("Could not delete file:", filePath, err.message);
//   }
// };

// const createBlog = async (req, res) => {
//   try {
//     console.log("=== BLOG CREATION START ===");
//     console.log("Request body keys:", Object.keys(req.body));
//     console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

//     // Log all uploaded files
//     if (req.files) {
//       console.log("=== UPLOADED FILES DEBUG ===");
//       if (req.files.coverImage) {
//         console.log("Cover Image:", req.files.coverImage[0].filename);
//       }
//       if (req.files.bodyImage1) {
//         console.log("Body Image 1:", req.files.bodyImage1[0].filename);
//       }
//       if (req.files.bodyImage2) {
//         console.log("Body Image 2:", req.files.bodyImage2[0].filename);
//       }
//     }

//     const { parsedData, agentId } = req.body;
//     console.log(agentId, "Agent ID");

//     // Validate required fields
//     if (!parsedData) {
//       return res.status(400).json({
//         success: false,
//         message: "parsedData is required",
//         received: { parsedData, agentId },
//       });
//     }

//     if (!agentId) {
//       return res.status(400).json({
//         success: false,
//         message: "agentId is required",
//         received: { parsedData: "present", agentId },
//       });
//     }

//     // Parse the data
//     let blogData;
//     try {
//       if (typeof parsedData === "string") {
//         console.log("Parsing string data...");
//         if (parsedData.trim().startsWith("{")) {
//           console.log("Detected JSON format");
//           blogData = JSON.parse(parsedData);
//         } else {
//           console.log("Detected plain text format, using text parser");
//           blogData = Blog.parseTextToBlogStructure(parsedData);
//         }
//       } else if (typeof parsedData === "object" && parsedData !== null) {
//         console.log("Data already parsed as object");
//         blogData = parsedData;
//       } else {
//         throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
//       }
//     } catch (parseError) {
//       console.error("Parse error:", parseError.message);
//       return res.status(400).json({
//         success: false,
//         message: "Failed to parse blog data",
//         error: parseError.message,
//         receivedType: typeof parsedData,
//         receivedData: parsedData ? parsedData.substring(0, 200) : "null",
//       });
//     }

//     console.log("=== PARSED BLOG DATA ===");
//     console.log("Blog data keys:", Object.keys(blogData || {}));
//     console.log("Content title:", blogData?.content?.title);
//     console.log("Sections count:", blogData?.content?.sections?.length);

//     // Validate parsed blog data structure
//     if (!blogData || typeof blogData !== "object") {
//       return res.status(400).json({
//         success: false,
//         message: "Parsed data must be an object",
//         received: blogData,
//       });
//     }

//     if (!blogData.content || !blogData.content.title) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog content and title are required",
//         received: {
//           hasContent: !!blogData.content,
//           contentTitle: blogData.content?.title,
//           blogDataKeys: Object.keys(blogData),
//         },
//       });
//     }

//     if (
//       !blogData.content.sections ||
//       !Array.isArray(blogData.content.sections)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog content sections are required and must be an array",
//       });
//     }

//     // Find the agent
//     console.log("Finding agent with custom agentId:", agentId);
//     const agent = await Agent.findOne({ agentId: agentId });

//     if (!agent) {
//       const sampleAgents = await Agent.find(
//         { isActive: true },
//         "agentId agentName"
//       ).limit(5);
//       return res.status(404).json({
//         success: false,
//         message: "Agent not found",
//         searchedFor: agentId,
//         availableAgents: sampleAgents.map((a) => ({
//           agentId: a.agentId,
//           agentName: a.agentName,
//         })),
//       });
//     }

//     if (!agent.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Agent is not active",
//         agentId: agentId,
//       });
//     }

//     console.log("Agent found:", agent.agentName);
//     console.log("Agent Image URL:", agent.imageUrl);

//     // ✅ Handle cover image upload
//     let coverImageData = null;
//     if (req.files && req.files.coverImage && req.files.coverImage[0]) {
//       console.log("Cover image uploaded:", req.files.coverImage[0].filename);
//       coverImageData = createImageData(req.files.coverImage[0]);
//     } else {
//       console.log("No cover image uploaded, using placeholder");
//       coverImageData = {
//         filename: "placeholder.jpg",
//         originalName: "placeholder.jpg",
//         mimetype: "image/jpeg",
//         size: 0,
//         path: "uploads/Blogs/placeholder.jpg",
//       };
//     }

//     // ✅ Handle body images upload
//     const bodyImage1Data = 
//       req.files && req.files.bodyImage1 && req.files.bodyImage1[0]
//         ? createImageData(req.files.bodyImage1[0])
//         : null;

//     const bodyImage2Data = 
//       req.files && req.files.bodyImage2 && req.files.bodyImage2[0]
//         ? createImageData(req.files.bodyImage2[0])
//         : null;

//     console.log("Body Image 1:", bodyImage1Data ? bodyImage1Data.filename : "Not provided");
//     console.log("Body Image 2:", bodyImage2Data ? bodyImage2Data.filename : "Not provided");

//     // Create the blog document
//     const newBlog = new Blog({
//       originalId:
//         blogData.id ||
//         `blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//       metadata: {
//         title: blogData.metadata?.title || blogData.content?.title,
//         description:
//           blogData.metadata?.description || blogData.seo?.metaDescription || "",
//         author: blogData.metadata?.author || agent.agentName,
//         tags: blogData.metadata?.tags || [],
//         category: blogData.metadata?.category || "",
//         slug: blogData.metadata?.slug || null,
//       },
//       content: {
//         title: blogData.content.title,
//         sections: blogData.content.sections || [],
//         wordCount: blogData.content.wordCount || 0,
//         readingTime: blogData.content.readingTime || 0,
//       },
//       seo: {
//         metaTitle: blogData.seo?.metaTitle || "",
//         metaDescription: blogData.seo?.metaDescription || "",
//         keywords: blogData.seo?.keywords || [],
//       },
//       author: {
//         agentId: agent.agentId,
//         agentName: agent.agentName,
//         agentEmail: agent.email,
//         agentImage: agent.imageUrl,
//       },
//       image: coverImageData,
//       bodyImages: {
//         image1: bodyImage1Data,
//         image2: bodyImage2Data,
//       },
//       status: blogData.status || "draft",
//       isPublished: blogData.status === "published" || false,
//     });

//     // Save the blog
//     console.log("Saving blog to database...");
//     const savedBlog = await newBlog.save();
//     console.log("Blog saved with ID:", savedBlog._id);
//     console.log("Body images saved:", {
//       image1: savedBlog.bodyImages?.image1?.filename || "none",
//       image2: savedBlog.bodyImages?.image2?.filename || "none",
//     });

//     // Add blog to agent's blogs array
//     try {
//       const blogForAgent = {
//         blogId: savedBlog._id,
//         title: savedBlog.content.title,
//         slug: savedBlog.metadata.slug,
//         image: savedBlog.image,
//         isPublished: savedBlog.isPublished,
//         publishedAt: savedBlog.publishedAt,
//         createdAt: savedBlog.createdAt,
//         updatedAt: savedBlog.updatedAt,
//       };

//       if (typeof agent.addOrUpdateBlog === "function") {
//         agent.addOrUpdateBlog(blogForAgent);
//         await agent.save({ validateBeforeSave: false });
//         console.log("Blog added to agent successfully");
//       }
//     } catch (agentUpdateError) {
//       console.log(
//         "Warning: Could not update agent's blog array:",
//         agentUpdateError.message
//       );
//     }

//     console.log("=== BLOG CREATION SUCCESS ===");

//     res.status(201).json({
//       success: true,
//       message: "Blog created successfully from parsed content",
//       data: {
//         blog: savedBlog,
//         stats: savedBlog.getContentStats(),
//         linkedAgent: {
//           agentId: agent.agentId,
//           agentName: agent.agentName,
//           email: agent.email,
//           imageUrl: agent.imageUrl,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("=== BLOG CREATION ERROR ===");
//     console.error("Error message:", error.message);
//     console.error("Error stack:", error.stack);

//     // Delete all uploaded files if blog creation fails
//     if (req.files) {
//       if (req.files.coverImage && req.files.coverImage[0]) {
//         await deleteFileSafely(req.files.coverImage[0].path);
//       }
//       if (req.files.bodyImage1 && req.files.bodyImage1[0]) {
//         await deleteFileSafely(req.files.bodyImage1[0].path);
//       }
//       if (req.files.bodyImage2 && req.files.bodyImage2[0]) {
//         await deleteFileSafely(req.files.bodyImage2[0].path);
//       }
//     }

//     res.status(500).json({
//       success: false,
//       message: "Failed to create blog from parsed content",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const updateBlog = async (req, res) => {
//   try {
//     console.log("=== BLOG UPDATE START ===");
//     console.log("Request body keys:", Object.keys(req.body));
//     console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

//     if (req.files) {
//       console.log("=== UPLOADED FILES DEBUG ===");
//       if (req.files.coverImage) {
//         console.log("New Cover Image:", req.files.coverImage[0].filename);
//       }
//       if (req.files.bodyImage1) {
//         console.log("New Body Image 1:", req.files.bodyImage1[0].filename);
//       }
//       if (req.files.bodyImage2) {
//         console.log("New Body Image 2:", req.files.bodyImage2[0].filename);
//       }
//     }

//     const { blogId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } = req.body;

//     console.log("BlogId:", blogId);
//     console.log("New AgentId:", agentId);
//     console.log("Remove Body Image 1:", removeBodyImage1);
//     console.log("Remove Body Image 2:", removeBodyImage2);

//     // Validate required fields
//     if (!blogId) {
//       return res.status(400).json({
//         success: false,
//         message: "blogId is required",
//       });
//     }

//     // Find the blog to update
//     const blog = await Blog.findById(blogId);
//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found",
//         blogId: blogId,
//       });
//     }

//     console.log("Blog found:", blog.content?.title || blog.metadata?.title);
//     console.log("Current blog author agentId:", blog.author.agentId);

//     // Store old agent info for later cleanup
//     const oldAgentId = blog.author.agentId;
//     let agentChanged = false;

//     // Handle agent change if new agentId is provided
//     if (agentId && agentId !== oldAgentId) {
//       console.log("=== AGENT CHANGE DETECTED ===");
//       console.log("Old Agent ID:", oldAgentId);
//       console.log("New Agent ID:", agentId);

//       const newAgent = await Agent.findOne({ agentId: agentId });

//       if (!newAgent) {
//         return res.status(404).json({
//           success: false,
//           message: "New agent not found",
//           requestedAgentId: agentId,
//         });
//       }

//       if (!newAgent.isActive) {
//         return res.status(400).json({
//           success: false,
//           message: "New agent is not active",
//           agentId: agentId,
//         });
//       }

//       console.log("New agent found:", newAgent.agentName);

//       blog.author.agentId = newAgent.agentId;
//       blog.author.agentName = newAgent.agentName;
//       blog.author.agentEmail = newAgent.email;
//       blog.author.agentImage = newAgent.imageUrl;

//       agentChanged = true;
//     }

//     // Parse and update blog data if provided
//     if (parsedData) {
//       let updateData;

//       try {
//         if (typeof parsedData === "string") {
//           console.log("Parsing string data...");
//           if (parsedData.trim().startsWith("{")) {
//             console.log("Detected JSON format");
//             updateData = JSON.parse(parsedData);
//           } else {
//             console.log("Detected plain text format, using text parser");
//             updateData = Blog.parseTextToBlogStructure(parsedData);
//           }
//         } else if (typeof parsedData === "object" && parsedData !== null) {
//           console.log("Data already parsed as object");
//           updateData = parsedData;
//         } else {
//           throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
//         }
//       } catch (parseError) {
//         console.error("Parse error:", parseError.message);
//         return res.status(400).json({
//           success: false,
//           message: "Failed to parse blog data",
//           error: parseError.message,
//           receivedType: typeof parsedData,
//         });
//       }

//       console.log("=== PARSED UPDATE DATA ===");
//       console.log("Update data keys:", Object.keys(updateData || {}));
//       console.log("Content title:", updateData?.content?.title);
//       console.log("Sections count:", updateData?.content?.sections?.length);

//       // Update metadata fields if provided
//       if (updateData.metadata) {
//         if (updateData.metadata.title) {
//           blog.metadata.title = updateData.metadata.title;
//         }
//         if (updateData.metadata.description !== undefined) {
//           blog.metadata.description = updateData.metadata.description;
//         }
//         if (updateData.metadata.author) {
//           blog.metadata.author = updateData.metadata.author;
//         }
//         if (updateData.metadata.tags) {
//           blog.metadata.tags = Array.isArray(updateData.metadata.tags)
//             ? updateData.metadata.tags
//             : [];
//         }
//         if (updateData.metadata.category !== undefined) {
//           blog.metadata.category = updateData.metadata.category;
//         }
//         if (updateData.metadata.slug !== undefined) {
//           blog.metadata.slug = updateData.metadata.slug;
//         }
//       }

//       // Update content fields if provided
//       if (updateData.content) {
//         if (updateData.content.title) {
//           blog.content.title = updateData.content.title;
//         }
//         if (
//           updateData.content.sections &&
//           Array.isArray(updateData.content.sections)
//         ) {
//           blog.content.sections = updateData.content.sections;
//         }
//         if (updateData.content.wordCount !== undefined) {
//           blog.content.wordCount = updateData.content.wordCount;
//         }
//         if (updateData.content.readingTime !== undefined) {
//           blog.content.readingTime = updateData.content.readingTime;
//         }
//       }

//       // Update SEO fields if provided
//       if (updateData.seo) {
//         if (updateData.seo.metaTitle !== undefined) {
//           blog.seo.metaTitle = updateData.seo.metaTitle;
//         }
//         if (updateData.seo.metaDescription !== undefined) {
//           blog.seo.metaDescription = updateData.seo.metaDescription;
//         }
//         if (updateData.seo.keywords) {
//           blog.seo.keywords = Array.isArray(updateData.seo.keywords)
//             ? updateData.seo.keywords
//             : [];
//         }
//       }

//       // Update status if provided
//       if (updateData.status) {
//         blog.status = updateData.status;

//         if (updateData.status === "published" && !blog.isPublished) {
//           blog.isPublished = true;
//           blog.publishedAt = new Date();
//         } else if (updateData.status === "draft" && blog.isPublished) {
//           blog.isPublished = false;
//           blog.publishedAt = null;
//         }
//       }
//     }

//     // ✅ Handle cover image update
//     if (req.files && req.files.coverImage && req.files.coverImage[0]) {
//       console.log("Updating cover image...");

//       // Delete old cover image if it exists and isn't placeholder
//       if (
//         blog.image &&
//         blog.image.path &&
//         blog.image.filename !== "placeholder.jpg"
//       ) {
//         await deleteFileSafely(blog.image.path);
//       }

//       blog.image = createImageData(req.files.coverImage[0]);
//       console.log("Cover image updated:", req.files.coverImage[0].filename);
//     }

//     // ✅ Handle body image 1 update or removal
//     if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
//       console.log("Removing body image 1...");
//       if (blog.bodyImages?.image1?.path) {
//         await deleteFileSafely(blog.bodyImages.image1.path);
//       }
//       blog.bodyImages.image1 = null;
//       console.log("Body image 1 removed");
//     } else if (req.files && req.files.bodyImage1 && req.files.bodyImage1[0]) {
//       console.log("Updating body image 1...");
      
//       // Delete old body image 1 if it exists
//       if (blog.bodyImages?.image1?.path) {
//         await deleteFileSafely(blog.bodyImages.image1.path);
//       }

//       if (!blog.bodyImages) {
//         blog.bodyImages = {};
//       }
//       blog.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
//       console.log("Body image 1 updated:", req.files.bodyImage1[0].filename);
//     }

//     // ✅ Handle body image 2 update or removal
//     if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
//       console.log("Removing body image 2...");
//       if (blog.bodyImages?.image2?.path) {
//         await deleteFileSafely(blog.bodyImages.image2.path);
//       }
//       blog.bodyImages.image2 = null;
//       console.log("Body image 2 removed");
//     } else if (req.files && req.files.bodyImage2 && req.files.bodyImage2[0]) {
//       console.log("Updating body image 2...");
      
//       // Delete old body image 2 if it exists
//       if (blog.bodyImages?.image2?.path) {
//         await deleteFileSafely(blog.bodyImages.image2.path);
//       }

//       if (!blog.bodyImages) {
//         blog.bodyImages = {};
//       }
//       blog.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
//       console.log("Body image 2 updated:", req.files.bodyImage2[0].filename);
//     }

//     // Save the updated blog
//     console.log("Saving updated blog...");
//     await blog.save();
//     console.log("Blog saved successfully");

//     // Prepare blog data for agent array
//     const blogForAgent = {
//       blogId: blog._id,
//       title: blog.content?.title || blog.metadata?.title || "Untitled",
//       slug: blog.metadata?.slug || "",
//       image: blog.image,
//       isPublished: blog.isPublished || false,
//       publishedAt: blog.publishedAt || null,
//       createdAt: blog.createdAt,
//       updatedAt: blog.updatedAt,
//     };

//     // Handle agent reassignment
//     if (agentChanged) {
//       console.log("=== HANDLING AGENT REASSIGNMENT ===");

//       // Remove blog from old agent
//       try {
//         const oldAgent = await Agent.findOne({ agentId: oldAgentId });
//         if (oldAgent) {
//           oldAgent.blogs = oldAgent.blogs.filter(
//             (b) => b.blogId.toString() !== blog._id.toString()
//           );
//           await oldAgent.save({ validateBeforeSave: false });
//           console.log("Removed blog from old agent:", oldAgent.agentName);
//         }
//       } catch (oldAgentError) {
//         console.log(
//           "Warning: Could not remove blog from old agent:",
//           oldAgentError.message
//         );
//       }

//       // Add blog to new agent
//       try {
//         const newAgent = await Agent.findOne({ agentId: blog.author.agentId });
//         if (newAgent && typeof newAgent.addOrUpdateBlog === "function") {
//           newAgent.addOrUpdateBlog(blogForAgent);
//           await newAgent.save({ validateBeforeSave: false });
//           console.log("Added blog to new agent:", newAgent.agentName);
//         }
//       } catch (newAgentError) {
//         console.log(
//           "Warning: Could not add blog to new agent:",
//           newAgentError.message
//         );
//       }
//     } else {
//       // No agent change, just update blog entry in current agent
//       try {
//         const currentAgent = await Agent.findOne({ agentId: blog.author.agentId });
//         if (currentAgent && typeof currentAgent.addOrUpdateBlog === "function") {
//           currentAgent.addOrUpdateBlog(blogForAgent);
//           await currentAgent.save({ validateBeforeSave: false });
//           console.log("Updated blog entry in current agent:", currentAgent.agentName);
//         }
//       } catch (agentError) {
//         console.log(
//           "Warning: Could not update agent's blog entry:",
//           agentError.message
//         );
//       }
//     }

//     console.log("=== BLOG UPDATE SUCCESS ===");

//     res.status(200).json({
//       success: true,
//       message: agentChanged 
//         ? "Blog updated and reassigned to new agent successfully" 
//         : "Blog updated successfully",
//       data: {
//         blog: blog,
//         stats: blog.getContentStats ? blog.getContentStats() : undefined,
//         linkedAgent: {
//           agentId: blog.author.agentId,
//           agentName: blog.author.agentName,
//           email: blog.author.agentEmail,
//         },
//         agentChanged: agentChanged,
//       },
//     });
//   } catch (error) {
//     console.error("=== BLOG UPDATE ERROR ===");
//     console.error("Error message:", error.message);
//     console.error("Error stack:", error.stack);

//     // Delete uploaded files if blog update fails
//     if (req.files) {
//       if (req.files.coverImage && req.files.coverImage[0]) {
//         await deleteFileSafely(req.files.coverImage[0].path);
//       }
//       if (req.files.bodyImage1 && req.files.bodyImage1[0]) {
//         await deleteFileSafely(req.files.bodyImage1[0].path);
//       }
//       if (req.files.bodyImage2 && req.files.bodyImage2[0]) {
//         await deleteFileSafely(req.files.bodyImage2[0].path);
//       }
//     }

//     res.status(500).json({
//       success: false,
//       message: "Failed to update blog",
//       error: error.message,
//       errorName: error.name,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const GetAllBlogs = async (req, res) => {
//   try {
//     console.log("Fetching all blogs for cards display...");

//     const blogs = await Blog.find({})
//       .populate("author.agentId", "agentName email imageUrl designation")
//       .sort({ createdAt: -1 });

//     console.log(`Found ${blogs.length} blogs`);

//     res.status(200).json({
//       success: true,
//       message: "All blogs fetched successfully",
//       totalBlogs: blogs.length,
//       data: blogs,
//     });
//   } catch (error) {
//     console.error("Error fetching all blogs:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch all blogs",
//       error: error.message,
//     });
//   }
// };

// const getSingleBlog = async (req, res) => {
//   try {
//     const blogId = req.query.id;

//     console.log("Blog ID:", blogId);

//     if (!blogId) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog ID is required",
//       });
//     }

//     const blog = await Blog.findById(blogId).populate(
//       "author.agentId",
//       "agentName email imageUrl designation specialistAreas phone whatsapp description"
//     );

//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Blog fetched successfully",
//       data: blog,
//     });
//   } catch (error) {
//     console.error("Error fetching blog:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch blog",
//       error: error.message,
//     });
//   }
// };

// const getBlogsByTags = async (req, res) => {
//   try {
//     const { tags, limit = 6, excludeId } = req.query;

//     if (!tags) {
//       return res.status(400).json({
//         success: false,
//         message: "Tags are required. Pass tags as comma-separated values.",
//         example: "/api/blogs/by-tags?tags=dubai,uae,property&limit=6"
//       });
//     }

//     const tagsArray = tags
//       .split(',')
//       .map(tag => tag.trim().toLowerCase())
//       .filter(tag => tag.length > 0);

//     const query = {
//       'metadata.tags': { $in: tagsArray },
//     };

//     if (excludeId) {
//       query._id = { $ne: excludeId };
//     }

//     const blogs = await Blog.find(query)
//       .populate('author.agentId', 'agentName email imageUrl designation')
//       .sort({ createdAt: -1 })
//       .limit(parseInt(limit));

//     const blogsWithScore = blogs.map(blog => {
//       const matchingTags = blog.metadata.tags.filter(tag => 
//         tagsArray.includes(tag.toLowerCase())
//       );
//       return {
//         ...blog.toObject(),
//         matchScore: matchingTags.length,
//         matchingTags: matchingTags
//       };
//     });

//     blogsWithScore.sort((a, b) => b.matchScore - a.matchScore);

//     console.log(`Found ${blogsWithScore.length} blogs with matching tags`);

//     res.status(200).json({
//       success: true,
//       message: "Blogs with matching tags fetched successfully",
//       count: blogsWithScore.length,
//       searchedTags: tagsArray,
//       data: blogsWithScore
//     });

//   } catch (error) {
//     console.error("Error fetching blogs by tags:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch blogs by tags",
//       error: error.message
//     });
//   }
// };

// const deleteBlog = async (req, res) => {
//   try {
//     const blogId = req.query.id || req.body.id;

//     console.log("Blog ID for deletion:", blogId);

//     if (!blogId) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog ID is required",
//       });
//     }

//     const blog = await Blog.findById(blogId);

//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found",
//       });
//     }

//     // Remove blog from agent's blogs array
//     const agent = await Agent.findById(blog.author.agentId);
//     if (agent) {
//       agent.removeBlog(blog._id);
//       await agent.save();
//       console.log(`✅ Blog removed from agent ${agent.agentName}`);
//     }

//     // ✅ Delete cover image
//     if (blog.image && blog.image.path && blog.image.filename !== "placeholder.jpg") {
//       await deleteFileSafely(blog.image.path);
//     }

//     // ✅ Delete body images
//     if (blog.bodyImages?.image1?.path) {
//       await deleteFileSafely(blog.bodyImages.image1.path);
//       console.log("Deleted body image 1");
//     }

//     if (blog.bodyImages?.image2?.path) {
//       await deleteFileSafely(blog.bodyImages.image2.path);
//       console.log("Deleted body image 2");
//     }

//     // Delete the blog
//     await Blog.findByIdAndDelete(blogId);

//     res.status(200).json({
//       success: true,
//       message: "Blog and all associated images deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting blog:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to delete blog",
//       error: error.message,
//     });
//   }
// };

// const getBlogsByAgent = async (req, res) => {
//   try {
//     const { agentId } = req.params;
//     const { published, page = 1, limit = 10 } = req.query;

//     if (!agentId) {
//       return res.status(400).json({
//         success: false,
//         message: "Agent ID is required",
//       });
//     }

//     let filter = { "author.agentId": agentId };
//     if (published !== undefined) {
//       filter.isPublished = published === "true";
//     }

//     const skip = (page - 1) * limit;

//     const blogs = await Blog.find(filter)
//       .populate("author.agentId", "agentName email imageUrl designation")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit));

//     const totalBlogs = await Blog.countDocuments(filter);

//     res.status(200).json({
//       success: true,
//       message: "Agent blogs fetched successfully",
//       data: {
//         blogs,
//         pagination: {
//           currentPage: parseInt(page),
//           totalPages: Math.ceil(totalBlogs / limit),
//           totalBlogs,
//           hasNext: page * limit < totalBlogs,
//           hasPrev: page > 1,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching agent blogs:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch agent blogs",
//       error: error.message,
//     });
//   }
// };

// const getAgentsWithBlogs = async (req, res) => {
//   try {
//     const { limit = 20 } = req.query;

//     const agentsWithBlogs = await Agent.findAgentsWithBlogs(parseInt(limit));

//     res.status(200).json({
//       success: true,
//       message: "Agents with blogs fetched successfully",
//       data: agentsWithBlogs,
//     });
//   } catch (error) {
//     console.error("Error fetching agents with blogs:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch agents with blogs",
//       error: error.message,
//     });
//   }
// };

// const toggleBlogPublishStatus = async (req, res) => {
//   try {
//     const { blogId } = req.params;
//     const { publish } = req.body;

//     if (!blogId) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog ID is required",
//       });
//     }

//     const blog = await Blog.findById(blogId);
//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found",
//       });
//     }

//     let result;
//     if (publish === true || publish === "true") {
//       result = await blog.publish();
//     } else {
//       result = await blog.unpublish();
//     }

//     const agent = await Agent.findById(blog.author.agentId);
//     if (agent) {
//       const blogForAgent = {
//         blogId: blog._id,
//         title: blog.title,
//         slug: blog.slug,
//         isPublished: blog.isPublished,
//         publishedAt: blog.publishedAt,
//       };
//       agent.addOrUpdateBlog(blogForAgent);
//       await agent.save();
//     }

//     res.status(200).json({
//       success: true,
//       message: `Blog ${publish ? "published" : "unpublished"} successfully`,
//       data: result,
//     });
//   } catch (error) {
//     console.error("Error toggling blog publish status:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to toggle blog publish status",
//       error: error.message,
//     });
//   }
// };

// module.exports = {
//   GetAllBlogs,
//   getSingleBlog,
//   getBlogsByTags,
//   createBlog,
//   updateBlog,
//   deleteBlog,
//   getBlogsByAgent,
//   getAgentsWithBlogs,
//   toggleBlogPublishStatus,
//   upload,
// };


// controllers/BlogsController.js
const Blog = require("../Models/BlogsModel");
const Agent = require("../Models/AgentModel");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// ---------- Cloudinary Multer Storage (multi-field) ----------
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const fileFilter = (_req, file, cb) => {
  const ok = (file.mimetype || "").startsWith("image/");
  if (!ok) return cb(new Error("Only image files are allowed!"), false);
  cb(null, true);
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Put all blog images under this folder
    const folder = "blogs";
    // Create descriptive public_id: blogs/<ts>-<random>-<slugged-original>
    const base =
      (file.originalname || "image")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^\w]+/g, "-")
        .slice(0, 50) || "image";
    const public_id = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}`;
    return {
      folder,
      public_id,
      allowed_formats: ALLOWED_EXT,
      resource_type: "image",
      transformation: [{ quality: "auto:good", fetch_format: "auto" }],
      overwrite: false,
    };
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB each
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "bodyImage1", maxCount: 1 },
  { name: "bodyImage2", maxCount: 1 },
]);

// ---------- Helpers ----------
const createImageData = (file) => {
  if (!file) return null;
  // Multer-Cloudinary fields:
  // file.path => secure URL, file.filename => public_id, file.format, file.size (bytes), file.width, file.height, file.folder
  return {
    url: file.path,
    publicId: file.filename,
    format: file.format,
    bytes: file.size,
    width: file.width,
    height: file.height,
    folder: file.folder,
    originalName: file.originalname,
    mimetype: file.mimetype,
  };
};

const destroyPublicId = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
    // console.log(`🗑️ Cloudinary destroyed: ${publicId}`);
  } catch (e) {
    console.warn("⚠️ Cloudinary destroy failed:", publicId, e.message);
  }
};

// ---------- CREATE ----------
const createBlog = async (req, res) => {
  try {
    const { parsedData, agentId } = req.body;

    if (!parsedData) {
      return res.status(400).json({ success: false, message: "parsedData is required" });
    }
    if (!agentId) {
      return res.status(400).json({ success: false, message: "agentId is required" });
    }

    // Parse parsedData (JSON or plain text → Blog.parseTextToBlogStructure)
    let blogData;
    try {
      if (typeof parsedData === "string") {
        if (parsedData.trim().startsWith("{")) {
          blogData = JSON.parse(parsedData);
        } else {
          blogData = Blog.parseTextToBlogStructure(parsedData);
        }
      } else if (typeof parsedData === "object" && parsedData !== null) {
        blogData = parsedData;
      } else {
        throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Failed to parse blog data",
        error: e.message,
      });
    }

    // Validate content/title
    if (!blogData?.content?.title) {
      return res.status(400).json({
        success: false,
        message: "Blog content and title are required",
      });
    }
    if (!Array.isArray(blogData.content.sections)) {
      return res.status(400).json({
        success: false,
        message: "Blog content sections are required and must be an array",
      });
    }

    // Validate agent
    const agent = await Agent.findOne({ agentId });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (!agent.isActive) {
      return res.status(400).json({ success: false, message: "Agent is not active" });
    }

    // Handle images (Cloudinary URLs now)
    const coverImageData =
      req.files?.coverImage?.[0] ? createImageData(req.files.coverImage[0]) : null;
    const bodyImage1Data =
      req.files?.bodyImage1?.[0] ? createImageData(req.files.bodyImage1[0]) : null;
    const bodyImage2Data =
      req.files?.bodyImage2?.[0] ? createImageData(req.files.bodyImage2[0]) : null;

    // Create blog doc
    const newBlog = new Blog({
      originalId:
        blogData.id ||
        `blog_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: {
        title: blogData.metadata?.title || blogData.content.title,
        description: blogData.metadata?.description || blogData.seo?.metaDescription || "",
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
      image: coverImageData, // cover
      bodyImages: {
        image1: bodyImage1Data,
        image2: bodyImage2Data,
      },
      status: blogData.status || "draft",
      isPublished: blogData.status === "published" || false,
    });

    const savedBlog = await newBlog.save();

    // Link to agent.blogs (if helper exists)
    try {
      if (typeof agent.addOrUpdateBlog === "function") {
        agent.addOrUpdateBlog({
          blogId: savedBlog._id,
          title: savedBlog.content.title,
          slug: savedBlog.metadata.slug,
          image: savedBlog.image,
          isPublished: savedBlog.isPublished,
          publishedAt: savedBlog.publishedAt,
          createdAt: savedBlog.createdAt,
          updatedAt: savedBlog.updatedAt,
        });
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent blogs link warning:", e.message);
    }

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: {
        blog: savedBlog,
        stats: savedBlog.getContentStats?.(),
        linkedAgent: {
          agentId: agent.agentId,
          agentName: agent.agentName,
          email: agent.email,
          imageUrl: agent.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error("BLOG CREATE ERROR:", error);
    // Nothing to clean on local FS now; uploads are on Cloudinary and already saved to blog doc only after success
    res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message,
    });
  }
};

// ---------- UPDATE ----------
const updateBlog = async (req, res) => {
  try {
    const { blogId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } = req.body;
    if (!blogId) {
      return res.status(400).json({ success: false, message: "blogId is required" });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    // Agent reassignment
    const oldAgentId = blog.author.agentId;
    let agentChanged = false;
    if (agentId && agentId !== oldAgentId) {
      const newAgent = await Agent.findOne({ agentId });
      if (!newAgent) {
        return res.status(404).json({ success: false, message: "New agent not found" });
      }
      if (!newAgent.isActive) {
        return res.status(400).json({ success: false, message: "New agent is not active" });
      }
      blog.author.agentId = newAgent.agentId;
      blog.author.agentName = newAgent.agentName;
      blog.author.agentEmail = newAgent.email;
      blog.author.agentImage = newAgent.imageUrl;
      agentChanged = true;
    }

    // Parse update content if provided
    if (parsedData) {
      let updateData;
      try {
        if (typeof parsedData === "string") {
          updateData = parsedData.trim().startsWith("{")
            ? JSON.parse(parsedData)
            : Blog.parseTextToBlogStructure(parsedData);
        } else if (typeof parsedData === "object") {
          updateData = parsedData;
        } else {
          throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Failed to parse blog data",
          error: e.message,
        });
      }

      // metadata
      if (updateData.metadata) {
        const m = updateData.metadata;
        if (m.title !== undefined) blog.metadata.title = m.title;
        if (m.description !== undefined) blog.metadata.description = m.description;
        if (m.author !== undefined) blog.metadata.author = m.author;
        if (m.tags !== undefined) blog.metadata.tags = Array.isArray(m.tags) ? m.tags : [];
        if (m.category !== undefined) blog.metadata.category = m.category;
        if (m.slug !== undefined) blog.metadata.slug = m.slug;
      }
      // content
      if (updateData.content) {
        const c = updateData.content;
        if (c.title !== undefined) blog.content.title = c.title;
        if (Array.isArray(c.sections)) blog.content.sections = c.sections;
        if (c.wordCount !== undefined) blog.content.wordCount = c.wordCount;
        if (c.readingTime !== undefined) blog.content.readingTime = c.readingTime;
      }
      // seo
      if (updateData.seo) {
        const s = updateData.seo;
        if (s.metaTitle !== undefined) blog.seo.metaTitle = s.metaTitle;
        if (s.metaDescription !== undefined) blog.seo.metaDescription = s.metaDescription;
        if (s.keywords !== undefined) blog.seo.keywords = Array.isArray(s.keywords) ? s.keywords : [];
      }
      // status
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

    // Images (replace + destroy old on Cloudinary)
    if (req.files?.coverImage?.[0]) {
      if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
      blog.image = createImageData(req.files.coverImage[0]);
    }

    if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
      if (blog.bodyImages?.image1?.publicId) await destroyPublicId(blog.bodyImages.image1.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image1 = null;
    } else if (req.files?.bodyImage1?.[0]) {
      if (blog.bodyImages?.image1?.publicId) await destroyPublicId(blog.bodyImages.image1.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
    }

    if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
      if (blog.bodyImages?.image2?.publicId) await destroyPublicId(blog.bodyImages.image2.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image2 = null;
    } else if (req.files?.bodyImage2?.[0]) {
      if (blog.bodyImages?.image2?.publicId) await destroyPublicId(blog.bodyImages.image2.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
    }

    await blog.save();

    // Update agent link arrays
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

    if (agentChanged) {
      try {
        const oldAgent = await Agent.findOne({ agentId: oldAgentId });
        if (oldAgent) {
          oldAgent.blogs = (oldAgent.blogs || []).filter(
            (b) => String(b.blogId) !== String(blog._id)
          );
          await oldAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("Old agent unlink warning:", e.message);
      }
      try {
        const newAgent = await Agent.findOne({ agentId: blog.author.agentId });
        if (newAgent?.addOrUpdateBlog) {
          newAgent.addOrUpdateBlog(blogForAgent);
          await newAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("New agent link warning:", e.message);
      }
    } else {
      try {
        const currentAgent = await Agent.findOne({ agentId: blog.author.agentId });
        if (currentAgent?.addOrUpdateBlog) {
          currentAgent.addOrUpdateBlog(blogForAgent);
          await currentAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("Agent blog update warning:", e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: agentChanged ? "Blog updated & reassigned" : "Blog updated",
      data: {
        blog,
        stats: blog.getContentStats?.(),
        linkedAgent: {
          agentId: blog.author.agentId,
          agentName: blog.author.agentName,
          email: blog.author.agentEmail,
        },
        agentChanged,
      },
    });
  } catch (error) {
    console.error("BLOG UPDATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// ---------- READS ----------
const GetAllBlogs = async (_req, res) => {
  try {
    const blogs = await Blog.find({})
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "All blogs fetched successfully",
      totalBlogs: blogs.length,
      data: blogs,
    });
  } catch (error) {
    console.error("GetAllBlogs error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch blogs", error: error.message });
  }
};

const getSingleBlog = async (req, res) => {
  try {
    const blogId = req.query.id;
    if (!blogId) {
      return res.status(400).json({ success: false, message: "Blog ID is required" });
    }

    const blog = await Blog.findById(blogId).populate(
      "author.agentId",
      "agentName email imageUrl designation specialistAreas phone whatsapp description"
    );

    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });

    res.status(200).json({ success: true, message: "Blog fetched successfully", data: blog });
  } catch (error) {
    console.error("getSingleBlog error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch blog", error: error.message });
  }
};

const getBlogsByTags = async (req, res) => {
  try {
    const { tags, limit = 6, excludeId } = req.query;
    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags are required. Pass tags as comma-separated values.",
      });
    }

    const tagsArray = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const query = { "metadata.tags": { $in: tagsArray } };
    if (excludeId) query._id = { $ne: excludeId };

    const blogs = await Blog.find(query)
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const blogsWithScore = blogs
      .map((b) => {
        const matchingTags = (b.metadata.tags || []).filter((t) =>
          tagsArray.includes(String(t).toLowerCase())
        );
        return { ...b.toObject(), matchScore: matchingTags.length, matchingTags };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      message: "Blogs with matching tags fetched successfully",
      count: blogsWithScore.length,
      searchedTags: tagsArray,
      data: blogsWithScore,
    });
  } catch (error) {
    console.error("getBlogsByTags error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch blogs by tags", error: error.message });
  }
};

// ---------- DELETE ----------
const deleteBlog = async (req, res) => {
  try {
    const blogId = req.query.id || req.body.id;
    if (!blogId) {
      return res.status(400).json({ success: false, message: "Blog ID is required" });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });

    // Remove from agent.blogs
    try {
      const agent = await Agent.findOne({ agentId: blog.author.agentId });
      if (agent?.removeBlog) {
        agent.removeBlog(blog._id);
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent unlink warning:", e.message);
    }

    // Destroy Cloudinary images
    if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
    if (blog.bodyImages?.image1?.publicId) await destroyPublicId(blog.bodyImages.image1.publicId);
    if (blog.bodyImages?.image2?.publicId) await destroyPublicId(blog.bodyImages.image2.publicId);

    await Blog.findByIdAndDelete(blogId);

    res.status(200).json({
      success: true,
      message: "Blog and associated images deleted successfully",
    });
  } catch (error) {
    console.error("deleteBlog error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete blog", error: error.message });
  }
};

// ---------- LIST BY AGENT ----------
const getBlogsByAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { published, page = 1, limit = 10 } = req.query;

    if (!agentId) return res.status(400).json({ success: false, message: "Agent ID is required" });

    const filter = { "author.agentId": agentId };
    if (published !== undefined) filter.isPublished = published === "true";

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find(filter)
        .populate("author.agentId", "agentName email imageUrl designation")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Blog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Agent blogs fetched successfully",
      data: {
        blogs,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalBlogs / parseInt(limit, 10)),
          totalBlogs,
          hasNext: parseInt(page, 10) * parseInt(limit, 10) < totalBlogs,
          hasPrev: parseInt(page, 10) > 1,
        },
      },
    });
  } catch (error) {
    console.error("getBlogsByAgent error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch agent blogs", error: error.message });
  }
};

// ---------- AGENTS WITH BLOGS ----------
const getAgentsWithBlogs = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const agentsWithBlogs = await Agent.findAgentsWithBlogs(parseInt(limit, 10));
    res.status(200).json({
      success: true,
      message: "Agents with blogs fetched successfully",
      data: agentsWithBlogs,
    });
  } catch (error) {
    console.error("getAgentsWithBlogs error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch agents with blogs", error: error.message });
  }
};

// ---------- PUBLISH TOGGLE ----------
const toggleBlogPublishStatus = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { publish } = req.body;
    if (!blogId) return res.status(400).json({ success: false, message: "Blog ID is required" });

    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });

    const result = (publish === true || publish === "true") ? await blog.publish() : await blog.unpublish();

    try {
      const agent = await Agent.findOne({ agentId: blog.author.agentId });
      if (agent?.addOrUpdateBlog) {
        agent.addOrUpdateBlog({
          blogId: blog._id,
          title: blog.content?.title || blog.metadata?.title || "",
          slug: blog.metadata?.slug || "",
          isPublished: blog.isPublished,
          publishedAt: blog.publishedAt,
        });
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent publish toggle link warning:", e.message);
    }

    res.status(200).json({
      success: true,
      message: `Blog ${publish ? "published" : "unpublished"} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("toggleBlogPublishStatus error:", error.message);
    res.status(500).json({ success: false, message: "Failed to toggle blog publish status", error: error.message });
  }
};

module.exports = {
  // upload middleware first (multi-field)
  upload,
  // CRUD
  GetAllBlogs,
  getSingleBlog,
  getBlogsByTags,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogsByAgent,
  getAgentsWithBlogs,
  toggleBlogPublishStatus,
};
