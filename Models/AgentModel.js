// // const mongoose = require("mongoose");
// // const { v4: uuidv4 } = require("uuid");

// // // Agent Schema Definition
// // const agentSchema = new mongoose.Schema(
// //   {
// //     agentId: {
// //       type: String,
// //       unique: true,
// //       default: () =>
// //         `AGENT_${uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase()}`,
// //       required: true,
// //     },
// //     // ——— NEW: Sequence number for ordering agents ———
// //     sequenceNumber: {
// //       type: Number,
// //       unique: true,
// //       sparse: true, // Allows null values to be non-unique
// //       min: [1, "Sequence number must be at least 1"],
// //     },
// //     agentName: {
// //       type: String,
// //       required: [true, "Agent name is required"],
// //       trim: true,
// //       maxlength: [100, "Agent name cannot exceed 100 characters"],
// //     },
// //     // Add this field in your agentSchema, after isActive field
// //     superAgent: {
// //       type: Boolean,
// //       default: false,
// //       required: [true, "Super agent status is required"],
// //       // index: true,
// //     },
// //     agentLanguage: {
// //       type: String,
// //       // required: [true, 'Agent Lang is required'],
// //       trim: true,
// //     },
// //     designation: {
// //       type: String,
// //       trim: true,
// //       maxlength: [50, "Designation cannot exceed 50 characters"],
// //     },
// //     reraNumber: {
// //       type: String,
// //       // required: [true, 'RERA number is required'],
// //       unique: true,
// //       trim: true,
// //       uppercase: true,
// //     },
// //     specialistAreas: {
// //       type: [String],
// //       default: [],
// //     },
// //     email: {
// //       type: String,
// //       required: [true, "Email is required"],
// //       unique: true,
// //       lowercase: true,
// //       match: [
// //         /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
// //         "Please enter a valid email",
// //       ],
// //     },
// //     phone: {
// //       type: String,
// //       trim: true,
// //     },
// //     whatsapp: {
// //       type: String,
// //       trim: true,
// //     },
// //     imageUrl: {
// //       type: String,
// //       trim: true,
// //     },
// //     activeSaleListings: {
// //       type: Number,
// //       default: 0,
// //       min: [0, "Active sale listings cannot be negative"],
// //     },
// //     propertiesSoldLast15Days: {
// //       type: Number,
// //       default: 0,
// //       min: [0, "Properties sold cannot be negative"],
// //     },
// //     description: {
// //       type: String,
// //       trim: true,
// //       // maxlength: [500, 'Description cannot exceed 500 characters']
// //     },

// //     // ——— Properties linked from XML parser ———
// //     properties: [
// //       {
// //         propertyId: {
// //           type: String,
// //           required: true,
// //         },
// //         listingTitle: {
// //           type: String,
// //           default: "",
// //           trim: true,
// //         },
// //         listingType: {
// //           type: String,
// //           enum: ["Sale", "Rent", "Off Plan"],
// //           required: true,
// //         },
// //         propertyType: {
// //           type: String,
// //           default: "Unknown",
// //           trim: true,
// //         },
// //         price: {
// //           type: String,
// //           default: "0",
// //         },
// //         currency: {
// //           type: String,
// //           default: "AED",
// //         },
// //         status: {
// //           type: String,
// //           default: "Active",
// //           trim: true,
// //         },
// //         bedrooms: {
// //           type: String,
// //           default: "0",
// //         },
// //         bathrooms: {
// //           type: String,
// //           default: "0",
// //         },
// //         area: {
// //           type: String,
// //           default: "0",
// //         },
// //         location: {
// //           city: {
// //             type: String,
// //             default: "",
// //             trim: true,
// //           },
// //           address: {
// //             type: String,
// //             default: "",
// //             trim: true,
// //           },
// //           community: {
// //             type: String,
// //             default: "",
// //             trim: true,
// //           },
// //           building: {
// //             type: String,
// //             default: "",
// //             trim: true,
// //           },
// //         },
// //         images: [
// //           {
// //             title: {
// //               type: String,
// //               trim: true,
// //             },
// //             url: {
// //               type: String,
// //               trim: true,
// //             },
// //           },
// //         ],
// //         description: {
// //           type: String,
// //           default: "",
// //           trim: true,
// //         },
// //         addedDate: {
// //           type: Date,
// //           default: Date.now,
// //         },
// //         lastUpdated: {
// //           type: Date,
// //           default: Date.now,
// //         },
// //       },
// //     ],

// //     // ——— Blogs linked to this agent ———
// //     blogs: [
// //       {
// //         blogId: {
// //           type: mongoose.Schema.Types.ObjectId,
// //           ref: "Blog",
// //           required: true,
// //         },
// //         title: {
// //           type: String,
// //           required: true,
// //           trim: true,
// //         },
// //         slug: {
// //           type: String,
// //           trim: true,
// //         },
// //         // Image field for blog
// //         image: {
// //           filename: {
// //             type: String,
// //             required: [true, "Image filename is required"],
// //           },
// //           originalName: String,
// //           mimetype: String,
// //           size: Number,
// //           path: String,
// //         },
// //         isPublished: {
// //           type: Boolean,
// //           default: false,
// //         },
// //         publishedAt: {
// //           type: Date,
// //         },
// //         createdAt: {
// //           type: Date,
// //           default: Date.now,
// //         },
// //         updatedAt: {
// //           type: Date,
// //           default: Date.now,
// //         },
// //       },
// //     ],

// //     isActive: {
// //       type: Boolean,
// //       default: true,
// //       index: true,
// //     },
// //     registeredDate: {
// //       type: Date,
// //       default: Date.now,
// //     },
// //     lastUpdated: {
// //       type: Date,
// //       default: Date.now,
// //     },
// //   },
// //   {
// //     timestamps: true,
// //   }
// // );

// // // Indexes
// // agentSchema.index({ "properties.propertyId": 1 });
// // agentSchema.index({ specialistAreas: 1 });
// // agentSchema.index({ "blogs.blogId": 1 });
// // agentSchema.index({ sequenceNumber: 1 }); // Index for sequence number

// // // ——— Virtual fields for property counts ———
// // agentSchema.virtual("totalProperties").get(function () {
// //   return this.properties ? this.properties.length : 0;
// // });

// // agentSchema.virtual("activeProperties").get(function () {
// //   return this.properties
// //     ? this.properties.filter((p) => p.status !== "Off Market").length
// //     : 0;
// // });

// // agentSchema.virtual("saleProperties").get(function () {
// //   return this.properties
// //     ? this.properties.filter((p) => p.listingType === "Sale").length
// //     : 0;
// // });

// // agentSchema.virtual("rentProperties").get(function () {
// //   return this.properties
// //     ? this.properties.filter((p) => p.listingType === "Rent").length
// //     : 0;
// // });

// // agentSchema.virtual("offPlanProperties").get(function () {
// //   return this.properties
// //     ? this.properties.filter((p) => p.listingType === "Off Plan").length
// //     : 0;
// // });

// // // ——— Virtual fields for blog counts ———
// // agentSchema.virtual("totalBlogs").get(function () {
// //   return this.blogs ? this.blogs.length : 0;
// // });

// // agentSchema.virtual("publishedBlogs").get(function () {
// //   return this.blogs ? this.blogs.filter((b) => b.isPublished).length : 0;
// // });

// // agentSchema.virtual("draftBlogs").get(function () {
// //   return this.blogs ? this.blogs.filter((b) => !b.isPublished).length : 0;
// // });

// // // ——— NEW: Sequence number management methods ———
// // agentSchema.statics.getNextSequenceNumber = async function () {
// //   const lastAgent = await this.findOne(
// //     {},
// //     {},
// //     { sort: { sequenceNumber: -1 } }
// //   );
// //   return lastAgent && lastAgent.sequenceNumber
// //     ? lastAgent.sequenceNumber + 1
// //     : 1;
// // };

// // agentSchema.statics.swapSequenceNumbers = async function (
// //   agentId,
// //   newSequenceNumber
// // ) {
// //   const session = await mongoose.startSession();

// //   try {
// //     await session.withTransaction(async () => {
// //       // Find the agent being updated
// //       const currentAgent = await this.findOne({ agentId }).session(session);
// //       if (!currentAgent) {
// //         throw new Error("Agent not found");
// //       }

// //       // Find the agent with the target sequence number
// //       const targetAgent = await this.findOne({
// //         sequenceNumber: newSequenceNumber,
// //         agentId: { $ne: agentId },
// //       }).session(session);

