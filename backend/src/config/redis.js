import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('Redis connected successfully'));
redis.on('error', (err) => console.error('Redis Connection Error:', err));

export default redis;