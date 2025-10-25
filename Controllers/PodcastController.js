// const Podcast = require("../Models/PodcastModel");

// // Helper function to get next order number
// const getNextOrderNumber = async () => {
//   const lastPodcast = await Podcast.findOne().sort({ orderNumber: -1 });
//   return lastPodcast ? lastPodcast.orderNumber + 1 : 1;
// };

// const createPodcast = async (req, res) => {
//   try {
//     const { 
//       title, 
//       shortDescription, 
//       detailedDescription,
//       whatsInside,
//       coverPhoto,
//       youtubeUrl, 
//       category, 
//       tags, 
//       orderNumber 
//     } = req.body;

//     // Validate required fields
//     if (!title || !shortDescription || !detailedDescription || !youtubeUrl || !coverPhoto) {
//       return res.status(400).json({
//         success: false,
//         message: "Title, short description, detailed description, cover photo, and YouTube URL are required",
//       });
//     }

//     // Validate whatsInside
//     if (!whatsInside || !Array.isArray(whatsInside) || whatsInside.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "At least one point for 'what's inside' is required",
//       });
//     }

//     // Get next order number if not provided
//     let finalOrderNumber = orderNumber;
//     if (!finalOrderNumber) {
//       finalOrderNumber = await getNextOrderNumber();
//     } else {
//       // Check if order number already exists
//       const existingPodcast = await Podcast.findOne({
//         orderNumber: finalOrderNumber,
//       });
//       if (existingPodcast) {
//         return res.status(400).json({
//           success: false,
//           message: `Order number ${finalOrderNumber} already exists`,
//         });
//       }
//     }

//     const podcastData = {
//       title: title.trim(),
//       shortDescription: shortDescription.trim(),
//       detailedDescription: detailedDescription.trim(),
//       whatsInside: whatsInside.map(point => point.trim()).filter(point => point.length > 0),
//       coverPhoto: coverPhoto.trim(),
//       youtubeUrl: youtubeUrl.trim(),
//       category: category?.trim() || "General",
//       tags: tags || [],
//       orderNumber: finalOrderNumber,
//     };

//     const podcast = new Podcast(podcastData);
//     await podcast.save();

//     res.status(201).json({
//       success: true,
//       message: "Podcast created successfully",
//       data: podcast,
//     });
//   } catch (error) {
//     console.error("Error creating podcast:", error);

//     // Handle validation errors
//     if (error.name === "ValidationError") {
//       const errors = Object.values(error.errors).map((err) => err.message);
//       return res.status(400).json({
//         success: false,
//         message: "Validation error",
//         errors: errors,
//       });
//     }

//     // Handle duplicate key errors
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyValue)[0];
//       return res.status(400).json({
//         success: false,
//         message: `${field} already exists`,
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error creating podcast",
//       error: error.message,
//     });
//   }
// };

// // Get All Podcasts
// const getAllPodcasts = async (req, res) => {
//   try {
//     const filter = {};

//     // Filter by category if provided
//     if (req.query.category) {
//       filter.category = req.query.category;
//     }

//     // Search functionality
//     if (req.query.search) {
//       filter.$or = [
//         { title: { $regex: req.query.search, $options: "i" } },
//         { shortDescription: { $regex: req.query.search, $options: "i" } },
//         { detailedDescription: { $regex: req.query.search, $options: "i" } },
//         { tags: { $in: [new RegExp(req.query.search, "i")] } },
//       ];
//     }

//     // Sort options
//     let sortOption = { orderNumber: 1 }; // Default sort by order number
//     if (req.query.sortBy) {
//       switch (req.query.sortBy) {
//         case "title":
//           sortOption = { title: 1 };
//           break;
//         case "date":
//           sortOption = { createdDate: -1 };
//           break;
//         case "category":
//           sortOption = { category: 1, orderNumber: 1 };
//           break;
//         default:
//           sortOption = { orderNumber: 1 };
//       }
//     }

//     const podcasts = await Podcast.find(filter)
//       .sort(sortOption)
//       .select("-__v");

//     const total = await Podcast.countDocuments(filter);

//     res.status(200).json({
//       success: true,
//       message: "Podcasts retrieved successfully",
//       data: podcasts,
//       total: total,
//     });
//   } catch (error) {
//     console.error("Error fetching podcasts:", error);