// //       if (targetAgent) {
// //         // Swap sequence numbers
// //         const currentSequence = currentAgent.sequenceNumber;

// //         // Temporarily set to null to avoid unique constraint issues
// //         await this.updateOne(
// //           { agentId: currentAgent.agentId },
// //           { $unset: { sequenceNumber: 1 } }
// //         ).session(session);

// //         // Update target agent with current agent's sequence
// //         await this.updateOne(
// //           { agentId: targetAgent.agentId },
// //           {
// //             $set: {
// //               sequenceNumber: currentSequence,
// //               lastUpdated: new Date(),
// //             },
// //           }
// //         ).session(session);

// //         // Update current agent with new sequence
// //         await this.updateOne(
// //           { agentId: currentAgent.agentId },
// //           {
// //             $set: {
// //               sequenceNumber: newSequenceNumber,
// //               lastUpdated: new Date(),
// //             },
// //           }
// //         ).session(session);

// //         console.log(
// //           `✅ Swapped sequence numbers: Agent ${currentAgent.agentName} (${currentSequence} → ${newSequenceNumber}), Agent ${targetAgent.agentName} (${newSequenceNumber} → ${currentSequence})`
// //         );
// //       } else {
// //         // No agent has the target sequence number, just update
// //         await this.updateOne(
// //           { agentId: currentAgent.agentId },
// //           {
// //             $set: {
// //               sequenceNumber: newSequenceNumber,
// //               lastUpdated: new Date(),
// //             },
// //           }
// //         ).session(session);

// //         console.log(
// //           `✅ Updated sequence number: Agent ${currentAgent.agentName} → ${newSequenceNumber}`
// //         );
// //       }
// //     });
// //   } catch (error) {
// //     console.error("Error swapping sequence numbers:", error);
// //     throw error;
// //   } finally {
// //     await session.endSession();
// //   }
// // };

// // agentSchema.statics.reorderSequences = async function () {
// //   const agents = await this.find({ isActive: true })
// //     .sort({ sequenceNumber: 1, registeredDate: 1 })
// //     .select("agentId sequenceNumber");

// //   const session = await mongoose.startSession();

// //   try {
// //     await session.withTransaction(async () => {
// //       for (let i = 0; i < agents.length; i++) {
// //         const newSequence = i + 1;
// //         if (agents[i].sequenceNumber !== newSequence) {
// //           await this.updateOne(
// //             { agentId: agents[i].agentId },
// //             {
// //               $set: {
// //                 sequenceNumber: newSequence,
// //                 lastUpdated: new Date(),
// //               },
// //             }
// //           ).session(session);
// //         }
// //       }
// //     });

// //     console.log(`✅ Reordered ${agents.length} agent sequences`);
// //   } catch (error) {
// //     console.error("Error reordering sequences:", error);
// //     throw error;
// //   } finally {
// //     await session.endSession();
// //   }
// // };

// // // ——— Property management methods ———
// // agentSchema.methods.addOrUpdateProperty = function (propertyData) {
// //   if (!this.properties) {
// //     this.properties = [];
// //   }

// //   const existingPropertyIndex = this.properties.findIndex(
// //     (p) => p.propertyId === propertyData.propertyId
// //   );

// //   if (existingPropertyIndex > -1) {
// //     this.properties[existingPropertyIndex] = {
// //       ...this.properties[existingPropertyIndex].toObject(),
// //       ...propertyData,
// //       lastUpdated: new Date(),
// //     };
// //   } else {
// //     this.properties.push({
// //       ...propertyData,
// //       addedDate: new Date(),
// //       lastUpdated: new Date(),
// //     });
// //   }

// //   this.activeSaleListings = this.properties.filter(
// //     (p) => p.listingType === "Sale" && p.status !== "Off Market"
// //   ).length;

// //   this.lastUpdated = new Date();
// //   return this;
// // };

// // agentSchema.methods.removeProperty = function (propertyId) {
// //   if (!this.properties) return false;

// //   const initialLength = this.properties.length;
// //   this.properties = this.properties.filter((p) => p.propertyId !== propertyId);

// //   if (this.properties.length < initialLength) {
// //     this.activeSaleListings = this.properties.filter(
// //       (p) => p.listingType === "Sale" && p.status !== "Off Market"
// //     ).length;

// //     this.lastUpdated = new Date();
// //     return true;
// //   }
// //   return false;
// // };

// // // ——— Blog management methods ———
// // agentSchema.methods.addOrUpdateBlog = function (blogData) {
// //   if (!this.blogs) {
// //     this.blogs = [];
// //   }

// //   const existingBlogIndex = this.blogs.findIndex(
// //     (b) => b.blogId.toString() === blogData.blogId.toString()
// //   );

// //   if (existingBlogIndex > -1) {
// //     // Update existing blog - EXPLICITLY set all fields including image
// //     this.blogs[existingBlogIndex].blogId = blogData.blogId;
// //     this.blogs[existingBlogIndex].title = blogData.title;
// //     this.blogs[existingBlogIndex].slug = blogData.slug;
// //     this.blogs[existingBlogIndex].image = blogData.image;
// //     this.blogs[existingBlogIndex].isPublished = blogData.isPublished;
// //     this.blogs[existingBlogIndex].publishedAt = blogData.publishedAt;
// //     this.blogs[existingBlogIndex].createdAt =
// //       blogData.createdAt || this.blogs[existingBlogIndex].createdAt;
// //     this.blogs[existingBlogIndex].updatedAt = new Date();

// //     console.log(
// //       `✅ Updated existing blog: ${blogData.title} with image: ${blogData.image?.filename}`
// //     );
// //   } else {
// //     // Add new blog - EXPLICITLY create the blog object with image
// //     const newBlogEntry = {
// //       blogId: blogData.blogId,
// //       title: blogData.title,
// //       slug: blogData.slug,
// //       image: blogData.image,
// //       isPublished: blogData.isPublished,
// //       publishedAt: blogData.publishedAt,
// //       createdAt: blogData.createdAt || new Date(),
// //       updatedAt: new Date(),
// //     };

// //     this.blogs.push(newBlogEntry);
// //     console.log(
// //       `✅ Added new blog: ${blogData.title} with image: ${blogData.image?.filename}`
// //     );
// //   }

// //   this.lastUpdated = new Date();
// //   return this;
// // };

// // agentSchema.methods.removeBlog = function (blogId) {
// //   if (!this.blogs) return false;

// //   const initialLength = this.blogs.length;
// //   this.blogs = this.blogs.filter(
// //     (b) => b.blogId.toString() !== blogId.toString()
// //   );

// //   if (this.blogs.length < initialLength) {
// //     this.lastUpdated = new Date();
// //     console.log(`✅ Removed blog with ID: ${blogId}`);
// //     return true;
// //   }
// //   return false;
// // };

// // agentSchema.methods.getBlogById = function (blogId) {
// //   if (!this.blogs) return null;
// //   return this.blogs.find((b) => b.blogId.toString() === blogId.toString());
// // };

// // agentSchema.methods.getPublishedBlogs = function () {
// //   if (!this.blogs) return [];
// //   return this.blogs.filter((b) => b.isPublished);
// // };

// // agentSchema.methods.getDraftBlogs = function () {
// //   if (!this.blogs) return [];
// //   return this.blogs.filter((b) => !b.isPublished);
// // };

// // // ——— Property helper methods ———
// // agentSchema.methods.getPropertiesByType = function (listingType) {
// //   if (!this.properties) return [];
// //   return this.properties.filter((p) => p.listingType === listingType);
// // };

// // agentSchema.methods.getActiveProperties = function () {
// //   if (!this.properties) return [];
// //   return this.properties.filter((p) => p.status !== "Off Market");
// // };

// // agentSchema.methods.updatePropertyCounts = function () {
// //   if (!this.properties) {
// //     this.activeSaleListings = 0;
// //     return this;
// //   }

// //   this.activeSaleListings = this.properties.filter(
// //     (p) => p.listingType === "Sale" && p.status !== "Off Market"
// //   ).length;

// //   this.lastUpdated = new Date();
// //   return this;
// // };

// // // ——— Static methods ———
// // agentSchema.statics.findByEmail = function (email) {
// //   return this.findOne({
// //     email: email.toLowerCase().trim(),
// //     isActive: true,
// //   });
// // };

