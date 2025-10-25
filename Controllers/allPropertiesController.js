const Property=require("../Models/PropertyModel")

const getSingleProperty = async (req, res) => {
  try {
    // Get property ID and type from request parameters
    const PropertyId = req.query.id;
    const PropertyType = req.query.type || req.query.listing_type;
    
    console.log("Property ID:", PropertyId);
    console.log("Property Type:", PropertyType);
    
    // Validate required parameters
    if (!PropertyId || !PropertyType) {
      return res.status(400).json({
        success: false,
        message: "Property ID & Property Type are required"
      });
    }
    
    // Build query for unified Property collection
    const query = {
      id: PropertyId,
      listing_type: PropertyType
    };
    
    console.log("Searching with query:", query);
    
    // Search in unified Property collection (same as your UniversalSpecializedFilter)
    const property = await Property.findOne(query);
    
    console.log("Property found:", property ? "Yes" : "No");
    
    // If property not found
    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${PropertyId} and listing_type: ${PropertyType}`,
        propertyId: PropertyId,
        propertyType: PropertyType,
        searchedWith: query
      });
    }

    // Map the property data to match frontend expectations
    const mappedProperty = {
      // Keep original MongoDB fields
      _id: property._id,
      id: property.id,
      property_type: property.property_type,
      offering_type: property.offering_type,
      listing_type: property.listing_type,
      created_at: property.created_at,
      timestamp: property.timestamp,
      mode: property.mode,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      __v: property.__v,

      // General listing information - exactly as frontend expects
      general_listing_information: {
        listing_title: property.general_listing_information?.listing_title || "",
        listingprice: property.general_listing_information?.listingprice || "0",
        currency_iso_code: property.general_listing_information?.currency_iso_code || "AED",
        status: property.general_listing_information?.status || "Live",
        totalarea: property.general_listing_information?.totalarea || "",
        description: property.general_listing_information?.description || "",
        bedrooms: property.general_listing_information?.bedrooms || "",
        fullbathrooms: property.general_listing_information?.fullbathrooms || "",
        propertytype: property.general_listing_information?.propertytype || property.property_type || ""
      },

      // Address information for map coordinates
      address_information: {
        latitude: property.custom_fields?.latitude || property.address_information?.latitude || null,
        longitude: property.custom_fields?.longitude || property.address_information?.longitude || null,
        city: property.custom_fields?.city || property.address_information?.city || "Dubai",
        community: property.custom_fields?.community || property.address_information?.community || "",
        address: property.custom_fields?.pba__addresstext_pb || property.address_information?.address || ""
      },

      // Listing media - exactly as frontend expects
      listing_media: {
        images: {
          image: property.listing_media?.images?.image || []
        }
      },

      // Listing agent information
      listing_agent: {
        listing_agent_email: property.listing_agent?.listing_agent_email || "",
        listing_agent_firstname: property.listing_agent?.listing_agent_firstname || "",
        listing_agent_lastname: property.listing_agent?.listing_agent_lastname || "",
        listing_agent_mobil_phone: property.listing_agent?.listing_agent_mobil_phone || "",
        listing_agent_phone: property.listing_agent?.listing_agent_phone || ""
      },

      // Custom fields - exactly as frontend expects
      custom_fields: {
        property_record_id: property.custom_fields?.property_record_id || "",
        permit_number: property.custom_fields?.permit_number || "",
        price_on_application: property.custom_fields?.price_on_application || "No",
        payment_method: property.custom_fields?.payment_method || "",
        city: property.custom_fields?.city || "Dubai",
        community: property.custom_fields?.community || "",
        sub_community: property.custom_fields?.sub_community || "",
        property_name: property.custom_fields?.property_name || "",
        propertyfinder_region: property.custom_fields?.propertyfinder_region || "",
        autonumber: property.custom_fields?.autonumber || "",
        unitnumber: property.custom_fields?.unitnumber || "",
        private_amenities: property.custom_fields?.private_amenities || "",
        plot_size: property.custom_fields?.plot_size || "",
        developer: property.custom_fields?.developer || "",
        completion_status: property.custom_fields?.completion_status || "",
        parking: property.custom_fields?.parking || "",
        furnished: property.custom_fields?.furnished || "No",
        project_name: property.custom_fields?.project_name || "",
        title_deed: property.custom_fields?.title_deed || "",
        availability_date: property.custom_fields?.availability_date || "",
        qr_code: property.custom_fields?.qr_code || "",
        community_name: property.custom_fields?.community_name || "",
        tower_text: property.custom_fields?.tower_text || "",
        pba__addresstext_pb: property.custom_fields?.pba__addresstext_pb || "",
        pba_uaefields__completion_status: property.custom_fields?.pba_uaefields__completion_status || "",
        sub_community_name: property.custom_fields?.sub_community_name || "",
        building_name: property.custom_fields?.building_name || "",
        rera_permit_number: property.custom_fields?.rera_permit_number || "",
        plot_area: property.custom_fields?.plot_area || "",
        completion_date: property.custom_fields?.completion_date || "",
        offering_type: property.custom_fields?.offering_type || property.offering_type || "",
        // Add latitude and longitude to custom_fields as well for fallback
        latitude: property.custom_fields?.latitude || null,
        longitude: property.custom_fields?.longitude || null
      },

      // QR code
      qr_code: property.qr_code || property.custom_fields?.qr_code || "",

      // Classification
      _classification: property._classification || {
        type: property.listing_type,
        listingType: property.listing_type,
        reason: `Found in unified Property collection with listing_type: ${property.listing_type}`
      }
    };

    return res.status(200).json({
      success: true,
      message: `Property fetched successfully from unified collection`,
      source: "Property", // Unified collection name
      listingType: property.listing_type,
      data: mappedProperty
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
