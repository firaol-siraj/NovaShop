import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import EmailLog from '../models/emailLogModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Setting from '../models/settingModel.js';

let transporter = null;

// Standard RFC 5322 compliant email regex validator
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Diagnostic analyzer for SMTP and Gmail-specific error codes
 */
export function diagnoseSmtpError(err) {
  if (!err) return { code: 'UNKNOWN', message: 'Unknown error', guidance: '' };

  const message = err.message || '';
  const response = err.response || '';
  const code = err.code || err.responseCode || '';

  // 1. Gmail 535 / Authentication failure
  if (
    code === 535 ||
    response.includes('535') ||
    message.includes('535') ||
    message.includes('Username and Password not accepted') ||
    message.includes('Invalid login')
  ) {
    return {
      code: 535,
      message: 'Authentication failed (535): Invalid username or password.',
      guidance:
        'Gmail requires a 16-character App Password (not your personal Google password). Ensure 2-Step Verification is enabled in your Google Account and generate an App Password at https://myaccount.google.com/apppasswords.',
    };
  }

  // 2. Gmail 534 / Application-specific password required
  if (
    code === 534 ||
    response.includes('534') ||
    message.includes('534') ||
    message.includes('Application-specific password required')
  ) {
    return {
      code: 534,
      message: 'Application-specific password required (534).',
      guidance:
        'Your Google Account blocked standard password login. Enable 2-Step Verification and generate a 16-character App Password at https://myaccount.google.com/apppasswords.',
    };
  }

  // 3. Gmail sending limits / rate limits (421, 450, 451, 550)
  if (
    code === 421 ||
    code === 450 ||
    code === 451 ||
    code === 550 ||
    response.includes('Daily user sending quota exceeded') ||
    message.includes('sending quota exceeded')
  ) {
    return {
      code: code || 550,
      message: `Sending limit exceeded or temporary provider block (${code || 'Rate Limit'}).`,
      guidance:
        'Gmail enforces a daily sending limit (500/day for free Gmail, 2000/day for Google Workspace). Please wait or check your sending volume.',
    };
  }

  // 4. DNS / Network failure
  if (
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    message.includes('EAI_AGAIN') ||
    message.includes('ENOTFOUND')
  ) {
    return {
      code: 'DNS_ERROR',
      message: `DNS resolution failed for host (${message}).`,
      guidance: 'Check internet connectivity and verify EMAIL_HOST (e.g. smtp.gmail.com).',
    };
  }

  // 5. Connection timeout / port block
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNREFUSED')
  ) {
    return {
      code: 'CONNECTION_ERROR',
      message: `Failed to connect to SMTP host (${message}).`,
      guidance:
        'Connection timed out or was refused. For port 465, ensure EMAIL_SECURE=true; for port 587, set EMAIL_SECURE=false. Check if your hosting provider blocks outbound SMTP ports.',
    };
  }

  return {
    code: code || 'SMTP_ERROR',
    message: message || response || 'SMTP connection failed',
    guidance: 'Check your SMTP credentials and host settings in .env.',
  };
}

/**
 * Initializes and returns the Nodemailer SMTP transporter.
 * Defaults to Gmail SMTP (smtp.gmail.com:465).
 * Mailtrap sandbox is ONLY enabled if explicitly requested via EMAIL_MODE=sandbox.
 */
export function getTransporter() {
  if (transporter) return transporter;

  const isSandbox = process.env.EMAIL_MODE === 'sandbox';

  let host;
  let port;
  let isSecure;
  let user;
  let pass;

  if (isSandbox) {
    // Optional developer sandbox mode (Mailtrap) - OFF by default
    host = process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io';
    port = Number(process.env.MAILTRAP_PORT) || 2525;
    isSecure = false;
    user = process.env.MAILTRAP_USER || process.env.EMAIL_USER;
    pass = process.env.MAILTRAP_PASS || process.env.EMAIL_PASS;
  } else {
    // Default: Real Gmail SMTP delivery
    host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    port = Number(process.env.EMAIL_PORT) || 465;
    isSecure =
      process.env.EMAIL_SECURE !== undefined
        ? process.env.EMAIL_SECURE === 'true'
        : port === 465;
    user = process.env.EMAIL_USER;
    pass = process.env.EMAIL_PASS;
  }

  // Strip all whitespace from App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  if (pass) {
    pass = pass.replace(/\s+/g, '');
  }

  if (!host || !user || !pass) {
    logger.warn('[EmailService] SMTP credentials are not fully configured in environment (EMAIL_HOST, EMAIL_USER, EMAIL_PASS).');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return transporter;
}

/**
 * Resets cached transporter (useful for testing or after environment updates)
 */
export function resetTransporter() {
  transporter = null;
}

/**
 * Sets a custom or mock transporter for testing
 */
export function setTransporter(mockTransporter) {
  transporter = mockTransporter;
}

/**
 * Verifies SMTP transporter connection on server start.
 * Logs clear OK/FAILED status with real provider error (no secrets).
 */
export async function verifyTransporter() {
  const isSandbox = process.env.EMAIL_MODE === 'sandbox';
  const host = isSandbox
    ? process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io'
    : process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(isSandbox ? process.env.MAILTRAP_PORT || 2525 : process.env.EMAIL_PORT || 465);
  const user = isSandbox ? process.env.MAILTRAP_USER || process.env.EMAIL_USER : process.env.EMAIL_USER;

  try {
    const activeTransporter = getTransporter();
    if (!activeTransporter) {
      const missingVars = [];
      if (!host) missingVars.push('EMAIL_HOST');
      if (!user) missingVars.push('EMAIL_USER');
      if (!process.env.EMAIL_PASS) missingVars.push('EMAIL_PASS');
      const warnMsg = `[EmailService] ⚠️ SMTP Transporter verification skipped: Missing environment variables (${missingVars.join(', ')}).`;
      logger.warn(warnMsg);
      console.warn(warnMsg);
      return false;
    }

    await activeTransporter.verify();
    const modeLabel = isSandbox ? 'SANDBOX (Mailtrap)' : 'REAL SMTP (Gmail/Production)';
    const okMsg = `[EmailService] ✓ SMTP Transporter verified successfully [OK] (${modeLabel} via ${host}:${port}, sender: ${user}). Ready to deliver transactional emails to ANY recipient.`;
    logger.info(okMsg);
    console.log(okMsg);
    return true;
  } catch (err) {
    const diag = diagnoseSmtpError(err);
    const failMsg = `[EmailService] ✕ SMTP Transporter verification [FAILED] for ${host}:${port} (${diag.message}).`;
    logger.error(failMsg);
    console.error(failMsg);
    if (diag.guidance) {
      console.error(`[EmailService Guidance]: ${diag.guidance}`);
    }
    return false;
  }
}