// // agentSchema.statics.findActiveAgents = function () {
// //   return this.find({ isActive: true }).sort({
// //     sequenceNumber: 1,
// //     agentName: 1,
// //   });
// // };

// // agentSchema.statics.findBySpecialistArea = function (area) {
// //   return this.find({
// //     specialistAreas: { $in: [area] },
// //     isActive: true,
// //   }).sort({ sequenceNumber: 1, agentName: 1 });
// // };

// // agentSchema.statics.findTopPerformers = function (limit = 10) {
// //   return this.aggregate([
// //     { $match: { isActive: true } },
// //     {
// //       $addFields: {
// //         totalPropertiesCount: { $size: { $ifNull: ["$properties", []] } },
// //         activePropertiesCount: {
// //           $size: {
// //             $filter: {
// //               input: { $ifNull: ["$properties", []] },
// //               cond: { $ne: ["$$this.status", "Off Market"] },
// //             },
// //           },
// //         },
// //         totalBlogsCount: { $size: { $ifNull: ["$blogs", []] } },
// //         publishedBlogsCount: {
// //           $size: {
// //             $filter: {
// //               input: { $ifNull: ["$blogs", []] },
// //               cond: { $eq: ["$$this.isPublished", true] },
// //             },
// //           },
// //         },
// //       },
// //     },
// //     {
// //       $sort: {
// //         sequenceNumber: 1,
// //         propertiesSoldLast15Days: -1,
// //         totalPropertiesCount: -1,
// //         activeSaleListings: -1,
// //         publishedBlogsCount: -1,
// //       },
// //     },
// //     { $limit: limit },
// //   ]);
// // };

// // agentSchema.statics.findAgentsWithBlogs = function (limit = 20) {
// //   return this.aggregate([
// //     { $match: { isActive: true, blogs: { $exists: true, $ne: [] } } },
// //     {
// //       $addFields: {
// //         totalBlogsCount: { $size: "$blogs" },
// //         publishedBlogsCount: {
// //           $size: {
// //             $filter: {
// //               input: "$blogs",
// //               cond: { $eq: ["$$this.isPublished", true] },
// //             },
// //           },
// //         },
// //       },
// //     },
// //     {
// //       $sort: {
// //         sequenceNumber: 1,
// //         publishedBlogsCount: -1,
// //         totalBlogsCount: -1,
// //         agentName: 1,
// //       },
// //     },
// //     { $limit: limit },
// //     {
// //       $project: {
// //         agentId: 1,
// //         agentName: 1,
// //         designation: 1,
// //         email: 1,
// //         imageUrl: 1,
// //         specialistAreas: 1,
// //         sequenceNumber: 1,
// //         totalBlogsCount: 1,
// //         publishedBlogsCount: 1,
// //         blogs: 1,
// //       },
// //     },
// //   ]);
// // };

// // // Middleware
// // agentSchema.pre("save", async function (next) {
// //   this.lastUpdated = new Date();

// //   // Ensure specialist areas are unique
// //   if (this.specialistAreas && this.specialistAreas.length > 0) {
// //     this.specialistAreas = [...new Set(this.specialistAreas)];
// //   }

// //   // Auto-assign sequence number for new agents if not provided
// //   if (this.isNew && !this.sequenceNumber) {
// //     try {
// //       this.sequenceNumber = await this.constructor.getNextSequenceNumber();
// //     } catch (error) {
// //       console.error("Error setting sequence number:", error);
// //     }
// //   }

// //   next();
// // });

// // agentSchema.pre("findOneAndUpdate", function (next) {
// //   this.set({ lastUpdated: new Date() });
// //   next();
// // });

// // module.exports = mongoose.model("Agent", agentSchema);

// // Agent Leaderboard Updates
// const mongoose = require("mongoose");
// const { v4: uuidv4 } = require("uuid");

// const agentSchema = new mongoose.Schema(
//   {
//     agentId: {
//       type: String,
//       unique: true,
//       default: () =>
//         `AGENT_${uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase()}`,
//       required: true,
//     },
//     // ——— NEW: Sequence number for ordering agents ———
//     sequenceNumber: {
//       type: Number,
//       unique: true,
//       sparse: true, // Allows null values to be non-unique
//       min: [1, "Sequence number must be at least 1"],
//     },
//     agentName: {
//       type: String,
//       required: [true, "Agent name is required"],
//       trim: true,
//       maxlength: [100, "Agent name cannot exceed 100 characters"],
//     },
//     // Add this field in your agentSchema, after isActive field
//     superAgent: {
//       type: Boolean,
//       default: false,
//       required: [true, "Super agent status is required"],
//       // index: true,
//     },
//     agentLanguage: {
//       type: String,
//       // required: [true, 'Agent Lang is required'],
//       trim: true,
//     },
//     designation: {
//       type: String,
//       trim: true,
//       maxlength: [50, "Designation cannot exceed 50 characters"],
//     },
//     reraNumber: {
//       type: String,
//       // required: [true, 'RERA number is required'],
//       unique: true,
//       trim: true,
//       uppercase: true,
//     },
//     specialistAreas: {
//       type: [String],
//       default: [],
//     },
//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       unique: true,
//       lowercase: true,
//       match: [
//         /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
//         "Please enter a valid email",
//       ],
//     },
//     phone: {
//       type: String,
//       trim: true,
//     },
//     whatsapp: {
//       type: String,
//       trim: true,
//     },
//     imageUrl: {
//       type: String,
//       trim: true,
//     },
//     activeSaleListings: {
//       type: Number,
//       default: 0,
//       min: [0, "Active sale listings cannot be negative"],
//     },
//     propertiesSoldLast15Days: {
//       type: Number,
//       default: 0,
//       min: [0, "Properties sold cannot be negative"],
//     },
//     description: {
//       type: String,
//       trim: true,
//       // maxlength: [500, 'Description cannot exceed 500 characters']
//     },

//     // ——— NEW: Leaderboard Performance Metrics ———
//     leaderboard: {
//       propertiesSold: {
//         type: Number,
//         default: 0,
//         min: [0, "Properties sold cannot be negative"],
//       },
//       totalCommission: {
//         type: Number,
//         default: 0,
//         min: [0, "Total commission cannot be negative"],
//       },
//       viewings: {
//         type: Number,
//         default: 0,
//         min: [0, "Viewings cannot be negative"],
//       },
//       offers: {
//         type: Number,
//         default: 0,
//         min: [0, "Offers cannot be negative"],
//       },
//       lastUpdated: {
//         type: Date,
//         default: Date.now,
//       },
//     },

//     // ——— Properties linked from XML parser ———
//     properties: [
//       {
//         propertyId: {
//           type: String,
//           required: true,
//         },
//         listingTitle: {
//           type: String,
//           default: "",
//           trim: true,
//         },
//         listingType: {
//           type: String,
//           enum: ["Sale", "Rent", "Off Plan"],
//           required: true,
//         },
//         propertyType: {
//           type: String,
//           default: "Unknown",
//           trim: true,
//         },
//         price: {
//           type: String,
//           default: "0",
//         },
//         currency: {
//           type: String,
//           default: "AED",
//         },
//         status: {
//           type: String,
//           default: "Active",
//           trim: true,
//         },
//         bedrooms: {
//           type: String,
//           default: "0",
//         },
//         bathrooms: {
//           type: String,
//           default: "0",
//         },
//         area: {
//           type: String,
//           default: "0",
//         },
//         location: {
//           city: {
//             type: String,
//             default: "",
//             trim: true,
//           },
//           address: {
//             type: String,
//             default: "",
//             trim: true,
//           },
//           community: {
//             type: String,
//             default: "",
//             trim: true,
//           },
//           building: {
//             type: String,
//             default: "",
//             trim: true,
//           },
//         },
//         images: [
//           {
//             title: {
//               type: String,
//               trim: true,
//             },
//             url: {
//               type: String,
//               trim: true,
//             },
//           },
//         ],
//         description: {
//           type: String,
//           default: "",
//           trim: true,
//         },
//         addedDate: {
//           type: Date,
//           default: Date.now,
//         },
//         lastUpdated: {
//           type: Date,
//           default: Date.now,
//         },
//       },
//     ],

