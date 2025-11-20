// // models/HeroContent.js
// const mongoose = require('mongoose');

// const heroContentSchema = new mongoose.Schema({
//   mediaUrl: {
//     type: String,
//     required: true
//   },
//   mediaType: {
//     type: String,
//     enum: ['image', 'video'],
//     required: true
//   },
//   altText: {
//     type: String,
//     default: 'Hero media'
//   }
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('HeroContent', heroContentSchema);



// models/HeroContent.js
// models/HeroContent.js
// models/HeroContent.js
const mongoose = require("mongoose");

const heroContentSchema = new mongoose.Schema(
  {
    mediaUrl: {
      type: String, // Cloudinary URL
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    publicId: {
      type: String, // Cloudinary public_id, used to delete/replace
      required: true,
    },
    altText: {
      type: String,
      default: "Hero media",
    },
    resourceType: {
      type: String, // 'image' or 'video'
      default: "image",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("HeroContent", heroContentSchema);


