const axios = require("axios");
const xml2js = require("xml2js");
const Property = require("../Models/PropertyModel");
const Agent = require("../Models/AgentModel");
const cron = require("node-cron");

/* ------------------------- Helpers & Utilities ------------------------- */

// Extract QR code URL from many shapes
const extractQRCodeUrl = (qrCode) => {
  if (!qrCode) return "";

  if (typeof qrCode === "string") return qrCode;

  if (qrCode.url) {
    if (typeof qrCode.url === "string") return qrCode.url;

    if (typeof qrCode.url === "object") {
      if (qrCode.url._) return qrCode.url._;
      if (qrCode.url.$t) return qrCode.url.$t;
    }

    if (Array.isArray(qrCode.url) && qrCode.url.length > 0) {
      const firstUrl = qrCode.url[0];
      if (typeof firstUrl === "string") return firstUrl;
      if (firstUrl && (firstUrl._ || firstUrl.$t))
        return firstUrl._ || firstUrl.$t;
    }
  }

  if (qrCode._ || qrCode.$t) return qrCode._ || qrCode.$t;

  return "";
};

// Prefer Last_Website_Published_Date_Time, else fall back to root created_at attribute
function getPublishedAtFromXml(property) {
  const fromGLI =
    property?.general_listing_information?.Last_Website_Published_Date_Time;
  const fromAttr = property?.created_at; // xml2js attr (mergeAttrs: true)
  return (
    (fromGLI && String(fromGLI).trim()) ||
    (fromAttr && String(fromAttr).trim()) ||
    null
  );
}