//     // ——— Blogs linked to this agent ———
//     blogs: [
//       {
//         blogId: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "Blog",
//           required: true,
//         },
//         title: {
//           type: String,
//           required: true,
//           trim: true,
//         },
//         slug: {
//           type: String,
//           trim: true,
//         },
//         // Image field for blog
//         image: {
//           filename: {
//             type: String,
//             required: [true, "Image filename is required"],
//           },
//           originalName: String,
//           mimetype: String,
//           size: Number,
//           path: String,
//         },
//         isPublished: {
//           type: Boolean,
//           default: false,
//         },
//         publishedAt: {
//           type: Date,
//         },
//         createdAt: {
//           type: Date,
//           default: Date.now,
//         },
//         updatedAt: {
//           type: Date,
//           default: Date.now,
//         },
//       },
//     ],

//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true,
//     },
//     registeredDate: {
//       type: Date,
//       default: Date.now,
//     },
//     lastUpdated: {
//       type: Date,
//       default: Date.now,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Indexes
// agentSchema.index({ "properties.propertyId": 1 });
// agentSchema.index({ specialistAreas: 1 });
// agentSchema.index({ "blogs.blogId": 1 });
// agentSchema.index({ sequenceNumber: 1 }); // Index for sequence number
// agentSchema.index({ "leaderboard.propertiesSold": -1 }); // Index for leaderboard sorting
// agentSchema.index({ "leaderboard.totalCommission": -1 }); // Index for leaderboard sorting

// // ——— Virtual fields for property counts ———
// agentSchema.virtual("totalProperties").get(function () {
//   return this.properties ? this.properties.length : 0;
// });

// agentSchema.virtual("activeProperties").get(function () {
//   return this.properties
//     ? this.properties.filter((p) => p.status !== "Off Market").length
//     : 0;
// });

// agentSchema.virtual("saleProperties").get(function () {
//   return this.properties
//     ? this.properties.filter((p) => p.listingType === "Sale").length
//     : 0;
// });

// agentSchema.virtual("rentProperties").get(function () {
//   return this.properties
//     ? this.properties.filter((p) => p.listingType === "Rent").length
//     : 0;
// });

// agentSchema.virtual("offPlanProperties").get(function () {
//   return this.properties
//     ? this.properties.filter((p) => p.listingType === "Off Plan").length
//     : 0;
// });

// // ——— Virtual fields for blog counts ———
// agentSchema.virtual("totalBlogs").get(function () {
//   return this.blogs ? this.blogs.length : 0;
// });

// agentSchema.virtual("publishedBlogs").get(function () {
//   return this.blogs ? this.blogs.filter((b) => b.isPublished).length : 0;
// });

// agentSchema.virtual("draftBlogs").get(function () {
//   return this.blogs ? this.blogs.filter((b) => !b.isPublished).length : 0;
// });

// // ——— NEW: Sequence number management methods ———
// agentSchema.statics.getNextSequenceNumber = async function () {
//   const lastAgent = await this.findOne(
//     {},
//     {},
//     { sort: { sequenceNumber: -1 } }
//   );
//   return lastAgent && lastAgent.sequenceNumber
//     ? lastAgent.sequenceNumber + 1
//     : 1;
// };

// agentSchema.statics.moveAgentSequence = async function (
//   agentId,
//   targetPosition
// ) {
//   const session = await mongoose.startSession();

//   try {
//     await session.withTransaction(async () => {
//       const agent = await this.findOne({ agentId }).session(session);
//       if (!agent) {
//         throw new Error("Agent not found");
//       }

//       const currentPosition = agent.sequenceNumber;
//       if (!currentPosition) {
//         throw new Error("Agent has no sequence number");
//       }

//       if (currentPosition === targetPosition) {
//         return;
//       }

//       // Validate target position
//       const maxSequence = await this.countDocuments({
//         sequenceNumber: { $exists: true, $ne: null },
//       }).session(session);

//       if (targetPosition < 1 || targetPosition > maxSequence) {
//         throw new Error(
//           `Invalid target position. Must be between 1 and ${maxSequence}`
//         );
//       }

//       // Shift agents
//       if (currentPosition < targetPosition) {
//         await this.updateMany(
//           {
//             sequenceNumber: {
//               $gt: currentPosition,
//               $lte: targetPosition,
//             },
//           },
//           {
//             $inc: { sequenceNumber: -1 },
//             $set: { lastUpdated: new Date() },
//           }
//         ).session(session);
//       } else {
//         await this.updateMany(
//           {
//             sequenceNumber: {
//               $gte: targetPosition,
//               $lt: currentPosition,
//             },
//           },
//           {
//             $inc: { sequenceNumber: 1 },
//             $set: { lastUpdated: new Date() },
//           }
//         ).session(session);
//       }

//       // Update target agent
//       await this.updateOne(
//         { agentId },
//         {
//           $set: {
//             sequenceNumber: targetPosition,
//             lastUpdated: new Date(),
//           },
//         }
//       ).session(session);
//     });

//     console.log(`✅ Moved agent ${agentId} to position ${targetPosition}`);
//   } catch (error) {
//     console.error("Error moving agent sequence:", error);
//     throw error;
//   } finally {
//     await session.endSession();
//   }
// };

// agentSchema.statics.reorderAllSequences = async function () {
//   const session = await mongoose.startSession();

//   try {
//     await session.withTransaction(async () => {
//       const agents = await this.find(
//         { sequenceNumber: { $exists: true } },
//         { agentId: 1, sequenceNumber: 1 }
//       )
//         .sort({ sequenceNumber: 1 })
//         .session(session);

//       for (let i = 0; i < agents.length; i++) {
//         const newSequence = i + 1;
//         if (agents[i].sequenceNumber !== newSequence) {
//           await this.updateOne(
//             { agentId: agents[i].agentId },
//             {
//               $set: {
//                 sequenceNumber: newSequence,
//                 lastUpdated: new Date(),
//               },
//             }
//           ).session(session);
//         }
//       }
//     });

//     console.log(`✅ Reordered ${agents.length} agent sequences`);
//   } catch (error) {
//     console.error("Error reordering sequences:", error);
//     throw error;
//   } finally {
//     await session.endSession();
//   }
// };

// // ——— NEW: Leaderboard Management Methods ———
// agentSchema.methods.updateLeaderboardMetrics = function (metrics) {
//   if (!this.leaderboard) {
//     this.leaderboard = {
//       propertiesSold: 0,
//       totalCommission: 0,
//       viewings: 0,
//       offers: 0,
//     };
//   }

//   if (metrics.propertiesSold !== undefined) {
//     this.leaderboard.propertiesSold = metrics.propertiesSold;
//   }
//   if (metrics.totalCommission !== undefined) {
//     this.leaderboard.totalCommission = metrics.totalCommission;
//   }
//   if (metrics.viewings !== undefined) {
//     this.leaderboard.viewings = metrics.viewings;
//   }
//   if (metrics.offers !== undefined) {
//     this.leaderboard.offers = metrics.offers;
//   }

//   this.leaderboard.lastUpdated = new Date();
//   this.lastUpdated = new Date();
//   return this;
// };

// agentSchema.methods.incrementLeaderboardMetric = function (metric, value = 1) {
//   if (!this.leaderboard) {
//     this.leaderboard = {
//       propertiesSold: 0,
//       totalCommission: 0,
//       viewings: 0,
//       offers: 0,
//     };
//   }

//   const validMetrics = [
//     "propertiesSold",
//     "totalCommission",
//     "viewings",
//     "offers",
//   ];
//   if (!validMetrics.includes(metric)) {
//     throw new Error(
//       `Invalid metric: ${metric}. Must be one of: ${validMetrics.join(", ")}`
//     );
//   }

//   this.leaderboard[metric] += value;
//   this.leaderboard.lastUpdated = new Date();
//   this.lastUpdated = new Date();
//   return this;
// };

// agentSchema.methods.resetLeaderboardMetrics = function () {
//   this.leaderboard = {
//     propertiesSold: 0,
//     totalCommission: 0,
//     viewings: 0,
//     offers: 0,
//     lastUpdated: new Date(),
//   };
//   this.lastUpdated = new Date();
//   return this;
// };

// // ——— NEW: Leaderboard Static Methods ———
// agentSchema.statics.getLeaderboard = function (options = {}) {
//   const {
//     sortBy = "propertiesSold", // Default sort by properties sold
//     limit = 10,
//     includeInactive = false,
//   } = options;

//   const matchStage = includeInactive ? {} : { isActive: true };

//   const sortField = `leaderboard.${sortBy}`;
//   const sortStage = { [sortField]: -1 };

