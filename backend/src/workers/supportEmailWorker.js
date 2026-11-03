import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import Setting from '../models/settingModel.js';
import EmailLog from '../models/emailLogModel.js';
import { generateTicketNumber } from '../services/supportService.js';
import { sendEmail } from '../services/emailService.js';
import { broadcastSupportEvent } from '../services/supportEventService.js';
import logger from '../utils/logger.js';

let workerTimer = null;
let isPolling = false;
let isWorkerStopped = false;
let consecutiveFailures = 0;
let normalInterval = 60000;
const BACKOFF_DELAYS = [5000, 15000, 60000]; // 5s, 15s, 60s

/**
 * Build a fresh ImapFlow client configuration from environment
 */
export function getImapClient() {
  const host = process.env.IMAP_HOST || 'imap.gmail.com';
  const port = parseInt(process.env.IMAP_PORT || '993', 10);
  const secure = process.env.IMAP_SECURE !== 'false';
  const user = process.env.IMAP_USER || process.env.EMAIL_USER;
  let pass = process.env.IMAP_PASS || process.env.EMAIL_PASS;

  if (pass && typeof pass === 'string') {
    pass = pass.replace(/\s+/g, '');
  }

  if (!user || !pass) {
    return null;
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
    emitLogs: false,
    socketTimeout: 30000,
    connectionTimeout: 30000,
    greetingTimeout: 15000,
  });

  client.on('error', (err) => {
    logger.warn(`[SupportEmailWorker] IMAP socket error: ${err.message}`);
  });

  client.on('close', () => {
    logger.debug('[SupportEmailWorker] IMAP connection closed');
  });

  return client;
}

/**
 * Strip quoted email history (e.g., "On <date> ... wrote:", "-----Original Message-----", "> ...")
 * so that customer replies display ONLY the real message and never the accumulated thread chain.
 */
export function cleanEmailReplyBody(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // Pattern 1: Original message / Forwarded message headers
  const origMsgIndex = text.search(/^-{3,}\s*(?:Original Message|Forwarded message)\s*-{3,}/im);
  if (origMsgIndex !== -1) {
    text = text.substring(0, origMsgIndex).trim();
  }

  // Pattern 2: Underscores separator (Outlook/Exchange web)
  const underscoreIndex = text.search(/_{20,}/);
  if (underscoreIndex !== -1) {
    text = text.substring(0, underscoreIndex).trim();
  }

  // Pattern 3: Standard and inline 'On <date> ... wrote:' (Gmail, Yahoo, Apple Mail, etc.)
  const onWroteRegex = /(?:\r?\n|^|\s{1,})On\s+(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s+)?(?:[A-Za-z]{3}\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})[\s\S]+?wrote:\s*[\s\S]*$/i;
  const onWroteGeneric = /(?:\r?\n|^|\s{1,})On\s+[\s\S]{5,120}?\s+wrote:\s*[\s\S]*$/i;

  if (onWroteRegex.test(text)) {
    text = text.replace(onWroteRegex, '').trim();
  } else if (onWroteGeneric.test(text)) {
    text = text.replace(onWroteGeneric, '').trim();
  }

  // Pattern 4: From: ... Sent/Date: ... To: ... Subject: ...
  const headerBlockRegex = /(?:\r?\n|^)\s*From:\s*.+?(?:\r?\n)\s*(?:Sent|Date):\s*.+?(?:\r?\n)\s*(?:To|Subject):[\s\S]*$/im;
  if (headerBlockRegex.test(text)) {
    text = text.replace(headerBlockRegex, '').trim();
  }

  // Pattern 5: Strip quoted lines starting with >
  const lines = text.split(/\r?\n/);
  const cleanLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('>')) continue;
    cleanLines.push(line);
  }

  const result = cleanLines.join('\n').trim();
  return result || rawText.trim();
}

/**
 * Check if incoming parsed email is an automated bot/loop message
 */
