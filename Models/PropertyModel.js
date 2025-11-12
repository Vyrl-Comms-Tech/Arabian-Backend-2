// // // models/PropertySchema.js
// // const mongoose = require('mongoose');

// // // Schema for Address Information
// // const AddressInformationSchema = new mongoose.Schema({
// //   city: String,
// //   address: String,
// //   latitude: String,
// //   longitude: String
// // }, { _id: false });

// // // Schema for General Listing Information - UPDATED with new listing types
// // const GeneralListingInformationSchema = new mongoose.Schema({
// //   listing_title: {
// //     type: String,
// //     required: true
// //   },
// //   listingprice: {
// //     type: String,
// //     required: true
// //   },
// //   currency_iso_code: {
// //     type: String,
// //     required: true
// //   },
// //   listingtype: {
// //     type: String,
// //     required: true,
// //     enum: ['Sale', 'Rent', 'OffPlan', 'Commercial'] // UPDATED: Added OffPlan and Commercial
// //   },
// //   property: {
// //     type: String,
// //     required: true
// //   },
// //   property_type: {
// //     type: String
// //   },
// //   propertytype: {
// //     type: String
// //   },
// //   status: {
// //     type: String,
// //     required: true
// //   },
// //   totalarea: String,
// //   description: String,
// //   bedrooms: String,
// //   fullbathrooms: String
// // }, { _id: false });

// // // Schema for Listing Agent
// // const ListingAgentSchema = new mongoose.Schema({
// //   listing_agent_email: {
// //     type: String,
// //     required: true
// //   },
// //   listing_agent_firstname: {
// //     type: String,
// //     required: true
// //   },
// //   listing_agent_lastname: {
// //     type: String,
// //     required: true
// //   },
// //   listing_agent_mobil_phone: {
// //     type: String,
// //     required: true
// //   },
// //   listing_agent_phone: {
// //     type: String,
// //     required: true
// //   }
// // }, { _id: false });

// // // Schema for URL object (for QR codes and images)
// // const UrlSchema = new mongoose.Schema({
// //   title: String,
// //   url: String
// // }, { _id: false });

// // // Schema for Image
// // const ImageSchema = new mongoose.Schema({
// //   title: String,
// //   url: String
// // }, { _id: false });

// // // Schema for Listing Media
// // const ListingMediaSchema = new mongoose.Schema({
// //   images: {
// //     image: [ImageSchema]
// //   }
// // }, { _id: false });

// // // Comprehensive Schema for Custom Fields - includes ALL possible fields
// // const CustomFieldsSchema = new mongoose.Schema({
// //   // New XML format fields
// //   property_record_id: String,
// //   permit_number: String,
// //   offering_type: String, // IMPORTANT: This field drives the new classification logic
// //   price_on_application: String,
// //   payment_method: String,
// //   city: String,
// //   community: String,
// //   sub_community: String,
// //   property_name: String,
// //   propertyfinder_region: String,
// //   autonumber: String,
// //   unitnumber: String,
// //   private_amenities: String,
// //   plot_size: String,
// //   developer: String,
// //   completion_status: String, // IMPORTANT: This field drives off-plan classification
// //   parking: String,
// //   furnished: String,
// //   project_name: String,
// //   title_deed: String,
// //   availability_date: String,
// //   qr_code: String, // Store as String instead of Mixed

// //   // Legacy/mapped fields for backward compatibility
// //   community_name: String,
// //   tower_text: String,
// //   pba__addresstext_pb: String,
// //   pba_uaefields__completion_status: String,
  
// //   // Additional new fields from XML
// //   sub_community_name: String,
// //   building_name: String,
// //   rera_permit_number: String,
// //   plot_area: String,
// //   completion_date: String,
  