//   return this.aggregate([
//     { $match: matchStage },
//     {
//       $project: {
//         agentId: 1,
//         agentName: 1,
//         designation: 1,
//         email: 1,
//         phone: 1,
//         imageUrl: 1,
//         specialistAreas: 1,
//         leaderboard: 1,
//         sequenceNumber: 1,
//         isActive: 1,
//       },
//     },
//     { $sort: sortStage },
//     { $limit: limit },
//   ]);
// };

// agentSchema.statics.getTopPerformersByMetric = function (metric, limit = 5) {
//   const validMetrics = [
//     "propertiesSold",
//     "totalCommission",
//     "viewings",
//     "offers",
//   ];
//   if (!validMetrics.includes(metric)) {
//     throw new Error(
//       `Invalid metric: ${metric}. Must be one of: ${validMetrics.join(", ")}`
//     );
//   }

//   const sortField = `leaderboard.${metric}`;
//   return this.aggregate([
//     { $match: { isActive: true } },
//     {
//       $project: {
//         agentId: 1,
//         agentName: 1,
//         designation: 1,
//         imageUrl: 1,
//         [`leaderboard.${metric}`]: 1,
//       },
//     },
//     { $sort: { [sortField]: -1 } },
//     { $limit: limit },
//   ]);
// };

// agentSchema.statics.getLeaderboardStats = function () {
//   return this.aggregate([
//     { $match: { isActive: true } },
//     {
//       $group: {
//         _id: null,
//         totalPropertiesSold: { $sum: "$leaderboard.propertiesSold" },
//         totalCommission: { $sum: "$leaderboard.totalCommission" },
//         totalViewings: { $sum: "$leaderboard.viewings" },
//         totalOffers: { $sum: "$leaderboard.offers" },
//         avgPropertiesSold: { $avg: "$leaderboard.propertiesSold" },
//         avgCommission: { $avg: "$leaderboard.totalCommission" },
//         avgViewings: { $avg: "$leaderboard.viewings" },
//         avgOffers: { $avg: "$leaderboard.offers" },
//         totalAgents: { $sum: 1 },
//       },
//     },
//   ]);
// };

// // ——— Property management methods ———
// agentSchema.methods.addOrUpdateProperty = function (propertyData) {
//   if (!this.properties) {
//     this.properties = [];
//   }

//   const existingPropertyIndex = this.properties.findIndex(
//     (p) => p.propertyId === propertyData.propertyId
//   );

//   if (existingPropertyIndex > -1) {
//     this.properties[existingPropertyIndex] = {
//       ...this.properties[existingPropertyIndex].toObject(),
//       ...propertyData,
//       lastUpdated: new Date(),
//     };
//   } else {
//     this.properties.push({
//       ...propertyData,
//       addedDate: new Date(),
//       lastUpdated: new Date(),
//     });
//   }

//   this.activeSaleListings = this.properties.filter(
//     (p) => p.listingType === "Sale" && p.status !== "Off Market"
//   ).length;

//   this.lastUpdated = new Date();
//   return this;
// };

// agentSchema.methods.removeProperty = function (propertyId) {
//   if (!this.properties) return false;

//   const initialLength = this.properties.length;
//   this.properties = this.properties.filter((p) => p.propertyId !== propertyId);

//   if (this.properties.length < initialLength) {
//     this.activeSaleListings = this.properties.filter(
//       (p) => p.listingType === "Sale" && p.status !== "Off Market"
//     ).length;

//     this.lastUpdated = new Date();
//     return true;
//   }
//   return false;
// };

// // ——— Blog management methods ———
// agentSchema.methods.addOrUpdateBlog = function (blogData) {
//   if (!this.blogs) {
//     this.blogs = [];
//   }

//   const existingBlogIndex = this.blogs.findIndex(
//     (b) => b.blogId.toString() === blogData.blogId.toString()
//   );

//   if (existingBlogIndex > -1) {
//     // Update existing blog - EXPLICITLY set all fields including image
//     this.blogs[existingBlogIndex].blogId = blogData.blogId;
//     this.blogs[existingBlogIndex].title = blogData.title;
//     this.blogs[existingBlogIndex].slug = blogData.slug;
//     this.blogs[existingBlogIndex].image = blogData.image;
//     this.blogs[existingBlogIndex].isPublished = blogData.isPublished;
//     this.blogs[existingBlogIndex].publishedAt = blogData.publishedAt;
//     this.blogs[existingBlogIndex].createdAt =
//       blogData.createdAt || this.blogs[existingBlogIndex].createdAt;
//     this.blogs[existingBlogIndex].updatedAt = new Date();

//     console.log(
//       `✅ Updated existing blog: ${blogData.title} with image: ${blogData.image?.filename}`
//     );
//   } else {
//     // Add new blog - EXPLICITLY create the blog object with image
//     const newBlogEntry = {
//       blogId: blogData.blogId,
//       title: blogData.title,
//       slug: blogData.slug,
//       image: blogData.image,
//       isPublished: blogData.isPublished,
//       publishedAt: blogData.publishedAt,
//       createdAt: blogData.createdAt || new Date(),
//       updatedAt: new Date(),
//     };

//     this.blogs.push(newBlogEntry);
//     console.log(
//       `✅ Added new blog: ${blogData.title} with image: ${blogData.image?.filename}`
//     );
//   }

//   this.lastUpdated = new Date();
//   return this;
// };

// agentSchema.methods.removeBlog = function (blogId) {
//   if (!this.blogs) return false;

//   const initialLength = this.blogs.length;
//   this.blogs = this.blogs.filter(
//     (b) => b.blogId.toString() !== blogId.toString()
//   );

//   if (this.blogs.length < initialLength) {
//     this.lastUpdated = new Date();
//     console.log(`✅ Removed blog with ID: ${blogId}`);
//     return true;
//   }
//   return false;
// };

// agentSchema.methods.getBlogById = function (blogId) {
//   if (!this.blogs) return null;
//   return this.blogs.find((b) => b.blogId.toString() === blogId.toString());
// };

// agentSchema.methods.getPublishedBlogs = function () {
//   if (!this.blogs) return [];
//   return this.blogs.filter((b) => b.isPublished);
// };

// agentSchema.methods.getDraftBlogs = function () {
//   if (!this.blogs) return [];
//   return this.blogs.filter((b) => !b.isPublished);
// };

// // ——— Property helper methods ———
// agentSchema.methods.getPropertiesByType = function (listingType) {
//   if (!this.properties) return [];
//   return this.properties.filter((p) => p.listingType === listingType);
// };

// agentSchema.methods.getActiveProperties = function () {
//   if (!this.properties) return [];
//   return this.properties.filter((p) => p.status !== "Off Market");
// };

// agentSchema.methods.updatePropertyCounts = function () {
//   if (!this.properties) {
//     this.activeSaleListings = 0;
//     return this;
//   }

//   this.activeSaleListings = this.properties.filter(
//     (p) => p.listingType === "Sale" && p.status !== "Off Market"
//   ).length;

//   this.lastUpdated = new Date();
//   return this;
// };

// // ——— Static methods ———
// agentSchema.statics.findByEmail = function (email) {
//   return this.findOne({
//     email: email.toLowerCase().trim(),
//     isActive: true,
//   });
// };

// agentSchema.statics.findActiveAgents = function () {
//   return this.find({ isActive: true }).sort({
//     sequenceNumber: 1,
//     agentName: 1,
//   });
// };

// agentSchema.statics.findBySpecialistArea = function (area) {
//   return this.find({
//     specialistAreas: { $in: [area] },
//     isActive: true,
//   }).sort({ sequenceNumber: 1, agentName: 1 });
// };

// agentSchema.statics.findTopPerformers = function (limit = 10) {
//   return this.aggregate([
//     { $match: { isActive: true } },
//     {
//       $addFields: {
//         totalPropertiesCount: { $size: { $ifNull: ["$properties", []] } },
//         activePropertiesCount: {
//           $size: {
//             $filter: {
//               input: { $ifNull: ["$properties", []] },
//               cond: { $ne: ["$$this.status", "Off Market"] },
//             },
//           },
//         },
//         totalBlogsCount: { $size: { $ifNull: ["$blogs", []] } },
//         publishedBlogsCount: {
//           $size: {
//             $filter: {
//               input: { $ifNull: ["$blogs", []] },
//               cond: { $eq: ["$$this.isPublished", true] },
//             },
//           },
//         },
//       },
//     },
//     {
//       $sort: {
//         sequenceNumber: 1,
//         propertiesSoldLast15Days: -1,
//         totalPropertiesCount: -1,
//         activeSaleListings: -1,
//         publishedBlogsCount: -1,
//       },
//     },
//     { $limit: limit },
//   ]);
// };

