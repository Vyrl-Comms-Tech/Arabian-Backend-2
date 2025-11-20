// const HeroContent = require('../Models/HeroContent');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Ensure upload directory exists
// const uploadDir = path.join(__dirname, '../uploads/hero/');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
//   console.log('✅ Created uploads/hero directory:', uploadDir);
// }

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, '../uploads/hero/');
    
//     // Double-check directory exists
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//       console.log('✅ Created directory during upload:', uploadPath);
//     }
    
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const filename = 'hero-' + uniqueSuffix + path.extname(file.originalname);
//     console.log('📁 Saving file as:', filename);
//     cb(null, filename);
//   }
// });

// const fileFilter = (req, file, cb) => {
//   const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
//   const allowedVideoTypes = /mp4|webm|ogg/;
//   const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
  
//   if (allowedImageTypes.test(extname) || allowedVideoTypes.test(extname)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only images (JPEG, JPG, PNG, GIF, WebP) and videos (MP4, WebM, OGG) are allowed.'));
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Helper function to delete old media file
// const deleteOldMedia = (mediaUrl) => {
//   try {
//     if (mediaUrl) {
//       const cleanUrl = mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl;
//       const filePath = path.join(__dirname, '..', cleanUrl);
      
//       if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//         console.log('🗑️  Deleted old media:', filePath);
//       } else {
//         console.log('⚠️  Old media file not found:', filePath);
//       }
//     }
//   } catch (error) {
//     console.error('❌ Error deleting old media:', error);
//   }
// };

// // Get current hero content
// const getHero = async (req, res) => {
//   try {
//     console.log('📥 GET /get-hero - Fetching hero content...');
//     const hero = await HeroContent.findOne();
    
//     if (!hero) {
//       console.log('⚠️  No hero content found');
//       return res.status(404).json({ 
//         success: false, 
//         message: 'No hero content found' 
//       });
//     }
    
//     console.log('✅ Hero content found:', hero.mediaType);
//     res.status(200).json({ success: true, data: hero });
//   } catch (error) {
//     console.error('❌ Error fetching hero:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Add or Replace hero content
// const addOrReplaceHero = async (req, res) => {
//   try {
//     console.log('📤 POST /add-replace - Starting upload...');
//     console.log('📎 File received:', req.file ? req.file.filename : 'No file');
//     console.log('📝 Body:', req.body);
    
//     if (!req.file) {
//       console.log('❌ No file uploaded');
//       return res.status(400).json({ 
//         success: false, 
//         message: 'No file uploaded' 
//       });
//     }

//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
//     const mediaUrl = `/uploads/hero/${req.file.filename}`;
    
//     console.log('📊 Media type:', mediaType);
//     console.log('🔗 Media URL:', mediaUrl);
//     console.log('💾 File saved to:', req.file.path);

//     // Check if hero already exists
//     const existingHero = await HeroContent.findOne();

//     if (existingHero) {
//       console.log('🔄 Replacing existing hero...');
//       console.log('🗑️  Old hero type:', existingHero.mediaType);
      
//       // Delete old media file
//       deleteOldMedia(existingHero.mediaUrl);

//       // Update existing hero
//       existingHero.mediaUrl = mediaUrl;
//       existingHero.mediaType = mediaType;
//       existingHero.altText = req.body.altText || 'Hero media';
//       await existingHero.save();

//       console.log('✅ Hero replaced successfully');
//       return res.status(200).json({ 
//         success: true, 
//         message: `Hero content replaced to ${mediaType}`,
//         data: existingHero 
//       });
//     } else {
//       console.log('➕ Creating new hero...');
      
//       // Create new hero
//       const newHero = await HeroContent.create({
//         mediaUrl,
//         mediaType,
//         altText: req.body.altText || 'Hero media'
//       });

//       console.log('✅ Hero created successfully');
//       return res.status(201).json({ 
//         success: true, 
//         message: 'Hero content added successfully',
//         data: newHero 
//       });
//     }
//   } catch (error) {
//     console.error('❌ Error in addOrReplaceHero:', error);
//     console.error('Stack:', error.stack);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Update hero content (only altText or replace media)
// const updateHero = async (req, res) => {
//   try {
//     console.log('🔄 PUT /update - Updating hero...');
//     console.log('📎 File received:', req.file ? req.file.filename : 'No file');
//     console.log('📝 Body:', req.body);
    
//     const hero = await HeroContent.findOne();

//     if (!hero) {
//       console.log('❌ No hero content found to update');
//       return res.status(404).json({ 
//         success: false, 
//         message: 'No hero content found to update' 
//       });
//     }

//     if (req.file) {
//       console.log('🔄 Replacing media file...');
      
//       // Delete old media file
//       deleteOldMedia(hero.mediaUrl);

//       const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
//       hero.mediaUrl = `/uploads/hero/${req.file.filename}`;
//       hero.mediaType = mediaType;
//       console.log('💾 New file saved to:', req.file.path);
//     }

//     // Update altText if provided
//     if (req.body.altText) {
//       console.log('📝 Updating alt text...');
//       hero.altText = req.body.altText;
//     }

//     await hero.save();

//     console.log('✅ Hero updated successfully');
//     res.status(200).json({ 
//       success: true, 
//       message: 'Hero content updated successfully',
//       data: hero 
//     });
//   } catch (error) {
//     console.error('❌ Error in updateHero:', error);
//     console.error('Stack:', error.stack);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// module.exports = {
//   getHero,
//   addOrReplaceHero,
//   updateHero,
//   upload
// };


