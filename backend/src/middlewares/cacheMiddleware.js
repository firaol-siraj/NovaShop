import redis from '../config/redis.js';

export const cacheMiddleware = (keyPrefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}`;

    try {
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.setex(cacheKey, ttlSeconds, JSON.stringify(body));
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Redis Cache Error:', error);
      next();
    }
  };
};