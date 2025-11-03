const Agent = require("../Models/AgentModel");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cron = require("node-cron");
const cloudinary = require("cloudinary").v2;

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
const stripLeadingSlash = (p) =>
  typeof p === "string" ? p.replace(/^[/\\]+/, "") : p;

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
      imageUrl: imageUrl, // ✅ Return Cloudinary URL for confirmation
    });
  } catch (err) {
    console.error("Create agent error:", err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

// -----------------------------
// Get agents
// -----------------------------

const getAgents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
    const skip = (page - 1) * limit;

    const pipeline = [
      // { $match: { isActive: true } }, // optional
      { $sort: { sequenceNumber: 1, agentName: 1 } },

      // Inclusion-only projection + computed count
      {
        $project: {
          agentName: 1,
          agentLanguage: 1,
          designation: 1,
          email: 1,
          whatsapp: 1,
          phone: 1,
          imageUrl: 1,
          activeSaleListings: 1,
          propertiesSoldLast15Days: 1,
          isActive: 1,
          agentId: 1,
          leaderboard: 1,
          sequenceNumber: 1,
          reraNumber: 1,

          // computed count (from properties[])
          propertiesCount: { $size: { $ifNull: ["$properties", []] } },

          // NOTE: Do NOT put properties:0 or blogs:0 here.
          // Not listing them means they are excluded.
        },
      },

      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: "total" }],
        },
      },
    ];

    const [result] = await Agent.aggregate(pipeline).allowDiskUse(true);
    const agents = result?.data ?? [];
    const total = result?.meta?.[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: agents,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};


