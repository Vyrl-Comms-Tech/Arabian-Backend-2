// const Agent = require("../Models/AgentModel");
// const path = require("path");
// const fs = require("fs");
// const axios = require("axios");
// const cron = require("node-cron");


// // Create a new agent with sequence number
// const createAgent = async (req, res) => {
//   console.log(req.body);
//   try {
//     // if an image was uploaded, set imageUrl to its path (relative to /public)
//     if (req.file) {
//       req.body.imageUrl = `/uploads/agents/${req.file.filename}`;
//     }
//     if (req.body.superAgent !== undefined) {
//       req.body.superAgent =
//         req.body.superAgent === "true" || req.body.superAgent === true;
//     }
//     // If sequenceNumber is provided, validate it
//     if (req.body.sequenceNumber) {
//       const sequenceNumber = parseInt(req.body.sequenceNumber);
//       if (sequenceNumber < 1) {
//         return res.status(400).json({
//           success: false,
//           error: "Sequence number must be at least 1",
//         });
//       }

//       // Check if sequence number already exists
//       const existingAgent = await Agent.findOne({ sequenceNumber });
//       if (existingAgent) {
//         return res.status(400).json({
//           success: false,
//           error: `Sequence number ${sequenceNumber} is already taken by agent: ${existingAgent.agentName}`,
//         });
//       }

//       req.body.sequenceNumber = sequenceNumber;
//     }

//     const agent = await Agent.create(req.body);
//     res.status(201).json({ success: true, data: agent });
//   } catch (err) {
//     res.status(400).json({ success: false, error: err.message });
//   }
// };

// // Get all agents (now sorted by sequence number)
// const getAgents = async (req, res) => {
//   try {
//     const agents = await Agent.find()
//       // .select("agentName agentId email designation phone whatsapp imageUrl sequenceNumber")
//       .sort({ sequenceNumber: 1, agentName: 1 });

//     res.status(200).json({ success: true, data: agents });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };
// // Get a single agent by agentId
// const getAgentById = async (req, res) => {
//   try {
//     // console.log(req.query.agentId)
//     const agent = await Agent.findOne({ agentId: req.query.agentId });
//     if (!agent) {
//       return res.status(404).json({ success: false, error: "Agent not found" });
//     }
//     res.status(200).json({ success: true, data: agent });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// const getAgentByEmail = async (req, res) => {
//   try {
//     const agent = await Agent.findOne({ email: req.query.email });
//     if (!agent) {
//       return res.status(404).json({ success: false, error: "Agent not found" });
//     }
//     res.status(200).json({ success: true, data: agent });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// const updateAgent = async (req, res) => {
//   try {
//     const { agentId, ...requestFields } = req.body;

//     if (!agentId) {
//       return res
//         .status(400)
//         .json({ success: false, error: "Agent ID is required" });
//     }

//     // First, find the current agent
//     const existingAgent = await Agent.findOne({ agentId });
//     if (!existingAgent) {
//       return res.status(404).json({ success: false, error: "Agent not found" });
//     }

//     // Handle sequence number update with swapping logic
//     if (requestFields.sequenceNumber !== undefined) {
//       const newSequenceNumber = parseInt(requestFields.sequenceNumber);

//       if (isNaN(newSequenceNumber) || newSequenceNumber < 1) {
//         return res.status(400).json({
//           success: false,
//           error: "Sequence number must be a positive integer",
//         });
//       }

//       // Only proceed with swap if the sequence number is actually changing
//       if (existingAgent.sequenceNumber !== newSequenceNumber) {
//         try {
//           await Agent.swapSequenceNumbers(agentId, newSequenceNumber);

//           // Fetch the updated agent to return
//           const updatedAgent = await Agent.findOne({ agentId });
//           return res.status(200).json({
//             success: true,
//             message: `Agent sequence number updated successfully to ${newSequenceNumber}`,
//             data: updatedAgent,
//           });
//         } catch (swapError) {
//           return res.status(400).json({
//             success: false,
//             error: `Failed to update sequence number: ${swapError.message}`,
//           });
//         }
//       } else {
//         // Remove sequenceNumber from requestFields since it's not changing
//         delete requestFields.sequenceNumber;
//       }
//     }

//     // Build update object for other fields
//     const buildUpdateObject = (fields, file, currentAgent) => {
//       const updateObj = {};

//       const allowedFields = [
//         "agentName",
//         "designation",
//         "reraNumber",
//         "specialistAreas",
//         "description",
//         "email",
//         "phone",
//         "whatsapp",
//         "activeSaleListings",
//         "propertiesSoldLast15Days",
//         "agentLanguage",
//         "isActive",
//         "superAgent", // Add this line
//       ];

//       allowedFields.forEach((field) => {
//         if (fields[field] !== undefined && fields[field] !== "") {
//           // Special handling for email - only update if different
//           if (field === "email") {
//             if (fields[field] !== currentAgent.email) {
//               updateObj[field] = fields[field];
//             }
//             return;
//           }

//           // Handle other special cases
//           switch (field) {
//             case "specialistAreas":
//               if (typeof fields[field] === "string") {
//                 try {
//                   updateObj[field] = JSON.parse(fields[field]);
//                 } catch (e) {
//                   updateObj[field] = fields[field];
//                 }
//               } else {
//                 updateObj[field] = fields[field];
//               }
//               break;

//             case "activeSaleListings":
//             case "propertiesSoldLast15Days":
//               updateObj[field] = parseInt(fields[field]) || 0;
//               break;

//             case "isActive":
//               updateObj[field] =
//                 fields[field] === "true" || fields[field] === true;
//               break;
//             case "superAgent":
//               updateObj[field] =
//                 fields[field] === "true" || fields[field] === true;
//               break;

//             default:
//               updateObj[field] = fields[field];
//           }
//         }
//       });

//       if (file) {
//         updateObj.imageUrl = `/uploads/agents/${file.filename}`;
//       }

//       updateObj.lastUpdated = new Date();
//       return updateObj;
//     };

//     // Build update object with current agent data (excluding sequenceNumber)
//     const updateFields = buildUpdateObject(
//       requestFields,
//       req.file,
//       existingAgent
//     );

//     // If no fields to update, return current agent
//     if (Object.keys(updateFields).length <= 1) {
//       // Only lastUpdated
//       return res.status(200).json({
//         success: true,
//         message: "No changes detected",
//         data: existingAgent,
//       });
//     }

//     console.log("Fields to update:", updateFields);

//     // Check if email is being updated and if it already exists
//     if (updateFields.email) {
//       const emailExists = await Agent.findOne({
//         email: updateFields.email,
//         agentId: { $ne: agentId }, // Exclude current agent
//       });

//       if (emailExists) {
//         return res.status(400).json({
//           success: false,
//           error: `Email "${updateFields.email}" is already in use by another agent`,
//         });
//       }
//     }

