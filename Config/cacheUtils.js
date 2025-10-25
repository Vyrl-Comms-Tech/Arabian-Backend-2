// // utils/cacheUtils.js - Cache Utility Functions (CommonJS)
// const { getCache, setCache, deleteCacheByPattern } = require('../config/redis');

// /**
//  * Generate cache key from request query parameters
//  * @param {Object} req - Express request object
//  * @returns {string} - Cache key
//  */
// const generateCacheKey = (req) => {
//   // Extract all query parameters
//   const params = {
//     page: req.query.page || '1',
//     limit: req.query.limit || '10',
//     listingType: req.query.listingType || 'Sale',
//     sortBy: req.query.sortBy || 'newest',
//     propertyType: req.query.propertyType || '',
//     minPrice: req.query.minPrice || '',
//     maxPrice: req.query.maxPrice || '',
//     bedrooms: req.query.bedrooms || '',
//     address: req.query.address || '',
//     developer: req.query.developer || '',
//     bathrooms: req.query.bathrooms || '',
//     furnishing: req.query.furnishing || '',
//     minSize: req.query.minSize || '',
//     maxSize: req.query.maxSize || '',
//     amenities: req.query.amenities || '',
//   };

//   // Create a sorted query string for consistent cache keys
//   const sortedParams = Object.keys(params)
//     .sort()
//     .filter((key) => params[key] !== '') // Remove empty params
//     .map((key) => `${key}=${params[key]}`)
//     .join('&');

//   // Generate cache key with prefix
//   return `property:filter:${sortedParams}`;
// };

// /**
//  * Get cached property data
//  * @param {string} cacheKey - Cache key
//  * @returns {Object|null} - Cached data or null
//  */
// const getCachedProperties = async (cacheKey) => {
//   try {
//     const cachedData = await getCache(cacheKey);
//     if (cachedData) {
//       console.log(`✅ Cache HIT: ${cacheKey}`);
//       return cachedData;
//     }
//     console.log(`❌ Cache MISS: ${cacheKey}`);
//     return null;
//   } catch (error) {
//     console.error('Error getting cached properties:', error);
//     return null;
//   }
// };

// /**
//  * Set property data to cache
//  * @param {string} cacheKey - Cache key
//  * @param {Object} data - Data to cache
//  * @param {number} ttl - Time to live in seconds (default: 1 hour)
//  * @returns {boolean} - Success status
//  */
// const setCachedProperties = async (cacheKey, data, ttl = 3600) => {
//   try {
//     const dataToCache = {
//       ...data,
//       fromCache: true,
//       cachedAt: new Date().toISOString(),
//     };
    
//     const success = await setCache(cacheKey, dataToCache, ttl);
//     if (success) {
//       console.log(`💾 Cached: ${cacheKey} for ${ttl}s`);
//     }
//     return success;
//   } catch (error) {
//     console.error('Error setting cached properties:', error);
//     return false;
//   }
// };

// /**
//  * Clear all property filter caches
//  * @returns {number} - Number of cleared cache entries
//  */
// const clearPropertyFilterCache = async () => {
//   try {
//     const count = await deleteCacheByPattern('property:filter:*');
//     console.log(`🗑️ Cleared ${count} property filter cache entries`);
//     return count;
//   } catch (error) {
//     console.error('Error clearing property filter cache:', error);
//     return 0;
//   }
// };

// /**
//  * Clear cache for specific listing type
//  * @param {string} listingType - Listing type (Sale, Rent, etc.)
//  * @returns {number} - Number of cleared cache entries
//  */
// const clearCacheByListingType = async (listingType) => {
//   try {
//     const count = await deleteCacheByPattern(`property:filter:*listingType=${listingType}*`);
//     console.log(`🗑️ Cleared ${count} cache entries for listing type: ${listingType}`);
//     return count;
//   } catch (error) {
//     console.error('Error clearing cache by listing type:', error);
//     return 0;
//   }
// };

// /**
//  * Get cache TTL based on request parameters
//  * Different cache durations for different types of queries
//  * @param {Object} req - Express request object
//  * @returns {number} - TTL in seconds
//  */
// const getCacheTTL = (req) => {
//   // More specific queries (with multiple filters) = longer cache
//   const hasMultipleFilters = 
//     (req.query.propertyType ? 1 : 0) +
//     (req.query.minPrice ? 1 : 0) +
//     (req.query.maxPrice ? 1 : 0) +
//     (req.query.bedrooms ? 1 : 0) +
//     (req.query.address ? 1 : 0) +
//     (req.query.developer ? 1 : 0) +
//     (req.query.bathrooms ? 1 : 0) +
//     (req.query.amenities ? 1 : 0);

//   if (hasMultipleFilters >= 4) {
//     // Very specific query - cache for 2 hours
//     return 7200;
//   } else if (hasMultipleFilters >= 2) {
//     // Moderately specific - cache for 1 hour
//     return 3600;
//   } else {
//     // General query - cache for 30 minutes
//     return 1800;
//   }
// };

// module.exports = {
//   generateCacheKey,
//   getCachedProperties,
//   setCachedProperties,
//   clearPropertyFilterCache,
//   clearCacheByListingType,
//   getCacheTTL
// };