function isCurrentMonth(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

const getLeaderboardAgents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
    const skip = (page - 1) * limit;

    const allowedAgentNames = [
      "Simone Adlington",
      "Elamir Adnan",
      "Aaqib Ahmed",
      "Zaher Akhawi",
      "Saad Al Hossain",
      "Hady Azrieh",
      "Shorouk Bahromzoda",
      "Rowan Beale",
      "Abdelwaheb Bekhadda",
      "Vikram Biant",
      "Nathan Blake",
      "Thomas Breeds",
      "Joshua Brooks",
      "Nils Brunsch",
      "Joseph Chiffi",
      "Christian Curran",
      "Pratik Das",
      "Shaheen Emami",
      "Jack Evans",
      "Casey Gaggini",
      "Ben Greenwood",
      "Foteini Hadjidemetriou",
      "Georgia Hargreaves",
      "Charlie Harris",
      "Tom Hastings",
      "Magomed Kartoev",
      "Ryan Kent",
      "Douglas Kisuule",
      "Alba Kuloglija",
      "Emma Jean Laycock",
      "Kevin Livingstone",
      "George Lupson",
      "Luca Mae Joseph",
      "Emma Elizabeth Maries",
      "David Marsh",
      "Clive Marsh",
      "Chris Michaelides",
      "Imad Najib",
      "Nadia Salman",
      "Samantha Scott",
      "Alexander Stanton",
      "Aidan Patric Stephenson",
      "Tetiana Syvak",
      "Sebastian Tyynela",
      "Callum Wallace",
      "Harry Warren",
      "Russell Wilson",
      "Leon Wright",
      "Charlie Wright",
      "Katarin Donkin",
      "Samuel Hewitt",
      "Craig Sutherland",
      "Gulzhanat Turebayeva",
    ];

    const pipeline = [
      // 1) Whitelist (and optionally only active)
      { $match: { agentName: { $in: allowedAgentNames } } },
      // { $match: { isActive: true } },

      // 2) Keep light fields + computed propertiesCount
      {
        $project: {
          agentName: 1,
          agentLanguage: 1,
          designation: 1,
          email: 1,
          whatsapp: 1,
          phone: 1,
          imageUrl: 1,
          isActive: 1,
          agentId: 1,
          leaderboard: 1, // contains totalCommission, propertiesSold, viewings, etc.
          sequenceNumber: 1,
          reraNumber: 1,
          propertiesCount: { $size: { $ifNull: ["$properties", []] } },
        },
      },

      // 3) Extract commission for sorting
      {
        $addFields: {
          _commission: {
            $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] },
          },
          _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
        },
      },

      // 4) Sort by commission (descending), then by sequenceNumber for stable ordering
      { $sort: { _commission: -1, _tieSeq: 1 } },
    ];

    // Get all sorted agents first
    const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

    // Calculate global total commission across all agents
    const globalTotalCommission = allAgents.reduce((sum, agent) => {
      return sum + (agent.leaderboard?.totalCommission ?? 0);
    }, 0);

    // Manually assign positions (1, 2, 3, 4...)
    const agentsWithPositions = allAgents.map((agent, index) => ({
      ...agent,
      position: index + 1, // Simple sequential positions starting from 1
    }));

    // Apply pagination
    const paginatedAgents = agentsWithPositions.slice(skip, skip + limit);
    const total = agentsWithPositions.length;
    const totalPages = Math.ceil(total / limit);

    const mapped = paginatedAgents.map((a) => ({
      position: a.position, // Simple sequential: 1, 2, 3, 4...
      name: a.agentName,
      imageUrl: a.imageUrl,
      leaderboard: {
        activePropertiesThisMonth:
          a.leaderboard?.activePropertiesThisMonth ?? 0,
        propertiesSold: a.leaderboard?.propertiesSold ?? 0,
        totalCommission: a.leaderboard?.totalCommission ?? 0,
        viewings: a.leaderboard?.viewings ?? 0,
        lastDealDays: a.leaderboard?.lastDealDays ?? 0,
        offers: a.leaderboard?.offers ?? 0,
      },
      propertiesCount: a.propertiesCount ?? 0,
      agentId: a.agentId,
    }));

    return res.status(200).json({
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      globalTotalCommission, // Global total commission across all agents
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findOne({ agentId: req.query.agentId });
    if (!agent)
      return res.status(404).json({ success: false, error: "Agent not found" });
    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getAgentByEmail = async (req, res) => {
  try {
    const agent = await Agent.findOne({ email: req.query.email });
    if (!agent)
      return res.status(404).json({ success: false, error: "Agent not found" });
    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateAgent = async (req, res) => {
  try {
    const { agentId, ...requestFields } = req.body || {};

    if (!agentId) {
      return res
        .status(400)
        .json({ success: false, error: "Agent ID is required" });
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
            error:
              "Sequence swap not available: Agent.swapSequenceNumbers is undefined.",
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

      // ✅ CLOUDINARY: Handle file upload with full URL
      if (file) {
        updateObj.imageUrl = file.path; // Cloudinary full URL
      }

      updateObj.lastUpdated = new Date();
      return updateObj;
    };

    const updateFields = buildUpdateObject(
      requestFields,
      req.file,
      existingAgent
    );

    // If no actual changes besides lastUpdated, return existing
    const effectiveKeys = Object.keys(updateFields).filter(
      (k) => k !== "lastUpdated"
    );
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

    // ✅ CLOUDINARY: Delete old image if new one is uploaded
    if (req.file && existingAgent.imageUrl) {
      try {
        // Extract public_id from Cloudinary URL
        // Example URL: https://res.cloudinary.com/dxxxxxxxx/image/upload/v123456/agent-images/agent-123456789.jpg
        const urlParts = existingAgent.imageUrl.split("/");
        const publicIdWithExt = urlParts[urlParts.length - 1]; // agent-123456789.jpg
        const publicIdWithoutExt = publicIdWithExt.split(".")[0]; // agent-123456789
        const fullPublicId = `agent-images/${publicIdWithoutExt}`; // agent-images/agent-123456789

        await cloudinary.uploader.destroy(fullPublicId);
        console.log(`✅ Deleted old Cloudinary image: ${fullPublicId}`);
      } catch (deleteError) {
        console.error(
          "⚠️ Error deleting old Cloudinary image:",
          deleteError.message
        );
        // Continue with update even if deletion fails
      }
    }

    const updatedAgent = await Agent.findOneAndUpdate(
      { agentId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: `Agent updated successfully. Updated fields: ${effectiveKeys.join(
        ", "
      )}`,
      data: updatedAgent,
      imageUrl: updatedAgent.imageUrl, // ✅ Return Cloudinary URL
    });
  } catch (err) {
    console.error("Update agent error:", err);

    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const value = err.keyValue?.[field];
      return res.status(400).json({
        success: false,
        error: `${field?.[0]?.toUpperCase()}${field?.slice(
          1
        )} "${value}" already exists`,
      });
    }

    return res.status(400).json({
      success: false,
      error: err.message || "Failed to update agent",
    });
  }
};

const getAgentsBySequence = async (req, res) => {
  try {
    const { activeOnly = "true" } = req.query;
    const query = isTruthy(activeOnly) ? { isActive: true } : {};
    const agents = await Agent.find(query).sort({
      sequenceNumber: 1,
      agentName: 1,
    });
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
      const filePath = path.join(
        __dirname,
        "../public",
        stripLeadingSlash(agent.imageUrl)
      );
      fs.promises.unlink(filePath).catch((e) => {
        if (e?.code !== "ENOENT")
          console.warn("⚠️  Failed to delete image:", e.message);
      });
    }

    // Optionally: await Agent.reorderSequences();
    return res.status(200).json({ success: true, msg: "Agent Removed" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// -----------------------------
// LEADERBOARD 
// -----------------------------

// Helper Functions

function ensureValidMonth(month) {
  const validMonths = ["this_month", "last_month", "ytd"];
  return validMonths.includes(month) ? month : "this_month";
}

function getUtcYearMonth(date) {
  const d = new Date(date);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; // 0..11
}

function resolveMonthUTC(monthParam = "this_month") {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();

  if (monthParam === "last_month") {
    if (m === 0) { y -= 1; m = 11; } else { m -= 1; }
  } else if (/^\d{4}-\d{2}$/.test(monthParam)) {
    const [yy, mm] = monthParam.split("-").map(Number);
    y = yy; m = mm - 1;
  }
  return { targetY: y, targetM: m };
}

function isSameUtcMonth(dateString, targetY, targetM) {
  if (!dateString) return false;
  const t = Date.parse(dateString);
  if (Number.isNaN(t)) return false;
  const { y, m } = getUtcYearMonth(t);
  return y === targetY && m === targetM;
}
// 




// CRON FUNCTIONS 
async function getSalesforceToken() {
  // console.log("Working")
  try {
    const resp = await axios.post(SALESFORCE.tokenUrl, null, {
      params: {
        grant_type: "password",
        client_id: SALESFORCE.clientId,
        client_secret: SALESFORCE.clientSecret,
        username: SALESFORCE.username,
        password: SALESFORCE.password,
      },
    });
    return resp.data.access_token;
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    throw new Error("Salesforce token generation failed");
  }
}

async function syncDealsJob(month = "this_month") {
  try {
    month = ensureValidMonth(month);
    console.log(`🔄 [CRON] Starting Salesforce deals sync for: ${month}`);

    // Fetch deals (monthly and YTD) and commissions separately
    const [monthlyDealsResp, ytdDealsResp, commissionsResp] = await Promise.all(
      [
        sfGet("/services/apexrest/deals", { month }), // Monthly deals for deal count
        sfGet("/services/apexrest/deals", { month: "ytd" }), // YTD deals for last deal date
        sfGet("/services/apexrest/commissions", { month }), // Monthly commissions from new endpoint
      ]
    );

    const monthlyDeals = monthlyDealsResp?.data?.deals || [];
    const ytdDeals = ytdDealsResp?.data?.deals || [];
    const commissions = commissionsResp?.data?.commissions || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    // ===== MONTHLY DEAL COUNTS (from deals endpoint) =====
    const dealCountsByAgent = new Map();
    for (const deal of monthlyDeals) {
      const ownerName = deal.owner_name;
      if (!ownerName) continue;

      const names = deal.commission_agents
        ? String(deal.commission_agents)
            .split(/[;,]/)
            .map((n) => n.trim())
        : [ownerName];

      for (const nm of names) {
        const key = normalizeAgentName(nm);
        if (!key || !agentMap.has(key)) continue;

        const current = dealCountsByAgent.get(key) || 0;
        dealCountsByAgent.set(key, current + 1);
      }
    }

    // ===== MONTHLY COMMISSIONS (from new commissions endpoint) =====
    const commissionsByAgent = new Map();
    for (const commission of commissions) {
      const agentName = commission.agent_name; // or whatever field name your endpoint uses
      if (!agentName) continue;

      const key = normalizeAgentName(agentName);
      if (!key || !agentMap.has(key)) continue;

      const totalCommission = parseFloat(commission.total_commission) || 0;
      const current = commissionsByAgent.get(key) || 0;
      commissionsByAgent.set(key, current + totalCommission);
    }

    // ===== YTD LAST DEAL DATE (from YTD deals) =====
    const agentLastDealDateYTD = new Map();
    for (const deal of ytdDeals) {
      const ownerName = deal.owner_name;
      if (!ownerName) continue;

      const names = deal.commission_agents
        ? String(deal.commission_agents)
            .split(/[;,]/)
            .map((n) => n.trim())
        : [ownerName];

      const dealDate = new Date(deal.createddate);

      for (const nm of names) {
        const key = normalizeAgentName(nm);
        if (!key || !agentMap.has(key)) continue;

        const prevDate = agentLastDealDateYTD.get(key);
        if (!prevDate || dealDate > prevDate) {
          agentLastDealDateYTD.set(key, dealDate);
        }
      }
    }

    // ===== UPDATE ALL AGENTS =====
    const today = new Date();
    const updates = [];
    let agentsUpdated = 0;

    for (const [key, agent] of agentMap.entries()) {
      const dealCount = dealCountsByAgent.get(key) || 0;
      const totalCommission = commissionsByAgent.get(key) || 0;
      const lastDealDate = agentLastDealDateYTD.get(key) || null;
      const lastDealDays = lastDealDate
        ? Math.floor((today - lastDealDate) / 86400000)
        : null;

      agent.updateLeaderboardMetrics({
        propertiesSold: dealCount,
        totalCommission: Math.round(totalCommission * 100) / 100,
        lastDealDate,
        lastDealDays,
      });

      updates.push(agent.save());
      if (dealCount > 0 || totalCommission > 0) agentsUpdated++;
    }

    await Promise.all(updates);

    console.log(`✅ [CRON] Deals sync completed.`);
    console.log(`   - Updated ${agentsUpdated} agents`);
    console.log(`   - Monthly deals: ${monthlyDeals.length}`);
    console.log(`   - Monthly commissions processed: ${commissions.length}`);
    console.log(`   - YTD deals for last-deal tracking: ${ytdDeals.length}`);

    return {
      success: true,
      agentsUpdated,
      monthlyDeals: monthlyDeals.length,
      commissions: commissions.length,
      ytdDeals: ytdDeals.length,
    };
  } catch (error) {
    console.error("❌ [CRON] Error syncing deals:", error.message);
    throw error;
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

      // ✅ NEW: Reset all agents' viewing count to 0 if no viewings found
      const agents = await Agent.find({ isActive: true });
      const updatePromises = agents.map((agent) => {
        agent.updateLeaderboardMetrics({ viewings: 0 });
        return agent.save();
      });
      await Promise.all(updatePromises);
      console.log(`✅ [CRON] Reset viewings to 0 for ${agents.length} agents`);
      return;
    }

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

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

    // ✅ IMPROVED: Update all agents, setting 0 for those without viewings
    for (const [key, agent] of agentMap.entries()) {
      const count = stats.viewingsByAgent.get(key) || 0;
      agent.updateLeaderboardMetrics({ viewings: count });
      updatePromises.push(agent.save());
      if (count > 0) stats.agentsUpdated++;
    }

    await Promise.all(updatePromises);
    console.log(
      `✅ [CRON] Viewings sync completed. Updated ${stats.agentsUpdated} agents with viewings`
    );
  } catch (error) {
    console.error("❌ [CRON] Error syncing viewings:", error.message);
  }
}

async function runSfCommissionSync({ month = "this_month", verbose = false } = {}) {
  const { targetY, targetM } = resolveMonthUTC(month);

  const commissionsResp = await sfGet("/services/apexrest/commissions", { month });
  const commissions = commissionsResp?.data?.commissions || [];

  const agents = await Agent.find({ isActive: true });
  const agentMap = new Map(agents.map(a => [normalizeAgentName(a.agentName), a]));

  const commissionsByAgent = new Map();
  const unmatchedCommissionAgents = [];
  let filteredCount = 0;

  const traceIncluded = [];
  const traceSkipped = [];

  for (const c of commissions) {
    const created = c.createddate;           // strict: createddate only
    const keep = isSameUtcMonth(created, targetY, targetM);
    if (!keep) {
      if (traceSkipped.length < 20) traceSkipped.push({
        ref: c.commission_ref_no,
        agent: c.agent_name || c.commission_agents,
        created
      });
      continue;
    }

    filteredCount++;
    if (traceIncluded.length < 20) traceIncluded.push({
      ref: c.commission_ref_no,
      agent: c.agent_name || c.commission_agents,
      created
    });

    const agentName = c.agent_name || c.commission_agents;
    if (!agentName) continue;

    const key = normalizeAgentName(agentName);
    if (!agentMap.has(key)) {
      if (!unmatchedCommissionAgents.includes(agentName)) {
        unmatchedCommissionAgents.push(agentName);
      }
      continue;
    }

    const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
    const amount = typeof raw === "string" ? Number(raw.replace(/[, ]/g, "")) : Number(raw) || 0;

    commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
  }

  // Bulk write back
  const ops = [];
  const agentCommissions = [];
  let agentsUpdated = 0;

  for (const [key, agent] of agentMap.entries()) {
    const totalCommission = Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

    ops.push({
      updateOne: {
        filter: { _id: agent._id },
        update: {
          $set: {
            "leaderboard.totalCommission": totalCommission,
            "leaderboard.lastUpdated": new Date(),
            "lastUpdated": new Date(),
          }
        }
      }
    });

    if (totalCommission > 0) agentsUpdated++;
    agentCommissions.push({
      agentName: agent.agentName,
      agentId: agent.agentId,
      totalCommission,
      currentDeals: agent.leaderboard?.propertiesSold || 0,
    });
  }

  if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

  const result = {
    success: true,
    message: `Synced ${filteredCount} commission records for ${targetY}-${String(targetM + 1).padStart(2, "0")} (UTC).`,
    note: "Strict UTC month matching on createddate only.",
    data: {
      period: month,
      targetUTC: { year: targetY, monthIndex0: targetM },
      totalCommissionRecords: commissions.length,
      currentMonthRecords: filteredCount,
      agentsWithCommission: agentsUpdated,
      agentsResetToZero: agents.length - agentsUpdated,
      agentCommissions: agentCommissions
        .filter(a => a.totalCommission > 0)
        .sort((a, b) => b.totalCommission - a.totalCommission),
      unmatchedAgents: unmatchedCommissionAgents,
      debugSample: verbose ? {
        includedFirst20: traceIncluded,
        skippedFirst20: traceSkipped
      } : undefined
    }
  };

  return result;
}
async function syncOffersJob(month = "this_month") {
  try {
    month = ensureValidMonth(month);
    console.log(`🔄 [CRON] Starting Salesforce offers sync for: ${month}`);

    const { data } = await sfGet("/services/apexrest/Offers", { month });
    const offers = data?.Offer || [];
    if (!Array.isArray(offers) || offers.length === 0) {
      console.log("📊 No offers found in Salesforce");

      // ✅ NEW: Reset all agents' offer count to 0 if no offers found
      const agents = await Agent.find({ isActive: true });
      const updatePromises = agents.map((agent) => {
        agent.updateLeaderboardMetrics({ offers: 0 });
        return agent.save();
      });
      await Promise.all(updatePromises);
      console.log(`✅ [CRON] Reset offers to 0 for ${agents.length} agents`);
      return;
    }

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

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

    // ✅ IMPROVED: Update all agents, setting 0 for those without offers
    for (const [key, agent] of agentMap.entries()) {
      const count = stats.offersByAgent.get(key) || 0;
      agent.updateLeaderboardMetrics({ offers: count });
      updatePromises.push(agent.save());
      if (count > 0) stats.agentsUpdated++;
    }

    await Promise.all(updatePromises);
    console.log(
      `✅ [CRON] Offers sync completed. Updated ${stats.agentsUpdated} agents with offers`
    );
  } catch (error) {
    console.error("❌ [CRON] Error syncing offers:", error.message);
  }
}

async function syncMonthlyPropertiesJob() {
  try {
    console.log("🔄 [CRON] Starting monthly properties update...");

    const result = await Agent.updateAllAgentsMonthlyProperties();

    console.log(
      `✅ [CRON] Monthly properties updated for ${result.agentsUpdated} agents`
    );
    return result;
  } catch (error) {
    console.error(
      "❌ [CRON] Error updating monthly properties:",
      error.message
    );
  }
}

async function runAllSyncs() {
  console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
  const t0 = Date.now();
  try {
    // Run deals, viewings, and offers in parallel
    await Promise.all([syncDealsJob(), syncViewingsJob(), syncOffersJob(),runSfCommissionSync()]);

    // ✅ NEW: Run monthly properties after other syncs
    await syncMonthlyPropertiesJob();

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

  // ✅ Main sync job - every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    await runAllSyncs();
  });

  cronScheduled = true;
  console.log(
    "✅ Cron job scheduled: Salesforce sync will run every 30 minutes"
  );

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
    console.log("WORKING");
    const resp = await axios.post(SALESFORCE.tokenUrl, null, {
      params: {
        grant_type: "password",
        client_id: SALESFORCE.clientId,
        client_secret: SALESFORCE.clientSecret,
        username: SALESFORCE.username,
        password: SALESFORCE.password,
      },
    });
    console.log(resp.data.access_token);
    return res.status(200).json({
      access_token: resp.data.access_token,
    });
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    throw new Error("Salesforce token generation failed");
  }
};

const syncAgentDealsFromSalesforce = async (req, res) => {
  try {
    const { month = "this_month" } = req.query;

    // Reuse the same helpers you used for commissions sync
    const { targetY, targetM } = resolveMonthUTC(month);

    console.log(`🔄 Starting Salesforce DEALS-ONLY sync for: ${month} -> UTC ${targetY}-${String(targetM+1).padStart(2,"0")}`);

    // Fetch deals:
    // - monthly: for counting deals in the selected month
    // - ytd (or this_year): for lastDealDate (latest in the calendar year)
    // If your API doesn't support "ytd", switch to "this_year" or similar.
    const [monthlyDealsResp, ytdDealsResp] = await Promise.all([
      sfGet("/services/apexrest/deals", { month }),           // e.g. "this_month" / "last_month" / "2025-11"
      sfGet("/services/apexrest/deals", { month: "ytd" }),    // fallback to "this_year" if needed by your API
    ]);

    const monthlyDealsRaw = monthlyDealsResp?.data?.deals || [];
    const ytdDealsRaw     = ytdDealsResp?.data?.deals || [];

    // Strict month filter (createddate ONLY), same rule as commissions
    const monthlyDeals = monthlyDealsRaw.filter(d =>
      isSameUtcMonth(d.createddate /* don't fallback to lastmodifieddate */, targetY, targetM)
    );

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map(a => [normalizeAgentName(a.agentName), a]));

    // ===== MONTHLY DEAL COUNTS =====
    const dealCountsByAgent = new Map();
    const unmatchedMonthly = [];

    for (const deal of monthlyDeals) {
      // Prefer commission_agents list; fallback to owner_name if none
      const names = deal.commission_agents
        ? String(deal.commission_agents).split(/[;,]/).map(n => n.trim()).filter(Boolean)
        : (deal.owner_name ? [deal.owner_name] : []);

      for (const nm of names) {
        const key = normalizeAgentName(nm);
        if (!key || !agentMap.has(key)) {
          if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
          continue;
        }
        dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
      }
    }

    // ===== YTD LAST DEAL DATE =====
    // If your API returned empty for "ytd", you can switch argument to "this_year"
    const ytdDeals = ytdDealsRaw;
    const agentLastDealDateYTD = new Map();
    const unmatchedYtd = [];

    for (const deal of ytdDeals) {
      const names = deal.commission_agents
        ? String(deal.commission_agents).split(/[;,]/).map(n => n.trim()).filter(Boolean)
        : (deal.owner_name ? [deal.owner_name] : []);

      // Use createddate as the deal moment (same as commissions rule)
      const created = deal.createddate;
      const dealDate = created ? new Date(created) : null;
      if (!dealDate) continue;

      for (const nm of names) {
        const key = normalizeAgentName(nm);
        if (!key) continue;

        if (!agentMap.has(key)) {
          if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
          continue;
        }

        const prev = agentLastDealDateYTD.get(key);
        if (!prev || dealDate > prev) {
          agentLastDealDateYTD.set(key, dealDate);
        }
      }
    }

    // ===== UPDATE AGENTS (DEAL METRICS ONLY) =====
    const today = new Date();
    const updates = [];
    let agentsUpdated = 0;
    const agentDeals = [];

    for (const [key, agent] of agentMap.entries()) {
      const dealCount = dealCountsByAgent.get(key) || 0;
      const lastDealDate = agentLastDealDateYTD.get(key) || null;
      const lastDealDays = lastDealDate ? Math.floor((today - lastDealDate) / 86400000) : null;

      // Only deal-related fields (do NOT touch totalCommission here)
      agent.updateLeaderboardMetrics({
        propertiesSold: dealCount,
        lastDealDate,
        lastDealDays,
      });

      updates.push(agent.save());

      agentDeals.push({
        agentName: agent.agentName,
        agentId: agent.agentId,
        dealCount,
        lastDealDate,
        daysSinceLastDeal: lastDealDays,
        currentCommission: agent.leaderboard?.totalCommission || 0,
      });

      if (dealCount > 0) agentsUpdated++;
    }

    await Promise.all(updates);

    console.log(`✅ DEALS-ONLY sync completed for ${targetY}-${String(targetM+1).padStart(2,"0")} (UTC).`);
    console.log(`   - Monthly deals (after strict UTC filter): ${monthlyDeals.length}`);
    console.log(`   - YTD deals scanned: ${ytdDeals.length}`);
    console.log(`   - Agents updated: ${agentsUpdated}`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${monthlyDeals.length} monthly deals (strict UTC month). Updated ${agentsUpdated} agents with deal counts only.`,
      note: "Commissions are NOT updated by this endpoint. Month inclusion = createddate in target UTC month.",
      data: {
        period: month,
        targetUTC: { year: targetY, monthIndex0: targetM },
        totalDealsReturnedByAPI: monthlyDealsRaw.length,
        totalDealsCountedAfterStrictFilter: monthlyDeals.length,
        agentsUpdated,
        agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
        unmatchedOwners: {
          monthly: unmatchedMonthly,
          ytd: unmatchedYtd,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error syncing deals:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const syncAgentCommissionsFromSalesforce = async (req, res) => {
  try {
    const { month = "this_month" } = req.query;
    const { targetY, targetM } = resolveMonthUTC(month);

    const commissionsResp = await sfGet("/services/apexrest/commissions", { month });
    const commissions = commissionsResp?.data?.commissions || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map(a => [normalizeAgentName(a.agentName), a]));

    const commissionsByAgent = new Map();
    const unmatchedCommissionAgents = [];
    let filteredCount = 0;

    // Optional: trace
    const traceIncluded = [];
    const traceSkipped = [];

    for (const c of commissions) {
      // ✅ ONLY createddate decides inclusion
      const created = c.createddate; // do not fall back to lastmodifieddate here
      const keep = isSameUtcMonth(created, targetY, targetM);

      if (!keep) {
        // for debugging, capture a few
        if (traceSkipped.length < 20) traceSkipped.push({
          ref: c.commission_ref_no,
          agent: c.agent_name || c.commission_agents,
          created
        });
        continue;
      }

      filteredCount++;
      if (traceIncluded.length < 20) traceIncluded.push({
        ref: c.commission_ref_no,
        agent: c.agent_name || c.commission_agents,
        created
      });

      const agentName = c.agent_name || c.commission_agents;
      if (!agentName) continue;

      const key = normalizeAgentName(agentName);
      if (!agentMap.has(key)) {
        if (!unmatchedCommissionAgents.includes(agentName)) {
          unmatchedCommissionAgents.push(agentName);
        }
        continue;
      }

      const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
      const amount = typeof raw === "string" ? Number(raw.replace(/[, ]/g, "")) : Number(raw) || 0;

      commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
    }

    // Write back (safe & fast)
    const ops = [];
    const agentCommissions = [];
    let agentsUpdated = 0;

    for (const [key, agent] of agentMap.entries()) {
      const totalCommission = Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: {
            $set: {
              "leaderboard.totalCommission": totalCommission,
              "leaderboard.lastUpdated": new Date(),
              "lastUpdated": new Date(),
            }
          }
        }
      });

      if (totalCommission > 0) agentsUpdated++;
      agentCommissions.push({
        agentName: agent.agentName,
        agentId: agent.agentId,
        totalCommission,
        currentDeals: agent.leaderboard?.propertiesSold || 0,
      });
    }

    if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

    return res.status(200).json({
      success: true,
      message: `Synced ${filteredCount} commission records for ${targetY}-${String(targetM+1).padStart(2,"0")} (UTC).`,
      note: "Strict UTC month matching on createddate only.",
      data: {
        period: month,
        targetUTC: { year: targetY, monthIndex0: targetM },
        totalCommissionRecords: commissions.length,
        currentMonthRecords: filteredCount,
        agentsWithCommission: agentsUpdated,
        agentsResetToZero: agents.length - agentsUpdated,
        agentCommissions: agentCommissions
          .filter(a => a.totalCommission > 0)
          .sort((a, b) => b.totalCommission - a.totalCommission),
        unmatchedAgents: unmatchedCommissionAgents,
        debugSample: {
          includedFirst20: traceIncluded,
          skippedFirst20: traceSkipped
        }
      }
    });
  } catch (error) {
    console.error("❌ Error syncing commissions:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};



// const syncAgentViewingsFromSalesforce = async (req, res) => {
//   try {
//     const month = ensureValidMonth(req.query?.month);
//     const { data } = await sfGet("/services/apexrest/viewings", { month });
//     const viewings = data?.viewings || [];

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     const stats = {
//       totalViewings: viewings.length,
//       agentsUpdated: 0,
//       unmatchedOwners: new Set(),
//       viewingsByAgent: new Map(),
//     };

//     for (const v of viewings) {
//       const key = normalizeAgentName(v.owner);
//       if (!key) continue;

//       if (agentMap.has(key)) {
//         const cur = stats.viewingsByAgent.get(key) || 0;
//         stats.viewingsByAgent.set(key, cur + 1);
//       } else {
//         stats.unmatchedOwners.add(v.owner);
//       }
//     }

//     const updates = [];
//     for (const [key, count] of stats.viewingsByAgent.entries()) {
//       const agent = agentMap.get(key);
//       if (!agent) continue;
//       agent.updateLeaderboardMetrics({ viewings: count });
//       updates.push(agent.save());
//       stats.agentsUpdated++;
//     }
//     await Promise.all(updates);

//     return res.status(200).json({
//       success: true,
//       message: `Successfully synced ${stats.totalViewings} viewings and updated ${stats.agentsUpdated} agents`,
//       data: {
//         period: month,
//         totalViewings: stats.totalViewings,
//         agentsUpdated: stats.agentsUpdated,
//         agentViewings: Array.from(stats.viewingsByAgent.entries()).map(
//           ([key, count]) => ({
//             agentName: agentMap.get(key).agentName,
//             agentId: agentMap.get(key).agentId,
//             viewingCount: count,
//           })
//         ),
//         unmatchedOwners:
//           stats.unmatchedOwners.size > 0
//             ? Array.from(stats.unmatchedOwners)
//             : undefined,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing Salesforce viewings:", error.message);
//     const status = error?.response?.status || 500;
//     const msg =
//       status === 401
//         ? "Salesforce authentication failed. Invalid or expired Bearer token"
//         : "Failed to fetch viewings from Salesforce";
//     return res.status(status === 401 ? 401 : 503).json({
//       success: false,
//       error: msg,
//       details: error.message,
//     });
//   }
// };

const syncAgentViewingsFromSalesforce = async (req, res) => {
  try {
    const { month = "this_month" } = req.query;
    const { targetY, targetM } = resolveMonthUTC(month);

    const resp = await sfGet("/services/apexrest/viewings", { month });
    const raw = resp?.data?.viewings || [];

    // ✅ Use createdDate (primary), then fallbacks for safety
    const viewings = raw.filter(v => {
      const created =
        v.createdDate ??
        v.createddate ??
        v.CreatedDate ??
        v.activityDate ?? // only if created* is missing
        null;
      return created && isSameUtcMonth(created, targetY, targetM);
    });

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(agents.map(a => [normalizeAgentName(a.agentName), a]));

    const counts = new Map();
    const unmatchedOwners = new Set();

    for (const v of viewings) {
      const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
      const key = normalizeAgentName(owner);
      if (!key) continue;
      if (agentMap.has(key)) {
        counts.set(key, (counts.get(key) || 0) + 1);
      } else if (owner) {
        unmatchedOwners.add(owner);
      }
    }

    // Write: set viewings for all active agents (0 if none)
    const ops = [];
    let agentsUpdated = 0;

    for (const [key, agent] of agentMap.entries()) {
      const viewingsCount = counts.get(key) || 0;
      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: {
            $set: {
              "leaderboard.viewings": viewingsCount,
              "leaderboard.lastUpdated": new Date(),
              "lastUpdated": new Date(),
            },
          },
        },
      });
      if (viewingsCount > 0) agentsUpdated++;
    }

    if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

    return res.status(200).json({
      success: true,
      message: `Synced ${viewings.length} viewings for ${targetY}-${String(targetM + 1).padStart(2, "0")} (UTC).`,
      note: "Strict UTC month matching on createdDate (with safe fallbacks). Agents without viewings set to 0.",
      data: {
        period: month,
        targetUTC: { year: targetY, monthIndex0: targetM },
        totalViewings: viewings.length,
        agentsUpdated,
        agentViewings: Array.from(counts.entries())
          .map(([k, c]) => ({
            agentName: agentMap.get(k)?.agentName,
            agentId:   agentMap.get(k)?.agentId,
            viewingCount: c,
          }))
          .sort((a, b) => b.viewingCount - a.viewingCount),
        unmatchedOwners: unmatchedOwners.size ? Array.from(unmatchedOwners) : undefined,
      },
    });
  } catch (error) {
    console.error("❌ Error syncing Salesforce viewings:", error);
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
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

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
        agentOffers: Array.from(stats.offersByAgent.entries()).map(
          ([key, count]) => ({
            agentName: agentMap.get(key).agentName,
            agentId: agentMap.get(key).agentId,
            offerCount: count,
          })
        ),
        unmatchedOwners:
          stats.unmatchedOwners.size > 0
            ? Array.from(stats.unmatchedOwners)
            : undefined,
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

const updateMonthlyPropertiesForAllAgents = async (req, res) => {
  try {
    console.log("📊 Starting monthly properties update...");

    const result = await Agent.updateAllAgentsMonthlyProperties();

    return res.status(200).json({
      success: true,
      message: "Successfully updated monthly properties for all agents",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error updating monthly properties:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to update monthly properties",
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
  getLeaderboardAgents,
  syncAgentDealsFromSalesforce,
  syncAgentViewingsFromSalesforce,
  syncAgentOffersFromSalesforce,
  syncAgentCommissionsFromSalesforce,
  updateMonthlyPropertiesForAllAgents,

  // Token (exposed for your tests; do not mount as a public route)
  getSalesforceToken,
  // Test
  GetSalesForceToken,

  // Cron
  setupCronJobs,
};