// //   // Existing legacy fields
// //   property_owner_mobile: String,
// //   pba__yearbuilttext_pb: String,
// //   year_build_text: String,
// //   owner_full_name: String,
// //   pba__tdlink: String,
// //   active_portal_images_pb: String,
// //   pba__systemallowedforportals: String,
// //   pba__zipformlink: String,
// //   pb_autonumber: String,
// //   pba_uaefields__location_source: String,
// //   valuetext_bedroom: String,
// //   lastvieweddate: String,
// //   address: String,
// //   last_activity_in_days: String,
// //   list_on_website: String,
// //   pba__unitnumber: String,
// //   website_url_for_valuetext: String,
// //   full_address: String,
// //   property_owner_full_name: String,
// //   pba_uaefields__price_unit: String,
// //   property_owner_email: String,
// //   building: String,
// //   pba_uaefields__rera_permit_number: String,
// //   portals_enabled: String,
// //   website_url: String,
// //   portal: String,
// //   generator: String,
// //   error_email: String,
// //   provider_software: String,
// //   provider_software_version: String,
// //   availability: String,
// //   pba_uaefields__city_propertyfinder: String,
// //   title_deed_number: String,
// //   property_live_date: String,
// //   pba_uaefields__private_amenities: String,
// //   old_listing: String,
// //   pba_uaefields__available_from: String,
// //   pba_uaefields__propertyfinder_region: String,
// //   pba_uaefields__availability_date: String,
// //   pba_uaefields__sub_community_propertyfinder: String,
// //   pba_uaefields__community_propertyfinder: String,
// //   pba_uaefields__property_sub_type: String,
// //   pba_uaefields__parking: String,
// //   pba_uaefields__furnished: String,
// //   pba_uaefields__property_propertyfinder: String,
// //   pba_uaefields__city_dubizzle: String,
// //   pba__previousprice: String,
// //   last_price_reduction: String,
// //   pba__latitude_property: String,
// //   form_a_expiry_date: String,
// //   pba_uaefields__plot_size: String,
// //   property_layout: String,
// //   pba__longitude_property: String,
// //   pba__geocodeaccuracy_pb: String,
// //   x360_tour: String,
// //   pba_uaefields__price_on_request: String,
// //   youtube_video_link: String,
// //   pba_uaefields__number_of_cheques: String,
// //   shark_tank: String,
// //   pba__numberofparkingspaces: String
// // }, { 
// //   _id: false,
// //   strict: false // Allow additional fields not defined in schema
// // });

// // // Main Property Schema
// // const PropertySchema = new mongoose.Schema({
// //   created_at: {
// //     type: String,
// //     required: true
// //   },
// //   mode: {
// //     type: String,
// //     required: true
// //   },
// //   timestamp: {
// //     type: String,
// //     required: true
// //   },
// //   id: {
// //     type: String, 
// //     required: true,
// //     unique: true
// //   },
// //   address_information: {
// //     type: AddressInformationSchema,
// //     default: {}
// //   },
// //   general_listing_information: {
// //     type: GeneralListingInformationSchema,
// //     required: true
// //   },
// //   listing_agent: {
// //     type: ListingAgentSchema,
// //     required: true
// //   },
// //   listing_media: {
// //     type: mongoose.Schema.Types.Mixed,
// //     default: function() {
// //       return {
// //         images: {
// //           image: []
// //         }
// //       };
// //     }
// //   },
// //   custom_fields: {
// //     type: CustomFieldsSchema,
// //     default: {}
// //   },
// //   // Store QR code separately for easier access
// //   qr_code: {
// //     type: String // Store as String instead of Mixed
// //   }
// // }, {
// //   timestamps: true,
// //   strict: false // Allow additional fields at root level if needed
// // });

// // // UPDATED Indexes for common queries - added new fields
// // PropertySchema.index({ 'general_listing_information.listingtype': 1 });
// // PropertySchema.index({ 'general_listing_information.propertytype': 1 });
// // PropertySchema.index({ 'general_listing_information.property_type': 1 });
// // PropertySchema.index({ 'general_listing_information.status': 1 });
// // PropertySchema.index({ 'custom_fields.community': 1 });
// // PropertySchema.index({ 'custom_fields.community_name': 1 });
// // PropertySchema.index({ 'custom_fields.sub_community': 1 });
// // PropertySchema.index({ 'custom_fields.property_name': 1 });
// // PropertySchema.index({ 'custom_fields.developer': 1 });
// // PropertySchema.index({ 'custom_fields.completion_status': 1 }); // IMPORTANT INDEX
// // PropertySchema.index({ 'custom_fields.offering_type': 1 }); // IMPORTANT INDEX
// // PropertySchema.index({ 'custom_fields.city': 1 });
// // PropertySchema.index({ 'custom_fields.furnished': 1 });
// // PropertySchema.index({ 'custom_fields.pba_uaefields__completion_status': 1 });

