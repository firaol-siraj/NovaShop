import redis from '../config/redis.js';

export const clearCachePattern = async (pattern) => {
  if (redis.status !== 'ready') {
    return;
  }

  return new Promise((resolve) => {
    try {
      const stream = redis.scanStream({
        match: `${pattern}:*`,
        count: 100,
      });

      stream.on('data', async (keys = []) => {
        if (keys.length > 0) {
          stream.pause();
          try {
            const pipeline = redis.pipeline();
            keys.forEach((key) => pipeline.del(key));
            await pipeline.exec();
          } catch (delError) {
            console.error('Cache pipeline deletion error:', delError);
          } finally {
            stream.resume();
          }
        }
      });

      stream.on('end', () => {
        resolve();
      });

      stream.on('error', (streamError) => {
        console.error('Cache stream error:', streamError);
        resolve();
      });
    } catch (error) {
      console.error('Cache Invalidation Error:', error);
      resolve();
    }
  });
};