import Redis from 'ioredis';

const bullConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
});

// Prevent unhandled exception crash when Redis is offline or unavailable
bullConnection.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[BullMQ Redis Warning]: ${err.message}`);
  }
});

export default bullConnection;