function isAutoReply(parsed, supportEmail) {
  const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
  const fromName = parsed.from?.value?.[0]?.name?.toLowerCase() || '';

  if (fromAddr && supportEmail && fromAddr === supportEmail.toLowerCase()) {
    return true;
  }

  // RFC 2369 / RFC 8058: Marketing emails and mailing lists (e.g. Cursor, Suno, subscriptions)
  if (parsed.headers?.get?.('list-unsubscribe') || parsed.headers?.get?.('list-id')) {
    return true;
  }

  // Ignore automated and system senders & known third-party SaaS/marketing senders
  const blockedSenders = [
    'noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster',
    'accounts.google.com', 'googleplay', 'linkedin.com', 'notifications@',
    'cursor.sh', 'cursor.com', 'suno.com', 'suno.ai', 'github.com',
    'spotify.com', 'netflix.com', 'twitter.com', 'x.com', 'facebookmail.com',
    'newsletter', 'mailer', 'notifications'
  ];

  if (blockedSenders.some(s => fromAddr.includes(s) || fromName.includes(s))) {
    return true;
  }

  // Check headers for auto-submitted flags
  const autoSubmitted = parsed.headers?.get?.('auto-submitted');
  if (autoSubmitted && typeof autoSubmitted === 'string' && autoSubmitted.toLowerCase() !== 'no') {
    return true;
  }

  const precedence = parsed.headers?.get?.('precedence');
  if (precedence && typeof precedence === 'string' && ['bulk', 'junk', 'auto_reply', 'list'].includes(precedence.toLowerCase())) {
    return true;
  }

  const xAutoreply = parsed.headers?.get?.('x-autoreply');
  if (xAutoreply) {
    return true;
  }

  return false;
}

/**
 * Check if message with messageId was already processed into database
 */
async function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  const existingMsg = await Message.findOne({ 'emailHeaders.messageId': messageId }).select('_id');
  if (existingMsg) return true;

  const existingConv = await Conversation.findOne({
    $or: [
      { emailThreadId: messageId },
      { emailMessageIds: messageId },
    ],
  }).select('_id');

  return !!existingConv;
}

/**
 * Detect delivery failure notifications (DSN / Bounce) and mark matching EmailLog as 'bounced'
 */