/**
 * Core unified email delivery function used everywhere.
 * Enforces user notification preferences, retries transient errors,
 * validates recipient, enforces sender branding ("NovaShop"),
 * formats subjects to start with "NovaShop: ", logs provider details,
 * and saves delivery status in EmailLog & Order documents without throwing.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address (any registered user)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Plain text fallback body
 * @param {string} [options.orderId] - Optional associated Order ID
 * @param {string} [options.userId] - Optional associated User ID
 * @param {string} [options.type] - Email category type
 * @param {'order'|'delivery'|'promo'|'security'} [options.statusCategory] - Category for user settings
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, skipped?: boolean }>}
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  orderId,
  userId,
  type = 'payment_receipt',
  statusCategory = 'order',
  replyTo,
  inReplyTo,
  references,
  headers,
  messageId,
  idempotencyKey,
  adminUserId,
  adminName,
}) {
  try {
    // 0. Deduplicate request if idempotencyKey provided and recently processed
    if (idempotencyKey) {
      const existingLog = await EmailLog.findOne({
        idempotencyKey,
        createdAt: { $gte: new Date(Date.now() - 60 * 1000) },
      });
      if (existingLog) {
        logger.info(`[EmailService] Deduplicated email send with idempotencyKey: ${idempotencyKey}`);
        return {
          success: existingLog.status === 'sent',
          messageId: existingLog.messageId,
          error: existingLog.error,
          deduplicated: true,
        };
      }
    }
    // 1. Validate recipient email format
    const normalizedTo = typeof to === 'string' ? to.trim().toLowerCase() : '';
    if (!normalizedTo || !EMAIL_REGEX.test(normalizedTo)) {
      const errMsg = `Invalid or missing recipient email address: "${to || ''}"`;
      logger.error(`[EmailService] ${errMsg}`);
      await EmailLog.create({
        to: normalizedTo || 'missing_recipient',
        subject: subject || 'No Subject',
        orderId: orderId || null,
        userId: userId || null,
        type,
        status: 'failed',
        error: errMsg,
      }).catch(() => {});
      return { success: false, error: errMsg };
    }

    // 2. Ensure subject line starts with "NovaShop: "
    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    const formattedSubject = cleanSubject.toLowerCase().startsWith('novashop:')
      ? cleanSubject
      : `NovaShop: ${cleanSubject.replace(/^novashop\s*[-—|:]\s*/i, '')}`;

    // 3. Check user notification preferences (security emails ALWAYS send)
    let userDoc = null;
    if (userId) {
      try {
        userDoc = await User.findById(userId).select('settings email name');
      } catch {
        // ignore
      }
    } else if (orderId) {
      try {
        const ord = await Order.findById(orderId).select('user customerEmail');
        if (ord?.user) {
          userDoc = await User.findById(ord.user).select('settings email name');
        }
      } catch {
        // ignore
      }
    } else {
      try {
        userDoc = await User.findOne({ email: normalizedTo }).select('settings email name');
      } catch {
        // ignore
      }
    }

    const isSecurityEmail =
      statusCategory === 'security' ||
      type === 'verification' ||
      type === 'password_reset' ||
      type === 'security_alert' ||
      type === 'account_deactivated' ||
      type === 'account_reactivated';

    if (!isSecurityEmail && userDoc?.settings?.notifications) {
      const prefs = userDoc.settings.notifications;

      // Rule: Payment receipts & order confirmations respect orderUpdates
      if (
        (type === 'order_confirmation' || type === 'payment_receipt') &&
        prefs.orderUpdates === false
      ) {
        logger.info(`[EmailService] Skipping order confirmation email to ${normalizedTo}: user disabled orderUpdates.`);
        await EmailLog.create({
          to: normalizedTo,
          subject: formattedSubject,
          orderId: orderId || null,
          userId: userDoc._id,
          type,
          status: 'skipped',
          error: 'Skipped per user notification setting (orderUpdates: false)',
        }).catch(() => {});
        return { success: true, skipped: true, reason: 'orderUpdates disabled' };
      }

      // Rule: Status updates respect orderUpdates or deliveryUpdates
      if (type === 'status_update') {
        if (statusCategory === 'order' && prefs.orderUpdates === false) {
          logger.info(`[EmailService] Skipping order status email to ${normalizedTo}: user disabled orderUpdates.`);
          await EmailLog.create({
            to: normalizedTo,
            subject: formattedSubject,
            orderId: orderId || null,
            userId: userDoc._id,
            type,
            status: 'skipped',
            error: 'Skipped per user notification setting (orderUpdates: false)',
          }).catch(() => {});
          return { success: true, skipped: true, reason: 'orderUpdates disabled' };
        }

        if (statusCategory === 'delivery' && prefs.deliveryUpdates === false) {
          logger.info(`[EmailService] Skipping delivery status email to ${normalizedTo}: user disabled deliveryUpdates.`);
          await EmailLog.create({
            to: normalizedTo,
            subject: formattedSubject,
            orderId: orderId || null,
            userId: userDoc._id,
            type,
            status: 'skipped',
            error: 'Skipped per user notification setting (deliveryUpdates: false)',
          }).catch(() => {});
          return { success: true, skipped: true, reason: 'deliveryUpdates disabled' };
        }
      }

      // Rule: Promotional emails require explicit opt-in
      if (type === 'promotional' && prefs.promotionalEmails !== true) {
        logger.info(`[EmailService] Skipping promotional email to ${normalizedTo}: user did not opt in.`);
        await EmailLog.create({
          to: normalizedTo,
          subject: formattedSubject,
          orderId: orderId || null,
          userId: userDoc._id,
          type,
          status: 'skipped',
          error: 'Skipped per user notification setting (promotionalEmails: false)',
        }).catch(() => {});
        return { success: true, skipped: true, reason: 'promotionalEmails not opted-in' };
      }
    }

    // 4. Transporter check
    const activeTransporter = getTransporter();
    if (!activeTransporter) {
      const errMsg = 'Email transporter not configured: Check EMAIL_HOST, EMAIL_USER, EMAIL_PASS';
      logger.warn(`[EmailService] Skipping email to ${normalizedTo} ("${formattedSubject}"): ${errMsg}`);
      await EmailLog.create({
        to: normalizedTo,
        subject: formattedSubject,
        orderId: orderId || null,
        userId: userId || null,
        type,
        status: 'failed',
        error: errMsg,
      }).catch(() => {});
      return { success: false, error: errMsg };
    }

    // 5. Construct sender name & address: separate technical SMTP sender from customer-facing display name & reply-to
    let fromName = process.env.FROM_NAME || 'NovaShop';
    let replyToEmail = '';
    try {
      const settingsDoc = await Setting.getSingleton();
      if (settingsDoc) {
        fromName = settingsDoc.notifications?.customerEmails?.senderName || settingsDoc.store?.name || fromName;
        replyToEmail = settingsDoc.notifications?.customerEmails?.replyToEmail || settingsDoc.store?.email || '';
      }
    } catch {
      // Continue with env defaults
    }

    let fromEmail = process.env.EMAIL_USER;
    if (process.env.EMAIL_FROM && !fromEmail) {
      const match = process.env.EMAIL_FROM.match(/<([^>]+)>/);
      fromEmail = match ? match[1] : process.env.EMAIL_FROM;
    }
    const sender = `"${fromName}" <${fromEmail || 'noreply@novashop.com'}>`;

    // 6. Append unsubscribe link for promotional emails
    let finalHtml = html;
    let finalText = text || (html ? html.replace(/<[^>]*>?/gm, '') : '');

    if (type === 'promotional') {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const unsubUrl = `${backendUrl}/api/v1/users/unsubscribe?email=${encodeURIComponent(normalizedTo)}`;
      const unsubFooter = `
        <div style="text-align: center; font-size: 11px; color: #7A726C; margin-top: 24px; padding-top: 14px; border-top: 1px solid #EFEAE4;">
          You received this promotional showcase from NovaShop. <a href="${unsubUrl}" style="color: #1B1816; text-decoration: underline;">Unsubscribe</a> anytime.
        </div>
      `;
      finalHtml = html ? html.replace('<!-- UNSUBSCRIBE_SLOT -->', unsubFooter) : unsubFooter;
      finalText += `\n\nUnsubscribe from promotions: ${unsubUrl}`;
    }

    const mailOptions = {
      from: sender,
      to: normalizedTo,
      subject: formattedSubject,
      text: finalText,
      html: finalHtml || undefined,
      ...(replyTo ? { replyTo } : (replyToEmail ? { replyTo: replyToEmail } : {})),
      ...(inReplyTo ? { inReplyTo } : {}),
      ...(references ? { references } : {}),
      ...(headers ? { headers } : {}),
      ...(messageId ? { messageId } : {}),
    };

    // Print headers debug log (never log email body)
    logger.info(`[EmailService Debug Headers] To: "${normalizedTo}" | From: "${sender}" | Reply-To: "${mailOptions.replyTo || '(none)'}" | Subject: "${formattedSubject}"`);

    // In automated testing environment, do not attempt outbound network sockets to external SMTP unless custom transporter is provided
    if (process.env.NODE_ENV === 'test' && !transporter) {
      logger.info(`[EmailService] Simulated delivery to ${normalizedTo} in test mode`);
      const mockLog = await EmailLog.create({
        to: normalizedTo,
        subject: formattedSubject,
        orderId: orderId || null,
        userId: userId || null,
        type,
        status: 'sent',
        messageId: 'mock-test-message-id',
        providerMessageId: 'mock-test-message-id',
        accepted: [normalizedTo],
        rejected: [],
        smtpResponse: '250 2.0.0 OK mock',
        idempotencyKey: idempotencyKey || null,
        adminUserId: adminUserId || null,
        adminName: adminName || '',
      }).catch(() => null);

      return {
        success: true,
        messageId: 'mock-test-message-id',
        accepted: [normalizedTo],
        rejected: [],
        response: '250 2.0.0 OK mock',
        logId: mockLog?._id,
      };
    }

    // 7. Retry on transient network errors (up to 2 attempts)
    let info = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        info = await activeTransporter.sendMail(mailOptions);
        break;
      } catch (err) {
        lastError = err;
        logger.warn(`[EmailService] Attempt ${attempt} failed to deliver email to ${normalizedTo}: ${err.message}`);
        // Do not retry on permanent auth or quota errors
        if (err.code === 535 || err.code === 534 || err.responseCode === 535) {
          break;
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }

    // 8. Result inspection: check acceptance and rejection
    if (info) {
      let acceptedList = Array.isArray(info.accepted) ? info.accepted.map(e => String(e).toLowerCase().trim()) : [];
      const rejectedList = Array.isArray(info.rejected) ? info.rejected.map(e => String(e).toLowerCase().trim()) : [];
      const isRejected = rejectedList.includes(normalizedTo);
      let isAccepted = acceptedList.includes(normalizedTo) || (acceptedList.length > 0 && rejectedList.length === 0);

      // If transport resolved successfully and no rejection occurred:
      // (e.g. nodemailer transport returned messageId or omitted accepted array or accepted array was empty without rejection)
      if (!isRejected && !isAccepted && (info.messageId || !Array.isArray(info.accepted) || rejectedList.length === 0)) {
        isAccepted = true;
        if (acceptedList.length === 0) {
          acceptedList = [normalizedTo];
        }
      }

      logger.info(`[EmailService SMTP Response] Accepted: [${acceptedList.join(', ')}] | Rejected: [${rejectedList.join(', ')}] | Response: "${info.response || ''}" | MessageId: ${info.messageId}`);

      if (isAccepted && !isRejected) {
        logger.info(`[EmailService] ✓ Email sent successfully to ${normalizedTo} (MessageId: ${info.messageId}) [Subject: "${formattedSubject}"]`);

        let savedLog = null;
        try {
          savedLog = await EmailLog.create({
            to: normalizedTo,
            subject: formattedSubject,
            orderId: orderId || null,
            userId: userId || null,
            type,
            status: 'sent',
            messageId: info.messageId,
            providerMessageId: info.messageId,
            accepted: acceptedList,
            rejected: rejectedList,
            smtpResponse: info.response || '',
            idempotencyKey: idempotencyKey || null,
            adminUserId: adminUserId || null,
            adminName: adminName || '',
          });

          if (orderId) {
            await Order.findByIdAndUpdate(orderId, {
              confirmationEmailSent: true,
              paymentEmailSent: true,
              emailDeliveryStatus: 'sent',
              emailSentAt: new Date(),
              emailError: null,
            });
          }
        } catch (logErr) {
          logger.warn(`[EmailService] Non-fatal log recording error: ${logErr.message}`);
        }

        return {
          success: true,
          messageId: info.messageId,
          accepted: acceptedList,
          rejected: rejectedList,
          response: info.response,
          logId: savedLog?._id,
        };
      } else {
        // Recipient rejected by SMTP server at envelope stage
        const rejectReason = `Recipient rejected by SMTP server: ${rejectedList.join(', ') || 'Address not accepted'}`;
        logger.error(`[EmailService] ✕ Recipient rejected for ${normalizedTo}: ${rejectReason}`);

        let failedLog = null;
        try {
          failedLog = await EmailLog.create({
            to: normalizedTo,
            subject: formattedSubject,
            orderId: orderId || null,
            userId: userId || null,
            type,
            status: 'failed',
            error: rejectReason,
            messageId: info.messageId,
            providerMessageId: info.messageId,
            accepted: acceptedList,
            rejected: rejectedList,
            smtpResponse: info.response || '',
            idempotencyKey: idempotencyKey || null,
            adminUserId: adminUserId || null,
            adminName: adminName || '',
          });
        } catch (logErr) {
          logger.warn(`[EmailService] Non-fatal log recording error: ${logErr.message}`);
        }

        return {
          success: false,
          error: rejectReason,
          messageId: info.messageId,
          accepted: acceptedList,
          rejected: rejectedList,
          response: info.response,
          logId: failedLog?._id,
        };
      }
    }

    // 9. Failure handling (never throws into caller)
    const diag = diagnoseSmtpError(lastError);
    logger.error(`[EmailService] ✕ Failed to send email to ${normalizedTo} after retries: ${diag.message}`);

    let errLog = null;
    try {
      errLog = await EmailLog.create({
        to: normalizedTo,
        subject: formattedSubject,
        orderId: orderId || null,
        userId: userId || null,
        type,
        status: 'failed',
        error: diag.message,
        idempotencyKey: idempotencyKey || null,
        adminUserId: adminUserId || null,
        adminName: adminName || '',
      });

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          emailDeliveryStatus: 'failed',
          emailError: diag.message,
        });
      }
    } catch (logErr) {
      logger.warn(`[EmailService] Non-fatal log recording error: ${logErr.message}`);
    }

    return { success: false, error: diag.message, logId: errLog?._id };
  } catch (unexpectedError) {
    logger.error(`[EmailService] Unexpected fatal mailer caught: ${unexpectedError.message}`);
    return { success: false, error: unexpectedError.message };
  }
}

// -------------------------------------------------------------
// RESPONSIVE HTML EMAIL TEMPLATES WITH PLAIN TEXT FALLBACKS
// -------------------------------------------------------------

const emailHeader = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #F9F5F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1B1816; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid rgba(27,24,22,0.08); }
    .header { background-color: #1B1816; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; color: #FDFBF7; font-family: Georgia, serif; font-size: 24px; letter-spacing: 0.16em; text-transform: uppercase; }
    .content { padding: 36px 32px; }
    .footer { padding: 24px 32px; background-color: #F6F0E9; text-align: center; font-size: 12px; color: #7A726C; line-height: 1.6; }
    .btn { display: inline-block; background-color: #1B1816; color: #FDFBF7 !important; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; margin: 20px 0; }
    .item-row { border-bottom: 1px solid #EFEAE4; padding: 12px 0; display: table; width: 100%; }
    .item-cell { display: table-cell; vertical-align: middle; }
    .meta-box { background: #F9F5F0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <h1>NOVASHOP</h1>
      </div>
      <div class="content">
`;