function parseXmlTsAsUTC(ts) {
  if (!ts || typeof ts !== "string") return null;
  const trimmed = ts.trim();
  // "2025-08-07 17:12:38" -> "2025-08-07T17:12:38Z"
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Live checker
const isPropertyLive = (propertyData) => {
  const status = propertyData.general_listing_information?.status;
  return status && status.toLowerCase() === "live";
};

// Classify listing type
const determinePropertyType = (customFields) => {
  const offeringType = customFields?.offering_type;
  const completionStatus = customFields?.completion_status;

  if (
    completionStatus === "off_plan_primary" ||
    completionStatus === "off_plan_secondary"
  ) {
    return {
      type: "OffPlan",
      listingType: "OffPlan",
      reason: `completion_status is ${completionStatus}`,
    };
  }

  if (offeringType === "RR") {
    return {
      type: "Rent",
      listingType: "Rent",
      reason: `offering_type is ${offeringType}`,
    };
  } else if (offeringType === "RS") {
    return {
      type: "Sale",
      listingType: "Sale",
      reason: `offering_type is ${offeringType}`,
    };
  } else if (offeringType === "CS" || offeringType === "CR") {
    return {
      type: "Commercial",
      listingType: "Commercial",
      reason: `offering_type is ${offeringType}`,
    };
  }

  return {
    type: "Sale",
    listingType: "Sale",
    reason: `Fallback - no clear classification found`,
  };
};

// Agent payload builder (uses the same published date)
// const createPropertyDataForAgent = (propertyData) => {
//   const generalInfo = propertyData.general_listing_information || {};
//   const addressInfo = propertyData.address_information || {};
//   const customFields = propertyData.custom_fields || {};

//   const publishedAtString = propertyData.created_at || null;
//   const publishedAtDate = parseXmlTsAsUTC(publishedAtString);

//   let agentListingType = propertyData.listing_type || 'Sale';
//   if (agentListingType === 'OffPlan') agentListingType = 'Off Plan';

//   return {
//     propertyId: propertyData.id,
//     listingTitle: generalInfo.listing_title || 'No Title',
//     listingType: agentListingType,
//     propertyType: propertyData.property_type || 'Unknown',
//     price: generalInfo.listingprice || '0',
//     currency: generalInfo.currency_iso_code || 'AED',
//     status: generalInfo.status || 'Active',
//     bedrooms: generalInfo.bedrooms || '0',
//     bathrooms: generalInfo.fullbathrooms || '0',
//     area: generalInfo.totalarea || '0',
//     location: {
//       city: customFields.city || addressInfo.city || '',
//       address: customFields.propertyfinder_region || addressInfo.address || '',
//       community: customFields.community || '',
//       building: customFields.property_name || ''
//     },
//     images: propertyData.listing_media?.images?.image || [],
//     description: generalInfo.description || '',

//     addedDate: publishedAtDate || null,        // Date
//     addedDateString: publishedAtString || '',  // String
//     lastUpdated:
//       parseXmlTsAsUTC(propertyData.general_listing_information?.Last_Website_Published_Date_Time) ||
//       new Date(),
//   };
// };
const createPropertyDataForAgent = (propertyData) => {
  const gi = propertyData.general_listing_information || {};
  const ai = propertyData.address_information || {};
  const cf = propertyData.custom_fields || {};

  // Prefer GLI.Last_Website_Published_Date_Time → else fallback to propertyData.created_at (already mapped by you)
  const publishedAtString =
    (gi.Last_Website_Published_Date_Time &&
      String(gi.Last_Website_Published_Date_Time).trim()) ||
    propertyData.created_at ||
    null;

  const publishedAtDate = parseXmlTsAsUTC(publishedAtString);

  let agentListingType = propertyData.listing_type || "Sale";
  if (agentListingType === "OffPlan") agentListingType = "Off Plan";

  return {
    propertyId: propertyData.id,
    listingTitle: gi.listing_title || "No Title",
    listingType: agentListingType,
    propertyType: propertyData.property_type || "Unknown",
    price: gi.listingprice || "0",
    currency: gi.currency_iso_code || "AED",
    status: gi.status || "Active",
    bedrooms: gi.bedrooms || "0",
    bathrooms: gi.fullbathrooms || "0",
    area: gi.totalarea || "0",
    location: {
      city: cf.city || ai.city || "",
      address: cf.propertyfinder_region || ai.address || "",
      community: cf.community || "",
      building: cf.property_name || "",
    },
    images: propertyData.listing_media?.images?.image || [],
    description: gi.description || "",

    // These MUST mirror Last_Website_Published_Date_Time when present
    addedDate: publishedAtDate || null, // Date
    addedDateString: publishedAtString || "", // String

    // keep lastUpdated as you had it (it’s fine)
    lastUpdated:
      parseXmlTsAsUTC(gi.Last_Website_Published_Date_Time) || new Date(),
  };
};
// Link property to existing agent (unchanged logic)
// const linkPropertyToAgent = async (propertyData) => {
//   try {
//     const listingAgent = propertyData.listing_agent;

//     if (!listingAgent || !listingAgent.listing_agent_email) {
//       return { success: false, operation: 'skipped', reason: 'No agent email found in property data' };
//     }

//     const agentEmail = listingAgent.listing_agent_email.toLowerCase().trim();
//     const existingAgent = await Agent.findByEmail(agentEmail);

//     if (!existingAgent) {
//       return {
//         success: false,
//         operation: 'agent_not_found',
//         reason: `No active agent found with email: ${agentEmail}`
//       };
//     }

//     const propertyDataForAgent = createPropertyDataForAgent(propertyData);
//     const existingProperty = existingAgent.properties?.find(p => p.propertyId === propertyData.id);
//     const operation = existingProperty ? 'property_updated' : 'property_added';

//     existingAgent.addOrUpdateProperty(propertyDataForAgent);
//     await existingAgent.save();

//     return {
//       success: true,
//       operation,
//       agentEmail,
//       agentName: existingAgent.agentName,
//       totalProperties: existingAgent.totalProperties,
//       activeSaleListings: existingAgent.activeSaleListings
//     };
//   } catch (error) {
//     return { success: false, operation: 'failed', error: error.message };
//   }
// };
const linkPropertyToAgent = async (propertyData) => {
  try {
    const listingAgent = propertyData.listing_agent;
    if (!listingAgent?.listing_agent_email) {
      return {
        success: false,
        operation: "skipped",
        reason: "No agent email found in property data",
      };
    }

    const agentEmail = listingAgent.listing_agent_email.toLowerCase().trim();
    const existingAgent = await Agent.findByEmail(agentEmail);
    if (!existingAgent) {
      return {
        success: false,
        operation: "agent_not_found",
        reason: `No active agent found with email: ${agentEmail}`,
      };
    }

    const payload = createPropertyDataForAgent(propertyData);

    // 1) Try update-in-place (positional operator) → force overwrite ALL fields incl. addedDate
    const upd = await Agent.updateOne(
      { _id: existingAgent._id, "properties.propertyId": propertyData.id },
      { $set: { "properties.$": payload } }
    );

    if (upd.matchedCount > 0) {
      return {
        success: true,
        operation: "property_updated",
        agentEmail,
        agentName: existingAgent.agentName,
      };
    }

    // 2) Not present → push a fresh record
    await Agent.updateOne(
      { _id: existingAgent._id },
      { $push: { properties: payload } }
    );

    return {
      success: true,
      operation: "property_added",
      agentEmail,
      agentName: existingAgent.agentName,
    };
  } catch (error) {
    return { success: false, operation: "failed", error: error.message };
  }
};

// Simple concurrency runner (no external deps)
const runWithConcurrency = async (items, limit, worker) => {
  const out = new Array(items.length);
  let idx = 0;
  const runners = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) break;
        out[i] = await worker(items[i], i);
      }
    });
  await Promise.all(runners);
  return out;
};

