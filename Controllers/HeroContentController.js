const HeroContent = require('../Models/HeroContent');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/hero/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Created uploads/hero directory:', uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/hero/');
    
    // Double-check directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log('✅ Created directory during upload:', uploadPath);
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'hero-' + uniqueSuffix + path.extname(file.originalname);
    console.log('📁 Saving file as:', filename);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|webm|ogg/;
  const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
  
  if (allowedImageTypes.test(extname) || allowedVideoTypes.test(extname)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, JPG, PNG, GIF, WebP) and videos (MP4, WebM, OGG) are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper function to delete old media file
const deleteOldMedia = (mediaUrl) => {
  try {
    if (mediaUrl) {
      const cleanUrl = mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl;
      const filePath = path.join(__dirname, '..', cleanUrl);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️  Deleted old media:', filePath);
      } else {
        console.log('⚠️  Old media file not found:', filePath);
      }
    }
  } catch (error) {
    console.error('❌ Error deleting old media:', error);
  }
};

// Get current hero content
const getHero = async (req, res) => {
  try {
    console.log('📥 GET /get-hero - Fetching hero content...');
    const hero = await HeroContent.findOne();
    
    if (!hero) {
      console.log('⚠️  No hero content found');
      return res.status(404).json({ 
        success: false, 
        message: 'No hero content found' 
      });
    }
    
    console.log('✅ Hero content found:', hero.mediaType);
    res.status(200).json({ success: true, data: hero });
  } catch (error) {
    console.error('❌ Error fetching hero:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add or Replace hero content
const addOrReplaceHero = async (req, res) => {
  try {
    console.log('📤 POST /add-replace - Starting upload...');
    console.log('📎 File received:', req.file ? req.file.filename : 'No file');
    console.log('📝 Body:', req.body);
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const mediaUrl = `/uploads/hero/${req.file.filename}`;
    
    console.log('📊 Media type:', mediaType);
    console.log('🔗 Media URL:', mediaUrl);
    console.log('💾 File saved to:', req.file.path);

    // Check if hero already exists
    const existingHero = await HeroContent.findOne();

    if (existingHero) {
      console.log('🔄 Replacing existing hero...');
      console.log('🗑️  Old hero type:', existingHero.mediaType);
      
      // Delete old media file
      deleteOldMedia(existingHero.mediaUrl);

      // Update existing hero
      existingHero.mediaUrl = mediaUrl;
      existingHero.mediaType = mediaType;
      existingHero.altText = req.body.altText || 'Hero media';
      await existingHero.save();

      console.log('✅ Hero replaced successfully');
      return res.status(200).json({ 
        success: true, 
        message: `Hero content replaced to ${mediaType}`,
        data: existingHero 
      });
    } else {
      console.log('➕ Creating new hero...');
      
      // Create new hero
      const newHero = await HeroContent.create({
        mediaUrl,
        mediaType,
        altText: req.body.altText || 'Hero media'
      });

      console.log('✅ Hero created successfully');
      return res.status(201).json({ 
        success: true, 
        message: 'Hero content added successfully',
        data: newHero 
      });
    }
  } catch (error) {
    console.error('❌ Error in addOrReplaceHero:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update hero content (only altText or replace media)
const updateHero = async (req, res) => {
  try {
    console.log('🔄 PUT /update - Updating hero...');
    console.log('📎 File received:', req.file ? req.file.filename : 'No file');
    console.log('📝 Body:', req.body);
    
    const hero = await HeroContent.findOne();

    if (!hero) {
      console.log('❌ No hero content found to update');
      return res.status(404).json({ 
        success: false, 
        message: 'No hero content found to update' 
      });
    }

    if (req.file) {
      console.log('🔄 Replacing media file...');
      
      // Delete old media file
      deleteOldMedia(hero.mediaUrl);

      const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
      hero.mediaUrl = `/uploads/hero/${req.file.filename}`;
      hero.mediaType = mediaType;
      console.log('💾 New file saved to:', req.file.path);
    }

    // Update altText if provided
    if (req.body.altText) {
      console.log('📝 Updating alt text...');
      hero.altText = req.body.altText;
    }

    await hero.save();

    console.log('✅ Hero updated successfully');
    res.status(200).json({ 
      success: true, 
      message: 'Hero content updated successfully',
      data: hero 
    });
  } catch (error) {
    console.error('❌ Error in updateHero:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getHero,
  addOrReplaceHero,
  updateHero,
  upload
};