const emailFooter = `
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px;">NovaShop Atelier & Concierge</p>
        <p style="margin: 0;">Addis Ababa, Ethiopia · If you have questions, reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * 1. Order Confirmation Template
 */
export function getOrderConfirmationEmail({ order, user }) {
  const orderNumber = order.orderNumber || order._id;
  const items = order.orderItems || [];
  const itemsHtml = items.map((i) => `
    <div class="item-row">
      <div class="item-cell" style="width: 70%;">
        <strong>${i.name}</strong><br>
        <span style="font-size: 12px; color: #7A726C;">Size: ${i.size || 'OS'} · Color: ${i.color || 'N/A'} · Qty: ${i.qty}</span>
      </div>
      <div class="item-cell" style="width: 30%; text-align: right; font-weight: bold;">
        $${((i.price || 0) * (i.qty || 1)).toFixed(2)}
      </div>
    </div>
  `).join('');

  const itemsText = items.map((i) => `- ${i.name} (${i.size}/${i.color}) x ${i.qty} = $${((i.price || 0) * (i.qty || 1)).toFixed(2)}`).join('\n');

  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const orderUrl = `${frontendUrl}/checkout/confirmation?orderId=${order._id}`;

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0;">Thank you for your order.</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${user?.name || 'Customer'}, your order <strong>#${orderNumber}</strong> has been received and registered in our atelier.
    </p>

    <div class="meta-box">
      <strong>Order Summary</strong><br>
      Total Amount: <strong>$${order.totalPrice?.toFixed(2)} ${order.currency || 'USD'}</strong><br>
      Payment Method: ${order.paymentMethod || 'Chapa'}<br>
      Status: ${order.paymentStatus === 'paid' ? 'Paid & Processing' : 'Awaiting Payment'}
    </div>

    <h3 style="font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 24px;">Garments in this order:</h3>
    ${itemsHtml}

    <div style="text-align: center; margin-top: 30px;">
      <a href="${orderUrl}" class="btn">View Order Confirmation</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Thank you for your order, ${user?.name || 'Customer'}!
Order #${orderNumber}

Summary:
${itemsText}

Total: $${order.totalPrice?.toFixed(2)} ${order.currency || 'USD'}
Payment Method: ${order.paymentMethod || 'Chapa'}
View order: ${orderUrl}
  `.trim();

  return {
    subject: `NovaShop: Order Confirmation #${orderNumber} (${order._id})`,
    html,
    text,
  };
}