// // // Compound indexes for complex queries
// // PropertySchema.index({ 
// //   'general_listing_information.listingtype': 1, 
// //   'custom_fields.community': 1 
// // });
// // PropertySchema.index({ 
// //   'general_listing_information.listingtype': 1, 
// //   'general_listing_information.propertytype': 1 
// // });
// // PropertySchema.index({ 
// //   'custom_fields.completion_status': 1, 
// //   'general_listing_information.listingtype': 1 
// // });
// // // NEW compound indexes for the new classification fields
// // PropertySchema.index({ 
// //   'custom_fields.offering_type': 1, 
// //   'custom_fields.completion_status': 1 
// // });

// // // Method to get the formatted price
// // PropertySchema.methods.getFormattedPrice = function() {
// //   if (!this.general_listing_information.listingprice) return 'Price on request';
  
// //   const price = parseFloat(this.general_listing_information.listingprice).toLocaleString();
// //   const currency = this.general_listing_information.currency_iso_code || 'AED';
  
// //   return `${currency} ${price}`;
// // };

// // // UPDATED Static method to find properties by listing type
// // PropertySchema.statics.findByListingType = function(type) {
// //   return this.find({
// //     'general_listing_information.listingtype': type
// //   });
// // };

// // // UPDATED Static method to find off-plan properties
// // PropertySchema.statics.findOffPlan = function() {
// //   return this.find({
// //     $or: [
// //       { 'custom_fields.completion_status': 'off_plan_primary' },
// //       { 'custom_fields.completion_status': 'off_plan_secondary' },
// //       { 'general_listing_information.listingtype': 'OffPlan' }
// //     ]
// //   });
// // };

// // // NEW Static method to find commercial properties
// // PropertySchema.statics.findCommercial = function() {
// //   return this.find({
// //     $or: [
// //       { 'custom_fields.offering_type': { $in: ['CS', 'CR'] } },
// //       { 'general_listing_information.listingtype': 'Commercial' }
// //     ]
// //   });
// // };

// // // NEW Static method to find by offering type
// // PropertySchema.statics.findByOfferingType = function(offeringType) {
// //   return this.find({
// //     'custom_fields.offering_type': offeringType
// //   });
// // };

// // // NEW Static method to find by completion status
// // PropertySchema.statics.findByCompletionStatus = function(completionStatus) {
// //   return this.find({
// //     'custom_fields.completion_status': completionStatus
// //   });
// // };

// // // Static method to find by community
// // PropertySchema.statics.findByCommunity = function(community) {
// //   return this.find({
// //     $or: [
// //       { 'custom_fields.community': community },
// //       { 'custom_fields.community_name': community }
// //     ]
// //   });
// // };

// // // Method to check if property has images
// // PropertySchema.methods.hasImages = function() {
// //   return this.listing_media && 
// //          this.listing_media.images && 
// //          this.listing_media.images.image && 
// //          this.listing_media.images.image.length > 0;
// // };

// // // Method to get QR code URL - SIMPLIFIED
// // PropertySchema.methods.getQRCodeUrl = function() {
// //   // First check root level qr_code
// //   if (this.qr_code && typeof this.qr_code === 'string') {
// //     return this.qr_code;
// //   }
  
// //   // Then check custom_fields qr_code
// //   if (this.custom_fields?.qr_code && typeof this.custom_fields.qr_code === 'string') {
// //     return this.custom_fields.qr_code;
// //   }
  
// //   return null;
// // };

// // // UPDATED Method to check if property is off-plan
// // PropertySchema.methods.isOffPlan = function() {
// //   return this.custom_fields?.completion_status === 'off_plan_primary' ||
// //          this.custom_fields?.completion_status === 'off_plan_secondary' ||
// //          this.general_listing_information?.listingtype === 'OffPlan';
// // };

// // // NEW Method to check if property is commercial
// // PropertySchema.methods.isCommercial = function() {
// //   return this.custom_fields?.offering_type === 'CS' ||
// //          this.custom_fields?.offering_type === 'CR' ||
// //          this.general_listing_information?.listingtype === 'Commercial';
// // };