//     // Update agent
//     const updatedAgent = await Agent.findOneAndUpdate(
//       { agentId },
//       { $set: updateFields },
//       {
//         new: true,
//         runValidators: true,
//       }
//     );

//     res.status(200).json({
//       success: true,
//       message: `Agent updated successfully. Updated fields: ${Object.keys(
//         updateFields
//       )
//         .filter((f) => f !== "lastUpdated")
//         .join(", ")}`,
//       data: updatedAgent,
//     });
//   } catch (err) {
//     console.error("Update agent error:", err);

//     // Handle duplicate key errors specifically
//     if (err.code === 11000) {
//       const field = Object.keys(err.keyPattern)[0];
//       const value = err.keyValue[field];
//       return res.status(400).json({
//         success: false,
//         error: `${
//           field.charAt(0).toUpperCase() + field.slice(1)
//         } "${value}" already exists`,
//       });
//     }

//     res.status(400).json({ success: false, error: err.message });
//   }
// };

// const getAgentsBySequence = async (req, res) => {
//   try {
//     const { activeOnly = true } = req.query;

//     const query = activeOnly === "true" ? { isActive: true } : {};
//     const agents = await Agent.find(query).sort({
//       sequenceNumber: 1,
//       agentName: 1,
//     });

//     res.status(200).json({ success: true, data: agents });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// const deleteAgent = async (req, res) => {
//   try {
//     const agent = await Agent.findOneAndDelete({ agentId: req.query.agentId });

//     if (!agent) {
//       return res.status(404).json({ success: false, error: "Agent not found" });
//     }

//     // optionally remove the image file
//     if (agent.imageUrl) {
//       const filePath = path.join(__dirname, "../public", agent.imageUrl);
//       fs.unlink(filePath, () => {});
//     }

//     // After deleting an agent, you might want to reorder sequences
//     // Uncomment the line below if you want automatic reordering after deletion
//     // await Agent.reorderSequences();

//     res.status(200).json({ success: true, msg: "Agent Removed" });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// // Leadrboard
// function normalizeAgentName(name) {
//   if (!name) return "";

//   return name
//     .toLowerCase()
//     .trim()
//     .replace(/\s+/g, " ") // Replace multiple spaces with single space
//     .replace(/[^\w\s]/g, ""); // Remove special characters except spaces
// }


// const getSalesforceToken = async () => {
//   try {
//     const response = await axios.post(process.env.SALESFORCE_TOKEN_URL, null, {
//       params: {
//         grant_type: "password",
//         client_id: process.env.SALESFORCE_CLIENT_ID,
//         client_secret: process.env.SALESFORCE_CLIENT_SECRET,
//         username: process.env.SALESFORCE_USERNAME,
//         password: process.env.SALESFORCE_PASSWORD,
//       },
//     });
//     return response.data.access_token;
//   } catch (error) {
//     console.error("❌ Failed to generate Salesforce token:", error.message);
//     throw new Error("Token generation failed");
//   }
// };

// // Sync function for deals (modified to work without req/res for cron)
// const syncDealsJob = async (month = "this_month") => {
//   try {
//     console.log(`🔄 [CRON] Starting Salesforce deals sync for period: ${month}`);

//     const token = await getSalesforceToken();
//     const salesforceUrl = `https://arabianestates.my.salesforce.com/services/apexrest/deals?month=${month}`;

//     const salesforceResponse = await axios.get(salesforceUrl, {
//       timeout: 30000,
//       headers: {
//         Accept: "application/json",
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     const deals = salesforceResponse.data?.deals || [];

//     if (!deals || deals.length === 0) {
//       console.log("📊 No deals found in Salesforce");
//       return;
//     }

//     console.log(`📊 Found ${deals.length} deals from Salesforce`);

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map();
//     agents.forEach((agent) => {
//       const normalizedName = normalizeAgentName(agent.agentName);
//       agentMap.set(normalizedName, agent);
//     });

//     const stats = {
//       totalDeals: deals.length,
//       agentsUpdated: 0,
//       dealsByAgent: new Map(),
//     };

//     for (const deal of deals) {
//       const ownerName = deal.owner_name;
//       if (!ownerName) continue;

//       const commissionAgents = deal.commission_agents
//         ? deal.commission_agents.split(/[;,]/).map((name) => name.trim())
//         : [ownerName];

//       const dealCommission = parseFloat(deal.total_commissions) || 0;
//       const commissionPerAgent = dealCommission / commissionAgents.length;

//       for (const agentName of commissionAgents) {
//         if (!agentName) continue;

//         const normalizedName = normalizeAgentName(agentName);

//         if (agentMap.has(normalizedName)) {
//           const currentStats = stats.dealsByAgent.get(normalizedName) || {
//             dealCount: 0,
//             totalCommission: 0,
//           };

//           currentStats.dealCount += 1;
//           currentStats.totalCommission += commissionPerAgent;
//           stats.dealsByAgent.set(normalizedName, currentStats);
//         }
//       }
//     }

//     const updatePromises = [];
//     for (const [normalizedName, agentStats] of stats.dealsByAgent.entries()) {
//       const agent = agentMap.get(normalizedName);
//       if (agent) {
//         agent.updateLeaderboardMetrics({
//           propertiesSold: agentStats.dealCount,
//           totalCommission: Math.round(agentStats.totalCommission * 100) / 100,
//         });
//         updatePromises.push(agent.save());
//         stats.agentsUpdated++;
//       }
//     }

//     await Promise.all(updatePromises);
//     console.log(`✅ [CRON] Deals sync completed. Updated ${stats.agentsUpdated} agents`);
//   } catch (error) {
//     console.error("❌ [CRON] Error syncing deals:", error.message);
//   }
// };

// // Sync function for viewings (modified to work without req/res for cron)
// const syncViewingsJob = async (month = "this_month") => {
//   try {
//     console.log(`🔄 [CRON] Starting Salesforce viewings sync for period: ${month}`);

//     const token = await getSalesforceToken();
//     const salesforceUrl = `https://arabianestates.my.salesforce.com/services/apexrest/viewings?month=${month}`;

//     const salesforceResponse = await axios.get(salesforceUrl, {
//       timeout: 30000,
//       headers: {
//         Accept: "application/json",
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     const viewings = salesforceResponse.data?.viewings || [];

//     if (!viewings || viewings.length === 0) {
//       console.log("📊 No viewings found in Salesforce");
//       return;
//     }

//     console.log(`📊 Found ${viewings.length} viewings from Salesforce`);

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map();
//     agents.forEach((agent) => {
//       const normalizedName = normalizeAgentName(agent.agentName);
//       agentMap.set(normalizedName, agent);
//     });

//     const stats = {
//       totalViewings: viewings.length,
//       agentsUpdated: 0,
//       viewingsByAgent: new Map(),
//     };

//     for (const viewing of viewings) {
//       const agentName = viewing.owner;
//       if (!agentName) continue;

//       const normalizedName = normalizeAgentName(agentName);

