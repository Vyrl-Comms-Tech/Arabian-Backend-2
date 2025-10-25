const CommunityGuide = require("../Models/CommunityGuideModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

// Configure multer storage for community guide files (images AND videos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const communityGuidesDir = path.join(__dirname, "..", "uploads", "CommunityGuides");
    
    if (!fsSync.existsSync(communityGuidesDir)) {
      fsSync.mkdirSync(communityGuidesDir, { recursive: true });
    }
    
    cb(null, communityGuidesDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = unique + "-" + file.originalname;
    cb(null, filename);
  }
});

// Updated file filter to accept BOTH images AND videos
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 100 * 1024 * 1024  // Increased to 100MB for videos
  },
});

// Multiple file upload configuration - cover image + 2 optional media blocks (images OR videos)
const uploadMultiple = upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'mediaBlock1Image', maxCount: 1 },
  { name: 'mediaBlock1Video', maxCount: 1 },  // Added video field
  { name: 'mediaBlock2Image', maxCount: 1 },
  { name: 'mediaBlock2Video', maxCount: 1 }   // Added video field
]);

// Helper function to extract tags from content
const extractTagsFromContent = (heroTitle, heroText) => {
  const tags = [];
  
  const communityMatch = heroTitle.match(/^(.+?)\s+Community\s+Guide/i);
  if (communityMatch) {
    tags.push(communityMatch[1].toLowerCase().trim());
  }
  
  tags.push('dubai', 'community', 'real estate');
  
  const locationKeywords = ['marina', 'downtown', 'palm', 'jumeirah', 'business bay', 'jvc', 'jbr'];
  const combinedText = (heroTitle + ' ' + heroText).toLowerCase();
  
  locationKeywords.forEach(keyword => {
    if (combinedText.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword);
    }
  });
  
  return tags.slice(0, 10);
};

// Validate media blocks
const validateMediaBlocks = (mediaBlock1Type, mediaBlock2Type, files) => {
  const errors = [];

  // Check for two videos
  if (mediaBlock1Type === 'video' && mediaBlock2Type === 'video') {
    errors.push('Cannot have two video blocks. Only one video is allowed.');
  }

  // Validate video files
  if (mediaBlock1Type === 'video' && (!files || !files.mediaBlock1Video)) {
    errors.push('Video file is required for media block 1');
  }
  if (mediaBlock2Type === 'video' && (!files || !files.mediaBlock2Video)) {
    errors.push('Video file is required for media block 2');
  }

  // Validate images
  if (mediaBlock1Type === 'image' && (!files || !files.mediaBlock1Image)) {
    errors.push('Image is required for media block 1');
  }
  if (mediaBlock2Type === 'image' && (!files || !files.mediaBlock2Image)) {
    errors.push('Image is required for media block 2');
  }

  return errors;
};