// agentSchema.statics.findAgentsWithBlogs = function (limit = 20) {
//   return this.aggregate([
//     { $match: { isActive: true, blogs: { $exists: true, $ne: [] } } },
//     {
//       $addFields: {
//         totalBlogsCount: { $size: "$blogs" },
//         publishedBlogsCount: {
//           $size: {
//             $filter: {
//               input: "$blogs",
//               cond: { $eq: ["$$this.isPublished", true] },
//             },
//           },
//         },
//       },
//     },
//     {
//       $sort: {
//         sequenceNumber: 1,
//         publishedBlogsCount: -1,
//         totalBlogsCount: -1,
//         agentName: 1,
//       },
//     },
//     { $limit: limit },
//     {
//       $project: {
//         agentId: 1,
//         agentName: 1,
//         designation: 1,
//         email: 1,
//         imageUrl: 1,
//         specialistAreas: 1,
//         sequenceNumber: 1,
//         totalBlogsCount: 1,
//         publishedBlogsCount: 1,
//         blogs: 1,
//       },
//     },
//   ]);
// };

// // Middleware
// agentSchema.pre("save", async function (next) {
//   this.lastUpdated = new Date();

//   // Ensure specialist areas are unique
//   if (this.specialistAreas && this.specialistAreas.length > 0) {
//     this.specialistAreas = [...new Set(this.specialistAreas)];
//   }

//   // Auto-assign sequence number for new agents if not provided
//   if (this.isNew && !this.sequenceNumber) {
//     try {
//       this.sequenceNumber = await this.constructor.getNextSequenceNumber();
//     } catch (error) {
//       console.error("Error setting sequence number:", error);
//     }
//   }

//   // Initialize leaderboard for new agents
//   if (this.isNew && !this.leaderboard) {
//     this.leaderboard = {
//       propertiesSold: 0,
//       totalCommission: 0,
//       viewings: 0,
//       offers: 0,
//       lastUpdated: new Date(),
//     };
//   }

//   next();
// });

// agentSchema.pre("findOneAndUpdate", function (next) {
//   this.set({ lastUpdated: new Date() });
//   next();
// });

// module.exports = mongoose.model("Agent", agentSchema);

const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const agentSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      unique: true,
      default: () =>
        `AGENT_${uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase()}`,
      required: true,
    },
    // ——— NEW: Sequence number for ordering agents ———
    sequenceNumber: {
      type: Number,
      unique: true,
      sparse: true, // Allows null values to be non-unique
      min: [1, "Sequence number must be at least 1"],
    },
    agentName: {
      type: String,
      required: [true, "Agent name is required"],
      trim: true,
      maxlength: [100, "Agent name cannot exceed 100 characters"],
    },
    // Add this field in your agentSchema, after isActive field
    superAgent: {
      type: Boolean,
      default: false,
      required: [true, "Super agent status is required"],
      // index: true,
    },
    agentLanguage: {
      type: String,
      // required: [true, 'Agent Lang is required'],
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [50, "Designation cannot exceed 50 characters"],
    },
    reraNumber: {
      type: String,
      // required: [true, 'RERA number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    specialistAreas: {
      type: [String],
      default: [],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    activeSaleListings: {
      type: Number,
      default: 0,
      min: [0, "Active sale listings cannot be negative"],
    },
    propertiesSoldLast15Days: {
      type: Number,
      default: 0,
      min: [0, "Properties sold cannot be negative"],
    },
    description: {
      type: String,
      trim: true,
      // maxlength: [500, 'Description cannot exceed 500 characters']
    },

    // ——— NEW: Leaderboard Performance Metrics ———
    leaderboard: {
      propertiesSold: {
        type: Number,
        default: 0,
        min: [0, "Properties sold cannot be negative"],
      },
      totalCommission: {
        type: Number,
        default: 0,
        min: [0, "Total commission cannot be negative"],
      },
      viewings: {
        type: Number,
        default: 0,
        min: [0, "Viewings cannot be negative"],
      },
      offers: {
        type: Number,
        default: 0,
        min: [0, "Offers cannot be negative"],
      },

      // ✅ Persist YTD last deal info
      lastDealDate: { type: Date, default: null },
      lastDealDays: {
        type: Number,
        default: null,
        min: [0, "Days cannot be negative"],
      },

      activePropertiesThisMonth: {
        type: Number,
        default: 0,
        min: [0, "Active properties this month cannot be negative"],
      },
      lastUpdated: { type: Date, default: Date.now },
    },

    // ——— Properties linked from XML parser ———
    properties: [
      {
        propertyId: {
          type: String,
          required: true,
        },
        listingTitle: {
          type: String,
          default: "",
          trim: true,
        },
        listingType: {
          type: String,
          enum: ["Sale", "Rent", "Off Plan"],
          required: true,
        },
        propertyType: {
          type: String,
          default: "Unknown",
          trim: true,
        },
        price: {
          type: String,
          default: "0",
        },
        currency: {
          type: String,
          default: "AED",
        },
        status: {
          type: String,
          default: "Active",
          trim: true,
        },
        bedrooms: {
          type: String,
          default: "0",
        },
        bathrooms: {
          type: String,
          default: "0",
        },
        area: {
          type: String,
          default: "0",
        },
        location: {
          city: {
            type: String,
            default: "",
            trim: true,
          },
          address: {
            type: String,
            default: "",
            trim: true,
          },
          community: {
            type: String,
            default: "",
            trim: true,
          },
          building: {
            type: String,
            default: "",
            trim: true,
          },
        },
        images: [
          {
            title: {
              type: String,
              trim: true,
            },
            url: {
              type: String,
              trim: true,
            },
          },
        ],
        description: {
          type: String,
          default: "",
          trim: true,
        },
        addedDate: {
          type: Date,
          default: null, // never auto-stamp; we want the source-listing moment only
        },
        lastUpdated: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ——— Blogs linked to this agent ———
    blogs: [
      {
        blogId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Blog",
          required: true,
        },
        title: {
          type: String,
          required: true,
          trim: true,
        },
        slug: {
          type: String,
          trim: true,
        },
        // Image field for blog
        image: {
          filename: {
            type: String,
            required: [true, "Image filename is required"],
          },
          originalName: String,
          mimetype: String,
          size: Number,
          path: String,
        },
        isPublished: {
          type: Boolean,
          default: false,
        },
        publishedAt: {
          type: Date,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    registeredDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
agentSchema.index({ "properties.propertyId": 1 });
agentSchema.index({ specialistAreas: 1 });
agentSchema.index({ "blogs.blogId": 1 });
agentSchema.index({ sequenceNumber: 1 }); // Index for sequence number
agentSchema.index({ "leaderboard.propertiesSold": -1 }); // Index for leaderboard sorting
agentSchema.index({ "leaderboard.totalCommission": -1 }); // Index for leaderboard sorting

// ——— Virtual fields for property counts ———
agentSchema.virtual("totalProperties").get(function () {
  return this.properties ? this.properties.length : 0;
});

agentSchema.virtual("activeProperties").get(function () {
  return this.properties
    ? this.properties.filter((p) => p.status !== "Off Market").length
    : 0;
});

agentSchema.virtual("saleProperties").get(function () {
  return this.properties
    ? this.properties.filter((p) => p.listingType === "Sale").length
    : 0;
});
agentSchema.methods.calculateActivePropertiesThisMonth = function () {
  if (!this.properties || this.properties.length === 0) {
    return 0;
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  const propertiesThisMonth = this.properties.filter((property) => {
    if (property.status !== "Live") return false;
    const d = property.addedDate ? new Date(property.addedDate) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return (
      d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth
    );
  });
  return propertiesThisMonth.length;
};

agentSchema.virtual("rentProperties").get(function () {
  return this.properties
    ? this.properties.filter((p) => p.listingType === "Rent").length
    : 0;
});

agentSchema.virtual("offPlanProperties").get(function () {
  return this.properties
    ? this.properties.filter((p) => p.listingType === "Off Plan").length
    : 0;
});

// ——— Virtual fields for blog counts ———
agentSchema.virtual("totalBlogs").get(function () {
  return this.blogs ? this.blogs.length : 0;
});

agentSchema.virtual("publishedBlogs").get(function () {
  return this.blogs ? this.blogs.filter((b) => b.isPublished).length : 0;
});

agentSchema.virtual("draftBlogs").get(function () {
  return this.blogs ? this.blogs.filter((b) => !b.isPublished).length : 0;
});

// ——— NEW: Sequence number management methods ———
agentSchema.statics.getNextSequenceNumber = async function () {
  const lastAgent = await this.findOne(
    {},
    {},
    { sort: { sequenceNumber: -1 } }
  );
  return lastAgent && lastAgent.sequenceNumber
    ? lastAgent.sequenceNumber + 1
    : 1;
};

agentSchema.statics.moveAgentSequence = async function (
  agentId,
  targetPosition
) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const agent = await this.findOne({ agentId }).session(session);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const currentPosition = agent.sequenceNumber;
      if (!currentPosition) {
        throw new Error("Agent has no sequence number");
      }

      if (currentPosition === targetPosition) {
        return;
      }

      // Validate target position
      const maxSequence = await this.countDocuments({
        sequenceNumber: { $exists: true, $ne: null },
      }).session(session);

      if (targetPosition < 1 || targetPosition > maxSequence) {
        throw new Error(
          `Invalid target position. Must be between 1 and ${maxSequence}`
        );
      }

      // Shift agents
      if (currentPosition < targetPosition) {
        await this.updateMany(
          {
            sequenceNumber: {
              $gt: currentPosition,
              $lte: targetPosition,
            },
          },
          {
            $inc: { sequenceNumber: -1 },
            $set: { lastUpdated: new Date() },
          }
        ).session(session);
      } else {
        await this.updateMany(
          {
            sequenceNumber: {
              $gte: targetPosition,
              $lt: currentPosition,
            },
          },
          {
            $inc: { sequenceNumber: 1 },
            $set: { lastUpdated: new Date() },
          }
        ).session(session);
      }

      // Update target agent
      await this.updateOne(
        { agentId },
        {
          $set: {
            sequenceNumber: targetPosition,
            lastUpdated: new Date(),
          },
        }
      ).session(session);
    });

    console.log(`✅ Moved agent ${agentId} to position ${targetPosition}`);
  } catch (error) {
    console.error("Error moving agent sequence:", error);
    throw error;
  } finally {
    await session.endSession();
  }
};

agentSchema.statics.reorderAllSequences = async function () {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const agents = await this.find(
        { sequenceNumber: { $exists: true } },
        { agentId: 1, sequenceNumber: 1 }
      )
        .sort({ sequenceNumber: 1 })
        .session(session);

      for (let i = 0; i < agents.length; i++) {
        const newSequence = i + 1;
        if (agents[i].sequenceNumber !== newSequence) {
          await this.updateOne(
            { agentId: agents[i].agentId },
            {
              $set: {
                sequenceNumber: newSequence,
                lastUpdated: new Date(),
              },
            }
          ).session(session);
        }
      }
    });

    // console.log(`✅ Reordered ${agents.length} agent sequences`);
  } catch (error) {
    console.error("Error reordering sequences:", error);
    throw error;
  } finally {
    await session.endSession();
  }
};