//       if (agentMap.has(normalizedName)) {
//         const currentCount = stats.viewingsByAgent.get(normalizedName) || 0;
//         stats.viewingsByAgent.set(normalizedName, currentCount + 1);
//       }
//     }

//     const updatePromises = [];
//     for (const [normalizedName, viewingCount] of stats.viewingsByAgent.entries()) {
//       const agent = agentMap.get(normalizedName);
//       if (agent) {
//         agent.updateLeaderboardMetrics({
//           viewings: viewingCount,
//         });
//         updatePromises.push(agent.save());
//         stats.agentsUpdated++;
//       }
//     }

//     await Promise.all(updatePromises);
//     console.log(`✅ [CRON] Viewings sync completed. Updated ${stats.agentsUpdated} agents`);
//   } catch (error) {
//     console.error("❌ [CRON] Error syncing viewings:", error.message);
//   }
// };

// // Sync function for offers (modified to work without req/res for cron)
// const syncOffersJob = async (month = "this_month") => {
//   try {
//     console.log(`🔄 [CRON] Starting Salesforce offers sync for period: ${month}`);

//     const token = await getSalesforceToken();
//     const salesforceUrl = `https://arabianestates.my.salesforce.com/services/apexrest/Offers?month=${month}`;

//     const salesforceResponse = await axios.get(salesforceUrl, {
//       timeout: 30000,
//       headers: {
//         Accept: "application/json",
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     const offers = salesforceResponse.data?.Offer || [];

//     if (!offers || offers.length === 0) {
//       console.log("📊 No offers found in Salesforce");
//       return;
//     }

//     console.log(`📊 Found ${offers.length} offers from Salesforce`);

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map();
//     agents.forEach((agent) => {
//       const normalizedName = normalizeAgentName(agent.agentName);
//       agentMap.set(normalizedName, agent);
//     });

//     const stats = {
//       totalOffers: offers.length,
//       agentsUpdated: 0,
//       offersByAgent: new Map(),
//     };

//     for (const offer of offers) {
//       const agentName = offer.owner;
//       if (!agentName) continue;

//       const normalizedName = normalizeAgentName(agentName);

//       if (agentMap.has(normalizedName)) {
//         const currentCount = stats.offersByAgent.get(normalizedName) || 0;
//         stats.offersByAgent.set(normalizedName, currentCount + 1);
//       }
//     }

//     const updatePromises = [];
//     for (const [normalizedName, offerCount] of stats.offersByAgent.entries()) {
//       const agent = agentMap.get(normalizedName);
//       if (agent) {
//         agent.updateLeaderboardMetrics({
//           offers: offerCount,
//         });
//         updatePromises.push(agent.save());
//         stats.agentsUpdated++;
//       }
//     }

//     await Promise.all(updatePromises);
//     console.log(`✅ [CRON] Offers sync completed. Updated ${stats.agentsUpdated} agents`);
//   } catch (error) {
//     console.error("❌ [CRON] Error syncing offers:", error.message);
//   }
// };

// // Combined job that runs all three syncs
// const runAllSyncs = async () => {
//   console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
//   const startTime = Date.now();

//   try {
//     // Run all three syncs in parallel for efficiency
//     await Promise.all([
//       syncDealsJob(),
//       syncViewingsJob(),
//       syncOffersJob()
//     ]);

//     const duration = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`✅ [CRON] All syncs completed successfully in ${duration}s`);
//   } catch (error) {
//     console.error("❌ [CRON] Error in scheduled sync job:", error.message);
//   }
// };

// // Setup cron job to run every 30 minutes
// const setupCronJobs = () => {
//   // Run every 30 minutes: "*/30 * * * *"
//   // This means: at minute 0 and 30 of every hour
//   cron.schedule("*/30 * * * *", async () => {
//     await runAllSyncs();
//   });

//   console.log("✅ Cron job scheduled: Salesforce sync will run every 30 minutes");
  
//   // Optional: Run immediately on startup
//   console.log("🚀 Running initial sync on startup...");
//   runAllSyncs();
// };

// // Original controller functions (for manual API calls)
// const syncAgentDealsFromSalesforce = async (req, res) => {
//   try {
//     const { month = "this_month" } = req.query;
//     console.log(`🔄 Starting Salesforce deals sync for period: ${month}`);

//     const token = await getSalesforceToken();
//     const salesforceUrl = `https://arabianestates.my.salesforce.com/services/apexrest/deals?month=${month}`;

//     let salesforceResponse;
//     try {
//       salesforceResponse = await axios.get(salesforceUrl, {
//         timeout: 30000,
//         headers: {
//           Accept: "application/json",
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//       });
//     } catch (apiError) {
//       console.error("❌ Salesforce API Error:", apiError.message);

//       if (apiError.response?.status === 401) {
//         return res.status(401).json({
//           success: false,
//           error: "Salesforce authentication failed. Invalid or expired Bearer token",
//           details: apiError.message,
//         });
//       }

//       return res.status(503).json({
//         success: false,
//         error: "Failed to fetch deals from Salesforce",
//         details: apiError.message,
//       });
//     }

//     const deals = salesforceResponse.data?.deals || [];

//     if (!deals || deals.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No deals found in Salesforce for the specified period",
//         data: {
//           totalDeals: 0,
//           agentsUpdated: 0,
//           period: month,
//         },
//       });
//     }

//     console.log(`📊 Found ${deals.length} deals from Salesforce`);

//     const agents = await Agent.find({ isActive: true });
//     console.log(`👥 Found ${agents.length} active agents in database`);

//     const agentMap = new Map();
//     agents.forEach((agent) => {
//       const normalizedName = normalizeAgentName(agent.agentName);
//       agentMap.set(normalizedName, agent);
//     });

//     const stats = {
//       totalDeals: deals.length,
//       agentsUpdated: 0,
//       unmatchedOwners: new Set(),
//       dealsByAgent: new Map(),
//     };

//     for (const deal of deals) {
//       const ownerName = deal.owner_name;

//       if (!ownerName) {
//         console.warn(`⚠️  Deal ${deal.deal_name} has no owner_name`);
//         continue;
//       }

//       const commissionAgents = deal.commission_agents
//         ? deal.commission_agents.split(/[;,]/).map((name) => name.trim())
//         : [ownerName];

//       const dealCommission = parseFloat(deal.total_commissions) || 0;
//       const commissionPerAgent = dealCommission / commissionAgents.length;

//       for (const agentName of commissionAgents) {
//         if (!agentName) continue;

//         const normalizedName = normalizeAgentName(agentName);

//         if (agentMap.has(normalizedName)) {
//           const currentStats = stats.dealsByAgent.get(normalizedName) || {
//             dealCount: 0,
//             totalCommission: 0,
//           };

//           currentStats.dealCount += 1;
//           currentStats.totalCommission += commissionPerAgent;