//     res.status(500).json({
//       success: false,
//       message: "Error fetching podcasts",
//       error: error.message,
//     });
//   }
// };

// // Get Single Podcast by ID
// const getPodcastById = async (req, res) => {
//   try {
//     const podcastId = req.query.id;
//     console.log(podcastId);
    
//     if (!podcastId.match(/^[0-9a-fA-F]{24}$/)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid podcast ID format",
//       });
//     }

//     const podcast = await Podcast.findById(podcastId).select("-__v");

//     if (!podcast) {
//       return res.status(404).json({
//         success: false,
//         message: "Podcast not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Podcast retrieved successfully",
//       data: podcast,
//     });
//   } catch (error) {
//     console.error("Error fetching podcast:", error);

//     // Handle invalid ObjectId
//     if (error.name === "CastError") {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid podcast ID format",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error fetching podcast",
//       error: error.message,
//     });
//   }
// };

// const updatePodcast = async (req, res) => {
//   try {
//     const { 
//       title, 
//       shortDescription, 
//       detailedDescription,
//       whatsInside,
//       coverPhoto,
//       youtubeUrl, 
//       category, 
//       tags, 
//       orderNumber 
//     } = req.body;
    
//     const podcast = await Podcast.findById(req.query.id);
//     console.log(podcast);
    
//     if (!podcast) {
//       return res.status(404).json({
//         success: false,
//         message: 'Podcast not found'
//       });
//     }
    
//     // Check if new order number conflicts with existing one
//     if (orderNumber && orderNumber !== podcast.orderNumber) {
//       const existingPodcast = await Podcast.findOne({ 
//         orderNumber: orderNumber,
//         _id: { $ne: req.query.id } 
//       });
//       if (existingPodcast) {
//         return res.status(400).json({
//           success: false,
//           message: `Order number ${orderNumber} already exists`
//         });
//       }
//     }
    
//     // Update fields
//     const updateData = {};
//     if (title !== undefined) updateData.title = title.trim();
//     if (shortDescription !== undefined) updateData.shortDescription = shortDescription.trim();
//     if (detailedDescription !== undefined) updateData.detailedDescription = detailedDescription.trim();
//     if (whatsInside !== undefined) {
//       updateData.whatsInside = whatsInside
//         .map(point => point.trim())
//         .filter(point => point.length > 0);
//     }
//     if (coverPhoto !== undefined) updateData.coverPhoto = coverPhoto.trim();
//     if (youtubeUrl !== undefined) updateData.youtubeUrl = youtubeUrl.trim();
//     if (category !== undefined) updateData.category = category.trim();
//     if (tags !== undefined) updateData.tags = tags;
//     if (orderNumber !== undefined) updateData.orderNumber = orderNumber;
    
//     const updatedPodcast = await Podcast.findByIdAndUpdate(
//       req.query.id,
//       updateData,
//       { 
//         new: true, 
//         runValidators: true 
//       }
//     ).select('-__v');
    
//     res.json({
//       success: true,
//       message: 'Podcast updated successfully',
//       data: updatedPodcast
//     });
//   } catch (error) {
//     console.error('Error updating podcast:', error);
    
//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       const errors = Object.values(error.errors).map(err => err.message);
//       return res.status(400).json({
//         success: false,
//         message: 'Validation error',
//         errors: errors
//       });
//     }
    
//     // Handle invalid ObjectId
//     if (error.name === 'CastError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid podcast ID format'
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       message: 'Error updating podcast',
//       error: error.message
//     });
//   }
// };

// const deletePodcast = async (req, res) => {
//   try {
//     const podcast = await Podcast.findById(req.query.id);
    
//     if (!podcast) {
//       return res.status(404).json({
//         success: false,
//         message: 'Podcast not found'
//       });
//     }
    
//     await Podcast.findByIdAndDelete(req.query.id);
    
//     res.json({
//       success: true,
//       message: 'Podcast deleted successfully',
//       data: {
//         deletedPodcast: {
//           _id: podcast._id,
//           title: podcast.title,
//           orderNumber: podcast.orderNumber
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error deleting podcast:', error);
    
//     // Handle invalid ObjectId
//     if (error.name === 'CastError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid podcast ID format'
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting podcast',
//       error: error.message
//     });
//   }
// };

