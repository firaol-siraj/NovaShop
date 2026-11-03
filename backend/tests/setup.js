import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import redis from '../src/config/redis.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

const clearRedis = async () => {
  try {
    const isMocked = Boolean(redis.get?._isMockFunction || typeof redis.get?.mock === 'object');
    if (!isMocked && redis && redis.status === 'ready' && typeof redis.flushall === 'function') {
      await redis.flushall();
    }
  } catch (e) {
    // Ignore Redis errors during test cleanup
  }
};

beforeEach(async () => {
  await clearRedis();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  await clearRedis();
});

afterAll(async () => {
  await clearRedis();
  try {
    if (redis && typeof redis.disconnect === 'function') {
      redis.disconnect();
    }
  } catch (e) {
    // ignore
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});