// Create Community Guide
const createCommunityGuide = async (req, res) => {
  try {
    console.log("=== COMMUNITY GUIDE CREATION START ===");

    const { 
      parsedData, 
      guideType, 
      googleMapUrl,
      mediaBlock1Type,
      mediaBlock2Type
    } = req.body;

    if (!parsedData) {
      return res.status(400).json({
        success: false,
        message: "parsedData is required"
      });
    }

    if (!googleMapUrl) {
      return res.status(400).json({
        success: false,
        message: "Google Maps URL is required"
      });
    }

    if (!req.files || !req.files.coverImage) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required"
      });
    }

    // Validate media blocks
    const mediaBlockErrors = validateMediaBlocks(
      mediaBlock1Type, 
      mediaBlock2Type, 
      req.files
    );

    if (mediaBlockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Media block validation failed",
        errors: mediaBlockErrors
      });
    }

    let contentData;
    try {
      contentData = typeof parsedData === "string" 
        ? JSON.parse(parsedData) 
        : parsedData;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: "Failed to parse community guide data",
        error: parseError.message
      });
    }

    console.log("=== PARSED CONTENT DATA ===");
    console.log("Hero title:", contentData?.heroTitle);
    console.log("Sections count:", contentData?.sections?.length);

    if (!contentData.heroTitle || !contentData.heroText) {
      return res.status(400).json({
        success: false,
        message: "Hero title and hero text are required"
      });
    }

    // Cover Image (Required)
    const coverImageData = {
      filename: req.files.coverImage[0].filename,
      originalName: req.files.coverImage[0].originalname,
      mimetype: req.files.coverImage[0].mimetype,
      size: req.files.coverImage[0].size,
      path: req.files.coverImage[0].path,
    };

    // Media Block 1
    const mediaBlock1Data = {
      type: mediaBlock1Type || 'none'
    };

    if (mediaBlock1Type === 'image' && req.files.mediaBlock1Image) {
      mediaBlock1Data.image = {
        filename: req.files.mediaBlock1Image[0].filename,
        originalName: req.files.mediaBlock1Image[0].originalname,
        mimetype: req.files.mediaBlock1Image[0].mimetype,
        size: req.files.mediaBlock1Image[0].size,
        path: req.files.mediaBlock1Image[0].path,
      };
    } else if (mediaBlock1Type === 'video' && req.files.mediaBlock1Video) {
      mediaBlock1Data.video = {
        filename: req.files.mediaBlock1Video[0].filename,
        originalName: req.files.mediaBlock1Video[0].originalname,
        mimetype: req.files.mediaBlock1Video[0].mimetype,
        size: req.files.mediaBlock1Video[0].size,
        path: req.files.mediaBlock1Video[0].path,
      };
    }

    // Media Block 2
    const mediaBlock2Data = {
      type: mediaBlock2Type || 'none'
    };

    if (mediaBlock2Type === 'image' && req.files.mediaBlock2Image) {
      mediaBlock2Data.image = {
        filename: req.files.mediaBlock2Image[0].filename,
        originalName: req.files.mediaBlock2Image[0].originalname,
        mimetype: req.files.mediaBlock2Image[0].mimetype,
        size: req.files.mediaBlock2Image[0].size,
        path: req.files.mediaBlock2Image[0].path,
      };
    } else if (mediaBlock2Type === 'video' && req.files.mediaBlock2Video) {
      mediaBlock2Data.video = {
        filename: req.files.mediaBlock2Video[0].filename,
        originalName: req.files.mediaBlock2Video[0].originalname,
        mimetype: req.files.mediaBlock2Video[0].mimetype,
        size: req.files.mediaBlock2Video[0].size,
        path: req.files.mediaBlock2Video[0].path,
      };
    }

    const tags = contentData.tags || 
                 extractTagsFromContent(contentData.heroTitle, contentData.heroText);

    const newGuide = new CommunityGuide({
      guideType: guideType || 'community',
      coverImage: coverImageData,
      googleMapUrl: googleMapUrl,
      mediaBlock1: mediaBlock1Data,
      mediaBlock2: mediaBlock2Data,
      content: contentData,
      tags: tags,
      publishedAt: new Date(),
    });

    // const validationErrors = newGuide.validateContent();
    // if (validationErrors.length > 0) {
    //   if (req.files) {
    //     for (const fieldName in req.files) {
    //       for (const file of req.files[fieldName]) {
    //         await fs.unlink(file.path).catch(() => {});
    //       }
    //     }
    //   }
    //   return res.status(400).json({
    //     success: false,
    //     message: "Content validation failed",
    //     errors: validationErrors
    //   });
    // }

    console.log("Saving community guide to database...");
    const savedGuide = await newGuide.save();
    console.log("Community guide saved with ID:", savedGuide._id);
    console.log("=== COMMUNITY GUIDE CREATION SUCCESS ===");

    res.status(201).json({
      success: true,
      message: "Community guide created successfully",
      data: {
        guide: savedGuide,
        stats: {
          totalSectionsCount: savedGuide.totalSectionsCount,
          sectionBreakdown: savedGuide.sectionBreakdown,
          mediaBlocks: savedGuide.getMediaBlocksSummary(),
          slug: savedGuide.slug,
          guideType: savedGuide.guideType,
          isPublished: !!savedGuide.publishedAt
        }
      },
    });

  } catch (error) {
    console.error("=== COMMUNITY GUIDE CREATION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    if (req.files) {
      for (const fieldName in req.files) {
        for (const file of req.files[fieldName]) {
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.log("Could not delete uploaded file:", unlinkError.message);
          }
        }
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to create community guide",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get all community guides
const getAllCommunityGuides = async (req, res) => {
  try {
    const guides = await CommunityGuide.find({}).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "All community guides fetched successfully",
      totalGuides: guides.length,
      data: guides,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch community guides",
      error: error.message,
    });
  }
};

