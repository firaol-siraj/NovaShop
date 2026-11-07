// src/workers/emailWorker.js
import { Worker, UnrecoverableError } from "bullmq";
import bullConnection from "../config/bullRedis.js";
import { sendEmail } from "../services/emailService.js";
import Message from "../models/messageModel.js";
import AdminNotification from "../models/adminNotificationModel.js";
import { broadcastSupportEvent } from "../services/supportEventService.js";

/**
 * Core BullMQ processor for asynchronous email jobs.
 * Handles recipient extraction across all job payloads, executes unified delivery,
 * and throws UnrecoverableError for permanent failures (HTTP 401/403/422) to avoid retry loops.
 */
export async function processEmailJob(job) {
  const data = job?.data || {};

  switch (job?.name) {
    case "sendVerificationEmail":
    case "sendPasswordResetEmail": {
      const isPasswordReset = job.name === "sendPasswordResetEmail";
      const raw = Array.isArray(data.to) ? data.to[0] : (data.to || data.email || data.customerEmail || data.recipient || '');
      const recipient = typeof raw === 'string' ? raw.trim() : '';

      if (!recipient) {
        console.warn(`[BullMQ] Skipping ${job.name} (ID: ${job.id}): missing or empty recipient email address`);
        throw new UnrecoverableError(
          `Missing or empty recipient email address for ${job.name}`
        );
      }

      const result = await sendEmail({
        to: recipient,
        subject: data.subject,
        text: data.text || data.message,
        html: data.html,
        userId: data.userId,
        type: isPasswordReset ? "password_reset" : "verification",
        statusCategory: "security",
      });

      if (!result.success && !result.skipped && !result.deduplicated) {
        const isPermanent = Boolean(
          result.isPermanent ||
          result.statusCode === 401 ||
          result.statusCode === 403 ||
          result.statusCode === 422 ||
          (result.error && (
            result.error.includes('403') ||
            result.error.includes('401') ||
            result.error.includes('only send testing emails') ||
            result.error.includes('API key') ||
            result.error.includes('Invalid or missing recipient')
          ))
        );
        if (isPermanent) {
          console.warn(`[BullMQ] Non-retryable permanent error for ${job.name} (ID: ${job.id}) to ${recipient}: ${result.error}`);
          throw new UnrecoverableError(result.error || "Permanent email delivery failure");
        }
        throw new Error(result.error || "Email delivery failed");
      }

      break;
    }

    case "sendOrderConfirmationEmail":
    case "sendOrderStatusEmail":
    case "sendPaymentReceiptEmail": {
      const raw = Array.isArray(data.to) ? data.to[0] : (data.to || data.email || data.customerEmail || data.recipient || '');
      const recipient = typeof raw === 'string' ? raw.trim() : '';

      if (!recipient) {
        console.warn(`[BullMQ] Skipping ${job.name} (ID: ${job.id}): missing or empty recipient email address`);
        throw new UnrecoverableError(
          `Missing or empty recipient email address for ${job.name}`
        );
      }

      const result = await sendEmail({
        to: recipient,
        subject: data.subject,
        text: data.text || data.message,
        html: data.html,
        orderId: data.orderId,
        userId: data.userId,
        type: job.name === 'sendPaymentReceiptEmail' ? 'payment_receipt' : (job.name === 'sendOrderConfirmationEmail' ? 'order_confirmation' : 'status_update'),
        statusCategory: 'order',
      });

      if (!result.success && !result.skipped && !result.deduplicated) {
        const isPermanent = Boolean(
          result.isPermanent ||
          result.statusCode === 401 ||
          result.statusCode === 403 ||
          result.statusCode === 422 ||
          (result.error && (
            result.error.includes('403') ||
            result.error.includes('401') ||
            result.error.includes('only send testing emails') ||
            result.error.includes('API key') ||
            result.error.includes('Invalid or missing recipient')
          ))
        );
        if (isPermanent) {
          console.warn(`[BullMQ] Non-retryable permanent error for ${job.name} (ID: ${job.id}) to ${recipient}: ${result.error}`);
          throw new UnrecoverableError(result.error || "Permanent email delivery failure");
        }
        throw new Error(result.error || "Email delivery failed");
      }
      break;
    }

    case "sendSupportEmail": {
      const raw = Array.isArray(data.to) ? data.to[0] : (data.to || data.email || data.customerEmail || data.recipient || '');
      const recipient = typeof raw === 'string' ? raw.trim() : '';
      const { subject, html, text, inReplyTo, references, headers, messageDocId, conversationId } = data;
      try {
        const result = await sendEmail({
          to: recipient,
          subject,
          html,
          text,
          type: 'support_reply',
          statusCategory: 'order',
          inReplyTo,
          references,
          headers,
        });

        if (messageDocId) {
          await Message.findByIdAndUpdate(messageDocId, {
            deliveryStatus: result.success ? 'sent' : 'failed',
            error: result.error || '',
            ...(result.messageId ? { 'emailHeaders.messageId': result.messageId, emailMessageId: result.messageId } : {}),
          });

          broadcastSupportEvent('message.updated', {
            conversationId,
            messageId: messageDocId,
            deliveryStatus: result.success ? 'sent' : 'failed',
          });
        }

        if (!result.success) {
          await AdminNotification.create({
            type: 'email_failed',
            title: `Email Delivery Failed to ${recipient}`,
            message: `Could not send support email: ${result.error || 'SMTP delivery failed'}`,
            entityType: 'conversation',
            entityId: conversationId || '',
            link: `/admin/support?conversation=${conversationId || ''}`,
            data: { conversationId, to: recipient, error: result.error },
          }).catch(() => {});

          const isPermanent = Boolean(
            result.isPermanent ||
            result.statusCode === 401 ||
            result.statusCode === 403 ||
            result.statusCode === 422 ||
            (result.error && (
              result.error.includes('403') ||
              result.error.includes('401') ||
              result.error.includes('only send testing emails') ||
              result.error.includes('API key') ||
              result.error.includes('Invalid or missing recipient')
            ))
          );
          if (isPermanent) {
            throw new UnrecoverableError(result.error || "Permanent email delivery failure");
          } else {
            throw new Error(result.error || "Support email delivery failed");
          }
        }
      } catch (err) {
        if (messageDocId) {
          await Message.findByIdAndUpdate(messageDocId, {
            deliveryStatus: 'failed',
            error: err.message,
          }).catch(() => {});
        }
        throw err;
      }
      break;
    }

    default:
      console.warn(`[BullMQ] Unhandled job name: ${job?.name}`);
  }
}

const emailWorker = new Worker(
  "emailQueue",
  processEmailJob,
  {
    connection: bullConnection,
    concurrency: 5,
  },
);

emailWorker.on('completed', (job) => {
  console.log(`[BullMQ] ${job.name} (ID: ${job.id}) sent to ${job.data.email || job.data.to}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] ${job?.name} (ID: ${job?.id}) failed: ${err.message}`);
});

// Prevent unhandled exception crash when Redis connection is refused or down
emailWorker.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[BullMQ Worker Warning]: ${err.message}`);
  }
});

export default emailWorker;