/**
 * 2. Payment Success Template
 */
export function getPaymentSuccessEmail({ order, paymentResult }) {
  const orderNumber = order.orderNumber || order._id;
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const confirmationUrl = `${frontendUrl}/checkout/confirmation?orderId=${order._id}`;
  const accountOrderUrl = `${frontendUrl}/account/orders/${order._id}`;
  const paymentRef = paymentResult?.id || order.chapaReference || order.paymentReference || 'N/A';

  const usdTotal = Number(order.totalPrice || 0).toFixed(2);
  const etbTotal = Number(
    order.totalPriceETB || order.totalPrice * (order.usdToEtbRate || 120)
  ).toFixed(2);

  const items = order.orderItems || [];
  const itemsHtml = items
    .map(
      (item) => `
    <div class="item-row">
      <div class="item-cell" style="width: 70%;">
        <strong>${item.name}</strong><br>
        <span style="font-size: 12px; color: #7A726C;">
          ${item.size ? `Size: ${item.size}` : ''} ${item.color ? `· Color: ${item.color}` : ''} ${item.sku ? `· SKU: ${item.sku}` : ''} · Qty: ${item.qty || 1}
        </span>
      </div>
      <div class="item-cell" style="width: 30%; text-align: right; font-weight: bold;">
        $${((Number(item.price) || 0) * (Number(item.qty) || 1)).toFixed(2)}
      </div>
    </div>
  `
    )
    .join('');

  const itemsText = items
    .map(
      (item) =>
        `- ${item.name} (${item.size || 'OS'}/${item.color || 'Standard'}) x ${item.qty || 1} = $${((Number(item.price) || 0) * (Number(item.qty) || 1)).toFixed(2)}`
    )
    .join('\n');

  const addr = order.shippingAddress || {};
  const addressText = [
    addr.recipientName,
    addr.address,
    addr.address2,
    `${addr.city || 'Addis Ababa'}${addr.state ? `, ${addr.state}` : ''} ${addr.postalCode || ''}`,
    addr.country || 'Ethiopia',
    addr.phone ? `Phone: ${addr.phone}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const html = `
    ${emailHeader}
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: #227B51; color: #FFFFFF; font-size: 24px;">✓</span>
    </div>
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0; text-align: center;">Payment Confirmed</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      We have received and verified your payment of <strong>$${usdTotal} USD</strong> (<strong>${etbTotal} ETB</strong>) for order <strong>#${orderNumber}</strong>.
    </p>

    <div class="meta-box">
      <strong>Payment Receipt Details:</strong><br>
      Order Number: <strong>#${orderNumber}</strong><br>
      Transaction Reference: <code>${paymentRef}</code><br>
      Payment Gateway: Chapa (Test Mode)<br>
      Order Total (USD): <strong>$${usdTotal} USD</strong><br>
      Charged Amount (ETB): <strong>${etbTotal} ETB</strong> (Exchange Rate: ${order.usdToEtbRate || 120} ETB/USD)<br>
      Payment Status: <span style="color: #227B51; font-weight: bold;">PAID / Confirmed</span><br>
      Order Status: <strong>Processing</strong>
    </div>

    ${
      addr.address
        ? `
    <div class="meta-box" style="margin-top: 14px;">
      <strong>Delivery Address:</strong><br>
      ${addr.recipientName ? `Recipient: ${addr.recipientName}<br>` : ''}
      ${addr.address}${addr.address2 ? `, ${addr.address2}` : ''}<br>
      ${addr.city || 'Addis Ababa'}${addr.state ? `, ${addr.state}` : ''} ${addr.postalCode || ''}<br>
      ${addr.country || 'Ethiopia'}<br>
      ${addr.phone ? `Contact: ${addr.phone}` : ''}
    </div>
    `
        : ''
    }

    <h3 style="font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 24px;">Garments in this order:</h3>
    ${itemsHtml}

    <p style="font-size: 14px; line-height: 1.6; color: #6E6962; margin-top: 24px;">
      Our team is preparing your items for packaging and fulfillment. You can track live updates in your NovaShop account anytime.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${accountOrderUrl}" class="btn" style="margin-right: 10px;">View in My Orders</a>
      <a href="${confirmationUrl}" class="btn" style="background-color: #4A4441;">Confirmation Receipt</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Payment Confirmed for Order #${orderNumber}
Transaction ID: ${paymentRef}
Amount: $${usdTotal} USD (${etbTotal} ETB)
Status: PAID / Processing

Shipping Address:
${addressText}

Garments:
${itemsText}

View order in your account:
${accountOrderUrl}
Live Confirmation:
${confirmationUrl}
  `.trim();

  return {
    subject: `NovaShop: Payment Confirmed & Receipt for Order #${orderNumber} (${order._id})`,
    html,
    text,
  };
}