//           stats.dealsByAgent.set(normalizedName, currentStats);
//         } else {
//           stats.unmatchedOwners.add(agentName);
//         }
//       }
//     }

//     const updatePromises = [];

//     for (const [normalizedName, agentStats] of stats.dealsByAgent.entries()) {
//       const agent = agentMap.get(normalizedName);

//       if (agent) {
//         console.log(
//           `📝 Updating ${agent.agentName}: ${
//             agentStats.dealCount
//           } deals, AED ${agentStats.totalCommission.toFixed(2)} commission`
//         );

//         agent.updateLeaderboardMetrics({
//           propertiesSold: agentStats.dealCount,
//           totalCommission: Math.round(agentStats.totalCommission * 100) / 100,
//         });

//         updatePromises.push(agent.save());
//         stats.agentsUpdated++;
//       }
//     }

//     await Promise.all(updatePromises);

//     console.log(`✅ Successfully updated ${stats.agentsUpdated} agents`);

//     const response = {
//       success: true,
//       message: `Successfully synced ${stats.totalDeals} deals and updated ${stats.agentsUpdated} agents`,
//       data: {
//         period: month,
//         totalDeals: stats.totalDeals,
//         agentsUpdated: stats.agentsUpdated,
//         agentDeals: Array.from(stats.dealsByAgent.entries()).map(
//           ([name, agentStats]) => ({
//             agentName: agentMap.get(name).agentName,
//             agentId: agentMap.get(name).agentId,
//             dealCount: agentStats.dealCount,
//             totalCommission: Math.round(agentStats.totalCommission * 100) / 100,
//           })
//         ),
//         unmatchedOwners:
//           Array.from(stats.unmatchedOwners).length > 0
//             ? Array.from(stats.unmatchedOwners)
//             : undefined,
//       },
//     };

//     if (stats.unmatchedOwners.size > 0) {
//       console.warn(
//         `⚠️  ${stats.unmatchedOwners.size} unmatched owner names:`,
//         Array.from(stats.unmatchedOwners).join(", ")
//       );
//     }

//     res.status(200).json(response);
//   } catch (error) {
//     console.error("❌ Error syncing Salesforce deals:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to sync deals from Salesforce",
//       details: error.message,
//     });
//   }
// };

// const syncAgentViewingsFromSalesforce = async (req, res) => {
//   try {
//     const { month = "this_month" } = req.query;

//     console.log(`🔄 Starting Salesforce viewings sync for period: ${month}`);

//     const token = await getSalesforceToken();

//     const salesforceUrl = `https://arabianestates.my.salesforce.com/services/apexrest/viewings?month=${month}`;

//     let salesforceResponse;
//     try {
//       salesforceResponse = await axios.get(salesforceUrl, {
//         timeout: 30000,
//         headers: {
//           Accept: "application/json",
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//       });
//     } catch (apiError) {
//       console.error("❌ Salesforce API Error:", apiError.message);

//       if (apiError.response?.status === 401) {
//         return res.status(401).json({
//           success: false,
//           error:
//             "Salesforce authentication failed. Invalid or expired Bearer token",
//           details: apiError.message,
//         });
//       }

//       return res.status(503).json({
//         success: false,
//         error: "Failed to fetch viewings from Salesforce",
//         details: apiError.message,
//       });
//     }

//     const viewings = salesforceResponse.data?.viewings || [];

//     if (!viewings || viewings.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No viewings found in Salesforce for the specified period",
//         data: {
//           totalViewings: 0,
//           agentsUpdated: 0,
//           period: month,
//         },
//       });
//     }

//     console.log(`📊 Found ${viewings.length} viewings from Salesforce`);

//     const agents = await Agent.find({ isActive: true });
//     console.log(`👥 Found ${agents.length} active agents in database`);

//     const agentMap = new Map();
//     agents.forEach((agent) => {
//       const normalizedName = normalizeAgentName(agent.agentName);
//       agentMap.set(normalizedName, agent);
//     });

//     const stats = {
//       totalViewings: viewings.length,
//       agentsUpdated: 0,
//       unmatchedOwners: new Set(),
//       viewingsByAgent: new Map(),
//     };

//     for (const viewing of viewings) {
//       const agentName = viewing.owner;

//       if (!agentName) {
//         console.warn(
//           `⚠️  Viewing ${viewing.viewing_id || viewing.id} has no agent_name`
//         );
//         continue;
//       }

//       const normalizedName = normalizeAgentName(agentName);

//       if (agentMap.has(normalizedName)) {
//         const currentCount = stats.viewingsByAgent.get(normalizedName) || 0;
//         stats.viewingsByAgent.set(normalizedName, currentCount + 1);
//       } else {
//         stats.unmatchedOwners.add(agentName);
//       }
//     }

//     const updatePromises = [];

//     for (const [
//       normalizedName,
//       viewingCount,
//     ] of stats.viewingsByAgent.entries()) {
//       const agent = agentMap.get(normalizedName);

//       if (agent) {
//         console.log(`📝 Updating ${agent.agentName}: ${viewingCount} viewings`);

//         agent.updateLeaderboardMetrics({
//           viewings: viewingCount,
//         });

//         updatePromises.push(agent.save());
//         stats.agentsUpdated++;
//       }
//     }

//     await Promise.all(updatePromises);

//     console.log(`✅ Successfully updated ${stats.agentsUpdated} agents`);

//     const response = {
//       success: true,
//       message: `Successfully synced ${stats.totalViewings} viewings and updated ${stats.agentsUpdated} agents`,
//       data: {
//         period: month,
//         totalViewings: stats.totalViewings,
//         agentsUpdated: stats.agentsUpdated,
//         agentViewings: Array.from(stats.viewingsByAgent.entries()).map(
//           ([name, count]) => ({
//             agentName: agentMap.get(name).agentName,
//             agentId: agentMap.get(name).agentId,
//             viewingCount: count,
//           })
//         ),
//         unmatchedOwners:
//           Array.from(stats.unmatchedOwners).length > 0
//             ? Array.from(stats.unmatchedOwners)
//             : undefined,
//       },
//     };

//     if (stats.unmatchedOwners.size > 0) {
//       console.warn(
//         `⚠️  ${stats.unmatchedOwners.size} unmatched agent names:`,
//         Array.from(stats.unmatchedOwners).join(", ")
//       );
//     }

//     res.status(200).json(response);
//   } catch (error) {
//     console.error("❌ Error syncing Salesforce viewings:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to sync viewings from Salesforce",
//       details: error.message,
//     });
//   }
// };

// const syncAgentOffersFromSalesforce = async (req, res) => {
//   try {
//     const { month = "this_month" } = req.query;

//     console.log(`🔄 Starting Salesforce offers sync for period: ${month}`);

//     const token = await getSalesforceToken();

//     const salesforceUrl = `https://arabianestates.my.salesforce.com/services/apexrest/Offers?month=${month}`;

