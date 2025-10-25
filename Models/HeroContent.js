// models/HeroContent.js
const mongoose = require('mongoose');

const heroContentSchema = new mongoose.Schema({
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  altText: {
    type: String,
    default: 'Hero media'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HeroContent', heroContentSchema);