/**
 * 3. Payment Failure Template
 */
export function getPaymentFailureEmail({ order, errorNote, retryUrl }) {
  const orderNumber = order.orderNumber || order._id;
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const resolvedRetryUrl = retryUrl || `${frontendUrl}/checkout/confirmation?orderId=${order._id}`;

  const html = `
    ${emailHeader}
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: #A14A3F; color: #FFFFFF; font-size: 24px;">✕</span>
    </div>
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0; text-align: center;">Payment Incomplete</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      We were unable to complete payment verification for order <strong>#${orderNumber}</strong>.
    </p>

    <div class="meta-box" style="border-left: 3px solid #A14A3F;">
      <strong>Notice:</strong><br>
      ${errorNote || 'The payment transaction was cancelled, timed out, or declined by the provider.'}<br>
      Your items are saved. You can retry payment anytime.
    </div>

    <div style="text-align: center;">
      <a href="${resolvedRetryUrl}" class="btn" style="background-color: #A14A3F;">Retry Payment via Chapa</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Payment Incomplete for Order #${orderNumber}
${errorNote || 'Payment was not completed.'}
Retry payment here: ${resolvedRetryUrl}
  `.trim();

  return {
    subject: `NovaShop: Payment Notice for Order #${orderNumber}`,
    html,
    text,
  };
}