// ——— NEW: Leaderboard Management Methods ———
agentSchema.methods.updateLeaderboardMetrics = function (metrics = {}) {
  if (!this.leaderboard) this.leaderboard = {};

  const assignNum = (k) => {
    if (metrics[k] !== undefined) {
      // force Mongoose change tracking on nested path
      this.set(`leaderboard.${k}`, Number(metrics[k]) || 0);
    }
  };

  [
    "propertiesSold",
    "totalCommission",
    "viewings",
    "offers",
    "activePropertiesThisMonth",
    "lastDealDate",
    "lastDealDays",
  ].forEach(assignNum);

  this.set("leaderboard.lastUpdated", new Date());
  this.set("lastUpdated", new Date());

  // ✅ ensure persistence for plain nested object
  this.markModified("leaderboard");
  return this;
};

agentSchema.methods.incrementLeaderboardMetric = function (metric, value = 1) {
  if (!this.leaderboard) {
    this.leaderboard = {
      propertiesSold: 0,
      totalCommission: 0,
      viewings: 0,
      offers: 0,
    };
  }

  const validMetrics = [
    "propertiesSold",
    "totalCommission",
    "viewings",
    "offers",
  ];
  if (!validMetrics.includes(metric)) {
    throw new Error(
      `Invalid metric: ${metric}. Must be one of: ${validMetrics.join(", ")}`
    );
  }

  this.leaderboard[metric] += value;
  this.leaderboard.lastUpdated = new Date();
  this.lastUpdated = new Date();
  return this;
};
agentSchema.statics.updateAllAgentsMonthlyProperties = async function () {
  try {
    console.log("📊 Updating active properties this month for all agents...");

    const agents = await this.find({ isActive: true });
    const updates = [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    for (const agent of agents) {
      // Calculate active properties added this month
      const count = agent.calculateActivePropertiesThisMonth();

      // Update the leaderboard field
      agent.leaderboard.activePropertiesThisMonth = count;
      agent.leaderboard.lastUpdated = new Date();

      updates.push(agent.save());

      // console.log(
      //   `✅ Agent ${agent.agentName}: ${count} active properties added in ${
      //     currentMonth + 1
      //   }/${currentYear}`
      // );
    }

    await Promise.all(updates);

    console.log(`✅ Updated monthly properties for ${agents.length} agents`);
    return {
      success: true,
      agentsUpdated: agents.length,
      month: currentMonth + 1,
      year: currentYear,
    };
  } catch (error) {
    console.error("❌ Error updating monthly properties:", error);
    throw error;
  }
};

agentSchema.methods.resetLeaderboardMetrics = function () {
  this.leaderboard = {
    propertiesSold: 0,
    totalCommission: 0,
    viewings: 0,
    offers: 0,
    lastUpdated: new Date(),
  };
  this.lastUpdated = new Date();
  return this;
};

// ——— NEW: Leaderboard Static Methods ———
agentSchema.statics.getLeaderboard = function (options = {}) {
  const {
    sortBy = "propertiesSold", // Default sort by properties sold
    limit = 10,
    includeInactive = false,
  } = options;

  const matchStage = includeInactive ? {} : { isActive: true };

  const sortField = `leaderboard.${sortBy}`;
  const sortStage = { [sortField]: -1 };

  return this.aggregate([
    { $match: matchStage },
    {
      $project: {
        agentId: 1,
        agentName: 1,
        designation: 1,
        email: 1,
        phone: 1,
        imageUrl: 1,
        specialistAreas: 1,
        leaderboard: 1,
        sequenceNumber: 1,
        isActive: 1,
      },
    },
    { $sort: sortStage },
    { $limit: limit },
  ]);
};

agentSchema.statics.getTopPerformersByMetric = function (metric, limit = 5) {
  const validMetrics = [
    "propertiesSold",
    "totalCommission",
    "viewings",
    "offers",
  ];
  if (!validMetrics.includes(metric)) {
    throw new Error(
      `Invalid metric: ${metric}. Must be one of: ${validMetrics.join(", ")}`
    );
  }

  const sortField = `leaderboard.${metric}`;
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        agentId: 1,
        agentName: 1,
        designation: 1,
        imageUrl: 1,
        [`leaderboard.${metric}`]: 1,
      },
    },
    { $sort: { [sortField]: -1 } },
    { $limit: limit },
  ]);
};

agentSchema.statics.getLeaderboardStats = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalPropertiesSold: { $sum: "$leaderboard.propertiesSold" },
        totalCommission: { $sum: "$leaderboard.totalCommission" },
        totalViewings: { $sum: "$leaderboard.viewings" },
        totalOffers: { $sum: "$leaderboard.offers" },
        avgPropertiesSold: { $avg: "$leaderboard.propertiesSold" },
        avgCommission: { $avg: "$leaderboard.totalCommission" },
        avgViewings: { $avg: "$leaderboard.viewings" },
        avgOffers: { $avg: "$leaderboard.offers" },
        totalAgents: { $sum: 1 },
      },
    },
  ]);
};

