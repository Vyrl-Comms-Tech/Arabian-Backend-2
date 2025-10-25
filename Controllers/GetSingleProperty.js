const SaleProperty = require("../Models/SalePropertyModel");
const RentProperty = require("../Models/RentPropertyModel");
const OffPlanProperty = require("../Models/OffplanModel");
const CommercialProperty = require("../Models/CommercialPropertyModel");

const getSingleProperty = async (req, res) => {
  try {
    // Get property ID and type from request parameters
    const PropertyId = req.query.id;
    const PropertyType = req.query.type;
    
    console.log("Property ID:", PropertyId);
    console.log("Property Type:", PropertyType);
    
    // Validate required parameters
    if (!PropertyId || !PropertyType) {
      return res.status(400).json({
        success: false,
        message: "Property ID & Property Type are required"
      });
    }
    
    let property = null;
    
    // Search based on property type
    if (PropertyType === "RS" || PropertyType=="Sale") {
      // Sale Property
      property = await SaleProperty.findOne({ id: PropertyId });
      console.log("Searching in Sale collection:", property);
      
      if (property) {
        return res.status(200).json({
          success: true,
          message: "Sale property fetched successfully",
          source: "Sale",
          data: property
        });
      }
      
    } else if (PropertyType === "RR"|| PropertyType=="Rent" ) {
      // Rent Property
      property = await RentProperty.findOne({ id: PropertyId });
      console.log("Searching in Rent collection:", property);
      
      if (property) {
        return res.status(200).json({
          success: true,
          message: "Rent property fetched successfully",
          source: "Rent",
          data: property
        });
      }
      
    } else if (PropertyType === "CS" || PropertyType === "CR" || PropertyType=="Commercial" ) {
      // Commercial Property (both sale and rent)
      property = await CommercialProperty.findOne({ id: PropertyId });
      console.log("Searching in Commercial collection:", property);
      
      if (property) {
        return res.status(200).json({
          success: true,
          message: "Commercial property fetched successfully",
          source: "Commercial",
          data: property
        });
      }
      
    } else {
      // OffPlan Property (default for all other types)
      property = await OffPlanProperty.findOne({ id: PropertyId });
      // console.log("Searching in OffPlan collection:", property);
      
      if (property) {
        return res.status(200).json({
          success: true,
          message: "OffPlan property fetched successfully",
          source: "OffPlan",
          data: property
        });
      }
    }
    
    // If property not found in any collection
    let searchedCollection = "";
    if (PropertyType === "RS") {
      searchedCollection = "Sale";
    } else if (PropertyType === "RR") {
      searchedCollection = "Rent";
    } else if (PropertyType === "CS" || PropertyType === "CR") {
      searchedCollection = "Commercial";
    } else {
      searchedCollection = "OffPlan";
    }
    
    return res.status(404).json({
      success: false,
      message: `Property not found in ${searchedCollection} collection`,
      propertyId: PropertyId,
      propertyType: PropertyType,
      searchedIn: searchedCollection
    });
    
  } catch (error) {
    console.error("Error fetching property:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch property",
      error: error.message
    });
  }
};

module.exports = getSingleProperty;