// module.exports = {
//   createPodcast,
//   getAllPodcasts,
//   getPodcastById,
//   updatePodcast,
//   deletePodcast
// };



const Podcast = require("../Models/PodcastModel");

// Helper function to get next order number
const getNextOrderNumber = async () => {
  const lastPodcast = await Podcast.findOne().sort({ orderNumber: -1 });
  return lastPodcast ? lastPodcast.orderNumber + 1 : 1;
};

// Helper function to normalize tags
const normalizeTags = (tags) => {
  if (!tags || !Array.isArray(tags)) return [];
  return [...new Set(tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0))];
};

const createPodcast = async (req, res) => {
  try {
    const { 
      title, 
      shortDescription, 
      detailedDescription,
      whatsInside,
      coverPhoto,
      youtubeUrl, 
      category, 
      tags, 
      orderNumber 
    } = req.body;

    // Validate required fields
    if (!title || !shortDescription || !detailedDescription || !youtubeUrl || !coverPhoto) {
      return res.status(400).json({
        success: false,
        message: "Title, short description, detailed description, cover photo, and YouTube URL are required",
      });
    }

    // Validate whatsInside
    if (!whatsInside || !Array.isArray(whatsInside) || whatsInside.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one point for 'what's inside' is required",
      });
    }

    // Get next order number if not provided
    let finalOrderNumber = orderNumber;
    if (!finalOrderNumber) {
      finalOrderNumber = await getNextOrderNumber();
    } else {
      // Check if order number already exists
      const existingPodcast = await Podcast.findOne({
        orderNumber: finalOrderNumber,
      });
      if (existingPodcast) {
        return res.status(400).json({
          success: false,
          message: `Order number ${finalOrderNumber} already exists`,
        });
      }
    }

    // Normalize tags (trim, lowercase, remove duplicates)
    const normalizedTags = normalizeTags(tags);

    const podcastData = {
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      detailedDescription: detailedDescription.trim(),
      whatsInside: whatsInside.map(point => point.trim()).filter(point => point.length > 0),
      coverPhoto: coverPhoto.trim(),
      youtubeUrl: youtubeUrl.trim(),
      category: category?.trim() || "General",
      tags: normalizedTags,
      orderNumber: finalOrderNumber,
    };

    const podcast = new Podcast(podcastData);
    await podcast.save();

    res.status(201).json({
      success: true,
      message: "Podcast created successfully",
      data: podcast,
    });
  } catch (error) {
    console.error("Error creating podcast:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating podcast",
      error: error.message,
    });
  }
};

// Get All Podcasts
const getAllPodcasts = async (req, res) => {
  try {
    const filter = {};

    // Filter by category if provided
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Search functionality
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { shortDescription: { $regex: req.query.search, $options: "i" } },
        { detailedDescription: { $regex: req.query.search, $options: "i" } },
        { tags: { $in: [new RegExp(req.query.search, "i")] } },
      ];
    }

    // Sort options
    let sortOption = { orderNumber: 1 }; // Default sort by order number
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case "title":
          sortOption = { title: 1 };
          break;
        case "date":
          sortOption = { createdDate: -1 };
          break;
        case "category":
          sortOption = { category: 1, orderNumber: 1 };
          break;
        default:
          sortOption = { orderNumber: 1 };
      }
    }

    const podcasts = await Podcast.find(filter)
      .sort(sortOption)
      .select("-__v");

    const total = await Podcast.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Podcasts retrieved successfully",
      data: podcasts,
      total: total,
    });
  } catch (error) {
    console.error("Error fetching podcasts:", error);

    res.status(500).json({
      success: false,
      message: "Error fetching podcasts",
      error: error.message,
    });
  }
};

// Get Single Podcast by ID
const getPodcastById = async (req, res) => {
  try {
    const podcastId = req.query.id;
    console.log(podcastId);
    
    if (!podcastId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid podcast ID format",
      });
    }

    const podcast = await Podcast.findById(podcastId).select("-__v");

    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: "Podcast not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Podcast retrieved successfully",
      data: podcast,
    });
  } catch (error) {
    console.error("Error fetching podcast:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid podcast ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching podcast",
      error: error.message,
    });
  }
};

