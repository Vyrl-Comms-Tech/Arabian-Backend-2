// Near the top with other requires
require('./Config/redis.js'); // Initialize Redis connection
require('dotenv').config();
const { setupCronJobs } = require("./Controllers/AgentController.js");
const { schedulePropertySync} = require("./Controllers/XmlParser.js");
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // ← ADD THIS MISSING IMPORT
const ConnectDb = require('./Database/Db');
const multer = require('multer');
const router = require('./Router/Routes');
const cloudinary = require('cloudinary').v2;

// Set up middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ---- Multer setup ---- 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads'); // ← FIXED: Remove '../'
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed!'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});






// Agents with salesforce sync cron job
setupCronJobs();
schedulePropertySync()

// Then mount your API routes
app.use("/", router);

// Start DB and server
ConnectDb().then(() => {
  app.listen(8000, () => {
    console.log("Server is running on port 8000");
  });
}).catch((err) => {
  console.log("DB connection failed:", err);
});


// Export upload middleware for use in routes
module.exports.upload = upload;
module.exports.cloudinary = cloudinary;