// Fixed Controller: NewOffplanController.js
const OffPlanProperty = require("../Models/NewOffplanModel");
const axios = require("axios");

// Fetch data from API and save to database
const fetchAndSaveProperties = async (req, res) => {
  try {
    console.log("Starting API fetch process...");

    const baseUrl =
      process.env.AllOffPlanPropertyiesListUrl ||
      "https://search-listings-production.up.railway.app/v1/properties";

    const headers = {
      "X-API-Key": `${process.env.OffPlanApiKey}`,
      Accept: "application/json",
    };

    let page = Number(req.query.page || 1);
    const perPage = Number(req.query.per_page || 12);

    let totalFromAPI = 0;
    let totalProcessed = 0;
    const errors = [];

    while (true) {
      console.log(`Fetching page ${page}...`);
      const { data, status } = await axios.get(baseUrl, {
        headers,
        params: { page, per_page: perPage },
      });

      console.log("API status:", status);

      const apiItems = data?.items || [];
      const pagination = data?.pagination || {};
      totalFromAPI += apiItems.length;

      if (!Array.isArray(apiItems) || apiItems.length === 0) {
        console.log("No items on this page; stopping.");
        break;
      }

      // Prepare bulk ops (upsert by apiId)
      const bulkOps = apiItems.map((item) => {
        // parse lat/lng
        let lat = null,
          lng = null;
        if (item.coordinates) {
          const [a, b] = String(item.coordinates)
            .split(",")
            .map((v) => v.trim());
          lat = a ? parseFloat(a) : null;
          lng = b ? parseFloat(b) : null;
        }

        // parse cover image JSON string
        let coverImage = {};
        try {
          if (item.cover_image_url)
            coverImage = JSON.parse(item.cover_image_url);
        } catch (e) {
          console.warn(
            `cover_image_url parse failed for ${item.name} (ID ${item.id}): ${e.message}`
          );
        }

        const completionDate = item.completion_datetime
          ? new Date(item.completion_datetime)
          : null;

        const doc = {
          apiId: item.id,
          name: item.name,
          area: item.area,
          developer: item.developer,
          coordinates: item.coordinates || "",
          latitude: lat,
          longitude: lng,
          minPrice: item.min_price ?? null,
          maxPrice: item.max_price ?? null,
          minPriceAed: item.min_price_aed ?? null,
          minPricePerAreaUnit: item.min_price_per_area_unit ?? null,
          priceCurrency: item.price_currency || "AED",
          areaUnit: item.area_unit || "sqft",
          status: item.status, // e.g. "Presale"
          saleStatus: item.sale_status, // e.g. "Presale(EOI)"
          completionDate,
          isPartnerProject: !!item.is_partner_project,
          hasEscrow: !!item.has_escrow,
          postHandover: !!item.post_handover,
          coverImage,
        };

        return {
          updateOne: {
            filter: { apiId: item.id },
            update: { $set: doc },
            upsert: true,
          },
        };
      });

      if (bulkOps.length) {
        try {
          const result = await OffPlanProperty.bulkWrite(bulkOps, {
            ordered: false,
          });
          const modified =
            (result.upsertedCount || 0) +
            (result.modifiedCount || 0) +
            (result.matchedCount || 0);
          totalProcessed += modified;
          console.log(
            `Page ${page}: upserts=${result.upsertedCount || 0}, modified=${
              result.modifiedCount || 0
            }`
          );
        } catch (e) {
          console.error("Bulk write error:", e?.message || e);
          errors.push({
            page,
            error: e?.message || String(e),
          });
        }
      }

      if (!pagination?.has_next) {
        console.log("No more pages.");
        break;
      }
      page += 1;
    }

    const totalInDB = await OffPlanProperty.countDocuments();

    return res.status(200).json({
      success: true,
      message: `Sync complete`,
      summary: {
        totalFromAPI,
        totalProcessed,
        totalErrors: errors.length,
        totalInDatabase: totalInDB,
      },
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("❌ Error in fetchAndSaveProperties:", error);
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: `API Error: ${error.response.status} - ${error.response.statusText}`,
        error: error.response.data || error.message,
      });
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return res.status(503).json({
        success: false,
        message: "Unable to connect to API endpoint",
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to fetch and save properties",
      error: error.message,
    });
  }
};

