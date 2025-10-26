const axios = require("axios");
const xml2js = require("xml2js");
const Property = require("../Models/PropertyModel");
const Agent = require("../Models/AgentModel");

// Simple QR code extraction function
const extractQRCodeUrl = (qrCode) => {
  if (!qrCode) return '';

  // Case 1: Direct string
  if (typeof qrCode === 'string') {
    return qrCode;
  }

  // Case 2: Object with url property (most common case based on your XML)
  if (qrCode.url) {
    // If url is a string directly
    if (typeof qrCode.url === 'string') {
      return qrCode.url;
    }

    // If url is an object with text content (xml2js parsing)
    if (typeof qrCode.url === 'object') {
      // Handle xml2js parsed text content (_ property contains the actual URL)
      if (qrCode.url._) {
        return qrCode.url._;
      }

      // Handle $t property (another xml2js text content property)
      if (qrCode.url.$t) {
        return qrCode.url.$t;
      }
    }

    // If url is an array (multiple URLs, take first)
    if (Array.isArray(qrCode.url) && qrCode.url.length > 0) {
      const firstUrl = qrCode.url[0];
      if (typeof firstUrl === 'string') {
        return firstUrl;
      }
      if (firstUrl && (firstUrl._ || firstUrl.$t)) {
        const url = firstUrl._ || firstUrl.$t;
        return url;
      }
    }
  }

  // Case 3: Direct text content at qr_code level
  if (qrCode._ || qrCode.$t) {
    const url = qrCode._ || qrCode.$t;
    return url;
  }

  return '';
};

// Check if property status is Live
const isPropertyLive = (propertyData) => {
  const status = propertyData.general_listing_information?.status;
  return status && status.toLowerCase() === 'live';
};

// Determine property type based on completion_status and offering_type
const determinePropertyType = (customFields) => {
  const offeringType = customFields?.offering_type;
  const completionStatus = customFields?.completion_status;

  // FIRST: Check completion_status for off-plan properties
  if (completionStatus === 'off_plan_primary' || completionStatus === 'off_plan_secondary') {
    return {
      type: 'OffPlan',
      listingType: 'OffPlan',
      reason: `completion_status is ${completionStatus}`
    };
  }

  // SECOND: If not off-plan, check offering_type
  if (offeringType === 'RR') {
    return {
      type: 'Rent',
      listingType: 'Rent',
      reason: `offering_type is ${offeringType}`
    };
  } else if (offeringType === 'RS') {
    return {
      type: 'Sale',
      listingType: 'Sale',
      reason: `offering_type is ${offeringType}`
    };
  } else if (offeringType === 'CS' || offeringType === 'CR') {
    return {
      type: 'Commercial',
      listingType: 'Commercial',
      reason: `offering_type is ${offeringType}`
    };
  }

  // FALLBACK: Default to Sale if no clear classification
  return {
    type: 'Sale',
    listingType: 'Sale',
    reason: `Fallback - no clear classification found`
  };
};

// Create property data for agent linking
const createPropertyDataForAgent = (propertyData) => {
  const generalInfo = propertyData.general_listing_information || {};
  const addressInfo = propertyData.address_information || {};
  const customFields = propertyData.custom_fields || {};

  // Map listingType to match Agent model enum ['Sale', 'Rent', 'Off Plan']
  let agentListingType = propertyData.listing_type || 'Sale';
  if (agentListingType === 'OffPlan') {
    agentListingType = 'Off Plan'; // Convert to match Agent model enum
  }

  return {
    propertyId: propertyData.id,
    listingTitle: generalInfo.listing_title || 'No Title',
    listingType: agentListingType,
    propertyType: propertyData.property_type || 'Unknown',
    price: generalInfo.listingprice || '0',
    currency: generalInfo.currency_iso_code || 'AED',
    status: generalInfo.status || 'Active',
    bedrooms: generalInfo.bedrooms || '0',
    bathrooms: generalInfo.fullbathrooms || '0',
    area: generalInfo.totalarea || '0',
    location: {
      city: customFields.city || addressInfo.city || '',
      address: customFields.propertyfinder_region || addressInfo.address || '',
      community: customFields.community || '',
      building: customFields.property_name || ''
    },
    images: propertyData.listing_media?.images?.image || [],
    description: generalInfo.description || '',
    addedDate: new Date(),
    lastUpdated: new Date()
  };
};