/* ------------------------------- Controller ------------------------------- */

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

    // Properties in result.list.property
    if (result && result.list && result.list.property) {
      allProperties = Array.isArray(result.list.property)
        ? result.list.property
        : [result.list.property];
    } else {
      // fallback: search anywhere
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
      if (propertiesArray) allProperties = propertiesArray;
    }

    console.log(`Found ${allProperties.length} properties in XML`);

    // Transformer (maps created_at from Last_Website_Published_Date_Time)
    const transformPropertyData = (property) => {
      const classification = determinePropertyType(property.custom_fields);

      const transformedProperty = {
        id: property.Id || property.id,
        mode: "CREATE",
        created_at: getPublishedAtFromXml(property), // <- critical mapping
        timestamp: property.timestamp,

        // Base fields
        offering_type: property.custom_fields?.offering_type || "RS",
        property_type:
          property.general_listing_information?.property_type || "apartment",
        listing_type: classification.listingType,

        address_information: property.address_information || {},

        general_listing_information: {
          listing_title:
            property.general_listing_information?.listing_title || "",
          updated: property.general_listing_information?.updated || "No",
          listingprice:
            property.general_listing_information?.listingprice || "0",
          listingtype: classification.listingType,
          currency_iso_code:
            property.general_listing_information?.currency_iso_code || "AED",
          property_type:
            property.general_listing_information?.property_type || "apartment",
          status: property.general_listing_information?.status || "Live",
          totalarea: property.general_listing_information?.totalarea || "0",
          description: property.general_listing_information?.description || "",
          bedrooms: property.general_listing_information?.bedrooms || "0",
          fullbathrooms:
            property.general_listing_information?.fullbathrooms || "0",
          propertytype:
            property.general_listing_information?.property_type || "apartment",
          property:
            property.general_listing_information?.property_type || "apartment",
        },

        listing_agent: {
          listing_agent_email:
            property.listing_agent?.listing_agent_email || "",
          listing_agent_firstname:
            property.listing_agent?.listing_agent_firstname || "",
          listing_agent_lastname:
            property.listing_agent?.listing_agent_lastname || "",
          listing_agent_mobil_phone:
            property.listing_agent?.listing_agent_mobil_phone || "",
          listing_agent_phone:
            property.listing_agent?.listing_agent_phone ||
            property.listing_agent?.listing_agent_mobil_phone ||
            "",
        },

        custom_fields: {
          property_record_id: property.custom_fields?.property_record_id || "",
          permit_number: property.custom_fields?.permit_number || "",
          offering_type: property.custom_fields?.offering_type || "",
          price_on_application:
            property.custom_fields?.price_on_application || "No",
          payment_method: property.custom_fields?.payment_method || "",
          city: property.custom_fields?.city || "",
          community: property.custom_fields?.community || "",
          sub_community: property.custom_fields?.sub_community || "",
          property_name: property.custom_fields?.property_name || "",
          propertyfinder_region:
            property.custom_fields?.propertyfinder_region || "",
          autonumber: property.custom_fields?.autonumber || "",
          unitnumber: property.custom_fields?.unitnumber || "",
          private_amenities: property.custom_fields?.private_amenities || "",
          plot_size: property.custom_fields?.plot_size || "0",
          developer: property.custom_fields?.developer || "",
          completion_status:
            property.custom_fields?.completion_status || "completed",
          parking: property.custom_fields?.parking || "0",
          furnished: property.custom_fields?.furnished || "No",
          project_name: property.custom_fields?.project_name || "",
          title_deed: property.custom_fields?.title_deed || "",
          availability_date: property.custom_fields?.availability_date || "",
          qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

          community_name: property.custom_fields?.community || "",
          tower_text: property.custom_fields?.property_name || "",
          pba__addresstext_pb:
            property.custom_fields?.propertyfinder_region || "",

          pba_uaefields__completion_status:
            property.custom_fields?.completion_status === "off_plan_primary" ||
            property.custom_fields?.completion_status === "off_plan_secondary"
              ? "Off Plan"
              : "Completed",

          sub_community_name: property.custom_fields?.sub_community || "",
          building_name: property.custom_fields?.property_name || "",
          rera_permit_number: property.custom_fields?.permit_number || "",
          plot_area: property.custom_fields?.plot_size || "0",
          completion_date: property.custom_fields?.availability_date || "",

          ...Object.keys(property.custom_fields || {}).reduce((acc, key) => {
            if (
              !acc[key] &&
              key !== "qr_code" &&
              property.custom_fields[key] !== undefined
            ) {
              acc[key] = property.custom_fields[key];
            }
            return acc;
          }, {}),
        },

        listing_media: {
          images: {
            image: (() => {
              const images = property.listing_media?.images?.image;
              if (!images) return [];
              if (Array.isArray(images)) {
                return images
                  .map((img) => {
                    if (typeof img === "string") return { title: "", url: img };
                    if (img.url) {
                      if (typeof img.url === "string")
                        return { title: img.title || "", url: img.url };
                      if (Array.isArray(img.url)) {
                        return img.url.map((urlItem) => ({
                          title: urlItem.title || "",
                          url: urlItem._ || urlItem.$t || urlItem,
                        }));
                      }
                      if (img.url._ || img.url.$t) {
                        return {
                          title: img.url.title || "",
                          url: img.url._ || img.url.$t,
                        };
                      }
                    }
                    return img;
                  })
                  .flat();
              }
              if (images.url) {
                if (Array.isArray(images.url)) {
                  return images.url.map((urlItem) => ({
                    title: urlItem.title || "",
                    url: urlItem._ || urlItem.$t || urlItem,
                  }));
                } else if (typeof images.url === "string") {
                  return [{ title: images.title || "", url: images.url }];
                } else if (images.url._ || images.url.$t) {
                  return [
                    {
                      title: images.url.title || "",
                      url: images.url._ || images.url.$t,
                    },
                  ];
                }
              }
              return [];
            })(),
          },
        },

        qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

        _classification: classification,
      };

      return transformedProperty;
    };

    const transformedProperties = allProperties.map(transformPropertyData);

    // Validity by mode (kept same)
    const validProperties = transformedProperties.filter((property) => {
      const mode = property.mode;
      if (mode === "CREATE" || mode === "CHANGE" || mode === "NEW") return true;
      console.log(`Skipping property ${property.id} with mode: ${mode}`);
      return false;
    });

    console.log(`Processing ${validProperties.length} properties`);

    // Separate by status (keep non-Live but mark as NonActive)
    const liveProperties = [];
    const nonLiveProperties = [];

    validProperties.forEach((property) => {
      if (isPropertyLive(property)) {
        liveProperties.push(property);
      } else {
        property._classification = {
          type: "NonActive",
          listingType: "NonActive",
          reason: `Status is not Live: ${property.general_listing_information?.status}`,
        };
        property.listing_type = "NonActive";
        property.general_listing_information.listingtype = "NonActive";
        nonLiveProperties.push(property);
      }
    });

    console.log(`Live properties: ${liveProperties.length}`);
    console.log(`Non-Live properties: ${nonLiveProperties.length}`);

    // Results tracker (same shape as before)
    const missingAgentsSet = new Set();
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
        agentFailed: 0,
      },
      byType: {
        Sale: { created: 0, updated: 0 },
        Rent: { created: 0, updated: 0 },
        OffPlan: { created: 0, updated: 0 },
        Commercial: { created: 0, updated: 0 },
        NonActive: { created: 0, updated: 0 },
      },
      classificationStats: {
        byCompletionStatus: {},
        byOfferingType: {},
        fallbacks: 0,
      },
    };

    // Aggregate stats by completion/offering/fallbacks
    const allPropertiesToProcess = [...liveProperties, ...nonLiveProperties];
    for (const property of allPropertiesToProcess) {
      const completionStatus = property.custom_fields?.completion_status;
      const offeringType = property.custom_fields?.offering_type;
      const classification = property._classification;

      if (completionStatus) {
        processResults.classificationStats.byCompletionStatus[
          completionStatus
        ] =
          (processResults.classificationStats.byCompletionStatus[
            completionStatus
          ] || 0) + 1;
      }
      if (offeringType) {
        processResults.classificationStats.byOfferingType[offeringType] =
          (processResults.classificationStats.byOfferingType[offeringType] ||
            0) + 1;
      }
      if (classification && classification.reason.includes("Fallback")) {
        processResults.classificationStats.fallbacks++;
      }
    }

    /* ----------------------------- BULK UPSERT ----------------------------- */

    // preload existence
    const ids = allPropertiesToProcess.map((p) => p.id);

    const existingProps = await Property.find(
      { id: { $in: ids } },
      { id: 1, created_at: 1 }
    ).lean();
    const existsMap = new Map(existingProps.map((p) => [p.id, p])); // store entire doc snippet
    // build write ops; keep id->operation map for stats
    const propertyOps = [];
    const mainOpById = new Map(); // id -> 'created' | 'updated' | 'skipped_no_update'

    for (const propertyData of allPropertiesToProcess) {
      const id = propertyData.id;
      const existing = existsMap.get(id);
      const existed = !!existing;
      const updateFlag = propertyData.general_listing_information?.updated;

      // If this record exists and XML says "No" update,
      // still bump created_at if it changed (to mirror Last_Website_Published_Date_Time).
      if (existed && updateFlag === "No") {
        if (
          propertyData.created_at && // we have a computed published date
          propertyData.created_at !== existing.created_at // and it's different from DB
        ) {
          propertyOps.push({
            updateOne: {
              filter: { id },
              update: { $set: { created_at: propertyData.created_at } }, // <- only created_at
              upsert: false,
            },
          });
          mainOpById.set(id, "updated_created_at_only"); // for stats/logs
        } else {
          mainOpById.set(id, "skipped_no_update");
        }
        continue; // IMPORTANT: don't fall through to the full $set write
      }

      // ...unchanged full $set upsert for inserts / updated === 'Yes'
      const $set = {
        created_at: propertyData.created_at,
        timestamp: propertyData.timestamp,
        address_information: propertyData.address_information,
        general_listing_information: propertyData.general_listing_information,
        listing_agent: propertyData.listing_agent,
        listing_media: propertyData.listing_media,
        custom_fields: propertyData.custom_fields,
        qr_code: propertyData.qr_code,
        offering_type: propertyData.offering_type,
        property_type: propertyData.property_type,
        listing_type: propertyData.listing_type,
        _classification: propertyData._classification,
      };

      propertyOps.push({
        updateOne: {
          filter: { id },
          update: { $set, $setOnInsert: { id } },
          upsert: true,
        },
      });
      mainOpById.set(id, existed ? "updated" : "created");
    }

    if (propertyOps.length) {
      await Property.bulkWrite(propertyOps, { ordered: false });
    }

    // Fold in main operation stats
    for (const propertyData of allPropertiesToProcess) {
      const id = propertyData.id;
      const op = mainOpById.get(id);
      if (!op) {
        // Not written nor skipped properly (should be rare)
        processResults.failed++;
        processResults.failures.push({
          id,
          status: propertyData.general_listing_information?.status || "Unknown",
          classification: propertyData._classification,
          error: "No main operation recorded",
        });
        continue;
      }

      if (op === "created") {
        processResults.successful++;
        processResults.operations.created++;
        const lt = propertyData._classification?.listingType;
        if (lt && processResults.byType[lt])
          processResults.byType[lt].created++;
      } else if (op === "updated") {
        processResults.successful++;
        processResults.operations.updated++;
        const lt = propertyData._classification?.listingType;
        if (lt && processResults.byType[lt])
          processResults.byType[lt].updated++;
      } else if (op === "skipped_no_update") {
        // you previously treated skip as success → keep same
        processResults.successful++;
        processResults.operations.skipped_no_update++;
      }
    }

    /* ----------------------- PARALLEL AGENT LINKING ----------------------- */

    const liveForLinking = allPropertiesToProcess.filter(
      (p) =>
        (p.general_listing_information?.status || "").toLowerCase() === "live"
    );

    const agentResults = await runWithConcurrency(
      liveForLinking,
      10,
      async (propertyData) => {
        const agentEmail =
          propertyData.listing_agent?.listing_agent_email?.toLowerCase();

        if (!agentEmail) {
          return { id: propertyData.id, outcome: "skipped_no_agent" };
        }

        try {
          const res = await linkPropertyToAgent(propertyData);
          if (res.success) {
            return { id: propertyData.id, outcome: res.operation };
          } else {
            // collect "agent_not_found" details in missingAgentsSet
            if (res.operation === "agent_not_found") {
              missingAgentsSet.add(
                JSON.stringify({
                  email: agentEmail,
                  propertyId: propertyData.id,
                  agentName: `${
                    propertyData.listing_agent?.listing_agent_firstname || ""
                  } ${
                    propertyData.listing_agent?.listing_agent_lastname || ""
                  }`.trim(),
                  phone:
                    propertyData.listing_agent?.listing_agent_mobil_phone ||
                    propertyData.listing_agent?.listing_agent_phone ||
                    "N/A",
                  propertyStatus:
                    propertyData.general_listing_information?.status,
                  propertyWasSkipped:
                    mainOpById.get(propertyData.id) === "skipped_no_update",
                })
              );
            }
            return { id: propertyData.id, outcome: res.operation || "failed" };
          }
        } catch (e) {
          return { id: propertyData.id, outcome: "failed", error: e.message };
        }
      }
    );

    // fold agent results into counters/logs
    for (const r of agentResults) {
      if (r.outcome === "property_added")
        processResults.operations.agentPropertiesAdded++;
      else if (r.outcome === "property_updated")
        processResults.operations.agentPropertiesUpdated++;
      else if (r.outcome === "agent_not_found")
        processResults.operations.agentNotFound++;
      else if (r.outcome === "skipped")
        processResults.operations.agentSkipped++;
      else if (r.outcome === "skipped_no_agent")
        processResults.operations.agentSkipped++;
      else if (r.outcome === "skipped_not_live")
        processResults.operations.agentSkippedNonActive++;
      else if (r.outcome === "failed") processResults.operations.agentFailed++;
    }

    /* ----------------------------- Missing Agents ----------------------------- */

    const missingAgentsList = Array.from(missingAgentsSet).map((item) =>
      JSON.parse(item)
    );

    const missingAgentsSummary = missingAgentsList.reduce((acc, agent) => {
      if (!acc[agent.email]) {
        acc[agent.email] = {
          email: agent.email,
          agentName: agent.agentName,
          phone: agent.phone,
          propertyCount: 0,
          properties: [],
        };
      }
      acc[agent.email].propertyCount++;
      acc[agent.email].properties.push({
        propertyId: agent.propertyId,
        status: agent.propertyStatus,
      });
      return acc;
    }, {});

    const missingAgentsArray = Object.values(missingAgentsSummary);

    /* --------------------------------- Finish -------------------------------- */

    console.log("=== DATABASE PROCESSING COMPLETED ===");
    console.log(
      `Successfully processed: ${processResults.successful} properties`
    );
    console.log(`Failed: ${processResults.failed} properties`);
    console.log(`Skipped: ${processResults.skipped} properties (invalid data)`);
    console.log(`Live properties: ${processResults.livePropertiesAttempted}`);
    console.log(
      `Non-Live properties: ${processResults.nonLivePropertiesAttempted}`
    );
    console.log(
      `Operations: Created ${processResults.operations.created}, Updated ${processResults.operations.updated}`
    );
    console.log(
      `Agent Operations: Added ${processResults.operations.agentPropertiesAdded}, ` +
        `Updated ${processResults.operations.agentPropertiesUpdated}, ` +
        `Not Found ${processResults.operations.agentNotFound}, ` +
        `Skipped ${processResults.operations.agentSkippedNonActive}`
    );
    console.log(`By Type:`, processResults.byType);

    console.log(
      `\n⚠️  Missing Agents: ${missingAgentsArray.length} unique agents not found`
    );
    if (missingAgentsArray.length > 0) {
      console.log("\n🔍 Top Missing Agents:");
      missingAgentsArray.slice(0, 10).forEach((agent, index) => {
        console.log(`   ${index + 1}. ${agent.email}`);
        console.log(`      Name: ${agent.agentName || "N/A"}`);
        console.log(`      Phone: ${agent.phone}`);
        console.log(`      Properties: ${agent.propertyCount}`);
      });
      if (missingAgentsArray.length > 10) {
        console.log(`   ... and ${missingAgentsArray.length - 10} more agents`);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "✅ XML data processed successfully - All properties saved with bulkWrite and agent linking",
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
        failures: processResults.failures.slice(0, 5),
      },
      missingAgents: {
        total: missingAgentsArray.length,
        totalPropertiesAffected: missingAgentsList.length,
        agents: missingAgentsArray,
      },
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

/* ------------------------------- Scheduler ------------------------------- */

// Cron job for every 2 hours — call controller directly (no HTTP call)
const schedulePropertySync = () => {
  const TZ = process.env.CRON_TZ || "Etc/UTC";
  cron.schedule(
    "*/150 * * * *",
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`🔄 [${startedAt}] Starting scheduled property sync...`);

      const fakeReq = {};
      const fakeRes = {
        _status: 200,
        status(code) {
          this._status = code;
          return this;
        },
        json(payload) {
          try {
            const summary = {
              success: payload?.success,
              totalPropertiesInXml: payload?.totalPropertiesInXml,
              processedProperties: payload?.processedProperties,
              liveProperties: payload?.liveProperties,
              nonLiveProperties: payload?.nonLiveProperties,
              skippedProperties: payload?.skippedProperties,
            };
            console.log(
              `✅ [${new Date().toISOString()}] Property sync completed:`,
              summary
            );
          } catch (e) {
            console.log(
              `✅ [${new Date().toISOString()}] Property sync completed.`
            );
          }
          return payload;
        },
      };

      try {
        await parseXmlFromUrl(fakeReq, fakeRes);
      } catch (error) {
        console.error(
          `❌ [${new Date().toISOString()}] Property sync failed:`,
          error.message
        );
      }
    },
    { timezone: TZ }
  );

  console.log("⏰ Property sync scheduler initialized - Running every 2 hours");
};

