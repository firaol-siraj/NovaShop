// src/workers/emailWorker.js
import { Worker } from "bullmq";
import bullConnection from "../config/bullRedis.js";
import sendEmail from "../utils/sendEmail.js";

const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    const { email, subject, message, html } = job.data;

    switch (job.name) {
      case "sendVerificationEmail":
      case "sendPasswordResetEmail":
        await sendEmail({ email, subject, message });
        break;

      case "sendOrderConfirmationEmail":
      case "sendOrderStatusEmail":
      case "sendPaymentReceiptEmail":
        // Supports plain text or custom HTML email templates
        await sendEmail({ email, subject, message, html });
        break;

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
  console.log(`[BullMQ] ${job.name} (ID: ${job.id}) sent to ${job.data.email}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] ${job?.name} (ID: ${job?.id}) failed: ${err.message}`);
});

export default emailWorker;
