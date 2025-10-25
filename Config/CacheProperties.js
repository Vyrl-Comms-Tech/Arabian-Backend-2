// // Create this file at ../Utlis/CacheProperties.js
// const NodeCache = require('node-cache');

// // Create a simple cache with 1-hour TTL
// const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// // Add a safety wrapper to prevent errors from stopping execution
// const safeCache = {
//   get: (key) => {
//     try {
//       return cache.get(key);
//     } catch (error) {
//       console.error(`Cache get error for key ${key}:`, error.message);
//       return null;
//     }
//   },
//   set: (key, value, ttl) => {
//     try {
//       return cache.set(key, value, ttl);
//     } catch (error) {
//       console.error(`Cache set error for key ${key}:`, error.message);
//       return false;
//     }
//   },
//   del: (key) => {
//     try {
//       return cache.del(key);
//     } catch (error) {
//       console.error(`Cache del error for key ${key}:`, error.message);
//       return 0;
//     }
//   }
// };

// module.exports = safeCache;