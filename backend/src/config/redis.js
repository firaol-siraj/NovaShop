import Redis from 'ioredis';

const isTest = process.env.NODE_ENV === 'test';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: isTest ? 1 : 3,
  retryStrategy(times) {
    if (isTest) return null;
    return Math.min(times * 200, 3000);
  },
  enableOfflineQueue: !isTest,
  lazyConnect: isTest,
});

redis.on('connect', () => console.log('Redis connected successfully'));
redis.on('error', (err) => {
  if (!isTest) {
    console.error('Redis Connection Error:', err.message);
  }
});

export default redis;