// // // NEW Method to get property classification details
// // PropertySchema.methods.getClassificationDetails = function() {
// //   return {
// //     listingType: this.general_listing_information?.listingtype,
// //     completionStatus: this.custom_fields?.completion_status,
// //     offeringType: this.custom_fields?.offering_type,
// //     isOffPlan: this.isOffPlan(),
// //     isCommercial: this.isCommercial()
// //   };
// // };

// // // SIMPLIFIED pre-save middleware
// // PropertySchema.pre('save', function(next) {
// //   if (this.isModified('general_listing_information.listingprice')) {
// //     console.log(`Price changed for property ${this.id}`);
// //   }
  
// //   // Simple QR code sync between root and custom_fields
// //   if (!this.qr_code && this.custom_fields?.qr_code) {
// //     this.qr_code = this.custom_fields.qr_code;
// //     console.log(`DEBUG - Schema: Synced QR code to root level for ${this.id}:`, this.qr_code);
// //   }
  
// //   next();
// // });

// // module.exports = PropertySchema;



// // models/PropertyModel.js
// const mongoose = require('mongoose');

// // Schema for Address Information
// const AddressInformationSchema = new mongoose.Schema({
//   city: String,
//   address: String,
//   latitude: String,
//   longitude: String
// }, { _id: false });

// // Schema for General Listing Information
// const GeneralListingInformationSchema = new mongoose.Schema({
//   listing_title: {
//     type: String,
//     required: true
//   },
//   listingprice: {
//     type: String,
//     required: true
//   },
//   currency_iso_code: {
//     type: String,
//     required: true
//   },
//   status: {
//     type: String,
//     required: true
//   },
//   totalarea: String,
//   description: String,
//   bedrooms: String,
//   fullbathrooms: String
// }, { _id: false });

// // Schema for Listing Agent
// const ListingAgentSchema = new mongoose.Schema({
//   listing_agent_email: {
//     type: String,
//     required: true
//   },
//   listing_agent_firstname: {
//     type: String,
//     required: true
//   },
//   listing_agent_lastname: {
//     type: String,
//     required: true
//   },
//   listing_agent_mobil_phone: {
//     type: String,
//     required: true
//   },
//   listing_agent_phone: {
//     type: String,
//     required: true
//   }
// }, { _id: false });

// // Schema for Image
// const ImageSchema = new mongoose.Schema({
//   title: String,
//   url: String
// }, { _id: false });

// // Schema for Listing Media
// const ListingMediaSchema = new mongoose.Schema({
//   images: {
//     image: [ImageSchema]
//   }
// }, { _id: false });

// // Custom Fields Schema - keeping all existing fields
// const CustomFieldsSchema = new mongoose.Schema({
//   property_record_id: String,
//   permit_number: String,
//   price_on_application: String,
//   payment_method: String,
//   city: String,
//   community: String,
//   sub_community: String,
//   property_name: String,
//   propertyfinder_region: String,
//   autonumber: String,
//   unitnumber: String,
//   private_amenities: String,
//   plot_size: String,
//   developer: String,
//   completion_status: String,
//   parking: String,
//   furnished: String,
//   project_name: String,
//   title_deed: String,
//   availability_date: String,
//   qr_code: String,
  
//   // Legacy/mapped fields for backward compatibility
//   community_name: String,
//   tower_text: String,
//   pba__addresstext_pb: String,
//   pba_uaefields__completion_status: String,
//   sub_community_name: String,
//   building_name: String,
//   rera_permit_number: String,
//   plot_area: String,
//   completion_date: String
// }, { 
//   _id: false,
//   strict: false
// });

// // Main Property Schema
// const PropertySchema = new mongoose.Schema({
//   created_at: {
//     type: String,
//     required: true
//   },
//   timestamp: {
//     type: String,
//     required: true
//   },
//   id: {
//     type: String, 
//     required: true,
//     unique: true
//   },
  
//   // Base level fields for indexing
//   offering_type: {
//     type: String,
//     required: true,
//     enum: ['RS', 'RR', 'CS', 'CR'], // Sale, Rent, Commercial Sale, Commercial Rent
//     index: true
//   },
//   property_type: {
//     type: String,
//     required: true,
//     default: 'apartment',
//     index: true
//   },
  