// ——— Property management methods ———
agentSchema.methods.addOrUpdateProperty = function (propertyData) {
  if (!this.properties) this.properties = [];

  const now = new Date();
  const idx = this.properties.findIndex(
    (p) => p.propertyId === propertyData.propertyId
  );

  const incomingAdded = propertyData.addedDate || null; // parsed UTC date from XML
  const incomingAddedStr = propertyData.addedDateString || null;

  if (idx > -1) {
    // UPDATE
    const current = this.properties[idx];
    const currentObj =
      typeof current.toObject === "function" ? current.toObject() : current;

    // Decide the correct addedDate:
    // 1) If current is missing, take incoming.
    // 2) If both exist and current > incoming (i.e., was set to "now"), replace with incoming (source truth).
    // 3) Otherwise keep current.
    let correctedAdded = currentObj.addedDate || incomingAdded || null;
    if (
      currentObj.addedDate &&
      incomingAdded &&
      currentObj.addedDate > incomingAdded
    ) {
      correctedAdded = incomingAdded;
    }

    this.properties[idx] = {
      ...currentObj,
      ...propertyData,
      addedDate: correctedAdded,
      addedDateString: currentObj.addedDateString || incomingAddedStr || null,
      lastUpdated: propertyData.lastUpdated || now,
    };
  } else {
    // CREATE — never fall back to now; if the source is missing we keep null
    this.properties.push({
      ...propertyData,
      addedDate: incomingAdded || null,
      addedDateString: incomingAddedStr || null,
      lastUpdated: propertyData.lastUpdated || now,
    });
  }

  // Recompute active Sale listings
  this.activeSaleListings = (this.properties || []).filter(
    (p) =>
      p?.listingType === "Sale" &&
      String(p?.status || "").toLowerCase() !== "off market"
  ).length;

  this.leaderboard = this.leaderboard || {};
  this.leaderboard.lastUpdated = now;
  this.lastUpdated = now;

  return this;
};

agentSchema.methods.removeProperty = function (propertyId) {
  if (!this.properties) return false;

  const initialLength = this.properties.length;
  this.properties = this.properties.filter((p) => p.propertyId !== propertyId);

  if (this.properties.length < initialLength) {
    this.activeSaleListings = this.properties.filter(
      (p) => p.listingType === "Sale" && p.status !== "Off Market"
    ).length;

    this.lastUpdated = new Date();
    return true;
  }
  return false;
};

// ——— Blog management methods ———
agentSchema.methods.addOrUpdateBlog = function (blogData) {
  if (!this.blogs) {
    this.blogs = [];
  }

  const existingBlogIndex = this.blogs.findIndex(
    (b) => b.blogId.toString() === blogData.blogId.toString()
  );

  if (existingBlogIndex > -1) {
    // Update existing blog - EXPLICITLY set all fields including image
    this.blogs[existingBlogIndex].blogId = blogData.blogId;
    this.blogs[existingBlogIndex].title = blogData.title;
    this.blogs[existingBlogIndex].slug = blogData.slug;
    this.blogs[existingBlogIndex].image = blogData.image;
    this.blogs[existingBlogIndex].isPublished = blogData.isPublished;
    this.blogs[existingBlogIndex].publishedAt = blogData.publishedAt;
    this.blogs[existingBlogIndex].createdAt =
      blogData.createdAt || this.blogs[existingBlogIndex].createdAt;
    this.blogs[existingBlogIndex].updatedAt = new Date();

    console.log(
      `✅ Updated existing blog: ${blogData.title} with image: ${blogData.image?.filename}`
    );
  } else {
    // Add new blog - EXPLICITLY create the blog object with image
    const newBlogEntry = {
      blogId: blogData.blogId,
      title: blogData.title,
      slug: blogData.slug,
      image: blogData.image,
      isPublished: blogData.isPublished,
      publishedAt: blogData.publishedAt,
      createdAt: blogData.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.blogs.push(newBlogEntry);
    console.log(
      `✅ Added new blog: ${blogData.title} with image: ${blogData.image?.filename}`
    );
  }

  this.lastUpdated = new Date();
  return this;
};

agentSchema.methods.removeBlog = function (blogId) {
  if (!this.blogs) return false;

  const initialLength = this.blogs.length;
  this.blogs = this.blogs.filter(
    (b) => b.blogId.toString() !== blogId.toString()
  );

  if (this.blogs.length < initialLength) {
    this.lastUpdated = new Date();
    console.log(`✅ Removed blog with ID: ${blogId}`);
    return true;
  }
  return false;
};

agentSchema.methods.getBlogById = function (blogId) {
  if (!this.blogs) return null;
  return this.blogs.find((b) => b.blogId.toString() === blogId.toString());
};

agentSchema.methods.getPublishedBlogs = function () {
  if (!this.blogs) return [];
  return this.blogs.filter((b) => b.isPublished);
};

agentSchema.methods.getDraftBlogs = function () {
  if (!this.blogs) return [];
  return this.blogs.filter((b) => !b.isPublished);
};

// ——— Property helper methods ———
agentSchema.methods.getPropertiesByType = function (listingType) {
  if (!this.properties) return [];
  return this.properties.filter((p) => p.listingType === listingType);
};

agentSchema.methods.getActiveProperties = function () {
  if (!this.properties) return [];
  return this.properties.filter((p) => p.status !== "Off Market");
};

agentSchema.methods.updatePropertyCounts = function () {
  if (!this.properties) {
    this.activeSaleListings = 0;
    return this;
  }

  this.activeSaleListings = this.properties.filter(
    (p) => p.listingType === "Sale" && p.status !== "Off Market"
  ).length;

  this.lastUpdated = new Date();
  return this;
};

// ——— Static methods ———
agentSchema.statics.findByEmail = function (email) {
  return this.findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
  });
};

agentSchema.statics.findActiveAgents = function () {
  return this.find({ isActive: true }).sort({
    sequenceNumber: 1,
    agentName: 1,
  });
};

agentSchema.statics.findBySpecialistArea = function (area) {
  return this.find({
    specialistAreas: { $in: [area] },
    isActive: true,
  }).sort({ sequenceNumber: 1, agentName: 1 });
};

agentSchema.statics.findTopPerformers = function (limit = 10) {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $addFields: {
        totalPropertiesCount: { $size: { $ifNull: ["$properties", []] } },
        activePropertiesCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$properties", []] },
              cond: { $ne: ["$$this.status", "Off Market"] },
            },
          },
        },
        totalBlogsCount: { $size: { $ifNull: ["$blogs", []] } },
        publishedBlogsCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$blogs", []] },
              cond: { $eq: ["$$this.isPublished", true] },
            },
          },
        },
      },
    },
    {
      $sort: {
        sequenceNumber: 1,
        propertiesSoldLast15Days: -1,
        totalPropertiesCount: -1,
        activeSaleListings: -1,
        publishedBlogsCount: -1,
      },
    },
    { $limit: limit },
  ]);
};

agentSchema.statics.findAgentsWithBlogs = function (limit = 20) {
  return this.aggregate([
    { $match: { isActive: true, blogs: { $exists: true, $ne: [] } } },
    {
      $addFields: {
        totalBlogsCount: { $size: "$blogs" },
        publishedBlogsCount: {
          $size: {
            $filter: {
              input: "$blogs",
              cond: { $eq: ["$$this.isPublished", true] },
            },
          },
        },
      },
    },
    {
      $sort: {
        sequenceNumber: 1,
        publishedBlogsCount: -1,
        totalBlogsCount: -1,
        agentName: 1,
      },
    },
    { $limit: limit },
    {
      $project: {
        agentId: 1,
        agentName: 1,
        designation: 1,
        email: 1,
        imageUrl: 1,
        specialistAreas: 1,
        sequenceNumber: 1,
        totalBlogsCount: 1,
        publishedBlogsCount: 1,
        blogs: 1,
      },
    },
  ]);
};

// Middleware
agentSchema.pre("save", async function (next) {
  this.lastUpdated = new Date();
  if (
    this.leaderboard &&
    this.leaderboard.activePropertiesThisMonth === undefined
  ) {
    this.leaderboard.activePropertiesThisMonth = 0;
  }
  // Ensure specialist areas are unique
  if (this.specialistAreas && this.specialistAreas.length > 0) {
    this.specialistAreas = [...new Set(this.specialistAreas)];
  }

  // Auto-assign sequence number for new agents if not provided
  if (this.isNew && !this.sequenceNumber) {
    try {
      this.sequenceNumber = await this.constructor.getNextSequenceNumber();
    } catch (error) {
      console.error("Error setting sequence number:", error);
    }
  }

  // Initialize leaderboard for new agents
  if (this.isNew && !this.leaderboard) {
    this.leaderboard = {
      propertiesSold: 0,
      totalCommission: 0,
      viewings: 0,
      offers: 0,
      lastUpdated: new Date(),
    };
  }

  next();
});

agentSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

module.exports = mongoose.model("Agent", agentSchema);