//     let salesforceResponse;
//     try {
//       salesforceResponse = await axios.get(salesforceUrl, {
//         timeout: 30000,
//         headers: {
//           Accept: "application/json",
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//       });
//     } catch (apiError) {
//       console.error("❌ Salesforce API Error:", apiError.message);

//       if (apiError.response?.status === 401) {
//         return res.status(401).json({
//           success: false,
//           error:
//             "Salesforce authentication failed. Invalid or expired Bearer token",
//           details: apiError.message,
//         });
//       }

//       return res.status(503).json({
//         success: false,
//         error: "Failed to fetch offers from Salesforce",
//         details: apiError.message,
//       });
//     }

//     const offers = salesforceResponse.data?.Offer || [];

//     if (!offers || offers.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No offers found in Salesforce for the specified period",
//         data: {
//           totalOffers: 0,
//           agentsUpdated: 0,
//           period: month,
//         },
//       });
//     }

//     console.log(`📊 Found ${offers.length} offers from Salesforce`);

//     const agents = await Agent.find({ isActive: true });
//     console.log(`👥 Found ${agents.length} active agents in database`);

//     const agentMap = new Map();
//     agents.forEach((agent) => {
//       const normalizedName = normalizeAgentName(agent.agentName);
//       agentMap.set(normalizedName, agent);
//     });

//     const stats = {
//       totalOffers: offers.length,
//       agentsUpdated: 0,
//       unmatchedOwners: new Set(),
//       offersByAgent: new Map(),
//     };

//     for (const offer of offers) {
//       const agentName = offer.owner;

//       if (!agentName) {
//         console.warn(`⚠️  Offer ${offer.offer_name || offer.id} has no owner`);
//         continue;
//       }

//       const normalizedName = normalizeAgentName(agentName);

//       if (agentMap.has(normalizedName)) {
//         const currentCount = stats.offersByAgent.get(normalizedName) || 0;
//         stats.offersByAgent.set(normalizedName, currentCount + 1);
//       } else {
//         stats.unmatchedOwners.add(agentName);
//       }
//     }

//     const updatePromises = [];

//     for (const [normalizedName, offerCount] of stats.offersByAgent.entries()) {
//       const agent = agentMap.get(normalizedName);

//       if (agent) {
//         console.log(`📝 Updating ${agent.agentName}: ${offerCount} offers`);

//         agent.updateLeaderboardMetrics({
//           offers: offerCount,
//         });

//         updatePromises.push(agent.save());
//         stats.agentsUpdated++;
//       }
//     }

//     await Promise.all(updatePromises);

//     console.log(`✅ Successfully updated ${stats.agentsUpdated} agents`);

//     const response = {
//       success: true,
//       message: `Successfully synced ${stats.totalOffers} offers and updated ${stats.agentsUpdated} agents`,
//       data: {
//         period: month,
//         totalOffers: stats.totalOffers,
//         agentsUpdated: stats.agentsUpdated,
//         agentOffers: Array.from(stats.offersByAgent.entries()).map(
//           ([name, count]) => ({
//             agentName: agentMap.get(name).agentName,
//             agentId: agentMap.get(name).agentId,
//             offerCount: count,
//           })
//         ),
//         unmatchedOwners:
//           Array.from(stats.unmatchedOwners).length > 0
//             ? Array.from(stats.unmatchedOwners)
//             : undefined,
//       },
//     };

//     if (stats.unmatchedOwners.size > 0) {
//       console.warn(
//         `⚠️  ${stats.unmatchedOwners.size} unmatched agent names:`,
//         Array.from(stats.unmatchedOwners).join(", ")
//       );
//     }

//     res.status(200).json(response);
//   } catch (error) {
//     console.error("❌ Error syncing Salesforce offers:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to sync offers from Salesforce",
//       details: error.message,
//     });
//   }
// };


// module.exports = {
//   createAgent,
//   getAgents,
//   getAgentById,
//   getAgentByEmail,
//   updateAgent,
//   getAgentsBySequence, // NEW: Get agents sorted by sequence
//   deleteAgent,

//   // Leaderboard Apis
//   // -- Deals and Commissions
//   syncAgentDealsFromSalesforce,
//   // -- Viewings
//   syncAgentViewingsFromSalesforce,
//   // -- Offers
//   syncAgentOffersFromSalesforce,
//   // -- Token
//   getSalesforceToken,


//   // cron job
//   setupCronJobs
// };







/* eslint-disable no-console */
const Agent = require("../Models/AgentModel");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cron = require("node-cron");

// -----------------------------
// Utilities
// -----------------------------
const isTruthy = (v) => v === true || v === "true";
const clampInt = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

function normalizeAgentName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

// Remove leading slash from a relative URL path (so path.join works on Win/*nix)
const stripLeadingSlash = (p) => (typeof p === "string" ? p.replace(/^[/\\]+/, "") : p);

// -----------------------------
// Salesforce HTTP client
// -----------------------------
const SALESFORCE = {
  tokenUrl: process.env.SALESFORCE_TOKEN_URL,
  baseUrl: "https://arabianestates.my.salesforce.com",
  clientId: process.env.SALESFORCE_CLIENT_ID,
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  username: process.env.SALESFORCE_USERNAME,
  password: process.env.SALESFORCE_PASSWORD,
};