//   address_information: {
//     type: AddressInformationSchema,
//     default: {}
//   },
//   general_listing_information: {
//     type: GeneralListingInformationSchema,
//     required: true
//   },
//   listing_agent: {
//     type: ListingAgentSchema,
//     required: true
//   },
//   listing_media: {
//     type: ListingMediaSchema,
//     default: function() {
//       return {
//         images: {
//           image: []
//         }
//       };
//     }
//   },
//   custom_fields: {
//     type: CustomFieldsSchema,
//     default: {}
//   },
//   qr_code: {
//     type: String
//   }
// }, {
//   timestamps: true,
//   strict: false
// });

// // Compound index for offering_type and property_type (primary retrieval pattern)
// PropertySchema.index({ listing_type: 1, property_type: 1 });

// // Methods
// PropertySchema.methods.getFormattedPrice = function() {
//   if (!this.general_listing_information.listingprice) return 'Price on request';
  
//   const price = parseFloat(this.general_listing_information.listingprice).toLocaleString();
//   const currency = this.general_listing_information.currency_iso_code || 'AED';
  
//   return `${currency} ${price}`;
// };

// PropertySchema.methods.hasImages = function() {
//   return this.listing_media && 
//          this.listing_media.images && 
//          this.listing_media.images.image && 
//          this.listing_media.images.image.length > 0;
// };

// PropertySchema.methods.getQRCodeUrl = function() {
//   return this.qr_code || this.custom_fields?.qr_code || null;
// };

// PropertySchema.methods.isOffPlan = function() {
//   return this.custom_fields?.completion_status === 'off_plan_primary' ||
//          this.custom_fields?.completion_status === 'off_plan_secondary';
// };

// PropertySchema.methods.isCommercial = function() {
//   return this.offering_type === 'CS' || this.offering_type === 'CR';
// };

// // Static methods for querying
// PropertySchema.statics.findByOfferingType = function(offeringType) {
//   return this.find({ offering_type: offeringType });
// };

// PropertySchema.statics.findByPropertyType = function(propertyType) {
//   return this.find({ property_type: propertyType });
// };

// PropertySchema.statics.findByOfferingAndPropertyType = function(offeringType, propertyType) {
//   return this.find({ offering_type: offeringType, property_type: propertyType });
// };

// PropertySchema.statics.findByCommunity = function(community) {
//   return this.find({
//     $or: [
//       { 'custom_fields.community': community },
//       { 'custom_fields.community_name': community }
//     ]
//   });
// };

// module.exports = mongoose.model('Property', PropertySchema);


const mongoose = require('mongoose');

// Schema for Address Information
const AddressInformationSchema = new mongoose.Schema({
  city: String,
  address: String,
  latitude: String,
  longitude: String
}, { _id: false });

// Schema for General Listing Information
const GeneralListingInformationSchema = new mongoose.Schema({
  listing_title: {
    type: String,
    required: true
  },
  updated: {
    type: String,
    enum: ['Yes', 'No']
  },
  listingprice: {
    type: String,
    required: true
  },
  currency_iso_code: {
    type: String,
    required: true
  },
  listingtype: {
    type: String,
    // enum: ['Sale', 'Rent', 'OffPlan', 'Commercial']
  },
  property: String,
  property_type: String,
  propertytype: String,
  status: {
    type: String,
    required: true
  },
  totalarea: String,
  description: String,
  bedrooms: String,
  fullbathrooms: String
}, { _id: false });

// Schema for Listing Agent
const ListingAgentSchema = new mongoose.Schema({
  listing_agent_email: {
    type: String,
    required: true
  },
  listing_agent_firstname: {
    type: String,
    required: true
  },
  listing_agent_lastname: {
    type: String,
    required: true
  },
  listing_agent_mobil_phone: {
    type: String,
    required: true
  },
  listing_agent_phone: {
    type: String,
    required: true
  }
}, { _id: false });

// Schema for Image
const ImageSchema = new mongoose.Schema({
  title: String,
  url: String
}, { _id: false });

// Schema for Listing Media
const ListingMediaSchema = new mongoose.Schema({
  images: {
    image: [ImageSchema]
  }
}, { _id: false });

