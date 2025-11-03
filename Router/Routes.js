// const getAllProperties = require("../Controllers/allPropertiesController");
const PropertyController = require("../Controllers/allPropertiesController");

// const getSaleProperties = require("../Controllers/salePropertiesController");
// const RentProperties = require("../Controllers/rentPropertiesController");
// const getSingleProperty = require("../Controllers/GetSingleProperty");
const ParseXml = require("../Controllers/XmlParser");
const AllFilter = require("../Controllers/UniversalFilter");
const ListProperty = require("../Controllers/PropertyListing");
// const OffPlanProperties = require("../Controllers/OffplanPropertyController");
const NewOffPlanProperties = require("../Controllers/NewOffplanController");
const ReferProperties = require("../Controllers/ReferPropertyController");
const ContactUs = require("../Controllers/Contact");
const Blogs = require("../Controllers/BlogController");
const News = require("../Controllers/NewsController");
const CommunityGuides = require("../Controllers/CommunityGuideController");
const Podcast = require("../Controllers/PodcastController");
const HeroController = require("../Controllers/HeroContentController");
//

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');


// Import Agent Controller
const AgentController = require("../Controllers/AgentController");

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});



const mainStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});

// Agent storage - separate directory for agent images
const agentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'agent-images', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' }, // Max size
      { quality: 'auto' } // Auto optimize
    ],
    public_id: (req, file) => {
      // Generate unique filename
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      return `agent-${unique}`;
    }
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Agent-specific upload middleware
const agentUpload = multer({
  storage: agentStorage, // Using Cloudinary storage
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// General upload middleware (for blogs, news, hero content, etc.)
const upload = multer({
  storage: mainStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
});
// Hero Content
router.get("/get-hero", HeroController.getHero);
router.post(
  "/add-replace",
  HeroController.upload.single("media"),
  HeroController.addOrReplaceHero
);
router.put(
  "/update",
  HeroController.upload.single("media"),
  HeroController.updateHero
);

// Contact us
router.post("/Contact", ContactUs.createContact);
router.get("/GetContact", ContactUs.getContacts);
router.get("/DeleteContact", ContactUs.deleteContact);

// Properties Api's
// router.get("/all-properties", PropertyController.getAllProperties);
// router.get("/sale-properties", getSaleProperties);
// router.get("/rent-properties", RentProperties.getRentProperties);

// Offplan Property Api's
// router.get("/offplan-property", OffPlanProperties.GetOffPlanProperties);
router.get("/single-property", PropertyController);

// New API for offplan properties
router.get(
  "/save-offplan-property",
  NewOffPlanProperties.fetchAndSaveProperties
);
router.get(
  "/get-offplan-property",
  NewOffPlanProperties.getNewOffPlanProperties
);
router.get(
  "/get-offplan-single-property",
  NewOffPlanProperties.getSIngleOffplanProperty
);
router.get(
  "/offplanfilterbydeveloper",
  NewOffPlanProperties.FilterDeveloperOffplanProperty
);
router.get("/offplanminprice", NewOffPlanProperties.filterByMinPrice);
router.get("/offplanmaxprice", NewOffPlanProperties.filterByMaxPrice);
router.get("/OffPlanLocation", NewOffPlanProperties.OffSearchProperty);
router.get(
  "/OffPlanLocationSuggestion",
  NewOffPlanProperties.getOffPlanAddressSuggestions
);

// Refer Property Api's
router.post("/ReferProperty", ReferProperties.ReferProperty);
router.get("/AllReferelProperties", ReferProperties.GetAllReferal);
router.get("/Track-Refer-Lead", ReferProperties.trackQUery);
router.get("/Update-Refer-Lead", ReferProperties.updateQueryProgress);
router.get("/Delete-Refer-Lead", ReferProperties.deleteQuery);

// Blogs Api's
router.get("/GetBlogs", Blogs.GetAllBlogs);
router.get("/SingleBlog", Blogs.getSingleBlog);
router.get("/DeleteBlog", Blogs.deleteBlog);
router.get("/GetBlogByTag", Blogs.getBlogsByTags);
router.post("/Addblog", Blogs.upload, Blogs.createBlog);
router.put("/UpdateBlog", Blogs.upload, Blogs.updateBlog);

// News Routes
router.get("/GetNews", News.GetAllNews);
router.get("/SingleNews", News.getSingleNews);
router.get("/DeleteNews", News.deleteNews);
router.post("/AddNews", News.upload, News.createNews);
router.post("/UpdateNews", News.upload, News.updateNews);

// Community Guideline
router.get("/GetCommunityGuides", CommunityGuides.getAllCommunityGuides);
router.get("/SingleCommunityGuide", CommunityGuides.getSingleCommunityGuide);
router.get("/DeleteCommunityGuide", CommunityGuides.deleteCommunityGuide);
router.post(
  "/AddCommunityGuide",
  CommunityGuides.uploadMultiple,
  CommunityGuides.createCommunityGuide
);
router.post(
  "/UpdateCommunityGuide",
  CommunityGuides.uploadMultiple,
  CommunityGuides.updateCommunityGuide
);

// Community Guideline Api's
// router.get("/GetCommunityGuides", CommunityGuides.GetAllCommunityGuides);
// router.get("/SingleCommunityGuide", CommunityGuides.getSingleCommunityGuide);
// router.get("/DeleteCommunityGuide", CommunityGuides.deleteCommunityGuide);
// router.post("/AddCommunityGuide", CommunityGuides.upload.single("image"), CommunityGuides.createCommunityGuide);
// router.post("/UpdateCommunityGuide", CommunityGuides.upload.single("image"), CommunityGuides.updateCommunityGuide);

// Podcast Api's
router.post("/CreatePodcast", Podcast.createPodcast);
router.get("/AllPodcasts", Podcast.getAllPodcasts);
router.get("/SinglePodcast", Podcast.getPodcastById);
router.get("/PodcastByTag", Podcast.getPodcastsByTags);
router.post("/UpdatePodcast", Podcast.updatePodcast);
router.get("/DeletePodcast", Podcast.deletePodcast);

// router.get("/SinglePodcast", Podcast.getSinglePodcast);

// Universal filter for All property pages section
// router.get("/Universal-filter", AllFilter.enhancedSpecializedFilter);
// New universal filter

router.get("/Universal-filter", AllFilter.UniversalSpecializedFilter);

router.get("/Sort-Properties", AllFilter.SortProperties);
// router.get("/Location-filter-property", AllFilter.filterByLocation);
router.get("/Similar-property", AllFilter.filterByCommunity);
router.get("/Property-location-suggestions", AllFilter.getAddressSuggestions);

// AGENT API ENDPOINTS
router.post(
  "/register-agents",
  agentUpload.single("imageUrl"),
  AgentController.createAgent
);
// Your route is already correct!
router.post(
  "/update-agent",
  agentUpload.single("image"),  // ✅ Field name matches what frontend sends
  AgentController.updateAgent
);

// Get all agents (with pagination, sorting, etc.)
router.get("/Allagents", AgentController.getAgents);
// router.get("/AllLeaderboardAgents", AgentController.getAgentsForLeaderboard);
router.get("/SequenceAgent", AgentController.getAgentsBySequence);

router.get("/Agent", AgentController.getAgentById);
router.get("/AgentByEmail", AgentController.getAgentByEmail);

router.get("/delete-agent", AgentController.deleteAgent);


// Leaderboard Agent Endpoints for CRONS
router.get("/GetAgentDeals", AgentController.syncAgentDealsFromSalesforce);
router.get("/GetAgentCommissions", AgentController.syncAgentCommissionsFromSalesforce);
router.get("/GetAgentViewings", AgentController.syncAgentViewingsFromSalesforce);
router.get("/GetAgentOffers", AgentController.syncAgentOffersFromSalesforce);
router.post("/SaleforceAuthToken",AgentController.getSalesforceToken)
router.get("/getLeaderboardAgents",AgentController.getLeaderboardAgents)


// Manual Testing
router.post("/ManualSaleforceAuthToken",AgentController.GetSalesForceToken)




// Leaderboard Agent

// Search agents by name or email
// router.get(
//   "/agents/search",
//   AgentController.searchAgents
// );

// Get top performing agents
// router.get(
//   "/agents/top",
//   AgentController.getTopAgents
// );

// Get agent statistics
// router.get(
//   "/agents/statistics",
//   AgentController.getAgentStatistics
// );

// Get specific agent details (by agentId or email)
// router.get(
//   "/agents/:identifier",
//   AgentController.getAgentDetails
// );

// Get an agent's properties (with filters)
// router.get(
//   "/agents/:identifier/properties",
//   AgentController.getAgentProperties
// );

// Update agent (with optional new image)
// router.put(
//   "/agents/:identifier",
//   upload.single("image"),
//   AgentController.updateAgent
// );

// Deactivate (or delete) an agent
// router.delete(
//   "/agents/:identifier",
//   AgentController.deactivateAgent
// );

// GET /api/agents - Get all agents with pagination and sorting
// Query params: page, limit, sortBy, sortOrder
// Example: /api/agents?page=1&limit=20&sortBy=totalProperties&sortOrder=desc
// router.get("/agents", AgentController.getAllAgents);

// GET /api/agents/search - Search agents by name or email
// Query params: query, page, limit
// Example: /api/agents/search?query=john&page=1&limit=10
// router.get("/agents/search", AgentController.searchAgents);

// GET /api/agents/top - Get top performing agents
// Query params: limit, type (total/sale/rent/offplan)
// Example: /api/agents/top?limit=10&type=sale
// router.get("/agents/top", AgentController.getTopAgents);

// GET /api/agents/statistics - Get agent statistics and analytics
// router.get("/agents/statistics", AgentController.getAgentStatistics);

// GET /api/agents/:identifier - Get specific agent details (by ID or email)
// Example: /api/agents/samantha@arabianestates.ae or /api/agents/507f1f77bcf86cd799439011
// router.get("/agents/:identifier", AgentController.getAgentDetails);

// GET /api/agents/:identifier/properties - Get agent's properties with filters
// Query params: listingType, status, minPrice, maxPrice, bedrooms, propertyType, page, limit
// Example: /api/agents/samantha@arabianestates.ae/properties?listingType=Sale&bedrooms=3&page=1&limit=10
// router.get("/agents/:identifier/properties", AgentController.getAgentProperties);

// PUT /api/agents/:identifier - Update agent information
// Body: { firstName, lastName, phone, mobilePhone }
// router.put("/agents/:identifier", AgentController.updateAgent);

// DELETE /api/agents/:identifier - Deactivate agent (soft delete)
// router.delete("/agents/:identifier", AgentController.deactivateAgent);

// ================================
// AGENT UTILITY ENDPOINTS (Optional - for admin use)
// ================================

// You can also add these utility endpoints if you want admin functionality
// Uncomment and add AgentService import at the top if needed

/*
const AgentService = require("../Services/agentService");

// GET /api/agents/admin/cleanup - Clean up orphaned properties
router.get("/agents/admin/cleanup", async (req, res) => {
  try {
    const result = await AgentService.cleanupOrphanedProperties();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/agents/admin/sync - Synchronize agent counts
router.get("/agents/admin/sync", async (req, res) => {
  try {
    const result = await AgentService.synchronizeAgentCounts();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/agents/admin/duplicates - Find duplicate agents
router.get("/agents/admin/duplicates", async (req, res) => {
  try {
    const result = await AgentService.findDuplicateAgents();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/agents/admin/validate - Validate data integrity
router.get("/agents/admin/validate", async (req, res) => {
  try {
    const result = await AgentService.validateDataIntegrity();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/agents/admin/performance - Generate performance report
router.get("/agents/admin/performance", async (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;
    const result = await AgentService.generatePerformanceReport(timeframe);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
*/

// Hero Section filter
// router.get("/All-Hero-filters", AllFilter.specializedFilter);

// Property Listing route (Post Route for listing property)
router.post("/list-property", ListProperty);

// Will Run Cors, main parser route
router.get("/parse-xml", ParseXml);

module.exports = router;