export async function detectAndProcessBounce(parsed) {
  const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
  const fromName = parsed.from?.value?.[0]?.name?.toLowerCase() || '';
  const subject = (parsed.subject || '').toLowerCase();
  const text = (parsed.text || parsed.html || '').toString();

  const isBounceSender =
    fromAddr.includes('mailer-daemon') ||
    fromAddr.includes('postmaster') ||
    fromName.includes('mail delivery') ||
    fromName.includes('mail delivery subsystem');

  const isBounceSubject =
    subject.includes('delivery status notification') ||
    subject.includes('failure') ||
    subject.includes('undelivered') ||
    subject.includes('returned mail') ||
    subject.includes('address not found');

  if (!isBounceSender && !isBounceSubject) {
    return false;
  }

  // Extract bounced recipient email address
  let recipient = null;
  const patterns = [
    /(?:the following address\(es\) failed|failed to deliver to|could not be delivered to|wasn't delivered to|was not delivered to|final-recipient: rfc822;?)\s*[:<]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>\s*[:\n].*?(?:address not found|user not found|does not exist|mailbox unavailable|550)/is,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*\n.*?(?:address not found|550|rejected)/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      recipient = match[1].toLowerCase().trim();
      break;
    }
  }

  if (!recipient) {
    const allEmails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const ignoreList = ['mailer-daemon', 'postmaster', 'root@', (process.env.EMAIL_USER || '').toLowerCase()].filter(Boolean);
    const candidates = allEmails.filter(e => !ignoreList.some(ig => e.toLowerCase().includes(ig)));
    if (candidates.length > 0) {
      recipient = candidates[0].toLowerCase().trim();
    }
  }

  let reason = 'Address not found or mailbox unavailable';
  const reasonMatch = text.match(/(550\s+[\d.]+\s+[^\n\r]+|Address not found|User unknown|Mailbox unavailable|The email account that you tried to reach does not exist|Recipient address rejected)/i);
  if (reasonMatch && reasonMatch[1]) {
    reason = reasonMatch[1].trim();
  }

  if (recipient) {
    logger.warn(`[SupportEmailWorker] ⚠ Detected email delivery failure (DSN/Bounce) for recipient: ${recipient} | Reason: ${reason}`);

    const emailLog = await EmailLog.findOne({
      to: recipient,
      createdAt: { $gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
    }).sort({ createdAt: -1 });

    if (emailLog) {
      emailLog.status = 'bounced';
      emailLog.bounceReason = reason;
      emailLog.error = reason;
      await emailLog.save();
      logger.info(`[SupportEmailWorker] ✓ Marked EmailLog ${emailLog._id} (${emailLog.type}) to ${recipient} as 'bounced'`);
    } else {
      await EmailLog.create({
        to: recipient,
        subject: `Delivery Bounce: ${reason}`,
        type: 'admin_message',
        status: 'bounced',
        bounceReason: reason,
        error: reason,
      }).catch(() => {});
    }

    return true;
  }

  return false;
}

/**
 * Process a single parsed email
 */
export async function processInboundEmail(parsed, uid = null) {
  // First, check if inbound email is a bounce / delivery failure notice
  const isBounce = await detectAndProcessBounce(parsed);
  if (isBounce) {
    return { status: 'bounced_processed', reason: 'dsn_bounce_recorded' };
  }

  const supportEmail = (process.env.IMAP_USER || process.env.EMAIL_USER || '').toLowerCase();
  if (isAutoReply(parsed, supportEmail)) {
    logger.info(`[SupportEmailWorker] Ignored auto-reply or loop email from ${parsed.from?.text || 'unknown'}`);
    return { status: 'ignored', reason: 'auto_reply_or_self' };
  }

  const fromObj = parsed.from?.value?.[0] || {};
  const customerEmail = (fromObj.address || '').toLowerCase().trim();
  const customerName = (fromObj.name || '').trim() || customerEmail.split('@')[0] || 'Customer';
  const subject = (parsed.subject || 'Support Inquiry').trim();
  const bodyText = (parsed.text || parsed.html ? (parsed.text || parsed.html.replace(/<[^>]*>?/gm, '')) : '').trim();
  const cleanedBody = cleanEmailReplyBody(bodyText);
  const messageId = parsed.messageId ? parsed.messageId.trim() : null;
  const inReplyTo = parsed.inReplyTo ? parsed.inReplyTo.trim() : null;
  const references = Array.isArray(parsed.references)
    ? parsed.references.map(r => r.trim()).filter(Boolean)
    : (parsed.references ? [parsed.references.trim()] : []);

  if (!customerEmail || !cleanedBody) {
    logger.warn(`[SupportEmailWorker] Skipped message UID ${uid}: missing sender email or clean body text`);
    return { status: 'skipped', reason: 'missing_sender_or_body' };
  }

  // Prevent duplicate processing if already recorded
  if (messageId && (await isDuplicateMessage(messageId))) {
    logger.info(`[SupportEmailWorker] Skipped duplicate email Message-ID: ${messageId}`);
    return { status: 'skipped', reason: 'duplicate_message_id', messageId };
  }

  // 1. Try to match an existing conversation:
  // a) Check ticket number in subject (e.g., [NS-T-1234] or [#NS-T-1234] or [NS-T-2005])
  let matchedConv = null;
  const ticketMatch = subject.match(/\[#?(NS-T-\d+)\]/i);
  if (ticketMatch && ticketMatch[1]) {
    matchedConv = await Conversation.findOne({ ticketNumber: ticketMatch[1].toUpperCase() });
  }

  // b) If no match, check inReplyTo or references in emailMessageIds / emailThreadId
  if (!matchedConv && (inReplyTo || references.length > 0)) {
    const searchIds = [inReplyTo, ...references].filter(Boolean);
    matchedConv = await Conversation.findOne({
      $or: [
        { emailThreadId: { $in: searchIds } },
        { emailMessageIds: { $in: searchIds } },
      ],
    });
  }

  // 2. Existing conversation matched -> Append message as customer reply
  if (matchedConv) {
    logger.info(`[SupportEmailWorker] Appending inbound message to ticket ${matchedConv.ticketNumber} from ${customerEmail}`);

    const replyMsg = await Message.create({
      conversation: matchedConv._id,
      senderType: 'customer',
      sender: matchedConv.customer || null,
      senderName: customerName,
      body: cleanedBody,
      type: 'reply',
      channel: 'email',
      emailHeaders: {
        messageId: messageId || null,
        inReplyTo: inReplyTo || null,
        references,
      },
    });

    try {
      await AdminNotification.create({
        type: 'support_reply',
        title: `Customer Reply: Ticket ${matchedConv.ticketNumber}`,
        message: `Inbound reply from ${customerEmail}: "${cleanedBody.slice(0, 100)}"`,
        entityType: 'conversation',
        entityId: matchedConv._id.toString(),
        link: `/admin/support?conversation=${matchedConv._id.toString()}#message=${replyMsg._id.toString()}`,
        data: {
          conversationId: matchedConv._id.toString(),
          messageId: replyMsg._id.toString(),
          ticketNumber: matchedConv.ticketNumber,
          customerEmail,
        },
      });
    } catch {
      // Non-fatal
    }

    const emailIdsToKeep = Array.from(new Set([...(matchedConv.emailMessageIds || []), messageId].filter(Boolean)));

    await Conversation.findByIdAndUpdate(matchedConv._id, {
      status: 'Open', // Reopen ticket
      unreadForAdmin: true,
      unreadForCustomer: false,
      lastMessageAt: new Date(),
      lastMessagePreview: cleanedBody.slice(0, 160),
      emailMessageIds: emailIdsToKeep,
    });

    broadcastSupportEvent('message.created', {
      conversationId: matchedConv._id.toString(),
      messageId: replyMsg._id.toString(),
      senderType: 'customer',
      ticketNumber: matchedConv.ticketNumber,
    });
    broadcastSupportEvent('conversation.updated', {
      conversationId: matchedConv._id.toString(),
      status: 'Open',
      unread: true,
    });
    broadcastSupportEvent('notification.created', {
      type: 'support_reply',
      ticketNumber: matchedConv.ticketNumber,
      title: `Customer Reply: Ticket ${matchedConv.ticketNumber}`,
    });

    return {
      status: 'appended',
      ticketNumber: matchedConv.ticketNumber,
      conversationId: matchedConv._id.toString(),
    };
  }

  // 3. New thread -> Verify whether this is a legitimate NovaShop customer inquiry
  const registeredUser = await User.findOne({ email: customerEmail });
  const recentOrder = await Order.findOne({
    $or: [
      ...(registeredUser ? [{ user: registeredUser._id }] : []),
      { customerEmail },
      { 'shippingAddress.email': customerEmail },
    ],
  }).sort({ createdAt: -1 });

  const combinedSearch = `${subject} ${cleanedBody}`.toLowerCase();
  const hasStoreKeywords = [
    'novashop', 'order', 'support', 'ticket', 'help', 'shipping',
    'refund', 'return', 'delivery', 'product', 'item', 'purchase',
    'track', 'package', 'exchange', 'size', 'cancel', 'invoice', 'payment'
  ].some(kw => combinedSearch.includes(kw));

  // If sender is neither a registered customer, nor has placed an order, nor mentioned store keywords:
  // Treat as unrelated personal/marketing email in developer's mailbox and skip creating support ticket.
  if (!registeredUser && !recentOrder && !hasStoreKeywords) {
    logger.info(`[SupportEmailWorker] Skipped unrelated non-support email from ${customerEmail}: "${subject}"`);
    return { status: 'ignored', reason: 'unrelated_non_support_email' };
  }

  logger.info(`[SupportEmailWorker] Creating new ticket from inbound email: "${subject}" from ${customerEmail}`);

  const ticketNumber = await generateTicketNumber();

  let linkedOrder = null;
  let linkedOrderNumber = '';
  let linkedOrderStatus = '';

  if (recentOrder) {
    linkedOrder = recentOrder._id;
    linkedOrderNumber = `#${recentOrder.orderNumber}`;
    const rawSt = recentOrder.status || recentOrder.orderStatus || 'Processing';
    linkedOrderStatus = rawSt.charAt(0).toUpperCase() + rawSt.slice(1);
  }

  // Topic classification from subject/body
  const combinedText = `${subject} ${cleanedBody}`.toLowerCase();
  let topic = 'General';
  if (combinedText.includes('ship') || combinedText.includes('delivery') || combinedText.includes('track')) {
    topic = 'Shipping';
  } else if (combinedText.includes('return') || combinedText.includes('refund') || combinedText.includes('exchange')) {
    topic = 'Returns';
  } else if (combinedText.includes('pay') || combinedText.includes('charge') || combinedText.includes('card')) {
    topic = 'Payments';
  } else if (combinedText.includes('discount') || combinedText.includes('coupon') || combinedText.includes('code')) {
    topic = 'Discounts';
  } else if (combinedText.includes('size') || combinedText.includes('stock') || combinedText.includes('material')) {
    topic = 'Product Inquiry';
  }

  const newConv = await Conversation.create({
    ticketNumber,
    subject,
    topic,
    status: 'Open',
    customer: registeredUser?._id || null,
    customerName,
    customerEmail,
    linkedOrder,
    linkedOrderNumber,
    linkedOrderStatus,
    channel: 'email',
    unreadForAdmin: true,
    unreadForCustomer: false,
    lastMessageAt: new Date(),
    lastMessagePreview: cleanedBody.slice(0, 160),
    emailThreadId: messageId || null,
    emailMessageIds: messageId ? [messageId] : [],
  });

  const initialMsg = await Message.create({
    conversation: newConv._id,
    senderType: 'customer',
    sender: registeredUser?._id || null,
    senderName: customerName,
    body: cleanedBody,
    type: 'reply',
    channel: 'email',
    emailHeaders: {
      messageId: messageId || null,
      inReplyTo: inReplyTo || null,
      references,
    },
  });

  // Create admin notification
  try {
    await AdminNotification.create({
      type: 'new_ticket',
      title: `New Email Ticket ${ticketNumber}`,
      message: `Inbound email from ${customerEmail}: "${subject}"`,
      entityType: 'conversation',
      entityId: newConv._id.toString(),
      link: `/admin/support?conversation=${newConv._id.toString()}#message=${initialMsg._id.toString()}`,
      data: {
        ticketNumber,
        conversationId: newConv._id.toString(),
        messageId: initialMsg._id.toString(),
        customerEmail,
        topic,
      },
    });
  } catch {
    // Non-fatal
  }

  // Send auto-acknowledgment email with ticket reference
  const ackHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #231E1B; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <div style="border-bottom: 2px solid #231E1B; padding-bottom: 12px; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0; color: #231E1B;">NovaShop Customer Support</h2>
        <span style="font-size: 12px; color: #7A726C; text-transform: uppercase; letter-spacing: 0.1em;">Request Received · ${ticketNumber}</span>
      </div>

      <p style="font-size: 15px; margin-bottom: 16px;">Hello ${customerName},</p>
      <p style="font-size: 15px; margin-bottom: 16px;">We received your message and created support ticket <strong>${ticketNumber}</strong>. A support specialist will review it and reply within 1 business day.</p>

      <div style="background: #FAF7F2; border-left: 3px solid #231E1B; padding: 16px 20px; margin-bottom: 24px; font-size: 14px; color: #231E1B;">
        <strong>Subject:</strong> ${subject}<br/><br/>
        ${bodyText}
      </div>

      <p style="font-size: 13px; color: #7A726C; margin-bottom: 0;">Reply directly to this email to provide any additional details.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: customerEmail,
      subject: `NovaShop Support: [${ticketNumber}] ${subject}`,
      html: ackHtml,
      text: `Hello ${customerName},\n\nWe received your request (Ticket ${ticketNumber}) and will respond within 1 business day.\n\nYour message:\n${bodyText}`,
      type: 'support_acknowledgment',
      statusCategory: 'order',
      inReplyTo: messageId || undefined,
      references: messageId ? [messageId] : undefined,
    });
  } catch (err) {
    logger.warn(`[SupportEmailWorker] Could not send auto-ack to ${customerEmail}: ${err.message}`);
  }

  broadcastSupportEvent('conversation.created', {
    conversationId: newConv._id.toString(),
    ticketNumber,
    customerEmail,
    subject,
  });
  broadcastSupportEvent('notification.created', {
    type: 'new_ticket',
    ticketNumber,
    title: `New Email Ticket ${ticketNumber}`,
  });

  return {
    status: 'created',
    ticketNumber,
    conversationId: newConv._id.toString(),
  };
}