// Get single community guide by ID
const getSingleCommunityGuide = async (req, res) => {
  try {
    const guideId = req.query.id;
    console.log("guideId", guideId);
    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Community guide ID is required",
      });
    }

    const guide = await CommunityGuide.findById(guideId);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Community guide not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Community guide fetched successfully",
      data: guide,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch community guide",
      error: error.message,
    });
  }
};

// Get published community guides
const getPublishedCommunityGuides = async (req, res) => {
  try {
    const guides = await CommunityGuide.findPublished();
    res.status(200).json({
      success: true,
      message: "Published community guides fetched successfully",
      totalGuides: guides.length,
      data: guides,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch published community guides",
      error: error.message,
    });
  }
};

// Update community guide
const updateCommunityGuide = async (req, res) => {
  try {
    const { 
      guideId, 
      parsedData, 
      tags, 
      guideType,
      googleMapUrl,
      mediaBlock1Type,
      mediaBlock2Type
    } = req.body;

    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Community guide ID is required",
      });
    }

    const guide = await CommunityGuide.findById(guideId);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Community guide not found",
      });
    }

    if (guideType) {
      guide.guideType = guideType;
    }

    if (googleMapUrl) {
      guide.googleMapUrl = googleMapUrl;
    }

    if (parsedData) {
      let contentData;
      try {
        contentData = typeof parsedData === "string" 
          ? JSON.parse(parsedData) 
          : parsedData;
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: "Failed to parse content data",
          error: parseError.message
        });
      }

      guide.content = contentData;
    }

    // Update Cover Image
    if (req.files && req.files.coverImage) {
      if (guide.coverImage?.path) {
        await fs.unlink(guide.coverImage.path).catch(() => {});
      }

      guide.coverImage = {
        filename: req.files.coverImage[0].filename,
        originalName: req.files.coverImage[0].originalname,
        mimetype: req.files.coverImage[0].mimetype,
        size: req.files.coverImage[0].size,
        path: req.files.coverImage[0].path,
      };
    }

    // Update Media Block 1
    if (mediaBlock1Type) {
      guide.mediaBlock1.type = mediaBlock1Type;

      if (mediaBlock1Type === 'image' && req.files && req.files.mediaBlock1Image) {
        if (guide.mediaBlock1.image?.path) {
          await fs.unlink(guide.mediaBlock1.image.path).catch(() => {});
        }

        guide.mediaBlock1.image = {
          filename: req.files.mediaBlock1Image[0].filename,
          originalName: req.files.mediaBlock1Image[0].originalname,
          mimetype: req.files.mediaBlock1Image[0].mimetype,
          size: req.files.mediaBlock1Image[0].size,
          path: req.files.mediaBlock1Image[0].path,
        };
        guide.mediaBlock1.video = undefined;
      } else if (mediaBlock1Type === 'video' && req.files && req.files.mediaBlock1Video) {
        if (guide.mediaBlock1.video?.path) {
          await fs.unlink(guide.mediaBlock1.video.path).catch(() => {});
        }

        guide.mediaBlock1.video = {
          filename: req.files.mediaBlock1Video[0].filename,
          originalName: req.files.mediaBlock1Video[0].originalname,
          mimetype: req.files.mediaBlock1Video[0].mimetype,
          size: req.files.mediaBlock1Video[0].size,
          path: req.files.mediaBlock1Video[0].path,
        };
        guide.mediaBlock1.image = undefined;
      } else if (mediaBlock1Type === 'none') {
        if (guide.mediaBlock1.image?.path) {
          await fs.unlink(guide.mediaBlock1.image.path).catch(() => {});
        }
        if (guide.mediaBlock1.video?.path) {
          await fs.unlink(guide.mediaBlock1.video.path).catch(() => {});
        }
        guide.mediaBlock1.image = undefined;
        guide.mediaBlock1.video = undefined;
      }
    }

    // Update Media Block 2
    if (mediaBlock2Type) {
      guide.mediaBlock2.type = mediaBlock2Type;

      if (mediaBlock2Type === 'image' && req.files && req.files.mediaBlock2Image) {
        if (guide.mediaBlock2.image?.path) {
          await fs.unlink(guide.mediaBlock2.image.path).catch(() => {});
        }

        guide.mediaBlock2.image = {
          filename: req.files.mediaBlock2Image[0].filename,
          originalName: req.files.mediaBlock2Image[0].originalname,
          mimetype: req.files.mediaBlock2Image[0].mimetype,
          size: req.files.mediaBlock2Image[0].size,
          path: req.files.mediaBlock2Image[0].path,
        };
        guide.mediaBlock2.video = undefined;
      } else if (mediaBlock2Type === 'video' && req.files && req.files.mediaBlock2Video) {
        if (guide.mediaBlock2.video?.path) {
          await fs.unlink(guide.mediaBlock2.video.path).catch(() => {});
        }

        guide.mediaBlock2.video = {
          filename: req.files.mediaBlock2Video[0].filename,
          originalName: req.files.mediaBlock2Video[0].originalname,
          mimetype: req.files.mediaBlock2Video[0].mimetype,
          size: req.files.mediaBlock2Video[0].size,
          path: req.files.mediaBlock2Video[0].path,
        };
        guide.mediaBlock2.image = undefined;
      } else if (mediaBlock2Type === 'none') {
        if (guide.mediaBlock2.image?.path) {
          await fs.unlink(guide.mediaBlock2.image.path).catch(() => {});
        }
        if (guide.mediaBlock2.video?.path) {
          await fs.unlink(guide.mediaBlock2.video.path).catch(() => {});
        }
        guide.mediaBlock2.image = undefined;
        guide.mediaBlock2.video = undefined;
      }
    }

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        guide.tags = tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
      } else if (typeof tags === "string") {
        guide.tags = tags.split(",").map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
      }
    }

    const validationErrors = guide.validateContent();
    if (validationErrors.length > 0) {
      if (req.files) {
        for (const fieldName in req.files) {
          for (const file of req.files[fieldName]) {
            await fs.unlink(file.path).catch(() => {});
          }
        }
      }
      return res.status(400).json({
        success: false,
        message: "Content validation failed",
        errors: validationErrors
      });
    }

    await guide.save();

    res.status(200).json({
      success: true,
      message: "Community guide updated successfully",
      data: guide,
    });
  } catch (error) {
    if (req.files) {
      for (const fieldName in req.files) {
        for (const file of req.files[fieldName]) {
          await fs.unlink(file.path).catch(() => {});
        }
      }
    }
    res.status(500).json({
      success: false,
      message: "Failed to update community guide",
      error: error.message,
    });
  }
};

