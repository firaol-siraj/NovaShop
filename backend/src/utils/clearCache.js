import redis from '../config/redis.js';

export const clearCachePattern = async (pattern) => {
  try {
    const stream = redis.scanStream({
      match: `${pattern}:*`,
      count: 100,
    });

    stream.on('data', async (keys = []) => {
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        keys.forEach((key) => pipeline.del(key));
        await pipeline.exec();
      }
    });
  } catch (error) {
    console.error('Cache Invalidation Error:', error);
  }
};