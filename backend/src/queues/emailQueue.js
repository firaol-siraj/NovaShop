import { Queue } from 'bullmq';
import bullConnection from '../config/bullRedis.js';

export const emailQueue = new Queue('emailQueue', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times if SMTP fails
    backoff: {
      type: 'exponential',
      delay: 5000, // Retry after 5s, 10s, 20s
    },
    removeOnComplete: true, // Auto-delete successful jobs from Redis
    removeOnFail: 100,      // Keep last 100 failed jobs for auditing
  },
});