// Get all new off-plan properties with pagination
// controllers/NewOffplanController.js (inside getNewOffPlanProperties)
const getNewOffPlanProperties = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "12", 10);
    const skip = (page - 1) * limit;

    const filterQuery = {};

    if (req.query.area) filterQuery.area = new RegExp(req.query.area, "i");
    if (req.query.developer)
      filterQuery.developer = new RegExp(req.query.developer, "i");
    if (req.query.status) filterQuery.status = req.query.status;
    if (req.query.saleStatus) filterQuery.saleStatus = req.query.saleStatus;

    if (typeof req.query.isPartnerProject !== "undefined") {
      filterQuery.isPartnerProject = req.query.isPartnerProject === "true";
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filterQuery.minPriceAed = {};
      if (req.query.minPrice)
        filterQuery.minPriceAed.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice)
        filterQuery.minPriceAed.$lte = parseFloat(req.query.maxPrice);
    }

    if (req.query.search) {
      const re = new RegExp(req.query.search, "i");
      filterQuery.$or = [{ name: re }, { area: re }, { developer: re }];
    }

    const totalCount = await OffPlanProperty.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const offPlanProperties = await OffPlanProperty.find(filterQuery)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(offPlanProperties.length ? 200 : 404).json({
      success: !!offPlanProperties.length,
      message: offPlanProperties.length
        ? "Off-plan properties fetched successfully"
        : "No off-plan properties found",
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        totalMatchingProperties: totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      count: offPlanProperties.length,
      data: offPlanProperties,
    });
  } catch (error) {
    console.error("Error fetching new off-plan properties:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch off-plan properties",
      error: error.message,
    });
  }
};

