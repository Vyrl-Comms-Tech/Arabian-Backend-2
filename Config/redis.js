// // config/redis.js - Redis Client Configuration (CommonJS)
// const { createClient } = require('redis');
// require('dotenv').config();

// const redisClient = createClient({
//   socket: {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT) || 6379,
//   },
//   password: process.env.REDIS_PASSWORD || undefined,
// });

// // Error handling
// redisClient.on('error', (err) => {
//   console.error('❌ Redis Client Error:', err);
// });

// redisClient.on('connect', () => {
//   console.log('✅ Redis Client Connected');
// });

// redisClient.on('ready', () => {
//   console.log('✅ Redis Client Ready');
// });

// redisClient.on('end', () => {
//   console.log('⚠️ Redis Client Disconnected');
// });

// // Connect to Redis
// (async () => {
//   try {
//     await redisClient.connect();
//   } catch (error) {
//     console.error('Failed to connect to Redis:', error);
//   }
// })();

// // Helper functions
// const getCache = async (key) => {
//   try {
//     if (!redisClient.isReady) {
//       console.log('⚠️ Redis not ready, skipping cache get');
//       return null;
//     }
//     const data = await redisClient.get(key);
//     return data ? JSON.parse(data) : null;
//   } catch (error) {
//     console.error('Error getting cache:', error);
//     return null;
//   }
// };

// const setCache = async (key, data, ttl = 3600) => {
//   try {
//     if (!redisClient.isReady) {
//       console.log('⚠️ Redis not ready, skipping cache set');
//       return false;
//     }
//     await redisClient.setEx(key, ttl, JSON.stringify(data));
//     return true;
//   } catch (error) {
//     console.error('Error setting cache:', error);
//     return false;
//   }
// };

// const deleteCache = async (key) => {
//   try {
//     if (!redisClient.isReady) {
//       console.log('⚠️ Redis not ready, skipping cache delete');
//       return false;
//     }
//     await redisClient.del(key);
//     return true;
//   } catch (error) {
//     console.error('Error deleting cache:', error);
//     return false;
//   }
// };

// const deleteCacheByPattern = async (pattern) => {
//   try {
//     if (!redisClient.isReady) {
//       console.log('⚠️ Redis not ready, skipping cache delete by pattern');
//       return 0;
//     }
//     const keys = await redisClient.keys(pattern);
//     if (keys.length > 0) {
//       await redisClient.del(keys);
//       console.log(`🗑️ Cleared ${keys.length} cache entries matching: ${pattern}`);
//       return keys.length;
//     }
//     return 0;
//   } catch (error) {
//     console.error('Error deleting cache by pattern:', error);
//     return 0;
//   }
// };

// const isRedisReady = () => {
//   return redisClient.isReady;
// };

// module.exports = {
//   redisClient,
//   getCache,
//   setCache,
//   deleteCache,
//   deleteCacheByPattern,
//   isRedisReady
// };