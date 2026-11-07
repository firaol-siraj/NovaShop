import Redis from 'ioredis';

const isTest = process.env.NODE_ENV === 'test';

const bullConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy(times) {
    if (isTest) return null;
    return Math.min(times * 500, 5000);
  },
  lazyConnect: isTest,
});

// Prevent unhandled exception crash when Redis is offline or unavailable
bullConnection.on('error', (err) => {
  if (!isTest) {
    console.warn(`[BullMQ Redis Warning]: ${err.message}`);
  }
});

export default bullConnection;
