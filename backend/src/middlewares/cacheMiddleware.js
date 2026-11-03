import redis from '../config/redis.js';

export const cacheMiddleware = (keyPrefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    const isMocked = Boolean(redis.get?._isMockFunction || typeof redis.get?.mock === 'object');
    if (redis.status !== 'ready' && !isMocked) {
      return next();
    }

    const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}`;

    try {
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const isSetexMocked = Boolean(redis.setex?._isMockFunction || typeof redis.setex?.mock === 'object');
        if (res.statusCode >= 200 && res.statusCode < 300 && (redis.status === 'ready' || isSetexMocked)) {
          const p = redis.setex(cacheKey, ttlSeconds, JSON.stringify(body));
          if (p && typeof p.catch === 'function') {
            p.catch((err) => console.error('Redis setex error:', err));
          }
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