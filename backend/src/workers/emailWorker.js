// src/workers/emailWorker.js
import { Worker } from "bullmq";
import bullConnection from "../config/bullRedis.js";
import { sendEmail } from "../services/emailService.js";
import Message from "../models/messageModel.js";
import AdminNotification from "../models/adminNotificationModel.js";
import { broadcastSupportEvent } from "../services/supportEventService.js";

const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    const data = job.data;

    switch (job.name) {
      case "sendVerificationEmail":
      case "sendPasswordResetEmail": {
        const isPasswordReset = job.name === "sendPasswordResetEmail";
        const recipient = (data.to || data.email || data.customerEmail || data.recipient || '').trim();

        if (!recipient) {
          console.warn(`[BullMQ] Skipping ${job.name} (ID: ${job.id}): missing or empty recipient email address`);
          return;
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
          throw new Error(result.error || "Email delivery failed");
        }

        break;
      }

      case "sendOrderConfirmationEmail":
      case "sendOrderStatusEmail":
      case "sendPaymentReceiptEmail": {
        const recipient = (data.to || data.email || data.customerEmail || data.recipient || '').trim();

        if (!recipient) {
          console.warn(`[BullMQ] Skipping ${job.name} (ID: ${job.id}): missing or empty recipient email address`);
          return;
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
          throw new Error(result.error || "Email delivery failed");
        }
        break;
      }

      case "sendSupportEmail": {
        const { to, subject, html, text, inReplyTo, references, headers, messageDocId, conversationId } = data;
        try {
          const result = await sendEmail({
            to,
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
              title: `Email Delivery Failed to ${to}`,
              message: `Could not send support email: ${result.error || 'SMTP delivery failed'}`,
              entityType: 'conversation',
              entityId: conversationId || '',
              link: `/admin/support?conversation=${conversationId || ''}`,
              data: { conversationId, to, error: result.error },
            }).catch(() => {});
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
        console.warn(`[BullMQ] Unhandled job name: ${job.name}`);
    }
  },
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