/**
 * 4. Order Status Update Template
 */
export function getOrderStatusEmail({ order, newStatus }) {
  const orderNumber = order.orderNumber || order._id;
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const orderUrl = `${frontendUrl}/account/orders/${order._id}`;

  const statusDescriptions = {
    processing: 'Your order is currently being tailored, inspected, and packaged in our atelier.',
    shipped: 'Your package has been dispatched from our facility and is on its way to you.',
    out_for_delivery: 'Your order is out with the local delivery carrier and will arrive today.',
    delivered: 'Your order has been successfully delivered. We hope you cherish your new pieces.',
    cancelled: 'Your order has been cancelled. Any held stock and authorizations have been released.',
    refunded: 'Your payment has been refunded to your original payment method.',
  };

  const statusTitle = newStatus ? newStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Updated';
  const message = statusDescriptions[newStatus] || `Your order status has been updated to: ${statusTitle}.`;

  const itemsHtml = (order.orderItems || [])
    .map(
      (item) => `
        <div style="border-bottom: 1px solid #EFEAE4; padding: 12px 0; display: table; width: 100%;">
          <div style="display: table-cell; vertical-align: middle;">
            <strong style="color: #1B1816; font-size: 14px;">${item.name || 'Item'}</strong>
            ${item.color || item.size ? `<br><span style="font-size: 12px; color: #7A726C;">${[item.color, item.size].filter(Boolean).join(' · ')}</span>` : ''}
          </div>
          <div style="display: table-cell; text-align: right; vertical-align: middle; white-space: nowrap; font-size: 13px; font-weight: 600; color: #1B1816;">
            ${item.qty || item.quantity || 1} × $${Number(item.price || 0).toFixed(2)}
          </div>
        </div>
      `
    )
    .join('');

  const itemsText = (order.orderItems || [])
    .map((item) => `- ${item.name || 'Item'} (${[item.color, item.size].filter(Boolean).join('/')}) x${item.qty || item.quantity || 1} - $${Number(item.price || 0).toFixed(2)}`)
    .join('\n');

  const trackingInfo = order.trackingNumber
    ? `
      <div style="background: #FDFBF7; border: 1px solid rgba(27,24,22,0.12); border-radius: 8px; padding: 14px 18px; margin: 16px 0; font-size: 13px;">
        <strong>Tracking Carrier:</strong> ${order.carrier || 'Standard Courier'}<br>
        <strong>Tracking Number:</strong> <span style="font-family: monospace;">${order.trackingNumber}</span>
      </div>
    `
    : '';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0; color: #1B1816;">Order Update: ${statusTitle}</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Your order <strong>#${orderNumber}</strong> has transitioned to <strong>${statusTitle}</strong>.
    </p>

    <div class="meta-box" style="background: #F8F4EE; padding: 16px; border-radius: 8px; font-size: 14px; color: #3A3532; margin: 18px 0;">
      ${message}
    </div>

    ${trackingInfo}

    <div style="margin: 24px 0;">
      <h3 style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #7A726C; margin: 0 0 12px;">Order Summary</h3>
      ${itemsHtml}
      <div style="padding-top: 12px; text-align: right; font-size: 14px; font-weight: 700; color: #1B1816;">
        Total: $${Number(order.totalPrice || 0).toFixed(2)}
      </div>
    </div>

    <div style="text-align: center; margin-top: 28px;">
      <a href="${orderUrl}" class="btn">View Order Details</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Order #${orderNumber} Status Update: ${statusTitle}
${message}

${order.trackingNumber ? `Tracking: ${order.trackingNumber} (${order.carrier || 'Courier'})` : ''}

Items:
${itemsText}

Total: $${Number(order.totalPrice || 0).toFixed(2)}

View full details: ${orderUrl}
  `.trim();

  const subject =
    newStatus === 'delivered'
      ? `NovaShop: Your Order #${orderNumber} Has Been Delivered! 📦`
      : newStatus === 'shipped'
      ? `NovaShop: Your Order #${orderNumber} Has Been Dispatched 🚚`
      : newStatus === 'out_for_delivery'
      ? `NovaShop: Your Order #${orderNumber} Is Out For Delivery 🛵`
      : `NovaShop: Order #${orderNumber} Status Updated to ${statusTitle}`;

  return {
    subject,
    html,
    text,
  };
}

/**
 * 5. Email Verification Template
 */
export function getVerificationEmail({ user, verificationUrl }) {
  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0;">Verify your email address</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Welcome to NovaShop, ${user.name || 'valued customer'}. Please confirm your email address by clicking the button below.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" class="btn">Verify My Email</a>
    </div>

    <p style="font-size: 13px; line-height: 1.6; color: #7A726C;">
      This verification link expires in 24 hours. If you did not create an account with NovaShop, please disregard this email.
    </p>
    ${emailFooter}
  `;

  const text = `
Welcome to NovaShop, ${user.name || 'valued customer'}!
Please verify your email address by clicking the link below:
${verificationUrl}

This link expires in 24 hours.
  `.trim();

  return {
    subject: 'Verify your NovaShop Account',
    html,
    text,
  };
}

/**
 * 6. Password Reset Template
 */
export function getPasswordResetEmail({ user, resetUrl }) {
  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0;">Reset your password</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      You requested a password reset for your NovaShop account (${user.email}). Click the button below to choose a new password.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>

    <div class="meta-box">
      <strong>Security Notice:</strong> This link expires in 10 minutes and can only be used once. If you did not request a password reset, your account is secure and no action is required.
    </div>
    ${emailFooter}
  `;

  const text = `
Reset Password: You requested a password reset for your NovaShop account.
${resetUrl}

This link expires in 10 minutes. If you did not make this request, ignore this message.
  `.trim();

  return {
    subject: 'Reset your NovaShop password',
    html,
    text,
  };
}