// controllers/HeroController.js
// controllers/HeroController.js
const HeroContent = require("../Models/HeroContent");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// ---------- Cloudinary Multer Storage for hero (image + video) ----------

const HERO_ALLOWED_EXT = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "ogg",
  "mov",
];

const heroFileFilter = (_req, file, cb) => {
  const mimetype = file.mimetype || "";
  if (mimetype.startsWith("image/") || mimetype.startsWith("video/")) {
    return cb(null, true);
  }
  cb(
    new Error(
      "Invalid file type. Only images (JPEG, JPG, PNG, GIF, WebP) and videos (MP4, WebM, OGG, MOV) are allowed."
    ),
    false
  );
};

const heroStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = "hero";
    const isVideo = (file.mimetype || "").startsWith("video/");

    const base =
      (file.originalname || "hero-media")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^\w]+/g, "-")
        .slice(0, 50) || "hero-media";

    const public_id = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}`;

    const common = {
      folder,
      public_id,
      allowed_formats: HERO_ALLOWED_EXT,
      overwrite: false,
      resource_type: isVideo ? "video" : "image",
    };

    // Apply transformations only for images
    if (!isVideo) {
      return {
        ...common,
        transformation: [{ quality: "auto:good", fetch_format: "auto" }],
      };
    }

    return common;
  },
});

// 👉 This is what your router will use: HeroController.upload.single("media")
const upload = multer({
  storage: heroStorage,
  fileFilter: heroFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ---------- Helpers ----------

const createHeroMediaData = (file) => {
  if (!file) return null;
  const isVideo = (file.mimetype || "").startsWith("video/");

  return {
    url: file.path, // Cloudinary secure_url
    mediaType: isVideo ? "video" : "image",
    publicId: file.filename, // Cloudinary public_id
    resourceType: file.resource_type || (isVideo ? "video" : "image"),
  };
};

const destroyHeroMedia = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    console.log(`🗑️ Cloudinary hero destroyed: ${publicId}`);
  } catch (e) {
    console.warn("⚠️ Cloudinary hero destroy failed:", publicId, e.message);
  }
};

// ---------- CONTROLLERS ----------

// Get current hero content
const getHero = async (_req, res) => {
  try {
    console.log("📥 GET /get-hero - Fetching hero content...");
    const hero = await HeroContent.findOne();

    if (!hero) {
      console.log("⚠️ No hero content found");
      return res.status(404).json({
        success: false,
        message: "No hero content found",
      });
    }

    res.status(200).json({
      success: true,
      data: hero,
    });
  } catch (error) {
    console.error("❌ Error fetching hero:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add or Replace hero content (image or video)
const addOrReplaceHero = async (req, res) => {
  try {
    console.log("📤 POST /add-replace - Starting upload...");
    console.log("📎 File received:", req.file ? req.file.originalname : "No file");
    console.log("📝 Body:", req.body);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const mediaData = createHeroMediaData(req.file);
    const altText = req.body.altText || "Hero media";

    // Check if hero already exists
    const existingHero = await HeroContent.findOne();

    if (existingHero) {
      console.log("🔄 Replacing existing hero...");

      // Delete old media from Cloudinary
      await destroyHeroMedia(
        existingHero.publicId,
        existingHero.mediaType === "video" ? "video" : "image"
      );

      existingHero.mediaUrl = mediaData.url;
      existingHero.mediaType = mediaData.mediaType;
      existingHero.publicId = mediaData.publicId;
      existingHero.resourceType = mediaData.resourceType;
      existingHero.altText = altText;

      await existingHero.save();

      return res.status(200).json({
        success: true,
        message: `Hero content replaced with new ${mediaData.mediaType}`,
        data: existingHero,
      });
    }

    console.log("➕ Creating new hero...");
    const newHero = await HeroContent.create({
      mediaUrl: mediaData.url,
      mediaType: mediaData.mediaType,
      publicId: mediaData.publicId,
      resourceType: mediaData.resourceType,
      altText,
    });

    return res.status(201).json({
      success: true,
      message: "Hero content added successfully",
      data: newHero,
    });
  } catch (error) {
    console.error("❌ Error in addOrReplaceHero:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update hero (change media and/or altText)
const updateHero = async (req, res) => {
  try {
    console.log("🔄 PUT /update - Updating hero...");
    console.log("📎 File received:", req.file ? req.file.originalname : "No file");
    console.log("📝 Body:", req.body);

    const hero = await HeroContent.findOne();
    if (!hero) {
      return res.status(404).json({
        success: false,
        message: "No hero content found to update",
      });
    }

    // If a new file is uploaded, replace Cloudinary asset
    if (req.file) {
      console.log("🔄 Replacing hero media on Cloudinary...");

      await destroyHeroMedia(
        hero.publicId,
        hero.mediaType === "video" ? "video" : "image"
      );

      const mediaData = createHeroMediaData(req.file);

      hero.mediaUrl = mediaData.url;
      hero.mediaType = mediaData.mediaType;
      hero.publicId = mediaData.publicId;
      hero.resourceType = mediaData.resourceType;
    }

    // Update alt text if provided
    if (req.body.altText) {
      hero.altText = req.body.altText;
    }

    await hero.save();

    res.status(200).json({
      success: true,
      message: "Hero content updated successfully",
      data: hero,
    });
  } catch (error) {
    console.error("❌ Error in updateHero:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  upload,          // <-- IMPORTANT: this fixes HeroController.upload.single("media")
  getHero,
  addOrReplaceHero,
  updateHero,
};
