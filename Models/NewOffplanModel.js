// models/NewOffplanModel.js - FIXED VERSION
const mongoose = require('mongoose');

const offPlanPropertySchema = new mongoose.Schema({
  // Original API ID
  apiId: {
    type: Number,
    required: true,
    unique: true
  },
  
  // Property basic information
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  area: {
    type: String,
    required: true,
    trim: true
  },
  
  developer: {
    type: String,
    required: true,
    trim: true
  },
  
  // Location data
  coordinates: {
    type: String,
    required: true
  },
  
  // Parse coordinates into separate lat/lng fields for easier queries
  latitude: {
    type: Number,
    required: true
  },
  
  longitude: {
    type: Number,
    required: true
  },
  
  // Pricing information - Updated with new fields
  minPrice: {
    type: Number,
    default: null
  },
  
  maxPrice: {
    type: Number,
    default: null
  },
  
  minPriceAed: {
    type: Number,
    default: null
  },
  
  minPricePerAreaUnit: {
    type: Number,
    default: null
  },
  
  priceCurrency: {
    type: String,
    default: 'AED',
    trim: true
  },
  
  // Area information
  areaUnit: {
    type: String,
    default: 'sqft',
    trim: true
  },
  
  // Status information
  status: {
    type: String,
    required: true,
    enum: ['Presale', 'Under construction', 'Completed'],
    trim: true
  },
  
  saleStatus: {
    type: String,
    required: true,
    enum: ['Presale(EOI)', 'Start of sales', 'On sale', 'Out of stock'],
    trim: true
  },
  
  // Dates - Updated field name
  completionDate: {
    type: Date,
    default: null
  },
  
  // Partnership and additional information
  isPartnerProject: {
    type: Boolean,
    default: false
  },
  
  hasEscrow: {
    type: Boolean,
    default: false
  },
  
  postHandover: {
    type: Boolean,
    default: false
  },
  
  // FIXED: Image information - Changed structure to match API data
  coverImage: {
    access: {
      type: String,
      default: 'public'
    },
    path: {
      type: String,
      default: null
    },
    name: {
      type: String,
      default: null
    },
    type: {
      type: String,
      default: 'image'
    },
    size: {
      type: Number,
      default: null
    },
    mime: {
      type: String,
      default: null
    },
    meta: {
      width: {
        type: Number,
        default: null
      },
      height: {
        type: Number,
        default: null
      }
    },
    url: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'newoffplanproperties' // Specify collection name
});

// Indexes for better query performance
offPlanPropertySchema.index({ area: 1 });
offPlanPropertySchema.index({ developer: 1 });
offPlanPropertySchema.index({ status: 1 });
offPlanPropertySchema.index({ saleStatus: 1 });
offPlanPropertySchema.index({ minPrice: 1 });
offPlanPropertySchema.index({ maxPrice: 1 });
offPlanPropertySchema.index({ completionDate: 1 });
offPlanPropertySchema.index({ latitude: 1, longitude: 1 }); // Geospatial index
offPlanPropertySchema.index({ isPartnerProject: 1 });
offPlanPropertySchema.index({ hasEscrow: 1 });
offPlanPropertySchema.index({ postHandover: 1 });

// Virtual for formatted price
offPlanPropertySchema.virtual('formattedPrice').get(function() {
  if (!this.minPrice) return 'Price on Request';
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: this.priceCurrency || 'AED',
    minimumFractionDigits: 0
  }).format(this.minPrice);
});

// Virtual for formatted max price
offPlanPropertySchema.virtual('formattedMaxPrice').get(function() {
  if (!this.maxPrice) return null;
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: this.priceCurrency || 'AED',
    minimumFractionDigits: 0
  }).format(this.maxPrice);
});

// Virtual for price range
offPlanPropertySchema.virtual('priceRange').get(function() {
  if (!this.minPrice) return 'Price on Request';
  if (!this.maxPrice || this.minPrice === this.maxPrice) {
    return this.formattedPrice;
  }
  return `${this.formattedPrice} - ${this.formattedMaxPrice}`;
});

// Virtual for location object
offPlanPropertySchema.virtual('location').get(function() {
  return {
    type: 'Point',
    coordinates: [this.longitude, this.latitude]
  };
});

// FIXED: Virtual for main image URL (easy access to the main image)
offPlanPropertySchema.virtual('mainImageUrl').get(function() {
  return this.coverImage?.url || null;
});

// Instance method to get distance from a point
offPlanPropertySchema.methods.getDistanceFrom = function(lat, lng) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat - this.latitude) * Math.PI / 180;
  const dLng = (lng - this.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Instance method to check if property is available
offPlanPropertySchema.methods.isAvailable = function() {
  return ['On sale', 'Start of sales', 'Presale(EOI)'].includes(this.saleStatus);
};

// Instance method to get completion status
offPlanPropertySchema.methods.getCompletionStatus = function() {
  if (!this.completionDate) return 'Completion date not available';
  
  const now = new Date();
  const completion = new Date(this.completionDate);
  
  if (completion < now) return 'Completed';
  
  const monthsLeft = Math.ceil((completion - now) / (1000 * 60 * 60 * 24 * 30));
  return `${monthsLeft} months remaining`;
};

// Ensure virtuals are included in JSON output
offPlanPropertySchema.set('toJSON', { virtuals: true });
offPlanPropertySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('OffPlanProperty', offPlanPropertySchema);