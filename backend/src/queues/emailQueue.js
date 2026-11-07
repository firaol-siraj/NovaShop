import { Queue } from 'bullmq';
import bullConnection from '../config/bullRedis.js';
import { sendEmail } from '../services/emailService.js';
import logger from '../utils/logger.js';

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

// Prevent unhandled exception crash when Redis connection is refused or down
emailQueue.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[BullMQ Queue Warning]: ${err.message}`);
  }
});

/**
 * Resilient email dispatch helper.
 * Enqueues the job into BullMQ if Redis is active.
 * If Redis is unavailable or offline, executes safe direct delivery fallback
 * so critical transactional notifications (password resets, payment receipts) are never dropped.
 *
 * @param {string} jobName
 * @param {Object} jobData
 * @param {Object} [fallbackOptions]
 * @returns {Promise<any>}
 */
export async function queueOrSendEmail(jobName, jobData, fallbackOptions = null) {
  try {
    return await emailQueue.add(jobName, jobData);
  } catch (queueErr) {
    logger.warn(`[EmailQueue] BullMQ enqueue failed for ${jobName} (${queueErr.message}). Initiating direct delivery fallback.`);
    const fallback = fallbackOptions || {
      to: jobData.to || jobData.email,
      subject: jobData.subject,
      text: jobData.text || jobData.message,
      html: jobData.html,
      userId: jobData.userId,
      orderId: jobData.orderId,
      type: jobData.type || (jobName === 'sendPasswordResetEmail' ? 'password_reset' : (jobName === 'sendVerificationEmail' ? 'verification' : (jobName === 'sendPaymentReceiptEmail' ? 'payment_receipt' : 'order_confirmation'))),
      statusCategory: (jobName === 'sendPasswordResetEmail' || jobName === 'sendVerificationEmail') ? 'security' : 'order',
    };
    return await sendEmail(fallback);
  }
}