// Custom Fields Schema
const CustomFieldsSchema = new mongoose.Schema({
  property_record_id: String,
  permit_number: String,
  offering_type: String,
  price_on_application: String,
  payment_method: String,
  city: String,
  community: String,
  sub_community: String,
  property_name: String,
  propertyfinder_region: String,
  autonumber: String,
  unitnumber: String,
  private_amenities: String,
  plot_size: String,
  developer: String,
  completion_status: String,
  parking: String,
  furnished: String,
  project_name: String,
  title_deed: String,
  availability_date: String,
  qr_code: String,
  
  // Legacy/mapped fields
  community_name: String,
  tower_text: String,
  pba__addresstext_pb: String,
  pba_uaefields__completion_status: String,
  sub_community_name: String,
  building_name: String,
  rera_permit_number: String,
  plot_area: String,
  completion_date: String
}, { 
  _id: false,
  strict: false
});

// Main Property Schema
const PropertySchema = new mongoose.Schema({
  created_at: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  id: {
    type: String, 
    required: true,
    unique: true,
    // index: true  // ✅ INDEXED for fast lookups
  },
  
  // Base level fields for indexing
  offering_type: {
    type: String,
    required: true,
    enum: ['RS', 'RR', 'CS', 'CR'], // Sale, Rent, Commercial Sale, Commercial Rent
    // index: true
  },
  property_type: {
    type: String,
    required: true,
    default: 'apartment',
    // index: true
  },
  
  address_information: {
    type: AddressInformationSchema,
    default: {}
  },
  general_listing_information: {
    type: GeneralListingInformationSchema,
    required: true
  },
  listing_agent: {
    type: ListingAgentSchema,
    required: true
  },
  listing_media: {
    type: ListingMediaSchema,
    default: function() {
      return {
        images: {
          image: []
        }
      };
    }
  },
  custom_fields: {
    type: CustomFieldsSchema,
    default: {}
  },
  qr_code: {
    type: String
  }
}, {
  timestamps: true,
  strict: false
});

// ✅ INDEXES - Optimized for common queries
PropertySchema.index({ id: 1 }); // Primary lookup by property ID
PropertySchema.index({ offering_type: 1, property_type: 1 }); // Compound index for listing

PropertySchema.methods.getFormattedPrice = function() {
  if (!this.general_listing_information.listingprice) return 'Price on request';
  
  const price = parseFloat(this.general_listing_information.listingprice).toLocaleString();
  const currency = this.general_listing_information.currency_iso_code || 'AED';
  
  return `${currency} ${price}`;
};

PropertySchema.methods.hasImages = function() {
  return this.listing_media && 
         this.listing_media.images && 
         this.listing_media.images.image && 
         this.listing_media.images.image.length > 0;
};

PropertySchema.methods.getQRCodeUrl = function() {
  return this.qr_code || this.custom_fields?.qr_code || null;
};

PropertySchema.methods.isOffPlan = function() {
  return this.custom_fields?.completion_status === 'off_plan_primary' ||
         this.custom_fields?.completion_status === 'off_plan_secondary';
};

PropertySchema.methods.isCommercial = function() {
  return this.offering_type === 'CS' || this.offering_type === 'CR';
};

PropertySchema.methods.isLive = function() {
  return this.general_listing_information?.status?.toLowerCase() === 'live';
};

PropertySchema.methods.needsUpdate = function() {
  return this.general_listing_information?.updated === 'Yes';
};

// Static Methods for querying
PropertySchema.statics.findByOfferingType = function(offeringType) {
  return this.find({ offering_type: offeringType });
};

PropertySchema.statics.findByPropertyType = function(propertyType) {
  return this.find({ property_type: propertyType });
};

PropertySchema.statics.findByOfferingAndPropertyType = function(offeringType, propertyType) {
  return this.find({ offering_type: offeringType, property_type: propertyType });
};

PropertySchema.statics.findByCommunity = function(community) {
  return this.find({
    $or: [
      { 'custom_fields.community': community },
      { 'custom_fields.community_name': community }
    ]
  });
};

PropertySchema.statics.findLiveProperties = function() {
  return this.find({ 'general_listing_information.status': { $regex: /^live$/i } });
};

PropertySchema.statics.findPropertiesNeedingUpdate = function() {
  return this.find({ 'general_listing_information.updated': 'Yes' });
};

// Pre-save middleware
PropertySchema.pre('save', function(next) {
  // Sync QR code
  if (!this.qr_code && this.custom_fields?.qr_code) {
    this.qr_code = this.custom_fields.qr_code;
  }
  
  next();
});

module.exports = mongoose.model('Property', PropertySchema);