// Link property to existing agent
const linkPropertyToAgent = async (propertyData) => {
  try {
    const listingAgent = propertyData.listing_agent;

    if (!listingAgent || !listingAgent.listing_agent_email) {
      return {
        success: false,
        operation: 'skipped',
        reason: 'No agent email found in property data'
      };
    }

    const agentEmail = listingAgent.listing_agent_email.toLowerCase().trim();

    // Find existing agent by email using the static method from Agent model
    const existingAgent = await Agent.findByEmail(agentEmail);

    if (!existingAgent) {
      return {
        success: false,
        operation: 'agent_not_found',
        reason: `No active agent found with email: ${agentEmail}`
      };
    }

    // Create property data for agent
    const propertyDataForAgent = createPropertyDataForAgent(propertyData);

    // Check if property already exists in agent's properties
    const existingProperty = existingAgent.properties?.find(
      p => p.propertyId === propertyData.id
    );

    const operation = existingProperty ? 'property_updated' : 'property_added';

    // Use the Agent model's addOrUpdateProperty method
    existingAgent.addOrUpdateProperty(propertyDataForAgent);

    // Save the agent with updated properties
    await existingAgent.save();

    return {
      success: true,
      operation: operation,
      agentEmail: agentEmail,
      agentName: existingAgent.agentName,
      totalProperties: existingAgent.totalProperties, // Using virtual field
      activeSaleListings: existingAgent.activeSaleListings
    };

  } catch (error) {
    return {
      success: false,
      operation: 'failed',
      error: error.message
    };
  }
};