/**
 * 7. Welcome Email Template
 */
export function getWelcomeEmail({ user, storefrontUrl }) {
  const resolvedUrl = storefrontUrl || process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin-top: 0;">Welcome to NovaShop Atelier</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${user.name || 'friend'}, we are thrilled to welcome you to our community of contemporary fashion.
    </p>

    <p style="font-size: 14px; line-height: 1.7; color: #6E6962;">
      Explore our curated garments crafted with bespoke materials, transparent inventory, and seamless concierge delivery.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resolvedUrl}/shop" class="btn">Explore Current Collection</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Welcome to NovaShop Atelier, ${user.name || 'friend'}!
Explore our collection: ${resolvedUrl}/shop
  `.trim();

  return {
    subject: 'NovaShop: Welcome to NovaShop Atelier',
    html,
    text,
  };
}

/**
 * 8. Review Approved Email Template
 */
export function getReviewApprovedEmail({ review, user, product }) {
  const productName = product?.name || 'your purchased item';
  const resolvedUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; color: #1B1816;">Your Review is Live!</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${user?.name || 'Customer'},
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A4441;">
      Thank you for sharing your experience. Your review for <strong>${productName}</strong> has been approved and published to the NovaShop catalog.
    </p>
    <div style="background: #FDFBF7; border: 1px solid rgba(27,24,22,0.1); border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: bold; color: #1B1816; margin-bottom: 6px;">${review.title} (${review.rating} / 5 ★)</div>
      <div style="font-size: 13px; color: #6E6962; font-style: italic;">"${review.body}"</div>
    </div>
    <div style="text-align: center; margin: 26px 0;">
      <a href="${resolvedUrl}/products/${product?._id || ''}" class="btn">View on NovaShop</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Hello ${user?.name || 'Customer'},
Your review for ${productName} has been approved and is now live on NovaShop!

Rating: ${review.rating} / 5
Title: ${review.title}
"${review.body}"

View product: ${resolvedUrl}/products/${product?._id || ''}
  `.trim();

  return {
    subject: `Your review for ${productName} is published`,
    html,
    text,
  };
}

/**
 * 9. Review Rejected Email Template
 */
export function getReviewRejectedEmail({ review, user, product, rejectionReason }) {
  const productName = product?.name || 'your purchased item';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; color: #1B1816;">Update Regarding Your Review</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${user?.name || 'Customer'},
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A4441;">
      Thank you for submitting a review for <strong>${productName}</strong>. Following our moderation guidelines, we were unable to publish your review.
    </p>
    ${rejectionReason ? `
    <div style="background: #FFF8F6; border-left: 3px solid #E5484D; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #6E6962;">
      <strong>Reason:</strong> ${rejectionReason}
    </div>` : ''}
    <p style="font-size: 13px; line-height: 1.6; color: #7A726C;">
      If you would like to submit an updated reflection conforming to our community guidelines, please feel free to reach out to our concierge.
    </p>
    ${emailFooter}
  `;

  const text = `
Hello ${user?.name || 'Customer'},
Thank you for submitting a review for ${productName}.
Unfortunately, your review could not be published to NovaShop under our moderation guidelines.
${rejectionReason ? `Reason: ${rejectionReason}` : ''}
  `.trim();

  return {
    subject: `Update regarding your review for ${productName}`,
    html,
    text,
  };
}

/**
 * 10. Review Admin Reply Email Template
 */
export function getReviewReplyEmail({ review, user, product, replyText }) {
  const productName = product?.name || 'your purchased item';
  const resolvedUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; color: #1B1816;">NovaShop Concierge Replied to Your Review</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${user?.name || 'Customer'},
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A4441;">
      The NovaShop team has replied to your review on <strong>${productName}</strong>:
    </p>
    <div style="background: #F4F1EA; border-left: 3px solid #1B1816; padding: 14px 18px; margin: 18px 0; font-size: 14px; color: #1B1816;">
      "${replyText}"
    </div>
    <div style="font-size: 12px; color: #7A726C; margin-bottom: 20px;">
      In reference to your review: <em>"${review.title}"</em>
    </div>
    <div style="text-align: center; margin: 26px 0;">
      <a href="${resolvedUrl}/products/${product?._id || ''}" class="btn">View on NovaShop</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Hello ${user?.name || 'Customer'},
The NovaShop team has replied to your review on ${productName}:

"${replyText}"

View product: ${resolvedUrl}/products/${product?._id || ''}
  `.trim();

  return {
    subject: `NovaShop Concierge replied to your review on ${productName}`,
    html,
    text,
  };
}

/**
 * 11. Return Request Received Email Template
 */
export function getReturnRequestedEmail({ returnRequest, order, user }) {
  const returnNumber = returnRequest?.returnNumber || 'RT-PENDING';
  const orderNumber = order?.orderNumber || returnRequest?.orderNumber || 'N/A';
  const customerName = user?.name || returnRequest?.customerName || 'Customer';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; color: #1B1816;">Return Request Received</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${customerName}, we have received your return request <strong>#${returnNumber}</strong> for Order <strong>#${orderNumber}</strong>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #665F5B;">
      Our concierge team is reviewing your request. Once approved, you will receive pickup and shipping instructions.
    </p>
    <div style="text-align: center; margin: 26px 0;">
      <a href="${frontendUrl}/account/orders/${order?._id || ''}" class="btn">View Order Details</a>
    </div>
    ${emailFooter}
  `;

  const text = `
Hello ${customerName},
Your return request #${returnNumber} for Order #${orderNumber} has been received and is being reviewed.
We will notify you once your return is approved with complimentary pickup instructions.
  `.trim();

  return {
    subject: `Return Request Received: #${returnNumber}`,
    html,
    text,
  };
}

/**
 * 12. Return Request Approved Email Template
 */