// NEW: Get Podcasts by Tags
const getPodcastsByTags = async (req, res) => {
  try {
    const { tags } = req.query;

    // Validate tags parameter
    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags parameter is required. Pass tags as comma-separated values (e.g., ?tags=tech,ai,coding)",
      });
    }

    // Parse tags (support both comma-separated string and array)
    let tagArray;
    if (typeof tags === 'string') {
      tagArray = tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    } else if (Array.isArray(tags)) {
      tagArray = tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid tags format. Pass tags as comma-separated values or array",
      });
    }

    if (tagArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid tag is required",
      });
    }

    // Find podcasts that contain ANY of the provided tags
    const podcasts = await Podcast.find({
      tags: { $in: tagArray }
    })
    .sort({ orderNumber: 1 })
    .select("-__v");

    // Optional: Find podcasts that contain ALL of the provided tags (commented out)
    // const podcasts = await Podcast.find({
    //   tags: { $all: tagArray }
    // })
    // .sort({ orderNumber: 1 })
    // .select("-__v");

    res.status(200).json({
      success: true,
      message: `Found ${podcasts.length} podcast(s) matching the tags`,
      searchedTags: tagArray,
      data: podcasts,
      total: podcasts.length,
    });
  } catch (error) {
    console.error("Error fetching podcasts by tags:", error);

    res.status(500).json({
      success: false,
      message: "Error fetching podcasts by tags",
      error: error.message,
    });
  }
};

// NEW: Get All Unique Tags
const getAllTags = async (req, res) => {
  try {
    // Get all unique tags from all podcasts
    const tags = await Podcast.distinct("tags");

    // Sort tags alphabetically
    const sortedTags = tags.sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      success: true,
      message: "Tags retrieved successfully",
      data: sortedTags,
      total: sortedTags.length,
    });
  } catch (error) {
    console.error("Error fetching tags:", error);

    res.status(500).json({
      success: false,
      message: "Error fetching tags",
      error: error.message,
    });
  }
};

const updatePodcast = async (req, res) => {
  try {
    const { 
      title, 
      shortDescription, 
      detailedDescription,
      whatsInside,
      coverPhoto,
      youtubeUrl, 
      category, 
      tags, 
      orderNumber 
    } = req.body;
    
    const podcast = await Podcast.findById(req.query.id);
    console.log(podcast);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    // Check if new order number conflicts with existing one
    if (orderNumber && orderNumber !== podcast.orderNumber) {
      const existingPodcast = await Podcast.findOne({ 
        orderNumber: orderNumber,
        _id: { $ne: req.query.id } 
      });
      if (existingPodcast) {
        return res.status(400).json({
          success: false,
          message: `Order number ${orderNumber} already exists`
        });
      }
    }
    
    // Update fields
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription.trim();
    if (detailedDescription !== undefined) updateData.detailedDescription = detailedDescription.trim();
    if (whatsInside !== undefined) {
      updateData.whatsInside = whatsInside
        .map(point => point.trim())
        .filter(point => point.length > 0);
    }
    if (coverPhoto !== undefined) updateData.coverPhoto = coverPhoto.trim();
    if (youtubeUrl !== undefined) updateData.youtubeUrl = youtubeUrl.trim();
    if (category !== undefined) updateData.category = category.trim();
    
    // Handle tags update with normalization
    if (tags !== undefined) {
      updateData.tags = normalizeTags(tags);
    }
    
    if (orderNumber !== undefined) updateData.orderNumber = orderNumber;
    
    const updatedPodcast = await Podcast.findByIdAndUpdate(
      req.query.id,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-__v');
    
    res.json({
      success: true,
      message: 'Podcast updated successfully',
      data: updatedPodcast
    });
  } catch (error) {
    console.error('Error updating podcast:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid podcast ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating podcast',
      error: error.message
    });
  }
};

const deletePodcast = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.query.id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    await Podcast.findByIdAndDelete(req.query.id);
    
    res.json({
      success: true,
      message: 'Podcast deleted successfully',
      data: {
        deletedPodcast: {
          _id: podcast._id,
          title: podcast.title,
          orderNumber: podcast.orderNumber
        }
      }
    });
  } catch (error) {
    console.error('Error deleting podcast:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid podcast ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting podcast',
      error: error.message
    });
  }
};

module.exports = {
  createPodcast,
  getAllPodcasts,
  getPodcastById,
  getPodcastsByTags,
  getAllTags,
  updatePodcast,
  deletePodcast
};