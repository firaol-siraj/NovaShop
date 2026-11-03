import { sendEmail as coreSendEmail } from '../services/emailService.js';

/**
 * Unified sendEmail adapter backwards-compatible with legacy options { email, subject, message, html }
 * and new options { to, subject, html, text }.
 */
const sendEmail = async (options) => {
  const to = options.to || options.email;
  const subject = options.subject;
  const html = options.html;
  const text = options.text || options.message;
  const type = options.type;
  const orderId = options.orderId;
  const userId = options.userId;
  const statusCategory = options.statusCategory;
  const replyTo = options.replyTo;

  const inReplyTo = options.inReplyTo;
  const references = options.references;
  const headers = options.headers;
  const messageId = options.messageId;
  const idempotencyKey = options.idempotencyKey;
  const adminUserId = options.adminUserId;
  const adminName = options.adminName;

  return coreSendEmail({
    to,
    subject,
    html,
    text,
    type,
    orderId,
    userId,
    statusCategory,
    replyTo,
    inReplyTo,
    references,
    headers,
    messageId,
    idempotencyKey,
    adminUserId,
    adminName,
  });
};

export default sendEmail;