export function getReturnApprovedEmail({ returnRequest, order, user, instructions }) {
  const returnNumber = returnRequest?.returnNumber || 'RT-PENDING';
  const customerName = user?.name || returnRequest?.customerName || 'Customer';
  const tracking = returnRequest?.trackingNumber || returnRequest?.tracking || 'Prepaid courier pickup';
  const customInstructions = instructions || 'Please ensure the items are packaged in their original boxes with tags attached. Our courier will contact you to collect the parcel.';

  const html = `
    ${emailHeader}
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: #227B51; color: #FFFFFF; font-size: 24px;">✓</span>
    </div>
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; text-align: center; color: #1B1816;">Return Request Approved</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${customerName}, your return request <strong>#${returnNumber}</strong> has been approved.
    </p>
    <div style="background: #FAF8F5; border: 1px solid #EAE4D9; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <strong style="display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #1B1816; margin-bottom: 8px;">Instructions</strong>
      <p style="font-size: 14px; line-height: 1.6; color: #4A4441; margin: 0;">${customInstructions}</p>
      <div style="margin-top: 12px; font-size: 13px; color: #79716B;">
        Waybill / Courier: <strong>${tracking}</strong>
      </div>
    </div>
    ${emailFooter}
  `;

  const text = `
Hello ${customerName},
Your return request #${returnNumber} has been approved.
Instructions: ${customInstructions}
Courier: ${tracking}
  `.trim();

  return {
    subject: `Return Request Approved: #${returnNumber}`,
    html,
    text,
  };
}

/**
 * 13. Return Request Rejected Email Template
 */
export function getReturnRejectedEmail({ returnRequest, order, user, reason }) {
  const returnNumber = returnRequest?.returnNumber || 'RT-PENDING';
  const customerName = user?.name || returnRequest?.customerName || 'Customer';
  const rejectReason = reason || returnRequest?.rejectionReason || 'Does not meet return policy criteria';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; color: #1B1816;">Update on Return Request #${returnNumber}</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${customerName}, after reviewing your return request <strong>#${returnNumber}</strong>, we are unable to accept this return.
    </p>
    <div style="background: #FDF4F2; border: 1px solid #F5D3CE; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <strong style="display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #8F2D24; margin-bottom: 6px;">Reason</strong>
      <p style="font-size: 14px; line-height: 1.6; color: #4A4441; margin: 0;">${rejectReason}</p>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #79716B;">
      If you believe this was an error or have further questions, please contact our support concierge.
    </p>
    ${emailFooter}
  `;

  const text = `
Hello ${customerName},
Regarding return request #${returnNumber}: We are unable to accept this return for the following reason:
${rejectReason}
  `.trim();

  return {
    subject: `Update on Return Request: #${returnNumber}`,
    html,
    text,
  };
}

/**
 * 14. Return Items Received Email Template
 */
export function getReturnReceivedEmail({ returnRequest, order, user }) {
  const returnNumber = returnRequest?.returnNumber || 'RT-PENDING';
  const customerName = user?.name || returnRequest?.customerName || 'Customer';

  const html = `
    ${emailHeader}
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; color: #1B1816;">Returned Items Received</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${customerName}, we have safely received and inspected your returned items for return request <strong>#${returnNumber}</strong>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A4441;">
      Your refund is now being authorized and will be completed shortly.
    </p>
    ${emailFooter}
  `;

  const text = `
Hello ${customerName},
Your returned items for return #${returnNumber} have been safely received at our depot. Your refund is being processed.
  `.trim();

  return {
    subject: `Return Items Received: #${returnNumber}`,
    html,
    text,
  };
}

/**
 * 15. Refund Issued Email Template (Transactional / Security - Always Sent)
 */
export function getRefundIssuedEmail({ returnRequest, order, user, refundAmountUSD, refundAmountETB, refundMethod, refundRef }) {
  const returnNumber = returnRequest?.returnNumber || 'RT-PENDING';
  const orderNumber = order?.orderNumber || returnRequest?.orderNumber || 'N/A';
  const customerName = user?.name || returnRequest?.customerName || 'Customer';
  const amountStr = refundAmountUSD !== undefined ? `$${Number(refundAmountUSD).toFixed(2)}` : (refundAmountETB ? `${refundAmountETB} ETB` : 'Full Refund');
  const method = refundMethod || returnRequest?.refundMethod || 'Original payment method';
  const ref = refundRef || returnRequest?.refundReference || 'REF-SETTLED';

  const html = `
    ${emailHeader}
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: #227B51; color: #FFFFFF; font-size: 24px;">✓</span>
    </div>
    <h2 style="font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin-top: 0; text-align: center; color: #1B1816;">Refund Issued</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #4A4441;">
      Hello ${customerName}, a refund of <strong>${amountStr}</strong> has been issued for your Return <strong>#${returnNumber}</strong> (Order #${orderNumber}).
    </p>
    <div style="background: #FAF8F5; border: 1px solid #EAE4D9; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
        <span style="color: #79716B;">Refund Method:</span>
        <strong style="color: #1B1816;">${method}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px;">
        <span style="color: #79716B;">Reference:</span>
        <strong style="color: #1B1816; font-family: monospace;">${ref}</strong>
      </div>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #79716B;">
      Depending on your financial institution, funds typically reflect in 2–5 business days.
    </p>
    ${emailFooter}
  `;

  const text = `
Hello ${customerName},
A refund of ${amountStr} has been issued for your Return #${returnNumber} (Order #${orderNumber}).
Refund Method: ${method}
Reference: ${ref}
Funds typically reflect within 2-5 business days.
  `.trim();

  return {
    subject: `Refund Issued: #${returnNumber}`,
    html,
    text,
  };
}

export default {
  sendEmail,
  verifyTransporter,
  getTransporter,
  resetTransporter,
  diagnoseSmtpError,
  getOrderConfirmationEmail,
  getPaymentSuccessEmail,
  getPaymentFailureEmail,
  getOrderStatusEmail,
  getVerificationEmail,
  getPasswordResetEmail,
  getWelcomeEmail,
  getReviewApprovedEmail,
  getReviewRejectedEmail,
  getReviewReplyEmail,
  getReturnRequestedEmail,
  getReturnApprovedEmail,
  getReturnRejectedEmail,
  getReturnReceivedEmail,
  getRefundIssuedEmail,
};