// Delete community guide
const deleteCommunityGuide = async (req, res) => {
  try {
    const guideId = req.query.id || req.body.id;
    if (!guideId) {
      return res.status(400).json({
        success: false,
        message: "Community guide ID is required",
      });
    }

    const guide = await CommunityGuide.findById(guideId);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Community guide not found",
      });
    }

    // Delete cover image
    if (guide.coverImage?.path) {
      await fs.unlink(guide.coverImage.path).catch(() => {});
    }

    // Delete media block files
    if (guide.mediaBlock1?.image?.path) {
      await fs.unlink(guide.mediaBlock1.image.path).catch(() => {});
    }
    if (guide.mediaBlock1?.video?.path) {
      await fs.unlink(guide.mediaBlock1.video.path).catch(() => {});
    }
    if (guide.mediaBlock2?.image?.path) {
      await fs.unlink(guide.mediaBlock2.image.path).catch(() => {});
    }
    if (guide.mediaBlock2?.video?.path) {
      await fs.unlink(guide.mediaBlock2.video.path).catch(() => {});
    }

    await CommunityGuide.findByIdAndDelete(guideId);

    res.status(200).json({
      success: true,
      message: "Community guide deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete community guide",
      error: error.message,
    });
  }
};

module.exports = {
  createCommunityGuide,
  getAllCommunityGuides,
  getSingleCommunityGuide,
  getPublishedCommunityGuides,
  updateCommunityGuide,
  deleteCommunityGuide,
  uploadMultiple,
};