const parseXmlFromUrl = async (req, res, next) => {
  try {
    const xmlUrl = process.env.XML_URL;
    console.log(`Fetching XML from: ${xmlUrl}`);

    const response = await axios.get(xmlUrl, {
      headers: { Accept: "application/xml" },
    });

    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: false,
      trim: true,
    });

    console.log("Parsing XML data...");
    const result = await parser.parseStringPromise(response.data);

    let allProperties = [];

    // Handle the new XML structure - properties are directly in the list
    if (result && result.list && result.list.property) {
      if (Array.isArray(result.list.property)) {
        allProperties = result.list.property;
      } else {
        allProperties = [result.list.property];
      }
    } else {
      // Fallback to find properties array
      const findPropertiesArray = (obj) => {
        for (const key in obj) {
          if (
            Array.isArray(obj[key]) &&
            obj[key].length > 0 &&
            obj[key][0] &&
            (obj[key][0].general_listing_information || obj[key][0].Id)
          ) {
            return obj[key];
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            const found = findPropertiesArray(obj[key]);
            if (found) return found;
          }
        }
        return null;
      };

      const propertiesArray = findPropertiesArray(result);
      if (propertiesArray) {
        allProperties = propertiesArray;
      }
    }

    console.log(`Found ${allProperties.length} properties in XML`);

    // Transform new XML format to match existing structure
    const transformPropertyData = (property) => {
      // Determine property classification
      const classification = determinePropertyType(property.custom_fields);

      const transformedProperty = {
        id: property.Id || property.id,
        mode: "CREATE", // Default mode since new XML doesn't have mode
        created_at: property.created_at,
        timestamp: property.timestamp,

        // Base level fields for indexing - use classification results
        offering_type: property.custom_fields?.offering_type || "RS",
        property_type: property.general_listing_information?.property_type || "apartment",

        // Add listing_type based on classification
        listing_type: classification.listingType,

        // Transform address information
        address_information: property.address_information || {},

        // Transform general listing information
        general_listing_information: {
          listing_title: property.general_listing_information?.listing_title || "",
          updated: property.general_listing_information?.updated || "No", // ✅ ADD THIS LINE
          listingprice: property.general_listing_information?.listingprice || "0",
          listingtype: classification.listingType, // Use classification result
          currency_iso_code: property.general_listing_information?.currency_iso_code || "AED",
          property_type: property.general_listing_information?.property_type || "apartment",
          status: property.general_listing_information?.status || "Live",
          totalarea: property.general_listing_information?.totalarea || "0",
          description: property.general_listing_information?.description || "",
          bedrooms: property.general_listing_information?.bedrooms || "0",
          fullbathrooms: property.general_listing_information?.fullbathrooms || "0",
          // Map property_type to both propertytype and property for schema compatibility
          propertytype: property.general_listing_information?.property_type || "apartment",
          property: property.general_listing_information?.property_type || "apartment"
        },

        // Transform listing agent
        listing_agent: {
          listing_agent_email: property.listing_agent?.listing_agent_email || "",
          listing_agent_firstname: property.listing_agent?.listing_agent_firstname || "",
          listing_agent_lastname: property.listing_agent?.listing_agent_lastname || "",
          listing_agent_mobil_phone: property.listing_agent?.listing_agent_mobil_phone || "",
          listing_agent_phone: property.listing_agent?.listing_agent_phone ||
            property.listing_agent?.listing_agent_mobil_phone || ""
        },

        // Transform custom fields - mapping ALL fields from new XML format
        custom_fields: {
          // New XML fields - direct mapping
          property_record_id: property.custom_fields?.property_record_id || "",
          permit_number: property.custom_fields?.permit_number || "",
          offering_type: property.custom_fields?.offering_type || "",
          price_on_application: property.custom_fields?.price_on_application || "No",
          payment_method: property.custom_fields?.payment_method || "",
          city: property.custom_fields?.city || "",
          community: property.custom_fields?.community || "",
          sub_community: property.custom_fields?.sub_community || "",
          property_name: property.custom_fields?.property_name || "",
          propertyfinder_region: property.custom_fields?.propertyfinder_region || "",
          autonumber: property.custom_fields?.autonumber || "",
          unitnumber: property.custom_fields?.unitnumber || "",
          private_amenities: property.custom_fields?.private_amenities || "",
          plot_size: property.custom_fields?.plot_size || "0",
          developer: property.custom_fields?.developer || "",
          completion_status: property.custom_fields?.completion_status || "completed",
          parking: property.custom_fields?.parking || "0",
          furnished: property.custom_fields?.furnished || "No",
          project_name: property.custom_fields?.project_name || "",
          title_deed: property.custom_fields?.title_deed || "",
          availability_date: property.custom_fields?.availability_date || "",
          qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

          // Map to the field names your existing code expects for backward compatibility
          community_name: property.custom_fields?.community || "",
          tower_text: property.custom_fields?.property_name || "",
          pba__addresstext_pb: property.custom_fields?.propertyfinder_region || "",

          // Map completion status for OffPlan detection with multiple variants
          pba_uaefields__completion_status:
            property.custom_fields?.completion_status === "off_plan_primary" ||
              property.custom_fields?.completion_status === "off_plan_secondary" ? "Off Plan" : "Completed",

          // Additional fields that might be in the XML but not captured yet
          sub_community_name: property.custom_fields?.sub_community || "",
          building_name: property.custom_fields?.property_name || "",
          rera_permit_number: property.custom_fields?.permit_number || "",
          plot_area: property.custom_fields?.plot_size || "0",
          completion_date: property.custom_fields?.availability_date || "",

          // Map any other fields dynamically - but exclude qr_code to avoid object storage
          ...Object.keys(property.custom_fields || {}).reduce((acc, key) => {
            // Don't override already mapped fields and skip qr_code to avoid storing object
            if (!acc[key] && key !== 'qr_code' && property.custom_fields[key] !== undefined) {
              acc[key] = property.custom_fields[key];
            }
            return acc;
          }, {})
        },

        // Transform listing media with proper image handling for nested URL structures
        listing_media: {
          images: {
            image: (() => {
              const images = property.listing_media?.images?.image;
              if (!images) return [];

              // Handle array of images
              if (Array.isArray(images)) {
                return images.map(img => {
                  if (typeof img === 'string') {
                    return { title: '', url: img };
                  }

                  // Handle nested url structure from xml2js parsing
                  if (img.url) {
                    if (typeof img.url === 'string') {
                      return { title: img.title || '', url: img.url };
                    } else if (Array.isArray(img.url)) {
                      // Handle array of URLs within single image
                      return img.url.map(urlItem => ({
                        title: urlItem.title || '',
                        url: urlItem._ || urlItem.$t || urlItem
                      }));
                    } else if (img.url._ || img.url.$t) {
                      return { title: img.url.title || '', url: img.url._ || img.url.$t };
                    }
                  }

                  return img;
                }).flat(); // Flatten in case of nested arrays
              }

              // Handle single image object
              if (images.url) {
                if (Array.isArray(images.url)) {
                  return images.url.map(urlItem => ({
                    title: urlItem.title || '',
                    url: urlItem._ || urlItem.$t || urlItem
                  }));
                } else if (typeof images.url === 'string') {
                  return [{ title: images.title || '', url: images.url }];
                } else if (images.url._ || images.url.$t) {
                  return [{ title: images.url.title || '', url: images.url._ || images.url.$t }];
                }
              }

              return [];
            })()
          }
        },

        // Add QR code at root level for easier access
        qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

        // Store classification info
        _classification: classification,
      };

      return transformedProperty;
    };

    // Transform all properties to match expected structure
    const transformedProperties = allProperties.map(transformPropertyData);

    // Filter valid properties (all are valid since we're setting mode to CREATE)
    const validProperties = transformedProperties.filter(property => {
      const mode = property.mode;
      if (mode === "CREATE" || mode === "CHANGE" || mode === "NEW") {
        return true;
      }
      console.log(`Skipping property ${property.id} with mode: ${mode}`);
      return false;
    });

    console.log(`Processing ${validProperties.length} properties`);

    // Separate properties by status FIRST
    const liveProperties = [];
    const nonLiveProperties = [];

    validProperties.forEach(property => {
      if (isPropertyLive(property)) {
        liveProperties.push(property);
      } else {
        // For non-Live properties, update classification to NonActive
        property._classification = {
          type: 'NonActive',
          listingType: 'NonActive',
          reason: `Status is not Live: ${property.general_listing_information?.status}`
        };
        property.listing_type = 'NonActive';
        property.general_listing_information.listingtype = 'NonActive';

        nonLiveProperties.push(property);
      }
    });

    console.log(`Live properties: ${liveProperties.length}`);
    console.log(`Non-Live properties: ${nonLiveProperties.length}`);

    const validateAndCleanPropertyData = (propertyData) => {
      try {
        // Ensure required fields are present
        if (!propertyData.general_listing_information) {
          propertyData.general_listing_information = {};
        }

        if (!propertyData.general_listing_information.listingprice) {
          propertyData.general_listing_information.listingprice = "0";
        }

        if (!propertyData.general_listing_information.currency_iso_code) {
          propertyData.general_listing_information.currency_iso_code = "AED";
        }

        if (!propertyData.general_listing_information.status) {
          propertyData.general_listing_information.status = "Live";
        }

        if (!propertyData.general_listing_information.listing_title) {
          propertyData.general_listing_information.listing_title = "No Title";
        }

        if (!propertyData.general_listing_information.bedrooms) {
          propertyData.general_listing_information.bedrooms = "0";
        }

        if (!propertyData.general_listing_information.fullbathrooms) {
          propertyData.general_listing_information.fullbathrooms = "0";
        }

        if (!propertyData.general_listing_information.totalarea) {
          propertyData.general_listing_information.totalarea = "0";
        }

        // Validate listing agent required fields
        if (!propertyData.listing_agent) {
          propertyData.listing_agent = {};
        }

        if (!propertyData.listing_agent.listing_agent_email) {
          propertyData.listing_agent.listing_agent_email = "";
        }

        if (!propertyData.listing_agent.listing_agent_firstname) {
          propertyData.listing_agent.listing_agent_firstname = "";
        }

        if (!propertyData.listing_agent.listing_agent_lastname) {
          propertyData.listing_agent.listing_agent_lastname = "";
        }

        if (!propertyData.listing_agent.listing_agent_mobil_phone) {
          propertyData.listing_agent.listing_agent_mobil_phone = "";
        }

        if (!propertyData.listing_agent.listing_agent_phone) {
          propertyData.listing_agent.listing_agent_phone = propertyData.listing_agent.listing_agent_mobil_phone || "";
        }

        // Ensure custom_fields exists
        if (!propertyData.custom_fields) {
          propertyData.custom_fields = {};
        }

        // Ensure base level fields are set (required by PropertyModel)
        if (!propertyData.offering_type) {
          propertyData.offering_type = "RS";
        }

        if (!propertyData.property_type) {
          propertyData.property_type = "apartment";
        }

        // Ensure required root level fields
        if (!propertyData.created_at) {
          propertyData.created_at = new Date().toISOString();
        }

        if (!propertyData.timestamp) {
          propertyData.timestamp = new Date().toISOString();
        }

        // SIMPLIFIED QR code validation - extract URL string if it's an object
        if (propertyData.custom_fields.qr_code && typeof propertyData.custom_fields.qr_code === 'object') {
          const extractedUrl = extractQRCodeUrl(propertyData.custom_fields.qr_code);
          propertyData.custom_fields.qr_code = extractedUrl;
        }

        return { success: true, data: propertyData };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // SIMPLIFIED save and update function for single Property collection
    const saveOrUpdatePropertyToDb = async (propertyData, missingAgentsSet) => {
  try {
    const operationResults = {
      mainOperation: 'none',
      agentOperation: 'none',
      listingType: propertyData._classification?.listingType || 'Unknown',
      errors: []
    };

    const propertyId = propertyData.id;
    const propertyStatus = propertyData.general_listing_information?.status;
    const updateFlag = propertyData.general_listing_information?.updated;
    
    // ✅ Check if property status is exactly "Live" (case-insensitive)
    const isLive = propertyStatus && propertyStatus.toLowerCase() === 'live';

    // Check if property exists in database
    const existingProperty = await Property.findOne({ id: propertyId });

    if (existingProperty) {
      // Property exists - check if we should update
      if (updateFlag === 'No') {
        operationResults.mainOperation = 'skipped_no_update';
        console.log(`⏭️  Skipped property ${propertyId} - Updated flag is "No"`);
        // ✅ NO RETURN - Continue to agent checking below
      } else {
        // Update flag is "Yes" - proceed with update
        console.log(`🔄 Updating property ${propertyId}`);

        const updateData = {
          timestamp: propertyData.timestamp,
          address_information: propertyData.address_information,
          general_listing_information: propertyData.general_listing_information,
          listing_agent: propertyData.listing_agent,
          listing_media: propertyData.listing_media,
          custom_fields: propertyData.custom_fields,
          qr_code: propertyData.qr_code,
          offering_type: propertyData.offering_type,
          property_type: propertyData.property_type
        };

        await Property.findOneAndUpdate(
          { id: propertyId },
          { $set: updateData },
          { new: true, runValidators: true }
        );

        operationResults.mainOperation = 'updated';
        console.log(`✅ Updated property ${propertyId}`);
      }

    } else {
      // Property doesn't exist - create new one
      console.log(`🆕 Creating new property ${propertyId}`);

      const newProperty = new Property(propertyData);
      await newProperty.save();

      operationResults.mainOperation = 'created';
      console.log(`✅ Created property ${propertyId}`);
    }

    // ========================================
    // ✅ CRITICAL: ONLY LINK PROPERTIES WITH STATUS = "Live" TO AGENTS
    // Properties with "Off Market", "Archived", "Draft", etc. are NOT linked
    // ========================================
    if (isLive) {
      try {
        const agentEmail = propertyData.listing_agent?.listing_agent_email?.toLowerCase();

        if (!agentEmail) {
          operationResults.agentOperation = 'skipped_no_agent';
          console.log(`⏭️  No agent email found for property ${propertyId}`);
        } else {
          // ✅ USE THE linkPropertyToAgent FUNCTION
          const agentResult = await linkPropertyToAgent(propertyData);

          if (agentResult.success) {
            // Agent linking successful
            operationResults.agentOperation = agentResult.operation; // 'property_added' or 'property_updated'
            
            // Different log based on whether property was skipped or not
            if (operationResults.mainOperation === 'skipped_no_update') {
              console.log(`🔗 Verified agent link for skipped property: ${agentEmail}`);
            } else {
              console.log(`✅ ${agentResult.operation === 'property_added' ? 'Added' : 'Updated'} property in agent's list: ${agentEmail}`);
            }
          } else {
            // Agent linking failed
            operationResults.agentOperation = agentResult.operation; // 'agent_not_found', 'skipped', or 'failed'

            // If agent not found, add to missing agents list
            if (agentResult.operation === 'agent_not_found') {
              missingAgentsSet.add(JSON.stringify({
                email: agentEmail,
                propertyId: propertyId,
                agentName: `${propertyData.listing_agent?.listing_agent_firstname || ''} ${propertyData.listing_agent?.listing_agent_lastname || ''}`.trim(),
                phone: propertyData.listing_agent?.listing_agent_mobil_phone || propertyData.listing_agent?.listing_agent_phone || 'N/A',
                propertyStatus: propertyStatus,
                propertyWasSkipped: operationResults.mainOperation === 'skipped_no_update'
              }));
              console.log(`⚠️  Agent not found: ${agentEmail} - Property ${propertyId}${operationResults.mainOperation === 'skipped_no_update' ? ' (property was skipped but agent still checked)' : ''}`);
            } else {
              console.log(`⚠️  Agent operation failed: ${agentResult.reason || agentResult.error}`);
            }
          }
        }
      } catch (agentError) {
        console.error(`❌ Agent operation failed for ${propertyId}:`, agentError.message);
        operationResults.agentOperation = 'failed';
        operationResults.errors.push(`Agent operation: ${agentError.message}`);
      }
    } else {
      // ✅ Property is NOT Live - Skip agent linking
      operationResults.agentOperation = 'skipped_not_live';
      console.log(`⏭️  Skipped agent linking - property status is "${propertyStatus}" (only Live properties are linked to agents)`);
    }

    // ✅ Success includes created, updated, AND skipped
    const isSuccess = operationResults.mainOperation === 'created' ||
      operationResults.mainOperation === 'updated' ||
      operationResults.mainOperation === 'skipped_no_update';

    return {
      success: isSuccess,
      operationResults: operationResults,
      error: isSuccess ? null : operationResults.errors.join('; ')
    };

  } catch (error) {
    console.error(`❌ Error processing property ${propertyData.id}:`, error);
    return {
      success: false,
      error: error.message,
      operationResults: {
        mainOperation: 'failed',
        agentOperation: 'failed',
        errors: [error.message]
      }
    };
  }
};




    console.log("Starting to process all properties...");
    const missingAgentsSet = new Set();

    // Process results tracking
    const processResults = {
      totalAttempted: validProperties.length,
      livePropertiesAttempted: liveProperties.length,
      nonLivePropertiesAttempted: nonLiveProperties.length,
      successful: 0,
      failed: 0,
      skipped: allProperties.length - validProperties.length,
      failures: [],
      operations: {
        created: 0,
        updated: 0,
        skipped_no_update: 0,
        agentPropertiesAdded: 0,
        agentPropertiesUpdated: 0,
        agentNotFound: 0,
        agentSkipped: 0,
        agentSkippedNonActive: 0,
        agentFailed: 0
      },
      byType: {
        Sale: { created: 0, updated: 0 },
        Rent: { created: 0, updated: 0 },
        OffPlan: { created: 0, updated: 0 },
        Commercial: { created: 0, updated: 0 },
        NonActive: { created: 0, updated: 0 }
      },
      classificationStats: {
        byCompletionStatus: {},
        byOfferingType: {},
        fallbacks: 0
      }
    };

    // Process ALL properties (Live and Non-Live)
    const allPropertiesToProcess = [...liveProperties, ...nonLiveProperties];

    for (let i = 0; i < allPropertiesToProcess.length; i++) {
      try {
        const property = allPropertiesToProcess[i];

        // Track classification stats
        const completionStatus = property.custom_fields?.completion_status;
        const offeringType = property.custom_fields?.offering_type;
        const classification = property._classification;

        if (completionStatus) {
          processResults.classificationStats.byCompletionStatus[completionStatus] =
            (processResults.classificationStats.byCompletionStatus[completionStatus] || 0) + 1;
        }

        if (offeringType) {
          processResults.classificationStats.byOfferingType[offeringType] =
            (processResults.classificationStats.byOfferingType[offeringType] || 0) + 1;
        }

        if (classification && classification.reason.includes('Fallback')) {
          processResults.classificationStats.fallbacks++;
        }

        // Save property to single Property collection
        const result = await saveOrUpdatePropertyToDb(property, missingAgentsSet);

        if (result.success) {
          processResults.successful++;

          const ops = result.operationResults;

          // Track main operations
          if (ops.mainOperation === 'created') {
            processResults.operations.created++;
            if (processResults.byType[ops.listingType]) {
              processResults.byType[ops.listingType].created++;
            }
          } else if (ops.mainOperation === 'updated') {
            processResults.operations.updated++;
            if (processResults.byType[ops.listingType]) {
              processResults.byType[ops.listingType].updated++;
            }
          } else if (ops.mainOperation === 'skipped_no_update') {
            // ✅ ADD THIS ENTIRE BLOCK
            processResults.operations.skipped_no_update++;
          }


          // Track Agent operations
          if (ops.agentOperation === 'property_added') {
            processResults.operations.agentPropertiesAdded++;
          } else if (ops.agentOperation === 'property_updated') {
            processResults.operations.agentPropertiesUpdated++;
          } else if (ops.agentOperation === 'agent_not_found') {
            processResults.operations.agentNotFound++;
          } else if (ops.agentOperation === 'skipped') {
            processResults.operations.agentSkipped++;
          } else if (ops.agentOperation === 'skipped_nonactive') {
            processResults.operations.agentSkippedNonActive++;
          } else if (ops.agentOperation === 'failed') {
            processResults.operations.agentFailed++;
          }

          if (processResults.successful % 50 === 0) {
            console.log(`Progress: ${processResults.successful}/${allPropertiesToProcess.length} properties processed`);
          }
        } else {
          processResults.failed++;
          processResults.failures.push({
            id: property.id || `Unknown property at index ${i}`,
            status: property.general_listing_information?.status || 'Unknown',
            classification: property._classification,
            error: result.error
          });
        }
      } catch (error) {
        console.error(`Error in property processing loop at index ${i}:`, error);
        processResults.failed++;
        processResults.failures.push({
          id: allPropertiesToProcess[i]?.id || `Unknown property at index ${i}`,
          status: allPropertiesToProcess[i]?.general_listing_information?.status || 'Unknown',
          error: error.message
        });
      }
    }
    const missingAgentsList = Array.from(missingAgentsSet).map(item => JSON.parse(item));

    // Group missing agents by email
    const missingAgentsSummary = missingAgentsList.reduce((acc, agent) => {
      if (!acc[agent.email]) {
        acc[agent.email] = {
          email: agent.email,
          agentName: agent.agentName,
          phone: agent.phone,
          propertyCount: 0,
          properties: []
        };
      }
      acc[agent.email].propertyCount++;
      acc[agent.email].properties.push({
        propertyId: agent.propertyId,
        status: agent.propertyStatus
      });
      return acc;
    }, {});

    // Convert to array
    const missingAgentsArray = Object.values(missingAgentsSummary);


    console.log("=== DATABASE PROCESSING COMPLETED ===");
    console.log(`Successfully processed: ${processResults.successful} properties`);
    console.log(`Failed: ${processResults.failed} properties`);
    console.log(`Skipped: ${processResults.skipped} properties (invalid data)`);
    console.log(`Live properties: ${processResults.livePropertiesAttempted}`);
    console.log(`Non-Live properties: ${processResults.nonLivePropertiesAttempted}`);
    console.log(`Operations: Created ${processResults.operations.created}, Updated ${processResults.operations.updated}`);
    console.log(`Agent Operations: Added ${processResults.operations.agentPropertiesAdded}, Updated ${processResults.operations.agentPropertiesUpdated}, Not Found ${processResults.operations.agentNotFound}, Skipped ${processResults.operations.agentSkippedNonActive}`);
    console.log(`By Type:`, processResults.byType);

    console.log(`\n⚠️  Missing Agents: ${missingAgentsArray.length} unique agents not found`);
    if (missingAgentsArray.length > 0) {
      console.log("\n🔍 Top Missing Agents:");
      missingAgentsArray.slice(0, 10).forEach((agent, index) => {
        console.log(`   ${index + 1}. ${agent.email}`);
        console.log(`      Name: ${agent.agentName || 'N/A'}`);
        console.log(`      Phone: ${agent.phone}`);
        console.log(`      Properties: ${agent.propertyCount}`);
      });
      if (missingAgentsArray.length > 10) {
        console.log(`   ... and ${missingAgentsArray.length - 10} more agents`);
      }
    }

    return res.status(200).json({
      success: true,
      message: "✅ XML data processed successfully - All properties saved to single Property collection with proper classification and agent linking",
      totalPropertiesInXml: allProperties.length,
      processedProperties: validProperties.length,
      liveProperties: liveProperties.length,
      nonLiveProperties: nonLiveProperties.length,
      skippedProperties: processResults.skipped,
      databaseResults: {
        propertiesProcessed: processResults.successful,
        propertiesFailed: processResults.failed,
        operations: processResults.operations,
        byType: processResults.byType,
        classificationStats: processResults.classificationStats,
        failures: processResults.failures.slice(0, 5) // Show first 5 failures only
      },
      missingAgents: {
        total: missingAgentsArray.length,
        totalPropertiesAffected: missingAgentsList.length,
        agents: missingAgentsArray
      }
    });

  } catch (error) {
    console.error("❌ Error parsing XML:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to parse XML",
      error: error.message,
    });
  }
};

module.exports = parseXmlFromUrl;