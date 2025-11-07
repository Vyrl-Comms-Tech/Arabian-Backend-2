// const axios = require("axios");
// const Agent = require("../Models/AgentModel");
// const cron = require("node-cron");

// let masterSyncRunning = false;
// async function runAllSyncsLocked(fnName, fn) {
//   if (masterSyncRunning) {
//     console.log(`⏳ [SYNC LOCK] ${fnName} skipped; another sync is running.`);
//     return { skipped: true };
//   }
//   masterSyncRunning = true;
//   try {
//     return await fn();
//   } finally {
//     masterSyncRunning = false;
//   }
// }


// function normalizeAgentName(name) {
//   if (!name) return "";
//   return String(name)
//     .toLowerCase()
//     .trim()
//     .replace(/\s+/g, " ")
//     .replace(/[^\w\s]/g, "");
// }

// const SALESFORCE = {
//   tokenUrl: process.env.SALESFORCE_TOKEN_URL,
//   baseUrl: "https://arabianestates.my.salesforce.com",
//   clientId: process.env.SALESFORCE_CLIENT_ID,
//   clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
//   username: process.env.SALESFORCE_USERNAME,
//   password: process.env.SALESFORCE_PASSWORD,
// };

// const axiosSF = axios.create({
//   baseURL: SALESFORCE.baseUrl,
//   timeout: 30_000,
//   headers: { Accept: "application/json", "Content-Type": "application/json" },
// });

// // Simple retry helper for transient errors
// async function withRetry(fn, { retries = 2, delayMs = 600 } = {}) {
//   let lastErr;
//   for (let i = 0; i <= retries; i++) {
//     try {
//       return await fn();
//     } catch (err) {
//       lastErr = err;
//       const status = err?.response?.status;
//       // Retry on 429/5xx/timeouts/ENOTFOUND/ECONNRESET
//       const code = err?.code;
//       const retryable =
//         status === 429 ||
//         (status >= 500 && status < 600) ||
//         ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
//       if (!retryable || i === retries) break;
//       await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
//     }
//   }
//   throw lastErr;
// }

// // Wrap a GET to Apex REST with auto token + retry
// async function sfGet(pathname, params = {}) {
//   const token = await getSalesforceToken();
//   return withRetry(() =>
//     axiosSF.get(pathname, {
//       params,
//       headers: { Authorization: `Bearer ${token}` },
//     })
//   );
// }

// // Allowed values for ?month=
// const ALLOWED_MONTH = new Set([
//   "this_month",
//   "last_month",
//   "last_3_months",
//   "last_6_months",
//   "ytd",
//   "last_12_months",
// ]);
// function getUtcYearMonth(date) {
//   const d = new Date(date);
//   return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; // 0..11
// }

// function resolveMonthUTC(monthParam = "this_month") {
//   const now = new Date();
//   let y = now.getUTCFullYear();
//   let m = now.getUTCMonth();

//   if (monthParam === "last_month") {
//     if (m === 0) {
//       y -= 1;
//       m = 11;
//     } else {
//       m -= 1;
//     }
//   } else if (/^\d{4}-\d{2}$/.test(monthParam)) {
//     const [yy, mm] = monthParam.split("-").map(Number);
//     y = yy;
//     m = mm - 1;
//   }
//   return { targetY: y, targetM: m };
// }

// function isSameUtcMonth(dateString, targetY, targetM) {
//   const t = Date.parse(dateString);     // 👈 if string lacks timezone, this is LOCAL time
//   const { y, m } = getUtcYearMonth(t);  // then you read UTC → can shift months
//   return y === targetY && m === targetM;
// }

// //

// // CRON FUNCTIONS
// async function getSalesforceToken() {
//   // console.log("Working")
//   try {
//     const resp = await axios.post(SALESFORCE.tokenUrl, null, {
//       params: {
//         grant_type: "password",
//         client_id: SALESFORCE.clientId,
//         client_secret: SALESFORCE.clientSecret,
//         username: SALESFORCE.username,
//         password: SALESFORCE.password,
//       },
//     });
//     return resp.data.access_token;
//   } catch (error) {
//     console.error("❌ Failed to generate Salesforce token:", error.message);
//     throw new Error("Salesforce token generation failed");
//   }
// }

// async function aggregateDeals(monthParam) {
//   const { targetY, targetM } = resolveMonthUTC(monthParam);

//   // Pull both datasets exactly as requested (no coercion)
//   const [monthlyDealsResp, ytdDealsResp] = await Promise.all([
//     sfGet("/services/apexrest/deals", { month: monthParam }),
//     sfGet("/services/apexrest/deals", { month: "ytd" }),
//   ]);

//   const monthlyDealsRaw = monthlyDealsResp?.data?.deals || [];
//   const ytdDealsRaw = ytdDealsResp?.data?.deals || [];

//   // Strict UTC month filter on createddate (same as commissions)
//   const monthlyDeals = monthlyDealsRaw.filter((d) =>
//     isSameUtcMonth(d.createddate, targetY, targetM)
//   );

//   const agents = await Agent.find({ isActive: true });
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   // ===== MONTHLY DEAL COUNTS =====
//   const dealCountsByAgent = new Map();
//   const unmatchedMonthly = [];

//   for (const deal of monthlyDeals) {
//     const names = twoAgentNamesOnly(deal);
//     if (names.length === 0) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key || !agentMap.has(key)) {
//         if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//         continue;
//       }
//       dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
//     }
//   }

//   // ===== YTD LAST DEAL DATE =====
//   const agentLastDealDateYTD = new Map();
//   const unmatchedYtd = [];

//   for (const deal of ytdDealsRaw) {
//     const names = twoAgentNamesOnly(deal);
//     if (names.length === 0) continue;

//     const created = deal.createddate;
//     const dealDate = created ? new Date(created) : null;
//     if (!dealDate || Number.isNaN(dealDate.getTime())) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key) continue;

//       if (!agentMap.has(key)) {
//         if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//         continue;
//       }

//       const prev = agentLastDealDateYTD.get(key);
//       if (!prev || dealDate > prev) agentLastDealDateYTD.set(key, dealDate);
//     }
//   }

//   return {
//     targetY,
//     targetM,
//     monthlyDealsRaw,
//     monthlyDeals,
//     ytdDealsRawCount: ytdDealsRaw.length,
//     dealCountsByAgent,
//     agentLastDealDateYTD,
//     unmatchedMonthly,
//     unmatchedYtd,
//     agentMap,
//   };
// }

// function parseTarget(monthParam = "this_month") {
//   // Returns { mode: 'monthly'|'ytd', targetY, targetM }
//   if (monthParam === "ytd") {
//     const now = new Date();
//     return {
//       mode: "ytd",
//       targetY: now.getUTCFullYear(),
//       targetM: now.getUTCMonth(),
//     };
//   }
//   const { targetY, targetM } = resolveMonthUTC(monthParam);
//   return { mode: "monthly", targetY, targetM };
// }

// function twoAgentNamesOnly(deal) {
//   const names = [];
//   if (deal.deal_agent) names.push(deal.deal_agent.trim());
//   if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//   return names.filter(Boolean);
// }
// // async function syncDealsJob(month = "this_month") {
// //   try {
// //     // IMPORTANT: do NOT coerce with ensureValidMonth
// //     const {
// //       targetY,
// //       targetM,
// //       monthlyDealsRaw,
// //       monthlyDeals,
// //       ytdDealsRawCount,
// //       dealCountsByAgent,
// //       agentLastDealDateYTD,
// //       unmatchedMonthly,
// //       unmatchedYtd,
// //       agentMap,
// //     } = await aggregateDeals(month);

// //     const todayUTC = new Date();
// //     todayUTC.setUTCHours(0, 0, 0, 0);

// //     const ops = [];
// //     let agentsUpdated = 0;

// //     for (const [key, agent] of agentMap.entries()) {
// //       const dealCount = dealCountsByAgent.get(key) || 0;
// //       const lastDealDate = agentLastDealDateYTD.get(key) || null;

// //       let lastDealDays = null;
// //       if (lastDealDate) {
// //         const dealDateUTC = new Date(lastDealDate);
// //         dealDateUTC.setUTCHours(0, 0, 0, 0);
// //         lastDealDays = Math.max(
// //           0,
// //           Math.floor((todayUTC - dealDateUTC) / 86400000)
// //         );
// //       }

// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.propertiesSold": dealCount,
// //               "leaderboard.lastDealDate": lastDealDate,
// //               "leaderboard.lastDealDays": lastDealDays,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });

// //       if (dealCount > 0) agentsUpdated++;
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     console.log(
// //       `✅ [CRON] DEALS-ONLY sync completed for ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")} (UTC).`
// //     );
// //     console.log(
// //       `   - Monthly deals (strict UTC filter): ${monthlyDeals.length}/${monthlyDealsRaw.length} returned`
// //     );
// //     console.log(`   - YTD deals scanned: ${ytdDealsRawCount}`);
// //     console.log(`   - Agents updated: ${agentsUpdated}`);
// //     if (unmatchedMonthly.length)
// //       console.log(
// //         `   - Unmatched (monthly sample):`,
// //         unmatchedMonthly.slice(0, 10)
// //       );
// //     if (unmatchedYtd.length)
// //       console.log(`   - Unmatched (ytd sample):`, unmatchedYtd.slice(0, 10));

// //     return {
// //       success: true,
// //       agentsUpdated,
// //       monthlyDeals: monthlyDeals.length,
// //       ytdDeals: ytdDealsRawCount,
// //     };
// //   } catch (error) {
// //     console.error("❌ [CRON] Error syncing deals:", error.message);
// //     throw error;
// //   }
// // }
// async function syncDealsJob() {
//   // Determine current UTC month (used for filtering only)
//   const nowUTC = new Date();
//   const targetY = nowUTC.getUTCFullYear();
//   const targetM = nowUTC.getUTCMonth(); // 0..11

//   console.log(
//     `🔄 [DEALS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(
//       2,
//       "0"
//     )}`
//   );

//   // Fetch ALL deals (no month or year params)
//   const dealsResp = await sfGet("/services/apexrest/deals");
//   const allDeals = dealsResp?.data?.deals || [];

//   // Filter deals created in this current UTC month
//   const monthlyDeals = allDeals.filter((d) =>
//     isSameUtcMonth(d.createddate, targetY, targetM)
//   );

//   // Filter YTD deals to determine latest deal date in the current year
//   const ytdDeals = allDeals.filter((d) => {
//     const t = Date.parse(d.createddate);
//     if (Number.isNaN(t)) return false;
//     return new Date(t).getUTCFullYear() === targetY;
//   });

//   const agents = await Agent.find({ isActive: true });
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   // ==== MONTHLY DEAL COUNTS ====
//   const dealCountsByAgent = new Map();
//   const unmatchedMonthly = [];

//   for (const deal of monthlyDeals) {
//     const names = [];
//     if (deal.deal_agent) names.push(deal.deal_agent.trim());
//     if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//     if (!names.length) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key || !agentMap.has(key)) {
//         if (!unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//         continue;
//       }
//       dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
//     }
//   }

//   // ==== YTD LAST DEAL DATE ====
//   const agentLastDealDateYTD = new Map();
//   const unmatchedYtd = [];

//   for (const deal of ytdDeals) {
//     const names = [];
//     if (deal.deal_agent) names.push(deal.deal_agent.trim());
//     if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//     if (!names.length) continue;

//     const created = deal.createddate;
//     const dDate = created ? new Date(created) : null;
//     if (!dDate || Number.isNaN(dDate.getTime())) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key) continue;

//       if (!agentMap.has(key)) {
//         if (!unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//         continue;
//       }

//       const prev = agentLastDealDateYTD.get(key);
//       if (!prev || dDate > prev) {
//         agentLastDealDateYTD.set(key, dDate);
//       }
//     }
//   }

//   // ==== WRITE BACK TO DB ====
//   const todayUTC = new Date();
//   todayUTC.setUTCHours(0, 0, 0, 0);

//   const ops = [];
//   let agentsUpdated = 0;
//   const agentDeals = [];

//   for (const [key, agent] of agentMap.entries()) {
//     const dealCount = dealCountsByAgent.get(key) || 0;
//     const lastDealDate = agentLastDealDateYTD.get(key) || null;

//     let lastDealDays = null;
//     if (lastDealDate) {
//       const d0 = new Date(lastDealDate);
//       d0.setUTCHours(0, 0, 0, 0);
//       lastDealDays = Math.max(0, Math.floor((todayUTC - d0) / 86400000));
//     }

//     ops.push({
//       updateOne: {
//         filter: { _id: agent._id },
//         update: {
//           $set: {
//             "leaderboard.propertiesSold": dealCount,
//             "leaderboard.lastDealDate": lastDealDate,
//             "leaderboard.lastDealDays": lastDealDays,
//             "leaderboard.lastUpdated": new Date(),
//             lastUpdated: new Date(),
//           },
//         },
//       },
//     });

//     agentDeals.push({
//       agentName: agent.agentName,
//       agentId: agent.agentId,
//       dealCount,
//       lastDealDate,
//       daysSinceLastDeal: lastDealDays,
//     });

//     if (dealCount > 0) agentsUpdated++;
//   }

//   if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//   console.log(
//     `✅ [DEALS CORE] Done → Agents Updated: ${agentsUpdated}, Deals This Month: ${monthlyDeals.length}`
//   );

//   return {
//     targetY,
//     targetM,
//     totals: {
//       totalDealsReturnedByAPI: allDeals.length,
//       dealsThisMonth: monthlyDeals.length,
//       agentsUpdated,
//     },
//     agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
//     unmatched: { monthly: unmatchedMonthly, ytd: unmatchedYtd },
//   };
// }

// async function aggregateViewings(monthParam = "this_month") {
//   const { targetY, targetM } = resolveMonthUTC(monthParam);

//   const resp = await sfGet("/services/apexrest/viewings", {
//     month: monthParam,
//   });
//   const raw = resp?.data?.viewings || [];

//   // Strict UTC month filter on the 'start' field
//   const viewings = raw.filter(
//     (v) => v.start && isSameUtcMonth(v.start, targetY, targetM)
//   );

//   const agents = await Agent.find({ isActive: true });
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   const counts = new Map();
//   const unmatchedOwners = new Set();

//   for (const v of viewings) {
//     const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
//     const key = normalizeAgentName(owner);
//     if (!key) continue;

//     if (agentMap.has(key)) {
//       counts.set(key, (counts.get(key) || 0) + 1);
//     } else if (owner) {
//       unmatchedOwners.add(owner);
//     }
//   }

//   return {
//     targetY,
//     targetM,
//     viewings,
//     counts,
//     unmatchedOwners,
//     agentMap,
//     totalReturned: raw.length,
//   };
// }

// // async function syncViewingsJob(month = "this_month") {
// //   try {
// //     // ❌ Do NOT coerce with ensureValidMonth — accept YYYY-MM just like manual
// //     const {
// //       targetY,
// //       targetM,
// //       viewings,
// //       counts,
// //       unmatchedOwners,
// //       agentMap,
// //       totalReturned,
// //     } = await aggregateViewings(month);

// //     const ops = [];
// //     let agentsUpdated = 0;

// //     for (const [key, agent] of agentMap.entries()) {
// //       const viewingsCount = counts.get(key) || 0;

// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.viewings": viewingsCount,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });

// //       if (viewingsCount > 0) agentsUpdated++;
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     console.log(
// //       `✅ [CRON] Viewings sync completed for ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")} (UTC).`
// //     );
// //     console.log(
// //       `   - Viewings after strict UTC filter: ${viewings.length}/${totalReturned} returned`
// //     );
// //     console.log(`   - Agents updated: ${agentsUpdated}`);
// //     if (unmatchedOwners.size)
// //       console.log(
// //         `   - Unmatched (sample):`,
// //         Array.from(unmatchedOwners).slice(0, 10)
// //       );

// //     return { success: true, agentsUpdated, totalViewings: viewings.length };
// //   } catch (error) {
// //     console.error("❌ [CRON] Error syncing viewings:", error.message);
// //     throw error;
// //   }
// // }
// async function syncViewingsJob() {
//   const nowUTC = new Date();
//   const targetY = nowUTC.getUTCFullYear();
//   const targetM = nowUTC.getUTCMonth(); // 0..11

//   console.log(
//     `🔄 [VIEWINGS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
//   );

//   // Single dataset — no params
//   const resp = await sfGet("/services/apexrest/viewings");
//   const raw = resp?.data?.viewings || [];

//   // Strict UTC month filter by 'start'
//   const viewings = raw.filter((v) => {
//     const start = v.start || null;
//     return start && isSameUtcMonth(start, targetY, targetM);
//   });

//   const agents = await Agent.find({ isActive: true });
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   const counts = new Map();
//   const unmatchedOwners = new Set();

//   for (const v of viewings) {
//     const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
//     const key = normalizeAgentName(owner);
//     if (!key) continue;

//     if (agentMap.has(key)) {
//       counts.set(key, (counts.get(key) || 0) + 1);
//     } else if (owner) {
//       unmatchedOwners.add(owner);
//     }
//   }

//   // Write back: set viewings for all active agents (0 if none)
//   const ops = [];
//   let agentsUpdated = 0;

//   for (const [key, agent] of agentMap.entries()) {
//     const viewingsCount = counts.get(key) || 0;

//     ops.push({
//       updateOne: {
//         filter: { _id: agent._id },
//         update: {
//           $set: {
//             "leaderboard.viewings": viewingsCount,
//             "leaderboard.lastUpdated": new Date(),
//             lastUpdated: new Date(),
//           },
//         },
//       },
//     });

//     if (viewingsCount > 0) agentsUpdated++;
//   }

//   if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//   console.log(
//     `✅ [VIEWINGS CORE] Done → UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}, ` +
//     `Viewings: ${viewings.length}, Agents Updated: ${agentsUpdated}`
//   );

//   return {
//     targetY,
//     targetM,
//     totalReturned: raw.length,
//     viewingsThisMonth: viewings.length,
//     agentsUpdated,
//     agentViewings: Array.from(counts.entries())
//       .map(([k, c]) => ({
//         agentName: agentMap.get(k)?.agentName,
//         agentId: agentMap.get(k)?.agentId,
//         viewingCount: c,
//       }))
//       .sort((a, b) => b.viewingCount - a.viewingCount),
//     unmatchedOwners: unmatchedOwners.size ? Array.from(unmatchedOwners) : [],
//   };
// }

// // Manual LEaderBoard Functions
// const getLeaderboardAgents = async (req, res) => {
//   try {
//     const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
//     const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
//     const skip = (page - 1) * limit;

//     const allowedAgentNames = [
//       "Simone Adlington",
//       "Elamir Adnan",
//       "Aaqib Ahmed",
//       "Zaher Akhawi",
//       "Saad Al Hossain",
//       "Hady Azrieh",
//       "Shorouk Bahromzoda",
//       "Rowan Beale",
//       "Abdelwaheb Bekhadda",
//       "Vikram Biant",
//       "Nathan Blake",
//       "Thomas Breeds",
//       "Joshua Brooks",
//       "Nils Brunsch",
//       "Joseph Chiffi",
//       "Christian Curran",
//       "Pratik Das",
//       "Shaheen Emami",
//       "Jack Evans",
//       "Casey Gaggini",
//       "Ben Greenwood",
//       "Foteini Hadjidemetriou",
//       "Georgia Hargreaves",
//       "Charlie Harris",
//       "Tom Hastings",
//       "Magomed Kartoev",
//       // "Ryan Kent",
//       "Douglas Kisuule",
//       "Alba Kuloglija",
//       "Emma Jean Laycock",
//       "Kevin Livingstone",
//       "George Lupson",
//       "Luca Mae Joseph",
//       "Emma Elizabeth Maries",
//       "David Marsh",
//       "Clive Marsh",
//       "Chris Michaelides",
//       "Imad Najib",
//       "Nadia Salman",
//       "Samantha Scott",
//       "Alexander Stanton",
//       "Aidan Patric Stephenson",
//       "Tetiana Syvak",
//       "Sebastian Tyynela",
//       "Callum Wallace",
//       "Harry Warren",
//       "Russell Wilson",
//       "Leon Wright",
//       "Charlie Wright",
//       "Katarin Donkin",
//       "Samuel Hewitt",
//       "Craig Sutherland",
//       "Gulzhanat Turebayeva",
//     ];

//     const pipeline = [
//       // 1) Whitelist (and optionally only active)
//       { $match: { agentName: { $in: allowedAgentNames } } },
//       // { $match: { isActive: true } },

//       // 2) Keep light fields + computed propertiesCount
//       {
//         $project: {
//           agentName: 1,
//           agentLanguage: 1,
//           designation: 1,
//           email: 1,
//           whatsapp: 1,
//           phone: 1,
//           imageUrl: 1,
//           isActive: 1,
//           agentId: 1,
//           leaderboard: 1, // contains totalCommission, propertiesSold, viewings, etc.
//           sequenceNumber: 1,
//           reraNumber: 1,
//           propertiesCount: { $size: { $ifNull: ["$properties", []] } },
//         },
//       },

//       // 3) Extract commission for sorting
//       {
//         $addFields: {
//           _commission: {
//             $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] },
//           },
//           _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
//         },
//       },

//       // 4) Sort by commission (descending), then by sequenceNumber for stable ordering
//       { $sort: { _commission: -1, _tieSeq: 1 } },
//     ];

//     // Get all sorted agents first
//     const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

//     // Calculate global total commission across all agents
//     const globalTotalCommission = allAgents.reduce((sum, agent) => {
//       return sum + (agent.leaderboard?.totalCommission ?? 0);
//     }, 0);

//     // Manually assign positions (1, 2, 3, 4...)
//     const agentsWithPositions = allAgents.map((agent, index) => ({
//       ...agent,
//       position: index + 1, // Simple sequential positions starting from 1
//     }));

//     // Apply pagination
//     const paginatedAgents = agentsWithPositions.slice(skip, skip + limit);
//     const total = agentsWithPositions.length;
//     const totalPages = Math.ceil(total / limit);

//     const mapped = paginatedAgents.map((a) => ({
//       position: a.position, // Simple sequential: 1, 2, 3, 4...
//       name: a.agentName,
//       imageUrl: a.imageUrl,
//       leaderboard: {
//         activePropertiesThisMonth:
//           a.leaderboard?.activePropertiesThisMonth ?? 0,
//         propertiesSold: a.leaderboard?.propertiesSold ?? 0,
//         totalCommission: a.leaderboard?.totalCommission ?? 0,
//         viewings: a.leaderboard?.viewings ?? 0,
//         lastDealDays: a.leaderboard?.lastDealDays ?? 0,
//         offers: a.leaderboard?.offers ?? 0,
//       },
//       propertiesCount: a.propertiesCount ?? 0,
//       agentId: a.agentId,
//     }));

//     return res.status(200).json({
//       success: true,
//       data: mapped,
//       pagination: {
//         page,
//         limit,
//         totalItems: total,
//         totalPages,
//         hasPrev: page > 1,
//         hasNext: page < totalPages,
//       },
//       globalTotalCommission, // Global total commission across all agents
//     });
//   } catch (err) {
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// function parseTarget(monthParam = "this_month") {
//   // Returns { mode: 'monthly'|'ytd', targetY, targetM }
//   if (monthParam === "ytd") {
//     const now = new Date();
//     return {
//       mode: "ytd",
//       targetY: now.getUTCFullYear(),
//       targetM: now.getUTCMonth(),
//     };
//   }
//   const { targetY, targetM } = resolveMonthUTC(monthParam);
//   return { mode: "monthly", targetY, targetM };
// }

// function amountNumber(raw) {
//   return typeof raw === "string"
//     ? Number(raw.replace(/[, ]/g, ""))
//     : Number(raw) || 0;
// }

// async function aggregateCommissions(monthParam) {
//   const { mode, targetY, targetM } = parseTarget(monthParam);

//   const commissionsResp = await sfGet("/services/apexrest/commissions", {
//     month: monthParam,
//   });
//   const commissions = commissionsResp?.data?.commissions || [];

//   const agents = await Agent.find();
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   const commissionsByAgent = new Map();
//   const unmatchedCommissionAgents = [];
//   let filteredCount = 0;

//   for (const c of commissions) {
//     const created = c.createddate;
//     const inScope =
//       mode === "ytd"
//         ? created && new Date(created).getUTCFullYear() === targetY // keep same UTC year
//         : isSameUtcMonth(created, targetY, targetM); // keep same UTC month

//     if (!inScope) continue;

//     filteredCount++;

//     const agentName = c.agent_name || c.commission_agents;
//     if (!agentName) continue;

//     const key = normalizeAgentName(agentName);
//     if (!agentMap.has(key)) {
//       if (!unmatchedCommissionAgents.includes(agentName))
//         unmatchedCommissionAgents.push(agentName);
//       continue;
//     }

//     const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
//     const amt = amountNumber(raw);
//     commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amt);
//   }

//   return {
//     commissionsByAgent,
//     unmatchedCommissionAgents,
//     filteredCount,
//     agentMap,
//     targetY,
//     targetM,
//     mode,
//   };
// }

// // async function syncCommissionsJobNew(month = "this_month") {
// //   try {
// //     // IMPORTANT: do NOT coerce the month with ensureValidMonth
// //     const {
// //       commissionsByAgent,
// //       unmatchedCommissionAgents,
// //       filteredCount,
// //       agentMap,
// //       targetY,
// //       targetM,
// //     } = await aggregateCommissions(month);

// //     const ops = [];
// //     let agentsUpdated = 0;

// //     for (const [key, agent] of agentMap.entries()) {
// //       const totalCommission =
// //         Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.totalCommission": totalCommission,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });

// //       if (totalCommission > 0) agentsUpdated++;
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     console.log(
// //       `✅ [CRON] Commissions sync completed for ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")} (UTC).`
// //     );
// //     console.log(`   - Commission records synced: ${filteredCount}`);
// //     console.log(`   - Agents updated: ${agentsUpdated}`);
// //     if (unmatchedCommissionAgents.length) {
// //       console.log(
// //         `   - Unmatched (sample):`,
// //         unmatchedCommissionAgents.slice(0, 10)
// //       );
// //     }

// //     return { success: true, agentsUpdated, commissionRecords: filteredCount };
// //   } catch (error) {
// //     console.error("❌ [CRON] Error syncing commissions:", error.message);
// //     throw error;
// //   }
// // }
// async function syncCommissionsJobNew(){
//   // Current UTC month
//   const nowUTC = new Date();
//   const targetY = nowUTC.getUTCFullYear();
//   const targetM = nowUTC.getUTCMonth(); // 0..11

//   console.log(
//     `🔄 [COMMISSIONS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
//   );

//   // Single dataset from Salesforce (no params)
//   const commissionsResp = await sfGet("/services/apexrest/commissions");
//   const commissions = commissionsResp?.data?.commissions || [];

//   // Build agent map from active agents only (consistent with manual)
//   const agents = await Agent.find({ isActive: true });
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   const commissionsByAgent = new Map();
//   const unmatchedCommissionAgents = [];
//   let filteredCount = 0;

//   for (const c of commissions) {
//     const created = c.createddate;
//     if (!isSameUtcMonth(created, targetY, targetM)) continue; // strict UTC month

//     filteredCount++;

//     const agentName = c.agent_name || c.commission_agents;
//     if (!agentName) continue;

//     const key = normalizeAgentName(agentName);
//     if (!agentMap.has(key)) {
//       if (!unmatchedCommissionAgents.includes(agentName)) {
//         unmatchedCommissionAgents.push(agentName);
//       }
//       continue;
//     }

//     const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
//     const amt =
//       typeof raw === "string"
//         ? Number(raw.replace(/[, ]/g, "")) || 0
//         : Number(raw) || 0;

//     commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amt);
//   }

//   // Write back
//   const ops = [];
//   let agentsUpdated = 0;

//   for (const [key, agent] of agentMap.entries()) {
//     const totalCommission =
//       Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

//     ops.push({
//       updateOne: {
//         filter: { _id: agent._id },
//         update: {
//           $set: {
//             "leaderboard.totalCommission": totalCommission,
//             "leaderboard.lastUpdated": new Date(),
//             lastUpdated: new Date(),
//           },
//         },
//       },
//     });

//     if (totalCommission > 0) agentsUpdated++;
//   }

//   if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//   console.log(
//     `✅ [COMMISSIONS CORE] Completed for ${targetY}-${String(targetM + 1).padStart(2, "0")} (UTC).`
//   );
//   console.log(`   - Commission records synced (current month): ${filteredCount}`);
//   console.log(`   - Agents updated: ${agentsUpdated}`);
//   if (unmatchedCommissionAgents.length) {
//     console.log(
//       `   - Unmatched (sample):`,
//       unmatchedCommissionAgents.slice(0, 10)
//     );
//   }

//   return {
//     targetY,
//     targetM,
//     filteredCount,
//     agentsUpdated,
//     unmatchedCommissionAgents,
//     totalReturned: commissions.length,
//   };
// }

// async function syncMonthlyPropertiesJobNew() {
//   try {
//     console.log("🔄 [CRON] Starting monthly properties update...");

//     const result = await Agent.updateAllAgentsMonthlyProperties();

//     console.log(
//       `✅ [CRON] Monthly properties updated for ${result.agentsUpdated} agents`
//     );
//     return result;
//   } catch (error) {
//     console.error(
//       "❌ [CRON] Error updating monthly properties:",
//       error.message
//     );
//     throw error;
//   }
// }

// // async function runAllSyncs() {
// //   console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
// //   const t0 = Date.now();
// //   try {
// //     // Run deals, commissions, and viewings in parallel
// //     await Promise.all([
// //       syncDealsJob(),
// //       syncCommissionsJobNew(),
// //       syncViewingsJob(),
// //     ]);

// //     // ✅ Run monthly properties after other syncs
// //     await syncMonthlyPropertiesJobNew();

// //     const sec = ((Date.now() - t0) / 1000).toFixed(2);
// //     console.log(`✅ [CRON] All syncs completed successfully in ${sec}s`);
// //   } catch (error) {
// //     console.error("❌ [CRON] Error in scheduled sync job:", error.message);
// //   }
// // }

// async function runAllSyncs() {
//   return runAllSyncsLocked("master-sync", async () => {
//     console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
//     const t0 = Date.now();
//     try {
//       // Run deals, commissions, and viewings in parallel
//       await Promise.all([
//         syncDealsJob(),
//         syncCommissionsJobNew(),
//         syncViewingsJob(),
//       ]);

//       // ✅ Run monthly properties after other syncs
//       await syncMonthlyPropertiesJobNew();

//       const sec = ((Date.now() - t0) / 1000).toFixed(2);
//       console.log(`✅ [CRON] All syncs completed successfully in ${sec}s`);
//     } catch (error) {
//       console.error("❌ [CRON] Error in scheduled sync job:", error.message);
//     }
//   });
// }


// // let cronScheduled = false;
// // function setupCronJobs() {
// //   if (cronScheduled) {
// //     console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
// //     return;
// //   }

// //   // ✅ Main sync job - every 15 minutes
// //   cron.schedule("*/15 * * * *", async () => {
// //     await runAllSyncs();
// //   });

// //   cronScheduled = true;
// //   console.log(
// //     "✅ Cron job scheduled: Salesforce sync will run every 15 minutes"
// //   );

// //   // Optional: run immediately on startup
// //   console.log("🚀 Running initial sync on startup...");
// //   runAllSyncs();
// // }


// let cronScheduled = false;
// function setupCronJobs() {
//   if (cronScheduled) {
//     console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
//     return;
//   }

//   // ✅ Main sync job - every 15 minutes, pinned to UTC
//   cron.schedule(
//     "*/30 * * * *",
//     async () => {
//       await runAllSyncs(); // already mutex-protected
//     },
//     { timezone: "UTC" }
//   );

//   cronScheduled = true;
//   console.log("✅ Cron job scheduled: Salesforce sync will run every 15 minutes (UTC)");

//   // Optional: run immediately on startup (also mutex-protected)
//   console.log("🚀 Running initial sync on startup...");
//   runAllSyncs();
// }

// const GetSalesForceToken = async (req, res) => {
//   try {
//     console.log("WORKING");
//     const resp = await axios.post(SALESFORCE.tokenUrl, null, {
//       params: {
//         grant_type: "password",
//         client_id: SALESFORCE.clientId,
//         client_secret: SALESFORCE.clientSecret,
//         username: SALESFORCE.username,
//         password: SALESFORCE.password,
//       },
//     });
//     console.log(resp.data.access_token);
//     return res.status(200).json({
//       access_token: resp.data.access_token,
//     });
//   } catch (error) {
//     console.error("❌ Failed to generate Salesforce token:", error.message);
//     throw new Error("Salesforce token generation failed");
//   }
// };

// // Fetching deals of agents amd days since last deal
// // const syncAgentDealsFromSalesforce = async (req, res) => {
// //     try {
// //     // Lock the target period to the current UTC month (for "monthly" counting)
// //     const nowUTC = new Date();
// //     const targetY = nowUTC.getUTCFullYear();
// //     const targetM = nowUTC.getUTCMonth();

// //     console.log(
// //       `🔄 Starting Salesforce DEALS-ONLY sync (single dataset) -> UTC ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")}`
// //     );

// //     // 🔹 Single call — no params, the API returns a constant list of deals
// //     const dealsResp = await sfGet("/services/apexrest/deals");
// //     const allDeals = dealsResp?.data?.deals || [];

// //     // Strict month filter (createddate ONLY) — local filter
// //     const monthlyDeals = allDeals.filter((d) =>
// //       isSameUtcMonth(d.createddate, targetY, targetM)
// //     );

// //     // For "YTD last deal date", restrict to the current UTC year
// //     const ytdDeals = allDeals.filter((d) => {
// //       const t = Date.parse(d.createddate);
// //       if (Number.isNaN(t)) return false;
// //       return new Date(t).getUTCFullYear() === targetY;
// //     });

// //     const agents = await Agent.find({ isActive: true });
// //     const agentMap = new Map(
// //       agents.map((a) => [normalizeAgentName(a.agentName), a])
// //     );

// //     // ===== MONTHLY DEAL COUNTS =====
// //     const dealCountsByAgent = new Map();
// //     const unmatchedMonthly = [];

// //     for (const deal of monthlyDeals) {
// //       // Only these two fields are considered owners of a deal
// //       const names = [];
// //       if (deal.deal_agent) names.push(deal.deal_agent.trim());
// //       if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
// //       if (names.length === 0) continue;

// //       for (const nm of names) {
// //         const key = normalizeAgentName(nm);
// //         if (!key || !agentMap.has(key)) {
// //           if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
// //           continue;
// //         }
// //         dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
// //       }
// //     }

// //     // ===== YTD LAST DEAL DATE =====
// //     const agentLastDealDateYTD = new Map();
// //     const unmatchedYtd = [];

// //     for (const deal of ytdDeals) {
// //       const names = [];
// //       if (deal.deal_agent) names.push(deal.deal_agent.trim());
// //       if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
// //       if (names.length === 0) continue;

// //       const created = deal.createddate;
// //       const dealDate = created ? new Date(created) : null;
// //       if (!dealDate || Number.isNaN(dealDate.getTime())) continue;

// //       for (const nm of names) {
// //         const key = normalizeAgentName(nm);
// //         if (!key) continue;

// //         if (!agentMap.has(key)) {
// //           if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
// //           continue;
// //         }

// //         const prev = agentLastDealDateYTD.get(key);
// //         if (!prev || dealDate > prev) {
// //           agentLastDealDateYTD.set(key, dealDate);
// //         }
// //       }
// //     }

// //     // ===== UPDATE AGENTS (DEAL METRICS ONLY) =====
// //     // Calculate days using UTC midnight for consistency
// //     const todayUTC = new Date();
// //     todayUTC.setUTCHours(0, 0, 0, 0);

// //     const ops = [];
// //     let agentsUpdated = 0;
// //     const agentDeals = [];

// //     for (const [key, agent] of agentMap.entries()) {
// //       const dealCount = dealCountsByAgent.get(key) || 0;
// //       const lastDealDate = agentLastDealDateYTD.get(key) || null;

// //       let lastDealDays = null;
// //       if (lastDealDate) {
// //         const dealDateUTC = new Date(lastDealDate);
// //         dealDateUTC.setUTCHours(0, 0, 0, 0);
// //         const diffMs = todayUTC.getTime() - dealDateUTC.getTime();
// //         lastDealDays = Math.max(0, Math.floor(diffMs / 86400000));
// //       }

// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.propertiesSold": dealCount,
// //               "leaderboard.lastDealDate": lastDealDate,
// //               "leaderboard.lastDealDays": lastDealDays,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });

// //       agentDeals.push({
// //         agentName: agent.agentName,
// //         agentId: agent.agentId,
// //         dealCount,
// //         lastDealDate,
// //         daysSinceLastDeal: lastDealDays,
// //       });

// //       if (dealCount > 0) agentsUpdated++;
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     console.log(
// //       `✅ DEALS-ONLY sync completed for ${targetY}-${String(targetM + 1).padStart(2, "0")} (UTC).`
// //     );
// //     console.log(`   - Monthly deals (strict UTC filter): ${monthlyDeals.length}`);
// //     console.log(`   - YTD deals scanned (local year filter): ${ytdDeals.length}`);
// //     console.log(`   - Agents updated: ${agentsUpdated}`);

// //     return res.status(200).json({
// //       success: true,
// //       message: `Successfully synced ${monthlyDeals.length} monthly deals (strict UTC month, local filter). Updated ${agentsUpdated} agents with deal counts only.`,
// //       note: "Single dataset from Salesforce. Monthly = createddate in current UTC month. YTD lastDealDate = latest deal in current UTC year. Referrers excluded; only deal_agent/deal_agent_2.",
// //       data: {
// //         targetUTC: { year: targetY, monthIndex0: targetM },
// //         totalDealsReturnedByAPI: allDeals.length,
// //         totalDealsCountedAfterStrictFilter: monthlyDeals.length,
// //         agentsUpdated,
// //         agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
// //         unmatchedOwners: {
// //           monthly: unmatchedMonthly,
// //           ytd: unmatchedYtd,
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     console.error("❌ Error syncing deals:", error.message);
// //     return res.status(500).json({ success: false, error: error.message });
// //   }
// // }
// const syncAgentDealsFromSalesforce = async (req, res) => {
//   try {
//     // Determine current UTC month (used for filtering only)
//     const nowUTC = new Date();
//     const targetY = nowUTC.getUTCFullYear();
//     const targetM = nowUTC.getUTCMonth(); // 0..11

//     console.log(
//       `🔄 Starting Salesforce DEALS sync -> UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );

//     // Fetch ALL deals (no month or year params from now on)
//     const dealsResp = await sfGet("/services/apexrest/deals");
//     const allDeals = dealsResp?.data?.deals || [];

//     // Filter deals created in this current UTC month
//     const monthlyDeals = allDeals.filter((d) =>
//       isSameUtcMonth(d.createddate, targetY, targetM)
//     );

//     // Filter YTD deals to determine latest deal date in the current year
//     const ytdDeals = allDeals.filter((d) => {
//       const t = Date.parse(d.createddate);
//       if (Number.isNaN(t)) return false;
//       return new Date(t).getUTCFullYear() === targetY;
//     });

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     // ==== MONTHLY DEAL COUNTS ====
//     const dealCountsByAgent = new Map();
//     const unmatchedMonthly = [];

//     for (const deal of monthlyDeals) {
//       const names = [];
//       if (deal.deal_agent) names.push(deal.deal_agent.trim());
//       if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//       if (!names.length) continue;

//       for (const nm of names) {
//         const key = normalizeAgentName(nm);
//         if (!key || !agentMap.has(key)) {
//           if (!unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//           continue;
//         }
//         dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
//       }
//     }

//     // ==== YTD LAST DEAL DATE ====
//     const agentLastDealDateYTD = new Map();
//     const unmatchedYtd = [];

//     for (const deal of ytdDeals) {
//       const names = [];
//       if (deal.deal_agent) names.push(deal.deal_agent.trim());
//       if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//       if (!names.length) continue;

//       const created = deal.createddate;
//       const dDate = created ? new Date(created) : null;
//       if (!dDate || Number.isNaN(dDate.getTime())) continue;

//       for (const nm of names) {
//         const key = normalizeAgentName(nm);
//         if (!key) continue;

//         if (!agentMap.has(key)) {
//           if (!unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//           continue;
//         }

//         const prev = agentLastDealDateYTD.get(key);
//         if (!prev || dDate > prev) {
//           agentLastDealDateYTD.set(key, dDate);
//         }
//       }
//     }

//     // ==== WRITE BACK TO DB ====
//     const todayUTC = new Date();
//     todayUTC.setUTCHours(0, 0, 0, 0);

//     const ops = [];
//     let agentsUpdated = 0;
//     const agentDeals = [];

//     for (const [key, agent] of agentMap.entries()) {
//       const dealCount = dealCountsByAgent.get(key) || 0;
//       const lastDealDate = agentLastDealDateYTD.get(key) || null;

//       let lastDealDays = null;
//       if (lastDealDate) {
//         const d0 = new Date(lastDealDate);
//         d0.setUTCHours(0, 0, 0, 0);
//         lastDealDays = Math.max(0, Math.floor((todayUTC - d0) / 86400000));
//       }

//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: {
//             $set: {
//               "leaderboard.propertiesSold": dealCount,
//               "leaderboard.lastDealDate": lastDealDate,
//               "leaderboard.lastDealDays": lastDealDays,
//               "leaderboard.lastUpdated": new Date(),
//               lastUpdated: new Date(),
//             },
//           },
//         },
//       });

//       agentDeals.push({
//         agentName: agent.agentName,
//         agentId: agent.agentId,
//         dealCount,
//         lastDealDate,
//         daysSinceLastDeal: lastDealDays,
//       });

//       if (dealCount > 0) agentsUpdated++;
//     }

//     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//     console.log(
//       `✅ DEALS SYNC DONE → Agents Updated: ${agentsUpdated}, Deals This Month: ${monthlyDeals.length}`
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Synced deals successfully.`,
//       data: {
//         targetUTC: { year: targetY, monthIndex0: targetM },
//         totalDealsReturnedByAPI: allDeals.length,
//         dealsThisMonth: monthlyDeals.length,
//         agentsUpdated,
//         agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
//         unmatched: { monthly: unmatchedMonthly, ytd: unmatchedYtd },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing deals:", error.message);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Fetching monthly commissions
// // const syncAgentCommissionsFromSalesforce = async (req, res) => {
// //   try {
// //     const { month = "this_month" } = req.query;
// //     const { targetY, targetM } = resolveMonthUTC(month);

// //     const commissionsResp = await sfGet("/services/apexrest/commissions", {
// //       month,
// //     });
// //     const commissions = commissionsResp?.data?.commissions || [];

// //     const agents = await Agent.find({ isActive: true });
// //     const agentMap = new Map(
// //       agents.map((a) => [normalizeAgentName(a.agentName), a])
// //     );

// //     const commissionsByAgent = new Map();
// //     const unmatchedCommissionAgents = [];
// //     let filteredCount = 0;

// //     // Optional: trace
// //     const traceIncluded = [];
// //     const traceSkipped = [];

// //     for (const c of commissions) {
// //       // ✅ ONLY createddate decides inclusion
// //       const created = c.createddate; // do not fall back to lastmodifieddate here
// //       const keep = isSameUtcMonth(created, targetY, targetM);

// //       if (!keep) {
// //         // for debugging, capture a few
// //         if (traceSkipped.length < 20)
// //           traceSkipped.push({
// //             ref: c.commission_ref_no,
// //             agent: c.agent_name || c.commission_agents,
// //             created,
// //           });
// //         continue;
// //       }

// //       filteredCount++;
// //       if (traceIncluded.length < 20)
// //         traceIncluded.push({
// //           ref: c.commission_ref_no,
// //           agent: c.agent_name || c.commission_agents,
// //           created,
// //         });

// //       const agentName = c.agent_name || c.commission_agents;
// //       if (!agentName) continue;

// //       const key = normalizeAgentName(agentName);
// //       if (!agentMap.has(key)) {
// //         if (!unmatchedCommissionAgents.includes(agentName)) {
// //           unmatchedCommissionAgents.push(agentName);
// //         }
// //         continue;
// //       }

// //       const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
// //       const amount =
// //         typeof raw === "string"
// //           ? Number(raw.replace(/[, ]/g, ""))
// //           : Number(raw) || 0;

// //       commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
// //     }

// //     // Write back (safe & fast)
// //     const ops = [];
// //     const agentCommissions = [];
// //     let agentsUpdated = 0;

// //     for (const [key, agent] of agentMap.entries()) {
// //       const totalCommission =
// //         Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.totalCommission": totalCommission,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });

// //       if (totalCommission > 0) agentsUpdated++;
// //       agentCommissions.push({
// //         agentName: agent.agentName,
// //         agentId: agent.agentId,
// //         totalCommission,
// //         currentDeals: agent.leaderboard?.propertiesSold || 0,
// //       });
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     return res.status(200).json({
// //       success: true,
// //       message: `Synced ${filteredCount} commission records for ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")} (UTC).`,
// //       note: "Strict UTC month matching on createddate only.",
// //       data: {
// //         period: month,
// //         targetUTC: { year: targetY, monthIndex0: targetM },
// //         totalCommissionRecords: commissions.length,
// //         currentMonthRecords: filteredCount,
// //         agentsWithCommission: agentsUpdated,
// //         agentsResetToZero: agents.length - agentsUpdated,
// //         agentCommissions: agentCommissions
// //           .filter((a) => a.totalCommission > 0)
// //           .sort((a, b) => b.totalCommission - a.totalCommission),
// //         unmatchedAgents: unmatchedCommissionAgents,
// //         debugSample: {
// //           includedFirst20: traceIncluded,
// //           skippedFirst20: traceSkipped,
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     console.error("❌ Error syncing commissions:", error);
// //     return res.status(500).json({ success: false, error: error.message });
// //   }
// // };
// const syncAgentCommissionsFromSalesforce = async (req, res) => {
//   try {
//     // Determine current UTC month & year
//     const nowUTC = new Date();
//     const targetY = nowUTC.getUTCFullYear();
//     const targetM = nowUTC.getUTCMonth(); // 0-11

//     console.log(
//       `🔄 Starting Salesforce COMMISSIONS sync (single dataset) -> UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );

//     // 🔹 Fetch ALL commission records from Salesforce (NO month param)
//     const commissionsResp = await sfGet("/services/apexrest/commissions");
//     const commissions = commissionsResp?.data?.commissions || [];

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     const commissionsByAgent = new Map();
//     const unmatchedCommissionAgents = [];
//     let filteredCount = 0;

//     // Debug trace samples
//     const traceIncluded = [];
//     const traceSkipped = [];

//     for (const c of commissions) {
//       const created = c.createddate;
//       const keep = isSameUtcMonth(created, targetY, targetM); // STRICT UTC MONTH

//       if (!keep) {
//         if (traceSkipped.length < 20)
//           traceSkipped.push({
//             ref: c.commission_ref_no,
//             agent: c.agent_name || c.commission_agents,
//             created,
//           });
//         continue;
//       }

//       filteredCount++;
//       if (traceIncluded.length < 20)
//         traceIncluded.push({
//           ref: c.commission_ref_no,
//           agent: c.agent_name || c.commission_agents,
//           created,
//         });

//       const agentName = c.agent_name || c.commission_agents;
//       if (!agentName) continue;

//       const key = normalizeAgentName(agentName);
//       if (!agentMap.has(key)) {
//         if (!unmatchedCommissionAgents.includes(agentName))
//           unmatchedCommissionAgents.push(agentName);
//         continue;
//       }

//       const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
//       const amount =
//         typeof raw === "string"
//           ? Number(raw.replace(/[, ]/g, "")) || 0
//           : Number(raw) || 0;

//       commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
//     }

//     // ✅ Write back leaderboard
//     const ops = [];
//     let agentsUpdated = 0;
//     const agentCommissions = [];

//     for (const [key, agent] of agentMap.entries()) {
//       const totalCommission =
//         Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: {
//             $set: {
//               "leaderboard.totalCommission": totalCommission,
//               "leaderboard.lastUpdated": new Date(),
//               lastUpdated: new Date(),
//             },
//           },
//         },
//       });

//       if (totalCommission > 0) agentsUpdated++;

//       agentCommissions.push({
//         agentName: agent.agentName,
//         agentId: agent.agentId,
//         totalCommission,
//         currentDeals: agent.leaderboard?.propertiesSold || 0,
//       });
//     }

//     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//     console.log(
//       `✅ COMMISSIONS sync completed for UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );
//     console.log(`   - Current month records: ${filteredCount}`);
//     console.log(`   - Agents updated: ${agentsUpdated}`);

//     return res.status(200).json({
//       success: true,
//       message: `Synced ${filteredCount} commission records for current month (UTC).`,
//       data: {
//         targetUTC: { year: targetY, monthIndex0: targetM },
//         totalCommissionRecordsReturned: commissions.length,
//         currentMonthRecords: filteredCount,
//         agentsWithCommission: agentsUpdated,
//         agentsResetToZero: agents.length - agentsUpdated,
//         agentCommissions: agentCommissions
//           .filter((a) => a.totalCommission > 0)
//           .sort((a, b) => b.totalCommission - a.totalCommission),
//         unmatchedAgents: unmatchedCommissionAgents,
//         debugSample: {
//           includedFirst20: traceIncluded,
//           skippedFirst20: traceSkipped,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing commissions:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Fetching monthly viewings
// // const syncAgentViewingsFromSalesforce = async (req, res) => {
// //   try {
// //     const { month = "this_month" } = req.query;
// //     const { targetY, targetM } = resolveMonthUTC(month);

// //     console.log(
// //       `🔄 Starting Salesforce VIEWINGS sync for: ${month} -> UTC ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")}`
// //     );

// //     const resp = await sfGet("/services/apexrest/viewings", { month });
// //     const raw = resp?.data?.viewings || [];

// //     // ✅ Use start field (primary) for filtering by month
// //     const viewings = raw.filter((v) => {
// //       const start = v.start || null;
// //       return start && isSameUtcMonth(start, targetY, targetM);
// //     });

// //     const agents = await Agent.find({ isActive: true });
// //     const agentMap = new Map(
// //       agents.map((a) => [normalizeAgentName(a.agentName), a])
// //     );

// //     const counts = new Map();
// //     const unmatchedOwners = new Set();

// //     for (const v of viewings) {
// //       const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
// //       const key = normalizeAgentName(owner);
// //       if (!key) continue;
// //       if (agentMap.has(key)) {
// //         counts.set(key, (counts.get(key) || 0) + 1);
// //       } else if (owner) {
// //         unmatchedOwners.add(owner);
// //       }
// //     }

// //     // Write: set viewings for all active agents (0 if none)
// //     const ops = [];
// //     let agentsUpdated = 0;

// //     for (const [key, agent] of agentMap.entries()) {
// //       const viewingsCount = counts.get(key) || 0;
// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.viewings": viewingsCount,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });
// //       if (viewingsCount > 0) agentsUpdated++;
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     console.log(
// //       `✅ Viewings sync completed for ${targetY}-${String(targetM + 1).padStart(
// //         2,
// //         "0"
// //       )} (UTC).`
// //     );

// //     return res.status(200).json({
// //       success: true,
// //       message: `Synced ${viewings.length} viewings for ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")} (UTC).`,
// //       note: "Strict UTC month matching on 'start' field. Agents without viewings set to 0.",
// //       data: {
// //         period: month,
// //         targetUTC: { year: targetY, monthIndex0: targetM },
// //         totalViewings: viewings.length,
// //         agentsUpdated,
// //         agentViewings: Array.from(counts.entries())
// //           .map(([k, c]) => ({
// //             agentName: agentMap.get(k)?.agentName,
// //             agentId: agentMap.get(k)?.agentId,
// //             viewingCount: c,
// //           }))
// //           .sort((a, b) => b.viewingCount - a.viewingCount),
// //         unmatchedOwners: unmatchedOwners.size
// //           ? Array.from(unmatchedOwners)
// //           : undefined,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("❌ Error syncing Salesforce viewings:", error);
// //     const status = error?.response?.status || 500;
// //     const msg =
// //       status === 401
// //         ? "Salesforce authentication failed. Invalid or expired Bearer token"
// //         : "Failed to fetch viewings from Salesforce";
// //     return res.status(status === 401 ? 401 : 503).json({
// //       success: false,
// //       error: msg,
// //       details: error.message,
// //     });
// //   }
// // };
// const syncAgentViewingsFromSalesforce = async (req, res) => {
//   try {
//     // Current UTC year/month for strict local filtering
//     const nowUTC = new Date();
//     const targetY = nowUTC.getUTCFullYear();
//     const targetM = nowUTC.getUTCMonth(); // 0..11

//     console.log(
//       `🔄 Starting Salesforce VIEWINGS sync (single dataset) -> UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );

//     // 🔹 Fetch ALL viewings once — no ?month param
//     const resp = await sfGet("/services/apexrest/viewings");
//     const raw = resp?.data?.viewings || [];

//     // ✅ Strict UTC month filter using the 'start' field
//     const viewings = raw.filter((v) => {
//       const start = v.start || null;
//       return start && isSameUtcMonth(start, targetY, targetM);
//     });

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     const counts = new Map();
//     const unmatchedOwners = new Set();

//     for (const v of viewings) {
//       const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
//       const key = normalizeAgentName(owner);
//       if (!key) continue;

//       if (agentMap.has(key)) {
//         counts.set(key, (counts.get(key) || 0) + 1);
//       } else if (owner) {
//         unmatchedOwners.add(owner);
//       }
//     }

//     // Write: set viewings for all active agents (0 if none)
//     const ops = [];
//     let agentsUpdated = 0;

//     for (const [key, agent] of agentMap.entries()) {
//       const viewingsCount = counts.get(key) || 0;

//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: {
//             $set: {
//               "leaderboard.viewings": viewingsCount,
//               "leaderboard.lastUpdated": new Date(),
//               lastUpdated: new Date(),
//             },
//           },
//         },
//       });

//       if (viewingsCount > 0) agentsUpdated++;
//     }

//     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//     console.log(
//       `✅ Viewings sync completed for UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}.`
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Synced ${viewings.length} viewings for current UTC month.`,
//       note: "Single dataset from Salesforce. Strict UTC month matching on 'start'. Agents without viewings set to 0.",
//       data: {
//         targetUTC: { year: targetY, monthIndex0: targetM },
//         totalViewings: viewings.length,
//         agentsUpdated,
//         agentViewings: Array.from(counts.entries())
//           .map(([k, c]) => ({
//             agentName: agentMap.get(k)?.agentName,
//             agentId: agentMap.get(k)?.agentId,
//             viewingCount: c,
//           }))
//           .sort((a, b) => b.viewingCount - a.viewingCount),
//         unmatchedOwners: unmatchedOwners.size
//           ? Array.from(unmatchedOwners)
//           : undefined,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing Salesforce viewings:", error);
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

// // const syncAgentViewingsFromSalesforce = async (req, res) => {
// //   try {
// //     // Current UTC year/month for strict local filtering
// //     const nowUTC = new Date();
// //     const targetY = nowUTC.getUTCFullYear();
// //     const targetM = nowUTC.getUTCMonth(); // 0..11

// //     console.log(
// //       `🔄 Starting Salesforce VIEWINGS sync (single dataset) -> UTC ${targetY}-${String(
// //         targetM + 1
// //       ).padStart(2, "0")}`
// //     );

// //     // 🔹 Fetch ALL viewings once — no ?month param
// //     const resp = await sfGet("/services/apexrest/viewings");
// //     const raw = resp?.data?.viewings || [];

// //     // ✅ Strict UTC month filter using the 'start' field
// //     const viewings = raw.filter((v) => {
// //       const start = v.start || null;
// //       return start && isSameUtcMonth(start, targetY, targetM);
// //     });

// //     const agents = await Agent.find({ isActive: true });
// //     const agentMap = new Map(
// //       agents.map((a) => [normalizeAgentName(a.agentName), a])
// //     );

// //     const counts = new Map();
// //     const unmatchedOwners = new Set();

// //     for (const v of viewings) {
// //       const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
// //       const key = normalizeAgentName(owner);
// //       if (!key) continue;

// //       if (agentMap.has(key)) {
// //         counts.set(key, (counts.get(key) || 0) + 1);
// //       } else if (owner) {
// //         unmatchedOwners.add(owner);
// //       }
// //     }

// //     // Write: set viewings for all active agents (0 if none)
// //     const ops = [];
// //     let agentsUpdated = 0;

// //     for (const [key, agent] of agentMap.entries()) {
// //       const viewingsCount = counts.get(key) || 0;

// //       ops.push({
// //         updateOne: {
// //           filter: { _id: agent._id },
// //           update: {
// //             $set: {
// //               "leaderboard.viewings": viewingsCount,
// //               "leaderboard.lastUpdated": new Date(),
// //               lastUpdated: new Date(),
// //             },
// //           },
// //         },
// //       });

// //       if (viewingsCount > 0) agentsUpdated++;
// //     }

// //     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

// //     console.log(
// //       `✅ Viewings sync completed for UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}.`
// //     );

// //     return res.status(200).json({
// //       success: true,
// //       message: `Synced ${viewings.length} viewings for current UTC month.`,
// //       note: "Single dataset from Salesforce. Strict UTC month matching on 'start'. Agents without viewings set to 0.",
// //       data: {
// //         targetUTC: { year: targetY, monthIndex0: targetM },
// //         totalViewings: viewings.length,
// //         agentsUpdated,
// //         agentViewings: Array.from(counts.entries())
// //           .map(([k, c]) => ({
// //             agentName: agentMap.get(k)?.agentName,
// //             agentId: agentMap.get(k)?.agentId,
// //             viewingCount: c,
// //           }))
// //           .sort((a, b) => b.viewingCount - a.viewingCount),
// //         unmatchedOwners: unmatchedOwners.size
// //           ? Array.from(unmatchedOwners)
// //           : undefined,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("❌ Error syncing Salesforce viewings:", error);
// //     const status = error?.response?.status || 500;
// //     const msg =
// //       status === 401
// //         ? "Salesforce authentication failed. Invalid or expired Bearer token"
// //         : "Failed to fetch viewings from Salesforce";
// //     return res.status(status === 401 ? 401 : 503).json({
// //       success: false,
// //       error: msg,
// //       details: error.message,
// //     });
// //   }
// // };

// // Updating monthly properties for all agents
// const updateMonthlyPropertiesForAllAgents = async (req, res) => {
//   try {
//     console.log("📊 Starting monthly properties update...");

//     const result = await Agent.updateAllAgentsMonthlyProperties();

//     return res.status(200).json({
//       success: true,
//       message: "Successfully updated monthly properties for all agents",
//       data: result,
//     });
//   } catch (error) {
//     console.error("❌ Error updating monthly properties:", error.message);
//     return res.status(500).json({
//       success: false,
//       error: "Failed to update monthly properties",
//       details: error.message,
//     });
//   }
// };

// module.exports = {
//   // Leaderboard APIs
//   getLeaderboardAgents,
//   syncAgentDealsFromSalesforce,
//   syncAgentViewingsFromSalesforce,
//   // syncAgentOffersFromSalesforce,
//   syncAgentCommissionsFromSalesforce,
//   updateMonthlyPropertiesForAllAgents,

//   // Token (exposed for your tests; do not mount as a public route)
//   getSalesforceToken,
//   // Test
//   GetSalesForceToken,

//   // Cron
//   setupCronJobs,
// };




// salesforceSyncController.fixed.js
/* eslint-disable no-console */
const axios = require("axios");
const Agent = require("../Models/AgentModel");
const cron = require("node-cron");
 
let masterSyncRunning = false;
async function runAllSyncsLocked(fnName, fn) {
  if (masterSyncRunning) {
    console.log(`⏳ [SYNC LOCK] ${fnName} skipped; another sync is running.`);
    return { skipped: true };
  }
  masterSyncRunning = true;
  try {
    return await fn();
  } finally {
    masterSyncRunning = false;
  }
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Name normalization
 *  ─────────────────────────────────────────────────────────────────────────── */
function normalizeAgentName(name) {
  if (!name) return "";
  return String(name)
    .normalize("NFKD") // strip diacritics where possible
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Salesforce / HTTP
 *  ─────────────────────────────────────────────────────────────────────────── */
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

// OAuth2 token
async function getSalesforceToken() {
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

// Apex REST GET with token + retry
async function sfGet(pathname, params = {}) {
  const token = await getSalesforceToken();
  return withRetry(() =>
    axiosSF.get(pathname, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

/** ───────────────────────────────────────────────────────────────────────────
 *  UTC date helpers (critical for month/year boundaries)
 *  ─────────────────────────────────────────────────────────────────────────── */
function toUtcDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = String(input);
  // If lacks TZ info, assume UTC (append 'Z')
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasTZ ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameUtcMonth(dateLike, targetY, targetM) {
  const d = toUtcDate(dateLike);
  if (!d) return false;
  return d.getUTCFullYear() === targetY && d.getUTCMonth() === targetM; // 0..11
}

function utcTodayStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** ───────────────────────────────────────────────────────────────────────────
 *  “Safe zeroing” guard:
 *  - Avoid writing zeros in the first minutes of a new UTC day when sources
 *    can be temporarily thin/empty due to upstream lags.
 *  Adjust window if needed.
 *  ─────────────────────────────────────────────────────────────────────────── */
function allowZeroingNow() {
  const now = new Date();
  const minsFromMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minsFromMidnight > 45; // skip zeroing in first 45 minutes of UTC day
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Deals sync (single dataset; strict UTC current month + YTD last deal date)
 *  ─────────────────────────────────────────────────────────────────────────── */
// async function syncDealsJob() {
//   const nowUTC = new Date();
//   const targetY = nowUTC.getUTCFullYear();
//   const targetM = nowUTC.getUTCMonth();

//   console.log(
//     `🔄 [DEALS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
//   );

//   const dealsResp = await sfGet("/services/apexrest/deals");
//   const allDeals = dealsResp?.data?.deals || [];

//   // Current month (UTC) by createddate
//   const monthlyDeals = allDeals.filter((d) =>
//     isSameUtcMonth(d?.createddate, targetY, targetM)
//   );

//   // YTD for lastDealDate (same UTC year)
//   const ytdDeals = allDeals.filter((d) => {
//     const dt = toUtcDate(d?.createddate);
//     return dt && dt.getUTCFullYear() === targetY;
//   });

//   const agents = await Agent.find({ isActive: true });
//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   // Count monthly deals per agent
//   const dealCountsByAgent = new Map();
//   const unmatchedMonthly = [];

//   function twoAgentNamesOnly(deal) {
//     const names = [];
//     if (deal.deal_agent) names.push(deal.deal_agent.trim());
//     if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//     return names.filter(Boolean);
//   }

//   for (const deal of monthlyDeals) {
//     const names = twoAgentNamesOnly(deal);
//     if (!names.length) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key || !agentMap.has(key)) {
//         if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//         continue;
//       }
//       dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
//     }
//   }

//   // Compute lastDealDate(YTD) per agent
//   const agentLastDealDateYTD = new Map();
//   const unmatchedYtd = [];

//   for (const deal of ytdDeals) {
//     const names = twoAgentNamesOnly(deal);
//     if (!names.length) continue;

//     const dDate = toUtcDate(deal.createddate);
//     if (!dDate) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key) continue;

//       if (!agentMap.has(key)) {
//         if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//         continue;
//       }

//       const prev = agentLastDealDateYTD.get(key);
//       if (!prev || dDate > prev) agentLastDealDateYTD.set(key, dDate);
//     }
//   }

//   // Writeback (safe zeroing)
//   const todayUTC = utcTodayStart();
//   const canZero = allowZeroingNow();
//   const ops = [];
//   let agentsUpdated = 0;

//   for (const [key, agent] of agentMap.entries()) {
//     const dealCount = dealCountsByAgent.get(key) || 0;
//     const lastDealDate = agentLastDealDateYTD.get(key) || null;

//     let lastDealDays = null;
//     if (lastDealDate) {
//       const d0 = new Date(lastDealDate);
//       d0.setUTCHours(0, 0, 0, 0);
//       lastDealDays = Math.max(0, Math.floor((todayUTC - d0) / 86400000));
//     }

//     const $set = {
//       "leaderboard.lastDealDate": lastDealDate,
//       "leaderboard.lastDealDays": lastDealDays,
//       "leaderboard.lastUpdated": new Date(),
//       lastUpdated: new Date(),
//     };

//     // Only write propertiesSold=0 when the guard allows
//     if (dealCount !== 0 || canZero) {
//       $set["leaderboard.propertiesSold"] = dealCount;
//     }

//     ops.push({
//       updateOne: {
//         filter: { _id: agent._id },
//         update: { $set },
//       },
//     });

//     if (dealCount > 0) agentsUpdated++;
//   }

//   if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//   console.log(
//     `✅ [DEALS CORE] Done → Agents Updated: ${agentsUpdated}, Deals This Month: ${monthlyDeals.length}`
//   );

//   return {
//     targetY,
//     targetM,
//     totals: {
//       totalDealsReturnedByAPI: allDeals.length,
//       dealsThisMonth: monthlyDeals.length,
//       agentsUpdated,
//     },
//     unmatched: { monthly: unmatchedMonthly, ytd: unmatchedYtd },
//   };
// }

async function syncDealsJob() {
  const nowUTC = new Date();
  const targetY = nowUTC.getUTCFullYear();
  const targetM = nowUTC.getUTCMonth();

  console.log(
    `🔄 [DEALS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
  );

  // Pull once
  const dealsResp = await sfGet("/services/apexrest/deals");
  const allDeals = dealsResp?.data?.deals || [];

  // Current month (UTC) by createddate
  const monthlyDeals = allDeals.filter((d) =>
    isSameUtcMonth(d?.createddate, targetY, targetM)
  );

  // YTD (same UTC year) — use all deals returned
  const ytdDeals = allDeals.filter((d) => {
    const dt = toUtcDate(d?.createddate);
    return dt && dt.getUTCFullYear() === targetY;
  });

  const agents = await Agent.find({ isActive: true });
  const agentMap = new Map(
    agents.map((a) => [normalizeAgentName(a.agentName), a])
  );

  // ===== MONTHLY DEAL COUNTS (strict) =====
  const dealCountsByAgent = new Map();
  const unmatchedMonthly = [];

  for (const deal of monthlyDeals) {
    const names = twoAgentNamesOnly(deal);
    if (!names.length) continue;

    for (const nm of names) {
      const key = normalizeAgentName(nm);
      if (!key || !agentMap.has(key)) {
        if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
        continue;
      }
      dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
    }
  }

  // ===== YTD LAST DEAL DATE (with fallbacks) =====
  const agentLastDealDateYTD = new Map();
  const unmatchedYtd = [];

  for (const deal of ytdDeals) {
    // Start from primary
    let candidateNames = twoAgentNamesOnly(deal);

    // Fallbacks ONLY for lastDealDate
    if (candidateNames.length === 0) {
      const fromCommission = splitCommissionAgents(deal.commission_agents);
      if (fromCommission.length) {
        candidateNames = fromCommission;
      } else if (deal.owner_name) {
        candidateNames = [deal.owner_name.trim()];
      }
    }

    if (!candidateNames.length) continue;

    const dDate = getDealDate(deal);
    if (!dDate) continue;

    const uniq = uniqueNormalizedNames(candidateNames);
    for (const { raw, key } of uniq) {
      if (!agentMap.has(key)) {
        if (raw && !unmatchedYtd.includes(raw)) unmatchedYtd.push(raw);
        continue;
      }
      const prev = agentLastDealDateYTD.get(key);
      if (!prev || dDate > prev) agentLastDealDateYTD.set(key, dDate);
    }
  }

  // ===== Writeback =====
  const todayUTC = utcTodayStart();
  const canZero = allowZeroingNow();
  const ops = [];
  let agentsUpdated = 0;

  for (const [key, agent] of agentMap.entries()) {
    const dealCount = dealCountsByAgent.get(key) || 0;
    const lastDealDate = agentLastDealDateYTD.get(key) || null;

    let lastDealDays = null;
    if (lastDealDate) {
      const d0 = new Date(lastDealDate);
      d0.setUTCHours(0, 0, 0, 0);
      lastDealDays = Math.max(0, Math.floor((todayUTC - d0) / 86400000));
    }

    const $set = {
      "leaderboard.lastDealDate": lastDealDate,
      "leaderboard.lastDealDays": lastDealDays,
      "leaderboard.lastUpdated": new Date(),
      lastUpdated: new Date(),
    };

    // Only zero propertiesSold when allowed
    if (dealCount !== 0 || canZero) {
      $set["leaderboard.propertiesSold"] = dealCount;
    }

    ops.push({
      updateOne: {
        filter: { _id: agent._id },
        update: { $set },
      },
    });

    if (dealCount > 0) agentsUpdated++;
  }

  if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

  console.log(
    `✅ [DEALS CORE] Done → Agents Updated: ${agentsUpdated}, Deals This Month: ${monthlyDeals.length}`
  );

  return {
    targetY,
    targetM,
    totals: {
      totalDealsReturnedByAPI: allDeals.length,
      dealsThisMonth: monthlyDeals.length,
      agentsUpdated,
    },
    unmatched: { monthly: unmatchedMonthly, ytd: unmatchedYtd },
  };
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Commissions sync (single dataset; strict UTC current month)
 *  ─────────────────────────────────────────────────────────────────────────── */
function amountNumber(raw) {
  return typeof raw === "string" ? Number(raw.replace(/[, ]/g, "")) : Number(raw) || 0;
}

function twoAgentNamesOnly(deal) {
  const names = [];
  if (deal.deal_agent) names.push(deal.deal_agent.trim());
  if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
  return names.filter(Boolean);
}
async function syncCommissionsJobNew() {
  const nowUTC = new Date();
  const targetY = nowUTC.getUTCFullYear();
  const targetM = nowUTC.getUTCMonth();

  console.log(
    `🔄 [COMMISSIONS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
  );

  const commissionsResp = await sfGet("/services/apexrest/commissions");
  const commissions = commissionsResp?.data?.commissions || [];

  const agents = await Agent.find({ isActive: true });
  const agentMap = new Map(
    agents.map((a) => [normalizeAgentName(a.agentName), a])
  );

  const commissionsByAgent = new Map();
  const unmatchedCommissionAgents = [];
  let filteredCount = 0;

  for (const c of commissions) {
    const created = c?.createddate;
    if (!isSameUtcMonth(created, targetY, targetM)) continue;
    filteredCount++;

    const agentName = c.agent_name || c.commission_agents;
    if (!agentName) continue;

    const key = normalizeAgentName(agentName);
    if (!agentMap.has(key)) {
      if (!unmatchedCommissionAgents.includes(agentName))
        unmatchedCommissionAgents.push(agentName);
      continue;
    }

    const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
    const amt = amountNumber(raw);
    commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amt);
  }

  // Writeback (safe zeroing)
  const canZero = allowZeroingNow();
  const ops = [];
  let agentsUpdated = 0;

  for (const [key, agent] of agentMap.entries()) {
    const totalCommission = Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

    const $set = {
      "leaderboard.lastUpdated": new Date(),
      lastUpdated: new Date(),
    };
    if (totalCommission !== 0 || canZero) {
      $set["leaderboard.totalCommission"] = totalCommission;
    }

    ops.push({
      updateOne: {
        filter: { _id: agent._id },
        update: { $set },
      },
    });

    if (totalCommission > 0) agentsUpdated++;
  }

  if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

  console.log(
    `✅ [COMMISSIONS CORE] Completed for ${targetY}-${String(targetM + 1).padStart(2, "0")} (UTC).`
  );
  console.log(`   - Commission records synced (current month): ${filteredCount}`);
  console.log(`   - Agents updated: ${agentsUpdated}`);

  return {
    targetY,
    targetM,
    filteredCount,
    agentsUpdated,
    unmatchedCommissionAgents,
    totalReturned: commissions.length,
  };
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Viewings sync (single dataset; strict UTC current month by 'start')
 *  ─────────────────────────────────────────────────────────────────────────── */
async function syncViewingsJob() {
  const nowUTC = new Date();
  const targetY = nowUTC.getUTCFullYear();
  const targetM = nowUTC.getUTCMonth();

  console.log(
    `🔄 [VIEWINGS CORE] Sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
  );

  const resp = await sfGet("/services/apexrest/viewings");
  const raw = resp?.data?.viewings || [];

  const viewings = raw.filter((v) => {
    const start = v?.start;
    return start && isSameUtcMonth(start, targetY, targetM);
  });

  const agents = await Agent.find({ isActive: true });
  const agentMap = new Map(
    agents.map((a) => [normalizeAgentName(a.agentName), a])
  );

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

  // Writeback (safe zeroing)
  const canZero = allowZeroingNow();
  const ops = [];
  let agentsUpdated = 0;

  for (const [key, agent] of agentMap.entries()) {
    const viewingsCount = counts.get(key) || 0;

    const $set = {
      "leaderboard.lastUpdated": new Date(),
      lastUpdated: new Date(),
    };
    if (viewingsCount !== 0 || canZero) {
      $set["leaderboard.viewings"] = viewingsCount;
    }

    ops.push({
      updateOne: {
        filter: { _id: agent._id },
        update: { $set },
      },
    });

    if (viewingsCount > 0) agentsUpdated++;
  }

  if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

  console.log(
    `✅ [VIEWINGS CORE] Done → UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}, ` +
      `Viewings: ${viewings.length}, Agents Updated: ${agentsUpdated}`
  );

  return {
    targetY,
    targetM,
    totalReturned: raw.length,
    viewingsThisMonth: viewings.length,
    agentsUpdated,
    agentViewings: Array.from(counts.entries())
      .map(([k, c]) => ({
        agentName: agentMap.get(k)?.agentName,
        agentId: agentMap.get(k)?.agentId,
        viewingCount: c,
      }))
      .sort((a, b) => b.viewingCount - a.viewingCount),
    unmatchedOwners: unmatchedOwners.size ? Array.from(unmatchedOwners) : [],
  };
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Monthly properties (calls model method). Ensure the model uses UTC getters.
 *  ─────────────────────────────────────────────────────────────────────────── */
async function syncMonthlyPropertiesJobNew() {
  try {
    console.log("🔄 [CRON] Starting monthly properties update...");
    const result = await Agent.updateAllAgentsMonthlyProperties();
    console.log(`✅ [CRON] Monthly properties updated for ${result.agentsUpdated} agents`);
    return result;
  } catch (error) {
    console.error("❌ [CRON] Error updating monthly properties:", error.message);
    throw error;
  }
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Cron orchestration
 *  ─────────────────────────────────────────────────────────────────────────── */
async function runAllSyncs() {
  return runAllSyncsLocked("master-sync", async () => {
    console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
    const t0 = Date.now();
    try {
      // Run in parallel
      await Promise.all([syncDealsJob(), syncCommissionsJobNew(), syncViewingsJob()]);
      // Then monthly properties
      await syncMonthlyPropertiesJobNew();

      const sec = ((Date.now() - t0) / 1000).toFixed(2);
      console.log(`✅ [CRON] All syncs completed successfully in ${sec}s`);
    } catch (error) {
      console.error("❌ [CRON] Error in scheduled sync job:", error.message);
    }
  });
}

let cronScheduled = false;
function setupCronJobs() {
  if (cronScheduled) {
    console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
    return;
  }

  // Every 15 minutes, pinned to UTC
  cron.schedule(
    "*/5 * * * *",
    async () => {
      await runAllSyncs(); // mutex-protected
    },
    { timezone: "UTC" }
  );

  cronScheduled = true;
  console.log("✅ Cron job scheduled: Salesforce sync will run every 15 minutes (UTC)");

  // Optional immediate run (also mutex-protected)
  console.log("🚀 Running initial sync on startup...");
  runAllSyncs();
}

/** ───────────────────────────────────────────────────────────────────────────
 *  API Handlers (manual triggers & leaderboard route)
 *  ─────────────────────────────────────────────────────────────────────────── */

// Manual: OAuth token (useful for diagnostics; don’t expose publicly)
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
    return res.status(200).json({ access_token: resp.data.access_token });
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    return res.status(500).json({ success: false, error: "Salesforce token generation failed" });
  }
};

// Leaderboard (unchanged logic; sorts by totalCommission desc, with seq tiebreaker)
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
      // "Ryan Kent",
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
      { $match: { agentName: { $in: allowedAgentNames } } },
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
          leaderboard: 1,
          sequenceNumber: 1,
          reraNumber: 1,
          propertiesCount: { $size: { $ifNull: ["$properties", []] } },
        },
      },
      {
        $addFields: {
          _commission: { $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] } },
          _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
        },
      },
      { $sort: { _commission: -1, _tieSeq: 1 } },
    ];

    const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

    const globalTotalCommission = allAgents.reduce(
      (sum, a) => sum + (a.leaderboard?.totalCommission ?? 0),
      0
    );

    const agentsWithPositions = allAgents.map((agent, index) => ({
      ...agent,
      position: index + 1,
    }));

    const paginatedAgents = agentsWithPositions.slice(skip, skip + limit);
    const total = agentsWithPositions.length;
    const totalPages = Math.ceil(total / limit);

    const mapped = paginatedAgents.map((a) => ({
      position: a.position,
      name: a.agentName,
      imageUrl: a.imageUrl,
      leaderboard: {
        activePropertiesThisMonth: a.leaderboard?.activePropertiesThisMonth ?? 0,
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
      globalTotalCommission,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Manual routes (single-dataset versions, mirroring cron core)

// const syncAgentDealsFromSalesforce = async (req, res) => {
//   try {
//     const nowUTC = new Date();
//     const targetY = nowUTC.getUTCFullYear();
//     const targetM = nowUTC.getUTCMonth();

//     console.log(
//       `🔄 Starting Salesforce DEALS sync -> UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
//     );

//     const dealsResp = await sfGet("/services/apexrest/deals");
//     const allDeals = dealsResp?.data?.deals || [];

//     const monthlyDeals = allDeals.filter((d) =>
//       isSameUtcMonth(d?.createddate, targetY, targetM)
//     );

//     const ytdDeals = allDeals.filter((d) => {
//       const dt = toUtcDate(d?.createddate);
//       return dt && dt.getUTCFullYear() === targetY;
//     });

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     const dealCountsByAgent = new Map();
//     const unmatchedMonthly = [];

//     function twoAgentNamesOnly(deal) {
//       const names = [];
//       if (deal.deal_agent) names.push(deal.deal_agent.trim());
//       if (deal.deal_agent_2) names.push(deal.deal_agent_2.trim());
//       return names.filter(Boolean);
//     }

//     for (const deal of monthlyDeals) {
//       const names = twoAgentNamesOnly(deal);
//       if (!names.length) continue;

//       for (const nm of names) {
//         const key = normalizeAgentName(nm);
//         if (!key || !agentMap.has(key)) {
//           if (!unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//           continue;
//         }
//         dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
//       }
//     }

//     const agentLastDealDateYTD = new Map();
//     const unmatchedYtd = [];

//     for (const deal of ytdDeals) {
//       const names = twoAgentNamesOnly(deal);
//       if (!names.length) continue;

//       const dDate = toUtcDate(deal.createddate);
//       if (!dDate) continue;

//       for (const nm of names) {
//         const key = normalizeAgentName(nm);
//         if (!key) continue;

//         if (!agentMap.has(key)) {
//           if (!unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//           continue;
//         }
//         const prev = agentLastDealDateYTD.get(key);
//         if (!prev || dDate > prev) agentLastDealDateYTD.set(key, dDate);
//       }
//     }

//     const todayUTC = utcTodayStart();
//     const canZero = allowZeroingNow();
//     const ops = [];
//     let agentsUpdated = 0;
//     const agentDeals = [];

//     for (const [key, agent] of agentMap.entries()) {
//       const dealCount = dealCountsByAgent.get(key) || 0;
//       const lastDealDate = agentLastDealDateYTD.get(key) || null;

//       let lastDealDays = null;
//       if (lastDealDate) {
//         const d0 = new Date(lastDealDate);
//         d0.setUTCHours(0, 0, 0, 0);
//         lastDealDays = Math.max(0, Math.floor((todayUTC - d0) / 86400000));
//       }

//       const $set = {
//         "leaderboard.lastDealDate": lastDealDate,
//         "leaderboard.lastDealDays": lastDealDays,
//         "leaderboard.lastUpdated": new Date(),
//         lastUpdated: new Date(),
//       };
//       if (dealCount !== 0 || canZero) {
//         $set["leaderboard.propertiesSold"] = dealCount;
//       }

//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: { $set },
//         },
//       });

//       agentDeals.push({
//         agentName: agent.agentName,
//         agentId: agent.agentId,
//         dealCount,
//         lastDealDate,
//         daysSinceLastDeal: lastDealDays,
//       });

//       if (dealCount > 0) agentsUpdated++;
//     }

//     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//     console.log(
//       `✅ DEALS SYNC DONE → Agents Updated: ${agentsUpdated}, Deals This Month: ${monthlyDeals.length}`
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Synced deals successfully.`,
//       data: {
//         targetUTC: { year: targetY, monthIndex0: targetM },
//         totalDealsReturnedByAPI: allDeals.length,
//         dealsThisMonth: monthlyDeals.length,
//         agentsUpdated,
//         agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
//         unmatched: { monthly: unmatchedMonthly, ytd: unmatchedYtd },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing deals:", error.message);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };
function resolveMonthUTC(monthParam = "this_month") {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();

  if (monthParam === "last_month") {
    if (m === 0) {
      y -= 1;
      m = 11;
    } else {
      m -= 1;
    }
  } else if (/^\d{4}-\d{2}$/.test(monthParam)) {
    const [yy, mm] = monthParam.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  return { targetY: y, targetM: m };
}
// --- helpers ---
function parseUtcDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getDealDate(deal) {
  // Priority: createddate -> deal_agreed_date -> lastmodifieddate
  return (
    parseUtcDate(deal.createddate) ||
    parseUtcDate(deal.deal_agreed_date) ||
    parseUtcDate(deal.lastmodifieddate)
  );
}

function splitCommissionAgents(str) {
  if (!str) return [];
  return str
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function uniqueNormalizedNames(names) {
  const seen = new Set();
  const out = [];
  for (const n of names) {
    const key = normalizeAgentName(n);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ raw: n, key });
  }
  return out;
}

const syncAgentDealsFromSalesforce = async (req, res) => {
  try {
    const { month = "this_month" } = req.query;

    // Reuse the same helpers you used for commissions sync
    const { targetY, targetM } = resolveMonthUTC(month);

    console.log(
      `🔄 Starting Salesforce DEALS-ONLY sync for: ${month} -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    // Fetch deals:
    // - monthly: for counting deals in the selected month
    // - ytd (or this_year): for lastDealDate (latest in the calendar year)
    const [monthlyDealsResp, ytdDealsResp] = await Promise.all([
      sfGet("/services/apexrest/deals", { month }),
      sfGet("/services/apexrest/deals", { month: "ytd" }),
    ]);

    const monthlyDealsRaw = monthlyDealsResp?.data?.deals || [];
    const ytdDealsRaw = ytdDealsResp?.data?.deals || [];

    // Strict month filter (createddate ONLY), same rule as commissions
    const monthlyDeals = monthlyDealsRaw.filter((d) =>
      isSameUtcMonth(d.createddate, targetY, targetM)
    );

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    // ===== MONTHLY DEAL COUNTS =====
    const dealCountsByAgent = new Map();
    const unmatchedMonthly = [];

    for (const deal of monthlyDeals) {
      // ✅ NEW LOGIC: Use deal_agent and deal_agent_2 fields only
      const names = [];

      if (deal.deal_agent) {
        names.push(deal.deal_agent.trim());
      }

      if (deal.deal_agent_2) {
        names.push(deal.deal_agent_2.trim());
      }

      // If no deal_agent fields, skip this deal
      if (names.length === 0) continue;

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
    const ytdDeals = ytdDealsRaw;
const agentLastDealDateYTD = new Map();
const unmatchedYtd = [];

for (const deal of ytdDeals) {
  // Primary agents
  let candidateNames = [];
  if (deal.deal_agent) candidateNames.push(deal.deal_agent.trim());
  if (deal.deal_agent_2) candidateNames.push(deal.deal_agent_2.trim());

  // 🔁 Fallbacks ONLY for lastDealDate:
  // If primary fields missing, look into commission_agents, then owner_name
  if (candidateNames.length === 0) {
    const fromCommission = splitCommissionAgents(deal.commission_agents);
    if (fromCommission.length) {
      candidateNames = fromCommission;
    } else if (deal.owner_name) {
      candidateNames = [deal.owner_name.trim()];
    }
  }

  if (candidateNames.length === 0) continue;

  const dealDate = getDealDate(deal);
  if (!dealDate) continue;

  // Deduplicate per deal by normalized key
  const uniq = uniqueNormalizedNames(candidateNames);

  for (const { raw, key } of uniq) {
    if (!agentMap.has(key)) {
      if (raw && !unmatchedYtd.includes(raw)) unmatchedYtd.push(raw);
      continue;
    }
    const prev = agentLastDealDateYTD.get(key);
    if (!prev || dealDate > prev) {
      agentLastDealDateYTD.set(key, dealDate);
    }
  }
}

    // ===== UPDATE AGENTS (DEAL METRICS ONLY) =====
    // Calculate days using UTC midnight for consistency
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const ops = [];
    let agentsUpdated = 0;
    const agentDeals = [];

    for (const [key, agent] of agentMap.entries()) {
      const dealCount = dealCountsByAgent.get(key) || 0;
      const lastDealDate = agentLastDealDateYTD.get(key) || null;

      // Calculate days properly using UTC dates
      let lastDealDays = null;
      if (lastDealDate) {
        const dealDateUTC = new Date(lastDealDate);
        dealDateUTC.setUTCHours(0, 0, 0, 0);

        // Calculate difference in days
        const diffMs = todayUTC.getTime() - dealDateUTC.getTime();
        lastDealDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Ensure it's never negative
        lastDealDays = Math.max(0, lastDealDays);
      }

      // Prepare bulk update operation
      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: {
            $set: {
              "leaderboard.propertiesSold": dealCount,
              "leaderboard.lastDealDate": lastDealDate,
              "leaderboard.lastDealDays": lastDealDays,
              "leaderboard.lastUpdated": new Date(),
              lastUpdated: new Date(),
            },
          },
        },
      });

      agentDeals.push({
        agentName: agent.agentName,
        agentId: agent.agentId,
        dealCount,
        lastDealDate,
        daysSinceLastDeal: lastDealDays,
      });

      if (dealCount > 0) agentsUpdated++;
    }

    // Execute bulk update (safe & fast)
    if (ops.length) {
      await Agent.bulkWrite(ops, { ordered: false });
    }

    console.log(
      `✅ DEALS-ONLY sync completed for ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")} (UTC).`
    );
    console.log(
      `   - Monthly deals (after strict UTC filter): ${monthlyDeals.length}`
    );
    console.log(`   - YTD deals scanned: ${ytdDeals.length}`);
    console.log(`   - Agents updated: ${agentsUpdated}`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${monthlyDeals.length} monthly deals (strict UTC month). Updated ${agentsUpdated} agents with deal counts only.`,
      note: "Deals assigned only to deal_agent and deal_agent_2 (referrers excluded). Month inclusion = createddate in target UTC month.",
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
    const nowUTC = new Date();
    const targetY = nowUTC.getUTCFullYear();
    const targetM = nowUTC.getUTCMonth();

    console.log(
      `🔄 Starting Salesforce COMMISSIONS sync (single dataset) -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    const commissionsResp = await sfGet("/services/apexrest/commissions");
    const commissions = commissionsResp?.data?.commissions || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    const commissionsByAgent = new Map();
    const unmatchedCommissionAgents = [];
    let filteredCount = 0;

    const traceIncluded = [];
    const traceSkipped = [];

    for (const c of commissions) {
      const created = c?.createddate;
      const keep = isSameUtcMonth(created, targetY, targetM);

      if (!keep) {
        if (traceSkipped.length < 20)
          traceSkipped.push({
            ref: c.commission_ref_no,
            agent: c.agent_name || c.commission_agents,
            created,
          });
        continue;
      }

      filteredCount++;
      if (traceIncluded.length < 20)
        traceIncluded.push({
          ref: c.commission_ref_no,
          agent: c.agent_name || c.commission_agents,
          created,
        });

      const agentName = c.agent_name || c.commission_agents;
      if (!agentName) continue;

      const key = normalizeAgentName(agentName);
      if (!agentMap.has(key)) {
        if (!unmatchedCommissionAgents.includes(agentName))
          unmatchedCommissionAgents.push(agentName);
        continue;
      }

      const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
      const amount = amountNumber(raw);

      commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
    }

    const canZero = allowZeroingNow();
    const ops = [];
    let agentsUpdated = 0;
    const agentCommissions = [];

    for (const [key, agent] of agentMap.entries()) {
      const totalCommission =
        Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

      const $set = {
        "leaderboard.lastUpdated": new Date(),
        lastUpdated: new Date(),
      };
      if (totalCommission !== 0 || canZero) {
        $set["leaderboard.totalCommission"] = totalCommission;
      }

      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: { $set },
        },
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

    console.log(
      `✅ COMMISSIONS sync completed for UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
    );
    console.log(`   - Current month records: ${filteredCount}`);
    console.log(`   - Agents updated: ${agentsUpdated}`);

    return res.status(200).json({
      success: true,
      message: `Synced ${filteredCount} commission records for current month (UTC).`,
      data: {
        targetUTC: { year: targetY, monthIndex0: targetM },
        totalCommissionRecordsReturned: commissions.length,
        currentMonthRecords: filteredCount,
        agentsWithCommission: agentsUpdated,
        agentsResetToZero: agents.length - agentsUpdated,
        agentCommissions: agentCommissions
          .filter((a) => a.totalCommission > 0)
          .sort((a, b) => b.totalCommission - a.totalCommission),
        unmatchedAgents: unmatchedCommissionAgents,
        debugSample: { includedFirst20: traceIncluded, skippedFirst20: traceSkipped },
      },
    });
  } catch (error) {
    console.error("❌ Error syncing commissions:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const syncAgentViewingsFromSalesforce = async (req, res) => {
  try {
    const nowUTC = new Date();
    const targetY = nowUTC.getUTCFullYear();
    const targetM = nowUTC.getUTCMonth();

    console.log(
      `🔄 Starting Salesforce VIEWINGS sync (single dataset) -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    const resp = await sfGet("/services/apexrest/viewings");
    const raw = resp?.data?.viewings || [];

    const viewings = raw.filter((v) => {
      const start = v?.start;
      return start && isSameUtcMonth(start, targetY, targetM);
    });

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

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

    const canZero = allowZeroingNow();
    const ops = [];
    let agentsUpdated = 0;

    for (const [key, agent] of agentMap.entries()) {
      const viewingsCount = counts.get(key) || 0;

      const $set = {
        "leaderboard.lastUpdated": new Date(),
        lastUpdated: new Date(),
      };
      if (viewingsCount !== 0 || canZero) {
        $set["leaderboard.viewings"] = viewingsCount;
      }

      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: { $set },
        },
      });

      if (viewingsCount > 0) agentsUpdated++;
    }

    if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

    console.log(
      `✅ Viewings sync completed for UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}.`
    );

    return res.status(200).json({
      success: true,
      message: `Synced ${viewings.length} viewings for current UTC month.`,
      note: "Single dataset from Salesforce. Strict UTC month matching on 'start'. Agents without viewings set with safe-zero guard.",
      data: {
        targetUTC: { year: targetY, monthIndex0: targetM },
        totalViewings: viewings.length,
        agentsUpdated,
        agentViewings: Array.from(counts.entries())
          .map(([k, c]) => ({
            agentName: agentMap.get(k)?.agentName,
            agentId: agentMap.get(k)?.agentId,
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

// Monthly properties (manual trigger)
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

module.exports = {
  // Leaderboard
  getLeaderboardAgents,

  // Manual sync endpoints
  syncAgentDealsFromSalesforce,
  syncAgentViewingsFromSalesforce,
  syncAgentCommissionsFromSalesforce,

  // Monthly properties manual
  updateMonthlyPropertiesForAllAgents,

  // Token diagnostic
  getSalesforceToken: getSalesforceToken, // not an express handler
  GetSalesForceToken, // express handler for tests

  // Cron
  setupCronJobs,
};
