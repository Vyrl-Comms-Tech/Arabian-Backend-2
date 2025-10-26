const Agent = require("../Models/AgentModel");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cron = require("node-cron");

// image testing
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
// Test
// -----------------------------
// Create a new agent 
// -----------------------------
const createAgent = async (req, res) => {
  try {
    // ✅ CLOUDINARY: Get the full Cloudinary URL from uploaded file
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path; // Cloudinary returns full URL in req.file.path
      req.body.imageUrl = imageUrl;
    }

    // Handle superAgent boolean
    if (req.body.superAgent !== undefined) {
      req.body.superAgent = isTruthy(req.body.superAgent);
    }

    // Validate and enforce unique sequenceNumber if provided
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

    // Create agent with Cloudinary URL
    const agent = await Agent.create(req.body);

    return res.status(201).json({ 
      success: true, 
      data: agent,
      imageUrl: imageUrl // ✅ Return Cloudinary URL for confirmation
    });

  } catch (err) {
    console.error("Create agent error:", err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

// -----------------------------
// Get agents
// -----------------------------
const getAgents = async (_req, res) => {
  console.log("Getting Agents")
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
// ✅ ADD THIS IMPORT AT THE TOP OF YOUR FILE
// ===== FIXED updateAgent Function =====
// Add this import at the TOP of your AgentController.js file
const cloudinary = require('cloudinary').v2;

const updateAgent = async (req, res) => {
  console.log("🔄 [UPDATE-AGENT] Request received");
  console.log("📦 Body keys:", Object.keys(req.body));
  console.log("📸 File present:", !!req.file);
  
  try {
    const { agentId, ...requestFields } = req.body || {};

    // 1️⃣ Validate Agent ID
    if (!agentId) {
      return res.status(400).json({ 
        success: false, 
        error: "Agent ID is required" 
      });
    }

    // 2️⃣ Find existing agent
    const existingAgent = await Agent.findOne({ agentId });
    if (!existingAgent) {
      return res.status(404).json({ 
        success: false, 
        error: "Agent not found" 
      });
    }

    console.log(`✅ [UPDATE-AGENT] Agent found: ${existingAgent.agentName}`);

    // 3️⃣ Handle sequenceNumber swap if changed
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
          console.error("❌ [UPDATE-AGENT] Sequence swap error:", swapError);
          return res.status(400).json({
            success: false,
            error: `Failed to update sequence number: ${swapError.message}`,
          });
        }
      } else {
        delete requestFields.sequenceNumber;
      }
    }

    // 4️⃣ Build update object
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

      // ✅ FIXED: Handle Cloudinary file upload
      if (file) {
        console.log("📸 [UPDATE-AGENT] Processing uploaded file");
        console.log("   - Field name:", file.fieldname);
        console.log("   - Original name:", file.originalname);
        console.log("   - Size:", file.size);
        console.log("   - Path:", file.path);
        
        // When using CloudinaryStorage, file.path is the full Cloudinary URL
        updateObj.imageUrl = file.path;
        console.log("✅ [UPDATE-AGENT] New image URL set:", file.path);
      }

      updateObj.lastUpdated = new Date();
      return updateObj;
    };

    const updateFields = buildUpdateObject(requestFields, req.file, existingAgent);

    // 5️⃣ Check if there are actual changes
    const effectiveKeys = Object.keys(updateFields).filter((k) => k !== "lastUpdated");
    if (effectiveKeys.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        data: existingAgent,
      });
    }

    console.log("📝 [UPDATE-AGENT] Fields to update:", effectiveKeys);

    // 6️⃣ Email uniqueness check
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

    // 7️⃣ ✅ FIXED: Delete old Cloudinary image if new one is uploaded
    if (req.file && existingAgent.imageUrl) {
      console.log("🗑️  [UPDATE-AGENT] Attempting to delete old image:", existingAgent.imageUrl);
      
      // Only try to delete if it's a Cloudinary URL
      if (existingAgent.imageUrl.includes('cloudinary.com')) {
        try {
          // ✅ FIXED: Correct public_id extraction
          // Example URL: https://res.cloudinary.com/dxxxxxxxx/image/upload/v123456/agent-images/agent-123456789.jpg
          const urlParts = existingAgent.imageUrl.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          
          if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
            // Get everything after 'upload/' (skip version if present)
            let pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
            
            // Remove version number if present (v1234567890/)
            pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
            
            // Remove file extension
            const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');
            
            console.log("🔑 [UPDATE-AGENT] Extracted public_id:", publicId);
            
            // Delete from Cloudinary
            const deleteResult = await cloudinary.uploader.destroy(publicId);
            
            if (deleteResult.result === 'ok') {
              console.log("✅ [UPDATE-AGENT] Old image deleted successfully");
            } else if (deleteResult.result === 'not found') {
              console.log("⚠️  [UPDATE-AGENT] Old image not found in Cloudinary (may have been deleted already)");
            } else {
              console.log("⚠️  [UPDATE-AGENT] Unexpected delete result:", deleteResult);
            }
          } else {
            console.warn("⚠️  [UPDATE-AGENT] Could not parse Cloudinary URL structure");
          }
        } catch (deleteError) {
          // ✅ Log but don't fail the update
          console.error("⚠️  [UPDATE-AGENT] Error deleting old image:", deleteError.message);
          // Continue with update even if deletion fails
        }
      } else {
        console.log("ℹ️  [UPDATE-AGENT] Old image is not from Cloudinary, skipping deletion");
      }
    }

    // 8️⃣ Update agent in database
    console.log("💾 [UPDATE-AGENT] Updating agent in database...");
    
    const updatedAgent = await Agent.findOneAndUpdate(
      { agentId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedAgent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found after update attempt"
      });
    }

    console.log("✅ [UPDATE-AGENT] Agent updated successfully");

    // 9️⃣ Return success response
    return res.status(200).json({
      success: true,
      message: `Agent updated successfully. Updated fields: ${effectiveKeys.join(", ")}`,
      data: updatedAgent,
      imageUrl: updatedAgent.imageUrl // Return the new Cloudinary URL
    });

  } catch (err) {
    // ✅ FIXED: Comprehensive error logging
    console.error("❌ [UPDATE-AGENT] Fatal error:", {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack
    });

    // Handle duplicate key errors
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const value = err.keyValue?.[field];
      return res.status(400).json({
        success: false,
        error: `${field?.[0]?.toUpperCase()}${field?.slice(1)} "${value}" already exists`,
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message || "Validation failed"
      });
    }

    // Handle Cloudinary errors
    if (err.message && err.message.toLowerCase().includes('cloudinary')) {
      return res.status(500).json({
        success: false,
        error: "Image upload service error",
        details: err.message
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update agent",
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
};

// ===== REQUIRED HELPER FUNCTIONS =====
// Make sure these are defined in your AgentController.js


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

// Token fetch (password grant) — kept separate for clarity
async function getSalesforceToken() {
  // console.log("Working")
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
      }

    );
    return resp.data.access_token;
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    throw new Error("Salesforce token generation failed");
  }
}

async function syncDealsJob(month = "this_year") {
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

async function syncViewingsJob(month = "this_year") {
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

async function syncOffersJob(month = "this_year") {
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

const GetSalesForceToken = async (req, res) => {
  try {
    console.log("WORKING")
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
      }

    );
    console.log(resp.data.access_token)
    return resp.data.access_token;
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    throw new Error("Salesforce token generation failed");
  }
}
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
  // Test
  GetSalesForceToken,

  // Cron
  setupCronJobs,
};