// Deleting function for properties not in the XML file
async function fetchAllXmlPropertyIds() {
  console.log("🔎 Searching ids in XML...");
  const xmlUrl = process.env.XML_URL;
  if (!xmlUrl) throw new Error("XML_URL is not configured");

  const response = await axios.get(xmlUrl, {
    headers: { Accept: "application/xml" },
    timeout: 120000, // 120s
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalize: true,
    normalizeTags: false,
    trim: true,
  });

  const result = await parser.parseStringPromise(response.data);

  let xmlProps = [];
  if (result?.list?.property) {
    xmlProps = Array.isArray(result.list.property)
      ? result.list.property
      : [result.list.property];
  } else {
    const findPropertiesArray = (obj) => {
      for (const key in obj) {
        if (
          Array.isArray(obj[key]) &&
          obj[key].length > 0 &&
          obj[key][0] &&
          (obj[key][0].Id || obj[key][0].general_listing_information)
        )
          return obj[key];
        else if (typeof obj[key] === "object" && obj[key] !== null) {
          const found = findPropertiesArray(obj[key]);
          if (found) return found;
        }
      }
      return null;
    };
    const arr = findPropertiesArray(result);
    if (arr) xmlProps = arr;
  }

  const xmlIdSet = new Set();
  for (const p of xmlProps) {
    const raw = p?.Id || p?.id;
    if (typeof raw === "string") {
      const norm = raw.trim();
      if (norm) xmlIdSet.add(norm);
    }
  }
  console.log(`📦 XML has ${xmlIdSet.size} ids.`);
  return xmlIdSet;
}

