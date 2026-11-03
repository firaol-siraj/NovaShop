import asyncHandler from '../utils/asyncHandler.js';
import { processInboundEmail } from '../workers/supportEmailWorker.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

/**
 * Inbound Email Webhook Controller
 * Supports SendGrid Inbound Parse, Postmark Inbound Webhooks, Mailgun, and custom JSON payloads.
 */
export const handleInboundEmailWebhook = asyncHandler(async (req, res) => {
  // 1. Signature / Secret Token Verification
  const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret =
      req.headers['x-webhook-secret'] ||
      req.headers['x-postmark-secret'] ||
      req.headers['x-sendgrid-secret'] ||
      req.query.secret;

    if (!providedSecret || providedSecret !== webhookSecret) {
      throw new ApiError(401, 'Invalid or missing webhook signature/secret');
    }
  }

  const body = req.body || {};

  // 2. Normalize From address & name
  let fromAddress = '';
  let fromName = '';

  if (typeof body.from === 'string') {
    const match = body.from.match(/^(?:([^<]+)\s*<)?([^>]+)>?$/);
    if (match) {
      fromName = (match[1] || '').trim();
      fromAddress = (match[2] || '').trim();
    } else {
      fromAddress = body.from.trim();
    }
  } else if (body.From) {
    // Postmark
    fromAddress = (body.From || body.FromFull?.Email || '').trim();
    fromName = (body.FromName || body.FromFull?.Name || '').trim();
  } else if (body.sender) {
    // Mailgun
    fromAddress = body.sender.trim();
    fromName = (body['from-name'] || '').trim();
  }

  // 3. Normalize Subject, Text, HTML
  const subject = body.subject || body.Subject || '';
  const textBody = body.text || body.TextBody || body['stripped-text'] || body['body-plain'] || '';
  const htmlBody = body.html || body.HtmlBody || body['body-html'] || '';

  // 4. Normalize Message-ID, In-Reply-To, References
  let messageId = body.messageId || body.MessageID || body['message-id'] || null;
  let inReplyTo = body.inReplyTo || body.InReplyTo || body['in-reply-to'] || null;
  let references = body.references || body.References || [];

  // Parse headers if passed as array (Postmark) or string (SendGrid)
  const headersMap = new Map();
  if (Array.isArray(body.Headers)) {
    for (const h of body.Headers) {
      if (h.Name && h.Value) {
        headersMap.set(h.Name.toLowerCase(), h.Value);
        if (h.Name.toLowerCase() === 'in-reply-to' && !inReplyTo) {
          inReplyTo = h.Value;
        }
        if (h.Name.toLowerCase() === 'references' && (!references || references.length === 0)) {
          references = h.Value.split(/\s+/).filter(Boolean);
        }
      }
    }
  } else if (typeof body.headers === 'string') {
    const lines = body.headers.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const headerName = match[1].toLowerCase().trim();
        const headerVal = match[2].trim();
        headersMap.set(headerName, headerVal);
        if (headerName === 'message-id' && !messageId) messageId = headerVal;
        if (headerName === 'in-reply-to' && !inReplyTo) inReplyTo = headerVal;
        if (headerName === 'references' && (!references || references.length === 0)) {
          references = headerVal.split(/\s+/).filter(Boolean);
        }
      }
    }
  }

  // 5. Structure payload into mailparser-compatible parsed object
  const parsedEmail = {
    from: {
      value: [
        {
          address: fromAddress.toLowerCase(),
          name: fromName,
        },
      ],
      text: `${fromName} <${fromAddress}>`,
    },
    subject,
    text: textBody,
    html: htmlBody,
    messageId,
    inReplyTo,
    references: Array.isArray(references) ? references : [references].filter(Boolean),
    headers: headersMap,
    attachments: body.attachments || body.Attachments || [],
  };

  logger.info(`[InboundWebhook] Processing incoming email webhook from: "${fromAddress}" | Subject: "${subject}"`);

  // 6. Process with inbound support email worker
  const result = await processInboundEmail(parsedEmail);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