// quick sanity check (won’t crash app; just warn)
(function warnMissingEnv() {
  const missing = Object.entries({
    SALESFORCE_TOKEN_URL: SALESFORCE.tokenUrl,
    SALESFORCE_CLIENT_ID: SALESFORCE.clientId,
    SALESFORCE_CLIENT_SECRET: SALESFORCE.clientSecret,
    SALESFORCE_USERNAME: SALESFORCE.username,
    SALESFORCE_PASSWORD: SALESFORCE.password,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.warn(
      `⚠️  Missing Salesforce env vars: ${missing.join(", ")}. Token generation will fail until set.`
    );
  }
})();

const axiosSF = axios.create({
  baseURL: SALESFORCE.baseUrl,
  timeout: 30_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

// Simple retry helper for transient errors
async function withRetry(fn, { retries = 2, delayMs = 600 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      // Retry on 429/5xx/timeouts/ENOTFOUND/ECONNRESET
      const code = err?.code;
      const retryable =
        status === 429 ||
        (status >= 500 && status < 600) ||
        ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
      if (!retryable || i === retries) break;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// Token fetch (password grant) — kept separate for clarity
async function getSalesforceToken() {
  try {
    const resp = await axios.post(
      SALESFORCE.tokenUrl,
      null,
      {
        params: {
          grant_type: "password",
          client_id: SALESFORCE.clientId,
          client_secret: SALESFORCE.clientSecret,
          username: SALESFORCE.username,
          password: SALESFORCE.password,
        },
        timeout: 30_000,
      }
    );
    return resp.data.access_token;
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    throw new Error("Salesforce token generation failed");
  }
}

// Wrap a GET to Apex REST with auto token + retry
async function sfGet(pathname, params = {}) {
  const token = await getSalesforceToken();
  return withRetry(() =>
    axiosSF.get(pathname, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

// Allowed values for ?month=
const ALLOWED_MONTH = new Set([
  "this_month",
  "last_month",
  "last_3_months",
  "last_6_months",
  "ytd",
  "last_12_months",
]);

function ensureValidMonth(value = "this_month") {
  if (ALLOWED_MONTH.has(value)) return value;
  return "this_month";
}

// -----------------------------
// Create a new agent
// -----------------------------
const createAgent = async (req, res) => {
  try {
    // Do not log full bodies with potential PII
    // console.debug("createAgent payload keys:", Object.keys(req.body || {}));

    // file upload → imageUrl
    if (req.file) {
      req.body.imageUrl = `/uploads/agents/${req.file.filename}`;
    }

    if (req.body.superAgent !== undefined) {
      req.body.superAgent = isTruthy(req.body.superAgent);
    }

    // validate and enforce unique sequenceNumber if provided
    if (req.body.sequenceNumber) {
      const sequenceNumber = clampInt(req.body.sequenceNumber);
      if (sequenceNumber < 1) {
        return res.status(400).json({
          success: false,
          error: "Sequence number must be at least 1",
        });
      }
      const existingAgent = await Agent.findOne({ sequenceNumber });
      if (existingAgent) {
        return res.status(400).json({
          success: false,
          error: `Sequence number ${sequenceNumber} is already taken by agent: ${existingAgent.agentName}`,
        });
      }
      req.body.sequenceNumber = sequenceNumber;
    }

    const agent = await Agent.create(req.body);
    return res.status(201).json({ success: true, data: agent });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// -----------------------------
// Get agents
// -----------------------------
const getAgents = async (_req, res) => {
  try {
    const agents = await Agent.find().sort({ sequenceNumber: 1, agentName: 1 });
    return res.status(200).json({ success: true, data: agents });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findOne({ agentId: req.query.agentId });
    if (!agent) return res.status(404).json({ success: false, error: "Agent not found" });
    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getAgentByEmail = async (req, res) => {
  try {
    const agent = await Agent.findOne({ email: req.query.email });
    if (!agent) return res.status(404).json({ success: false, error: "Agent not found" });
    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// -----------------------------
// Update agent (+ sequence swap)
// -----------------------------
const updateAgent = async (req, res) => {
  try {
    const { agentId, ...requestFields } = req.body || {};
    
    if (!agentId) {
      return res.status(400).json({ success: false, error: "Agent ID is required" });
    }

    const existingAgent = await Agent.findOne({ agentId });
    if (!existingAgent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    // Handle sequenceNumber swap if changed
    if (requestFields.sequenceNumber !== undefined) {
      const newSequenceNumber = clampInt(requestFields.sequenceNumber, NaN);
      if (!Number.isFinite(newSequenceNumber) || newSequenceNumber < 1) {
        return res.status(400).json({
          success: false,
          error: "Sequence number must be a positive integer",
        });
      }

      if (existingAgent.sequenceNumber !== newSequenceNumber) {
        if (typeof Agent.swapSequenceNumbers !== "function") {
          return res.status(500).json({
            success: false,
            error: "Sequence swap not available: Agent.swapSequenceNumbers is undefined.",
          });
        }
        try {
          await Agent.swapSequenceNumbers(agentId, newSequenceNumber);
          const updatedAgent = await Agent.findOne({ agentId });
          return res.status(200).json({
            success: true,
            message: `Agent sequence number updated successfully to ${newSequenceNumber}`,
            data: updatedAgent,
          });
        } catch (swapError) {
          return res.status(400).json({
            success: false,
            error: `Failed to update sequence number: ${swapError.message}`,
          });
        }
      } else {
        delete requestFields.sequenceNumber;
      }
    }

    // Build update object
    const buildUpdateObject = (fields, file, currentAgent) => {
      const updateObj = {};
      const allowedFields = [
        "agentName",
        "designation",
        "reraNumber",
        "specialistAreas",
        "description",
        "email",
        "phone",
        "whatsapp",
        "activeSaleListings",
        "propertiesSoldLast15Days",
        "agentLanguage",
        "isActive",
        "superAgent",
      ];

      for (const field of allowedFields) {
        const value = fields[field];
        if (value === undefined || value === "") continue;

        if (field === "email") {
          if (value !== currentAgent.email) updateObj[field] = value;
          continue;
        }

        switch (field) {
          case "specialistAreas":
            if (typeof value === "string") {
              try {
                updateObj[field] = JSON.parse(value);
              } catch {
                updateObj[field] = value;
              }
            } else {
              updateObj[field] = value;
            }
            break;

          case "activeSaleListings":
          case "propertiesSoldLast15Days":
            updateObj[field] = clampInt(value, 0);
            break;

          case "isActive":
          case "superAgent":
            updateObj[field] = isTruthy(value);
            break;

          default:
            updateObj[field] = value;
        }
      }

      // ✅ Handle file upload - matches the field name "imageUrl"
      if (file) {
        updateObj.imageUrl = `/uploads/agents/${file.filename}`;
      }

      updateObj.lastUpdated = new Date();
      return updateObj;
    };

    const updateFields = buildUpdateObject(requestFields, req.file, existingAgent);

    // If no actual changes besides lastUpdated, return existing
    const effectiveKeys = Object.keys(updateFields).filter((k) => k !== "lastUpdated");
    if (effectiveKeys.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        data: existingAgent,
      });
    }

    // Email uniqueness check
    if (updateFields.email) {
      const emailExists = await Agent.findOne({
        email: updateFields.email,
        agentId: { $ne: agentId },
      });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: `Email "${updateFields.email}" is already in use by another agent`,
        });
      }
    }

    const updatedAgent = await Agent.findOneAndUpdate(
      { agentId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: `Agent updated successfully. Updated fields: ${effectiveKeys.join(", ")}`,
      data: updatedAgent,
    });
  } catch (err) {
    console.error("Update agent error:", err);
    
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const value = err.keyValue?.[field];
      return res.status(400).json({
        success: false,
        error: `${field?.[0]?.toUpperCase()}${field?.slice(1)} "${value}" already exists`,
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      error: err.message || "Failed to update agent" 
    });
  }
};

const getAgentsBySequence = async (req, res) => {
  try {
    const { activeOnly = "true" } = req.query;
    const query = isTruthy(activeOnly) ? { isActive: true } : {};
    const agents = await Agent.find(query).sort({ sequenceNumber: 1, agentName: 1 });
    return res.status(200).json({ success: true, data: agents });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findOneAndDelete({ agentId: req.query.agentId });
    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    if (agent.imageUrl) {
      // Fix path joining with leading slash
      const filePath = path.join(__dirname, "../public", stripLeadingSlash(agent.imageUrl));
      fs.promises
        .unlink(filePath)
        .catch((e) => {
          if (e?.code !== "ENOENT") console.warn("⚠️  Failed to delete image:", e.message);
        });
    }

    // Optionally: await Agent.reorderSequences();
    return res.status(200).json({ success: true, msg: "Agent Removed" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// -----------------------------
// Leaderboard jobs
// -----------------------------
async function syncDealsJob(month = "this_month") {
  try {
    month = ensureValidMonth(month);
    console.log(`🔄 [CRON] Starting Salesforce deals sync for: ${month}`);

    const { data } = await sfGet("/services/apexrest/deals", { month });
    const deals = data?.deals || [];
    if (!Array.isArray(deals) || deals.length === 0) {
      console.log("📊 No deals found in Salesforce");
      return;
    }

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map((a) => [normalizeAgentName(a.agentName), a]));

    const stats = {
      totalDeals: deals.length,
      agentsUpdated: 0,
      dealsByAgent: new Map(),
    };

    for (const deal of deals) {
      const ownerName = deal.owner_name;
      if (!ownerName) continue;

      const commissionAgents = deal.commission_agents
        ? String(deal.commission_agents).split(/[;,]/).map((n) => n.trim())
        : [ownerName];

      const dealCommission = parseFloat(deal.total_commissions) || 0;
      const commissionPerAgent =
        commissionAgents.length > 0 ? dealCommission / commissionAgents.length : 0;

      for (const agentName of commissionAgents) {
        if (!agentName) continue;
        const key = normalizeAgentName(agentName);
        if (!agentMap.has(key)) continue;

        const cur = stats.dealsByAgent.get(key) || { dealCount: 0, totalCommission: 0 };
        cur.dealCount += 1;
        cur.totalCommission += commissionPerAgent;
        stats.dealsByAgent.set(key, cur);
      }
    }

    const updatePromises = [];
    for (const [key, agentStats] of stats.dealsByAgent.entries()) {
      const agent = agentMap.get(key);
      if (!agent) continue;
      agent.updateLeaderboardMetrics({
        propertiesSold: agentStats.dealCount,
        totalCommission: Math.round(agentStats.totalCommission * 100) / 100,
      });
      updatePromises.push(agent.save());
      stats.agentsUpdated++;
    }

    await Promise.all(updatePromises);
    console.log(`✅ [CRON] Deals sync completed. Updated ${stats.agentsUpdated} agents`);
  } catch (error) {
    console.error("❌ [CRON] Error syncing deals:", error.message);
  }
}

async function syncViewingsJob(month = "this_month") {
  try {
    month = ensureValidMonth(month);
    console.log(`🔄 [CRON] Starting Salesforce viewings sync for: ${month}`);

    const { data } = await sfGet("/services/apexrest/viewings", { month });
    const viewings = data?.viewings || [];
    if (!Array.isArray(viewings) || viewings.length === 0) {
      console.log("📊 No viewings found in Salesforce");
      return;
    }

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map((a) => [normalizeAgentName(a.agentName), a]));

    const stats = {
      totalViewings: viewings.length,
      agentsUpdated: 0,
      viewingsByAgent: new Map(),
    };

    for (const v of viewings) {
      const key = normalizeAgentName(v.owner);
      if (!key || !agentMap.has(key)) continue;
      const cur = stats.viewingsByAgent.get(key) || 0;
      stats.viewingsByAgent.set(key, cur + 1);
    }

    const updatePromises = [];
    for (const [key, count] of stats.viewingsByAgent.entries()) {
      const agent = agentMap.get(key);
      if (!agent) continue;
      agent.updateLeaderboardMetrics({ viewings: count });
      updatePromises.push(agent.save());
      stats.agentsUpdated++;
    }

    await Promise.all(updatePromises);
    console.log(`✅ [CRON] Viewings sync completed. Updated ${stats.agentsUpdated} agents`);
  } catch (error) {
    console.error("❌ [CRON] Error syncing viewings:", error.message);
  }
}

async function syncOffersJob(month = "this_month") {
  try {
    month = ensureValidMonth(month);
    console.log(`🔄 [CRON] Starting Salesforce offers sync for: ${month}`);

    const { data } = await sfGet("/services/apexrest/Offers", { month });
    const offers = data?.Offer || [];
    if (!Array.isArray(offers) || offers.length === 0) {
      console.log("📊 No offers found in Salesforce");
      return;
    }

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map((a) => [normalizeAgentName(a.agentName), a]));

    const stats = {
      totalOffers: offers.length,
      agentsUpdated: 0,
      offersByAgent: new Map(),
    };

    for (const o of offers) {
      const key = normalizeAgentName(o.owner);
      if (!key || !agentMap.has(key)) continue;
      const cur = stats.offersByAgent.get(key) || 0;
      stats.offersByAgent.set(key, cur + 1);
    }

    const updatePromises = [];
    for (const [key, count] of stats.offersByAgent.entries()) {
      const agent = agentMap.get(key);
      if (!agent) continue;
      agent.updateLeaderboardMetrics({ offers: count });
      updatePromises.push(agent.save());
      stats.agentsUpdated++;
    }

    await Promise.all(updatePromises);
    console.log(`✅ [CRON] Offers sync completed. Updated ${stats.agentsUpdated} agents`);
  } catch (error) {
    console.error("❌ [CRON] Error syncing offers:", error.message);
  }
}

// Combined job
async function runAllSyncs() {
  console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
  const t0 = Date.now();
  try {
    await Promise.all([syncDealsJob(), syncViewingsJob(), syncOffersJob()]);
    const sec = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`✅ [CRON] All syncs completed successfully in ${sec}s`);
  } catch (error) {
    console.error("❌ [CRON] Error in scheduled sync job:", error.message);
  }
}

// Cron guard to avoid double scheduling in hot reload / clustered processes
let cronScheduled = false;
function setupCronJobs() {
  if (cronScheduled) {
    console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
    return;
  }

  cron.schedule("*/30 * * * *", async () => {
    await runAllSyncs();
  });

  cronScheduled = true;
  console.log("✅ Cron job scheduled: Salesforce sync will run every 30 minutes");

  // Optional: run immediately on startup
  console.log("🚀 Running initial sync on startup...");
  // Fire and forget
  runAllSyncs();
}

// -----------------------------
// Manual API endpoints
// -----------------------------
const syncAgentDealsFromSalesforce = async (req, res) => {
  try {
    const month = ensureValidMonth(req.query?.month);
    const { data } = await sfGet("/services/apexrest/deals", { month });
    const deals = data?.deals || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map((a) => [normalizeAgentName(a.agentName), a]));

    const stats = {
      totalDeals: deals.length,
      agentsUpdated: 0,
      unmatchedOwners: new Set(),
      dealsByAgent: new Map(),
    };

    for (const deal of deals) {
      const ownerName = deal.owner_name;
      if (!ownerName) continue;

      const commissionAgents = deal.commission_agents
        ? String(deal.commission_agents).split(/[;,]/).map((n) => n.trim())
        : [ownerName];

      const dealCommission = parseFloat(deal.total_commissions) || 0;
      const perAgent = commissionAgents.length > 0 ? dealCommission / commissionAgents.length : 0;

      for (const rawName of commissionAgents) {
        const key = normalizeAgentName(rawName);
        if (!key) continue;

        if (agentMap.has(key)) {
          const cur = stats.dealsByAgent.get(key) || { dealCount: 0, totalCommission: 0 };
          cur.dealCount += 1;
          cur.totalCommission += perAgent;
          stats.dealsByAgent.set(key, cur);
        } else {
          stats.unmatchedOwners.add(rawName);
        }
      }
    }

    const updates = [];
    for (const [key, s] of stats.dealsByAgent.entries()) {
      const agent = agentMap.get(key);
      if (!agent) continue;
      agent.updateLeaderboardMetrics({
        propertiesSold: s.dealCount,
        totalCommission: Math.round(s.totalCommission * 100) / 100,
      });
      updates.push(agent.save());
      stats.agentsUpdated++;
    }
    await Promise.all(updates);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${stats.totalDeals} deals and updated ${stats.agentsUpdated} agents`,
      data: {
        period: month,
        totalDeals: stats.totalDeals,
        agentsUpdated: stats.agentsUpdated,
        agentDeals: Array.from(stats.dealsByAgent.entries()).map(([key, s]) => ({
          agentName: agentMap.get(key).agentName,
          agentId: agentMap.get(key).agentId,
          dealCount: s.dealCount,
          totalCommission: Math.round(s.totalCommission * 100) / 100,
        })),
        unmatchedOwners:
          stats.unmatchedOwners.size > 0 ? Array.from(stats.unmatchedOwners) : undefined,
      },
    });
  } catch (error) {
    console.error("❌ Error syncing Salesforce deals:", error.message);
    const status = error?.response?.status || 500;
    const msg =
      status === 401
        ? "Salesforce authentication failed. Invalid or expired Bearer token"
        : "Failed to fetch deals from Salesforce";
    return res.status(status === 401 ? 401 : 503).json({
      success: false,
      error: msg,
      details: error.message,
    });
  }
};

const syncAgentViewingsFromSalesforce = async (req, res) => {
  try {
    const month = ensureValidMonth(req.query?.month);
    const { data } = await sfGet("/services/apexrest/viewings", { month });
    const viewings = data?.viewings || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map((a) => [normalizeAgentName(a.agentName), a]));

    const stats = {
      totalViewings: viewings.length,
      agentsUpdated: 0,
      unmatchedOwners: new Set(),
      viewingsByAgent: new Map(),
    };

    for (const v of viewings) {
      const key = normalizeAgentName(v.owner);
      if (!key) continue;

      if (agentMap.has(key)) {
        const cur = stats.viewingsByAgent.get(key) || 0;
        stats.viewingsByAgent.set(key, cur + 1);
      } else {
        stats.unmatchedOwners.add(v.owner);
      }
    }

    const updates = [];
    for (const [key, count] of stats.viewingsByAgent.entries()) {
      const agent = agentMap.get(key);
      if (!agent) continue;
      agent.updateLeaderboardMetrics({ viewings: count });
      updates.push(agent.save());
      stats.agentsUpdated++;
    }
    await Promise.all(updates);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${stats.totalViewings} viewings and updated ${stats.agentsUpdated} agents`,
      data: {
        period: month,
        totalViewings: stats.totalViewings,
        agentsUpdated: stats.agentsUpdated,
        agentViewings: Array.from(stats.viewingsByAgent.entries()).map(([key, count]) => ({
          agentName: agentMap.get(key).agentName,
          agentId: agentMap.get(key).agentId,
          viewingCount: count,
        })),
        unmatchedOwners:
          stats.unmatchedOwners.size > 0 ? Array.from(stats.unmatchedOwners) : undefined,
      },
    });
  } catch (error) {
    console.error("❌ Error syncing Salesforce viewings:", error.message);
    const status = error?.response?.status || 500;
    const msg =
      status === 401
        ? "Salesforce authentication failed. Invalid or expired Bearer token"
        : "Failed to fetch viewings from Salesforce";
    return res.status(status === 401 ? 401 : 503).json({
      success: false,
      error: msg,
      details: error.message,
    });
  }
};

const syncAgentOffersFromSalesforce = async (req, res) => {
  try {
    const month = ensureValidMonth(req.query?.month);
    const { data } = await sfGet("/services/apexrest/Offers", { month });
    const offers = data?.Offer || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map((a) => [normalizeAgentName(a.agentName), a]));

    const stats = {
      totalOffers: offers.length,
      agentsUpdated: 0,
      unmatchedOwners: new Set(),
      offersByAgent: new Map(),
    };

    for (const o of offers) {
      const key = normalizeAgentName(o.owner);
      if (!key) continue;

      if (agentMap.has(key)) {
        const cur = stats.offersByAgent.get(key) || 0;
        stats.offersByAgent.set(key, cur + 1);
      } else {
        stats.unmatchedOwners.add(o.owner);
      }
    }

    const updates = [];
    for (const [key, count] of stats.offersByAgent.entries()) {
      const agent = agentMap.get(key);
      if (!agent) continue;
      agent.updateLeaderboardMetrics({ offers: count });
      updates.push(agent.save());
      stats.agentsUpdated++;
    }
    await Promise.all(updates);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${stats.totalOffers} offers and updated ${stats.agentsUpdated} agents`,
      data: {
        period: month,
        totalOffers: stats.totalOffers,
        agentsUpdated: stats.agentsUpdated,
        agentOffers: Array.from(stats.offersByAgent.entries()).map(([key, count]) => ({
          agentName: agentMap.get(key).agentName,
          agentId: agentMap.get(key).agentId,
          offerCount: count,
        })),
        unmatchedOwners:
          stats.unmatchedOwners.size > 0 ? Array.from(stats.unmatchedOwners) : undefined,
      },
    });
  } catch (error) {
    console.error("❌ Error syncing Salesforce offers:", error.message);
    const status = error?.response?.status || 500;
    const msg =
      status === 401
        ? "Salesforce authentication failed. Invalid or expired Bearer token"
        : "Failed to fetch offers from Salesforce";
    return res.status(status === 401 ? 401 : 503).json({
      success: false,
      error: msg,
      details: error.message,
    });
  }
};

// -----------------------------
// Exports
// -----------------------------
module.exports = {
  createAgent,
  getAgents,
  getAgentById,
  getAgentByEmail,
  updateAgent,
  getAgentsBySequence,
  deleteAgent,

  // Leaderboard APIs
  syncAgentDealsFromSalesforce,
  syncAgentViewingsFromSalesforce,
  syncAgentOffersFromSalesforce,

  // Token (exposed for your tests; do not mount as a public route)
  getSalesforceToken,

  // Cron
  setupCronJobs,
};
