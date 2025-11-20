const Agent = require("../Models/AgentModel");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const isTruthy = (v) => v === true || v === "true";
const clampInt = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

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

    // ✅ NEW: Handle activeOnLeaderboard boolean
    if (req.body.activeOnLeaderboard !== undefined) {
      req.body.activeOnLeaderboard = isTruthy(req.body.activeOnLeaderboard);
    } else {
      // Default to true if not provided
      req.body.activeOnLeaderboard = true;
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
const getAgents = async (req, res) => {
  try {
    const pipeline = [
      { $match: { isActive: true } }, // Filter for active agents only
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
          activeOnLeaderboard: 1,

          // computed count (from properties[])
          propertiesCount: { $size: { $ifNull: ["$properties", []] } },

          // NOTE: Do NOT put properties:0 or blogs:0 here.
          // Not listing them means they are excluded.
        },
      },
    ];

    const agents = await Agent.aggregate(pipeline).allowDiskUse(true);

    return res.status(200).json({
      success: true,
      data: agents,
      total: agents.length,
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
    const agent = await Agent.findOne(
      { email: req.query.email },
      {
        agentName: 1,
        designation: 1,
        reraNumber: 1,
        specialistAreas: 1,
        email: 1,
        phone: 1,
        whatsapp: 1,
        activeSaleListings: 1,
        propertiesSoldLast15Days: 1,
        isActive: 1,
        agentId: 1,
        registeredDate: 1,
        lastUpdated: 1,
        blogs: 1,
        imageUrl: 1,
        agentLanguage: 1,
        leaderboard: 1,
        superAgent: 1,
      }
    );

    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

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
        "activeOnLeaderboard", 
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
          case "activeOnLeaderboard": // ✅ NEW: Handle activeOnLeaderboard boolean
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

module.exports = {
  createAgent,
  getAgents,
  getAgentById,
  getAgentByEmail,
  updateAgent,
  getAgentsBySequence,
  deleteAgent,
};