const getSIngleOffplanProperty = async (req, res) => {
  const property_id = req.query.property_id;
  try {
    console.log("HELLO");
    const response = await axios.get(
      `${process.env.SingleOffPlanApi}/${property_id}`,
      {
        headers: {
          "X-API-Key": `${process.env.OffPlanApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data);
    return res.status(200).json({
      msg: "Single Property Data Recieved",
      data: response.data,
    });
  } catch (err) {
    console.log(err);
  }
};

const getOffPlanAddressSuggestions = async (req, res) => {
  try {
    const prefix = req.query.prefix;
    const maxSuggestions = parseInt(req.query.limit) || 8;

    // Validation
    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: "Prefix parameter is required",
      });
    }

    if (prefix.length < 2) {
      return res.json({
        success: true,
        message: "Prefix too short for meaningful search",
        data: [],
        count: 0,
        debug: {
          prefix: prefix,
          minLength: 2,
        },
      });
    }

    const query = {
      name: {
        $regex: new RegExp(`\\b${prefix}`, "i"), // Word boundary search, case insensitive
      },
    };

    console.log("MongoDB query:", JSON.stringify(query, null, 2));

    // Find matching off-plan properties
    const properties = await OffPlanProperty.find(query)
      .limit(maxSuggestions * 2) // Get more results to have variety
      .select("name area developer") // Select only needed fields for suggestions
      .lean();

    console.log(
      `Found ${properties.length} off-plan properties matching query`
    );

    // Create suggestions set to avoid duplicates
    const suggestions = new Set();

    // Process each property name
    properties.forEach((property) => {
      if (property.name && property.name.trim()) {
        const projectName = property.name.trim();

        // Check if the project name contains the prefix (case insensitive)
        if (projectName.toLowerCase().includes(prefix.toLowerCase())) {
          suggestions.add(projectName);
        }

        // Stop if we have enough suggestions
        if (suggestions.size >= maxSuggestions) return;
      }
    });

    // Convert to array and sort
    let suggestionsArray = Array.from(suggestions);

    // Sort suggestions for better user experience:
    // 1. Exact matches first
    // 2. Names starting with prefix
    // 3. Names containing prefix
    // 4. Alphabetically within each group
    suggestionsArray.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const prefixLower = prefix.toLowerCase();

      // Check for exact match
      const aExact = aLower === prefixLower;
      const bExact = bLower === prefixLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Check for starts with
      const aStarts = aLower.startsWith(prefixLower);
      const bStarts = bLower.startsWith(prefixLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Check for word boundary match at start
      const aWordStart = aLower.match(new RegExp(`^${prefixLower}\\b`));
      const bWordStart = bLower.match(new RegExp(`^${prefixLower}\\b`));
      if (aWordStart && !bWordStart) return -1;
      if (!aWordStart && bWordStart) return 1;

      // Sort by length (shorter first)
      if (a.length !== b.length) return a.length - b.length;

      // Finally sort alphabetically
      return a.localeCompare(b);
    });

    // Limit to requested number
    suggestionsArray = suggestionsArray.slice(0, maxSuggestions);

    console.log(
      `Returning ${suggestionsArray.length} project name suggestions`
    );

    return res.status(200).json({
      success: true,
      message: `Found ${suggestionsArray.length} off-plan project suggestions for "${prefix}"`,
      count: suggestionsArray.length,
      data: suggestionsArray,
      debug: {
        prefix: prefix,
        totalPropertiesFound: properties.length,
        uniqueSuggestions: suggestionsArray.length,
      },
    });
  } catch (error) {
    console.error("Error in getOffPlanAddressSuggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get off-plan project suggestions",
      error: error.message,
      data: [],
    });
  }
};
// Get current sync status
const getSyncStatus = async (req, res) => {
  try {
    const totalProperties = await OffPlanProperty.countDocuments();
    const recentProperties = await OffPlanProperty.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    });

    const lastUpdated = await OffPlanProperty.findOne()
      .sort({ updatedAt: -1 })
      .select("updatedAt");

    return res.status(200).json({
      success: true,
      message: "Sync status retrieved successfully",
      data: {
        totalProperties,
        recentProperties,
        lastUpdated: lastUpdated?.updatedAt || null,
        apiConfig: {
          baseUrl: process.env.AllOffPlanPropertyiesListUrl || "Not configured",
          hasApiKey: !!process.env.OffPlanApiKey,
          endpoint: "Off-plan properties endpoint",
        },
      },
    });
  } catch (error) {
    console.error("Error getting sync status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get sync status",
      error: error.message,
    });
  }
};

const FilterDeveloperOffplanProperty = async (req, res) => {
  try {
    const { developer } = req.query;
    const { page = 1, limit = 10 } = req.query;

    // console.log("Raw developer parameter:", developer);
    // console.log("Type of developer:", typeof developer);

    // Check if developer parameter exists
    if (!developer) {
      return res.status(400).json({
        success: false,
        message: "Developer parameter is required",
      });
    }

    // Clean the developer parameter (remove extra spaces, decode URL encoding)
    const cleanDeveloper = decodeURIComponent(developer).trim();
    // console.log("Cleaned developer parameter:", cleanDeveloper);

    // Simple exact match filter
    const filter = {
      developer: cleanDeveloper,
    };

    // console.log("MongoDB filter being applied:", JSON.stringify(filter, null, 2));

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // First, let's see what developers actually exist in the database
    const allDevelopers = await OffPlanProperty.distinct("developer");
    console.log("All developers in database:", allDevelopers);

    // Check if the requested developer exists in the list
    const developerExists = allDevelopers.includes(cleanDeveloper);
    console.log("Does requested developer exist?", developerExists);

    // Get total count first (for debugging)
    const totalCount = await OffPlanProperty.countDocuments(filter);
    console.log("Total matching properties:", totalCount);

    // Execute the main query
    const properties = await OffPlanProperty.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log("Found properties count:", properties.length);
    console.log(
      "Sample property developer (if found):",
      properties[0]?.developer
    );

    // Process the properties to match your expected format
    const processedProperties = properties.map((property) => ({
      ...property,
      formattedPrice: property.minPriceAed
        ? `AED ${property.minPriceAed.toLocaleString()}`
        : "Price on Request",
      formattedMaxPrice: property.maxPrice
        ? `AED ${property.maxPrice.toLocaleString()}`
        : null,
      priceRange: property.minPriceAed
        ? property.maxPrice && property.maxPrice !== property.minPriceAed
          ? `AED ${property.minPriceAed.toLocaleString()} - ${property.maxPrice.toLocaleString()}`
          : `AED ${property.minPriceAed.toLocaleString()}`
        : "Price on Request",
      mainImageUrl: property.coverImage?.url || null,
      id: property._id.toString(),
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);

    // Response matching your expected format
    res.status(200).json({
      success: true,
      message:
        totalCount > 0
          ? `Off-plan properties by developer: ${cleanDeveloper} fetched successfully`
          : `No properties found for developer: ${cleanDeveloper}`,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalCount: totalCount,
        totalMatchingProperties: totalCount,
        totalAllProperties: await OffPlanProperty.countDocuments({}),
        filteredProperties: totalCount,
        perPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      count: processedProperties.length,
      data: processedProperties,
      // Debug info (remove in production)
      debug: {
        requestedDeveloper: cleanDeveloper,
        developerExists: developerExists,
        allDevelopers: allDevelopers,
        filterUsed: filter,
      },
    });
  } catch (error) {
    console.error("Error filtering by developer:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering by developer",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const filterByMinPrice = async (req, res) => {
  try {
    const { minPrice } = req.query;
    const { page = 1, limit = 10 } = req.query;

    console.log("MinPrice", minPrice);

    // Check if minPrice parameter exists
    if (!minPrice) {
      return res.status(400).json({
        success: false,
        message: "MinPrice parameter is required",
      });
    }

    const filter = {
      minPriceAed: { $gte: parseInt(minPrice) },
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count first
    const totalCount = await OffPlanProperty.countDocuments(filter);
    console.log("Total matching properties:", totalCount);

    // Execute the main query
    const properties = await OffPlanProperty.find(filter)
      .sort({ minPriceAed: 1 }) // Sort by price ascending
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log("Found properties count:", properties.length);

    // Process the properties to match your expected format
    const processedProperties = properties.map((property) => ({
      ...property,
      formattedPrice: property.minPriceAed
        ? `AED ${property.minPriceAed.toLocaleString()}`
        : "Price on Request",
      formattedMaxPrice: property.maxPrice
        ? `AED ${property.maxPrice.toLocaleString()}`
        : null,
      priceRange: property.minPriceAed
        ? property.maxPrice && property.maxPrice !== property.minPriceAed
          ? `AED ${property.minPriceAed.toLocaleString()} - ${property.maxPrice.toLocaleString()}`
          : `AED ${property.minPriceAed.toLocaleString()}`
        : "Price on Request",
      mainImageUrl: property.coverImage?.url || null,
      id: property._id.toString(),
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);

    // Response matching your expected format
    res.status(200).json({
      success: true,
      message:
        totalCount > 0
          ? `Properties with minimum price AED ${parseInt(
              minPrice
            ).toLocaleString()} fetched successfully`
          : `No properties found with minimum price AED ${parseInt(
              minPrice
            ).toLocaleString()}`,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalCount: totalCount,
        totalMatchingProperties: totalCount,
        totalAllProperties: await OffPlanProperty.countDocuments({}),
        filteredProperties: totalCount,
        perPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      count: processedProperties.length,
      data: processedProperties,
      // Debug info (remove in production)
      debug: {
        requestedMinPrice: parseInt(minPrice),
        filterUsed: filter,
      },
    });
  } catch (error) {
    console.error("Error filtering by min price:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering by minimum price",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const filterByMaxPrice = async (req, res) => {
  try {
    const { maxPrice } = req.query;
    const { page = 1, limit = 10 } = req.query;

    console.log("MaxPrice", maxPrice);

    // Check if maxPrice parameter exists
    if (!maxPrice) {
      return res.status(400).json({
        success: false,
        message: "MaxPrice parameter is required",
      });
    }

    // Correct filter - use minPriceAed since that's where the actual price data is
    const filter = {
      minPriceAed: { $lte: parseInt(maxPrice) },
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count first
    const totalCount = await OffPlanProperty.countDocuments(filter);
    console.log("Total matching properties:", totalCount);

    // Execute the main query
    const properties = await OffPlanProperty.find(filter)
      .sort({ minPriceAed: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log("Found properties count:", properties.length);

    // Process the properties to match your expected format
    const processedProperties = properties.map((property) => ({
      ...property,
      formattedPrice: property.minPriceAed
        ? `AED ${property.minPriceAed.toLocaleString()}`
        : "Price on Request",
      formattedMaxPrice: property.maxPrice
        ? `AED ${property.maxPrice.toLocaleString()}`
        : null,
      priceRange: property.minPriceAed
        ? property.maxPrice && property.maxPrice !== property.minPriceAed
          ? `AED ${property.minPriceAed.toLocaleString()} - ${property.maxPrice.toLocaleString()}`
          : `AED ${property.minPriceAed.toLocaleString()}`
        : "Price on Request",
      mainImageUrl: property.coverImage?.url || null,
      id: property._id.toString(),
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);

    // Response matching your expected format
    res.status(200).json({
      success: true,
      message:
        totalCount > 0
          ? `Properties with maximum price AED ${parseInt(
              maxPrice
            ).toLocaleString()} fetched successfully`
          : `No properties found with maximum price AED ${parseInt(
              maxPrice
            ).toLocaleString()}`,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalCount: totalCount,
        totalMatchingProperties: totalCount,
        totalAllProperties: await OffPlanProperty.countDocuments({}),
        filteredProperties: totalCount,
        perPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      count: processedProperties.length,
      data: processedProperties,
      // Debug info (remove in production)
      debug: {
        requestedMaxPrice: parseInt(maxPrice),
        filterUsed: filter,
      },
    });
  } catch (error) {
    console.error("Error filtering by max price:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering by maximum price",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const OffSearchProperty = async (req, res) => {
  try {
    const { prefix, limit = 5 } = req.query;
    const minSuggestions = parseInt(limit);

    // Validation
    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: "Please provide a prefix",
      });
    }

    if (prefix.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Prefix must be at least 2 characters long",
        data: [],
      });
    }

    // Search only in name field for address suggestions
    const query = {
      name: { $regex: new RegExp(`\\b${prefix}`, "i") },
    };

    // Return full property details
    const suggestions = await OffPlanProperty.find(query)
      .limit(minSuggestions)
      .lean();

    return res.status(200).json({
      success: true,
      message: `Found ${suggestions.length} address suggestions`,
      data: suggestions,
      count: suggestions.length,
    });
  } catch (err) {
    console.error("Address suggestion error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: [],
    });
  }
};

module.exports = {
  fetchAndSaveProperties,
  getOffPlanAddressSuggestions,
  getNewOffPlanProperties,
  getSyncStatus,
  getSIngleOffplanProperty,
  FilterDeveloperOffplanProperty,
  filterByMinPrice,
  filterByMaxPrice,
  OffSearchProperty,
};