const cleanupMissingProperties = async (req, res) => {
  try {
    console.log("🧹 Deleter function running!");
    const dryRun = String(req.query?.dryRun ?? "0") === "1";
    const returnIds = String(req.query?.returnIds ?? "0") === "1"; // include sample ids in HTTP response
    const progressEvery = Number(req.query?.progressEvery ?? 5000); // log frequency
    const sampleCap = Number(req.query?.sampleCap ?? 100); // how many ids to echo in response
    const deleteChunkSize = Number(req.query?.deleteChunkSize ?? 5000); // delete in chunks
    const agentChunkSize = Number(req.query?.agentChunkSize ?? 5000); // $pull in chunks

    // 1) XML ids as a Set
    const xmlIds = await fetchAllXmlPropertyIds();

    // 2) Stream DB ids via cursor (fast & low memory)
    const cursor = Property.find({}, { id: 1 })
      .lean()
      .cursor({ batchSize: 5000 });

    const missing = [];
    let scanned = 0;
    let printedCount = 0;

    console.time("⏱️ missing-diff");
    for await (const doc of cursor) {
      scanned++;
      const id = typeof doc?.id === "string" ? doc.id.trim() : null;
      if (!id) continue;

      if (!xmlIds.has(id)) {
        missing.push(id);
        // Log first few missing immediately so you can SEE progress
        if (printedCount < 10) {
          console.log(`❗ Missing found: ${id}`);
          printedCount++;
        }
      }

      if (scanned % progressEvery === 0) {
        console.log(
          `...scanned ${scanned} DB docs; missing so far: ${missing.length}`
        );
      }
    }
    console.timeEnd("⏱️ missing-diff");

    // 3) Nothing to do?
    if (missing.length === 0) {
      console.log(
        `✅ DB is in sync. Scanned ${scanned} docs, XML=${xmlIds.size}`
      );
      return res.status(200).json({
        success: true,
        message: "No missing properties. DB is in sync with XML.",
        dryRun,
        counts: { xmlCount: xmlIds.size, dbScanned: scanned, toDelete: 0 },
      });
    }

    // If DRY RUN: preview + return a small sample
    if (dryRun) {
      console.log(
        `🟡 DRY-RUN: would delete ${missing.length} properties. Example:`,
        missing.slice(0, 10)
      );
      return res.status(200).json({
        success: true,
        message:
          "Dry-run: the following properties would be deleted and unlinked from agents.",
        dryRun: true,
        counts: {
          xmlCount: xmlIds.size,
          dbScanned: scanned,
          toDelete: missing.length,
        },
        sampleIds: returnIds ? missing.slice(0, sampleCap) : undefined,
      });
    }

    // 4) EXECUTE: delete in CHUNKS (avoid giant single op stalls)
    let deletedTotal = 0;
    console.time("⏱️ delete-properties");
    for (let i = 0; i < missing.length; i += deleteChunkSize) {
      const chunk = missing.slice(i, i + deleteChunkSize);
      const delRes = await Property.deleteMany({ id: { $in: chunk } });
      deletedTotal += delRes?.deletedCount ?? 0;
      console.log(
        `🗑️ Deleted chunk ${i}-${i + chunk.length - 1} (size=${
          chunk.length
        }) → removed ${delRes?.deletedCount ?? 0}`
      );
    }
    console.timeEnd("⏱️ delete-properties");

    // 5) Unlink from agents in CHUNKS
    let agentsUpdatedTotal = 0;
    console.time("⏱️ unlink-agents");
    for (let i = 0; i < missing.length; i += agentChunkSize) {
      const chunk = missing.slice(i, i + agentChunkSize);
      const pullRes = await Agent.updateMany(
        {},
        { $pull: { properties: { propertyId: { $in: chunk } } } }
      );
      agentsUpdatedTotal += pullRes?.modifiedCount ?? 0;
      console.log(
        `🔗 Unlinked chunk ${i}-${i + chunk.length - 1} (size=${
          chunk.length
        }) → agents modified ${pullRes?.modifiedCount ?? 0}`
      );
    }
    console.timeEnd("⏱️ unlink-agents");

    // 6) Done
    console.log(
      `✅ Cleanup complete. Deleted ${deletedTotal}, agent docs updated ${agentsUpdatedTotal}.`
    );
    return res.status(200).json({
      success: true,
      message:
        "Cleanup complete: removed properties not present in XML and unlinked from agents.",
      dryRun: false,
      counts: {
        xmlCount: xmlIds.size,
        dbScanned: scanned,
        deletedProperties: deletedTotal,
        agentsUpdated: agentsUpdatedTotal,
        affectedPropertyIds: missing.length,
      },
      sampleIds: returnIds ? missing.slice(0, sampleCap) : undefined,
    });
  } catch (err) {
    console.error("❌ cleanupMissingProperties error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Cleanup failed",
      error: err.message,
    });
  }
};

module.exports = {
  parseXmlFromUrl,
  schedulePropertySync,
  cleanupMissingProperties,
};