/**
 * Single-shot polling routine
 */
export async function pollInboundEmailsOnce() {
  if (isPolling) {
    logger.info('[SupportEmailWorker] Poll cycle already active. Skipping overlapping run.');
    return { status: 'already_running', processed: 0, details: [] };
  }

  const client = getImapClient();
  if (!client) {
    logger.warn('[SupportEmailWorker] IMAP credentials not configured. Skipping inbound poll.');
    return { status: 'skipped', reason: 'no_credentials', processed: 0, details: [] };
  }

  isPolling = true;
  let lock = null;
  let processedCount = 0;
  const outcomes = [];

  try {
    const host = process.env.IMAP_HOST || 'imap.gmail.com';
    const port = parseInt(process.env.IMAP_PORT || '993', 10);
    const user = process.env.IMAP_USER || process.env.EMAIL_USER;

    await client.connect();
    logger.info(`[SupportEmailWorker] IMAP connected to ${host}:${port} (${user})`);

    lock = await client.getMailboxLock('INBOX');

    // 1. UID & UIDVALIDITY tracking from Setting model
    const currentValidity = client.mailbox?.uidValidity ? String(client.mailbox.uidValidity) : null;
    let storedValidity = await Setting.getSetting('imap_uidvalidity', null);
    let lastProcessedUid = 0;

    if (storedValidity && currentValidity && String(storedValidity) === currentValidity) {
      lastProcessedUid = Number(await Setting.getSetting('imap_last_uid', 0)) || 0;
    } else if (currentValidity) {
      logger.info(`[SupportEmailWorker] Mailbox UIDVALIDITY initialized to ${currentValidity}`);
      await Setting.setSetting('imap_uidvalidity', currentValidity, 'IMAP mailbox UIDVALIDITY');
      // On first run / validity reset: check unseen messages or start from current max UID
      const allUids = await client.search({ all: true }, { uid: true });
      const maxUid = allUids.length > 0 ? Math.max(...allUids) : 0;
      const unseenUids = await client.search({ seen: false }, { uid: true });
      if (unseenUids.length > 0) {
        lastProcessedUid = Math.max(0, Math.min(...unseenUids) - 1);
      } else {
        lastProcessedUid = maxUid;
      }
      await Setting.setSetting('imap_last_uid', lastProcessedUid, 'Last processed IMAP UID');
    }

    // 2. Collect candidate UIDs (DO NOT run commands inside fetch loop)
    const newUidSearch = lastProcessedUid > 0 ? `${lastProcessedUid + 1}:*` : '1:*';
    const [uidsByRange, unseenUids] = await Promise.all([
      client.search({ uid: newUidSearch }, { uid: true }),
      client.search({ seen: false }, { uid: true }),
    ]);

    const candidateUids = Array.from(new Set([...uidsByRange, ...unseenUids]))
      .filter(uid => uid > lastProcessedUid || unseenUids.includes(uid))
      .sort((a, b) => a - b);

    if (candidateUids.length === 0) {
      logger.info(`[SupportEmailWorker] No new messages to process (lastProcessedUid: ${lastProcessedUid})`);
      return { status: 'success', processed: 0, details: [] };
    }

    logger.info(`[SupportEmailWorker] Found ${candidateUids.length} candidate message(s) to process: [${candidateUids.join(', ')}]`);

    // 3. Process each message sequentially with await
    for (const uid of candidateUids) {
      let outcome = { uid, status: 'unknown' };
      try {
        // Fetch complete message source as Buffer (RFC822 source)
        const msg = await client.fetchOne(uid, { source: true, uid: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) {
          logger.warn(`[SupportEmailWorker] Message UID ${uid} returned no source content. Skipping.`);
          outcome = { uid, status: 'skipped', reason: 'empty_source' };
          outcomes.push(outcome);
          continue;
        }

        const parsed = await simpleParser(msg.source);
        const result = await processInboundEmail(parsed, uid);

        // Mark as seen on IMAP server
        try {
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } catch (flagErr) {
          logger.warn(`[SupportEmailWorker] Could not set \\Seen flag for UID ${uid}: ${flagErr.message}`);
        }

        // Successfully processed: advance lastProcessedUid
        if (uid > lastProcessedUid) {
          lastProcessedUid = uid;
          await Setting.setSetting('imap_last_uid', lastProcessedUid, 'Last processed IMAP UID');
        }

        processedCount++;
        outcome = { uid, status: result.status, reason: result.reason, ticketNumber: result.ticketNumber };
        outcomes.push(outcome);
      } catch (msgErr) {
        logger.error(`[SupportEmailWorker] Error processing message UID ${uid}: ${msgErr.message}`);
        outcome = { uid, status: 'failed', error: msgErr.message };
        outcomes.push(outcome);
        // Do not advance lastProcessedUid past this failed message so it can be retried on next poll!
      }
    }
  } catch (err) {
    logger.error(`[SupportEmailWorker] IMAP polling connection failed: ${err.message}`);
    return { status: 'error', error: err.message, processed: processedCount, details: outcomes };
  } finally {
    if (lock) {
      try {
        lock.release();
      } catch (lockErr) {
        logger.debug(`[SupportEmailWorker] Mailbox lock release notice: ${lockErr.message}`);
      }
    }

    try {
      if (client.usable) {
        await client.logout();
      } else {
        client.close();
      }
    } catch (logoutErr) {
      logger.debug(`[SupportEmailWorker] IMAP logout notice: ${logoutErr.message}`);
    }

    isPolling = false;
  }

  return { status: 'success', processed: processedCount, details: outcomes };
}

/**
 * Schedule next poll cycle with exponential backoff on connection failure
 */
function scheduleNext(delayMs) {
  if (isWorkerStopped) return;
  if (workerTimer) clearTimeout(workerTimer);

  workerTimer = setTimeout(async () => {
    try {
      const res = await pollInboundEmailsOnce();
      if (res.status === 'error') {
        consecutiveFailures++;
        const backoffMs = BACKOFF_DELAYS[Math.min(consecutiveFailures - 1, BACKOFF_DELAYS.length - 1)];
        logger.warn(`[SupportEmailWorker] Retrying IMAP poll after error in ${backoffMs / 1000}s (failure #${consecutiveFailures})`);
        scheduleNext(backoffMs);
      } else {
        consecutiveFailures = 0;
        scheduleNext(normalInterval);
      }
    } catch (err) {
      consecutiveFailures++;
      const backoffMs = BACKOFF_DELAYS[Math.min(consecutiveFailures - 1, BACKOFF_DELAYS.length - 1)];
      logger.warn(`[SupportEmailWorker] Unexpected poll error. Retrying in ${backoffMs / 1000}s: ${err.message}`);
      scheduleNext(backoffMs);
    }
  }, delayMs);
}

/**
 * Start periodic polling worker (with recursive setTimeout and backoff)
 */
export function startSupportEmailWorker(intervalMs = 60000) {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[SupportEmailWorker] Periodic polling disabled in test environment');
    return;
  }

  const user = process.env.IMAP_USER || process.env.EMAIL_USER;
  const pass = process.env.IMAP_PASS || process.env.EMAIL_PASS;
  if (!user || !pass) {
    logger.info('[SupportEmailWorker] IMAP credentials missing. Inbound email polling worker is idle.');
    return;
  }

  normalInterval = intervalMs;
  isWorkerStopped = false;
  consecutiveFailures = 0;

  logger.info(`[SupportEmailWorker] Starting support email worker (polling every ${intervalMs / 1000}s)`);

  // Initial poll after 3 seconds
  scheduleNext(3000);
}

/**
 * Stop polling worker cleanly
 */
export function stopSupportEmailWorker() {
  isWorkerStopped = true;
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
    logger.info('[SupportEmailWorker] Stopped support email worker');
  }
}
