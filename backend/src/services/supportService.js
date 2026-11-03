import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import { sendEmail } from './emailService.js';
import { emailQueue } from '../queues/emailQueue.js';
import { cleanEmailReplyBody } from '../workers/supportEmailWorker.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import { broadcastSupportEvent } from './supportEventService.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

// Format date helpers
function formatSince(date) {
  if (!date) return '2025';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRelativeTime(date) {
  if (!date) return 'Just now';
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function formatMessageTimestamp(senderName, date) {
  if (!date) return `${senderName} · Just now`;
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const timeStr = `${formattedHours}:${minutes} ${ampm}`;

  if (isToday) return `${senderName} · ${timeStr}`;
  if (isYesterday) return `${senderName} · Yesterday ${timeStr}`;
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${senderName} · ${diffDays} days ago`;
  return `${senderName} · ${d.toLocaleDateString()}`;
}

// Generate unique ticket number: NS-T-XXXX
export async function generateTicketNumber() {
  const latest = await Conversation.findOne({ ticketNumber: /^NS-T-\d+$/ })
    .sort({ createdAt: -1 })
    .select('ticketNumber');

  if (latest && latest.ticketNumber) {
    const match = latest.ticketNumber.match(/^NS-T-(\d+)$/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `NS-T-${nextNum}`;
    }
  }

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `NS-T-${Date.now().toString().slice(-4)}${randomSuffix}`;
}

/**
 * Format conversation doc into frontend UI format
 */
export function formatConversationForUI(conv, messages = []) {
  const avatar = conv.customerAvatar || (
    conv.customerName
      ? conv.customerName.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
      : 'CU'
  );

  const formattedMessages = messages.map(m => ({
    id: m._id.toString(),
    sender: m.senderName,
    type: m.type === 'internal_note' ? 'internal_note' : (m.senderType === 'admin' ? 'admin' : 'customer'),
    senderType: m.senderType,
    direction: m.direction || (m.senderType === 'customer' ? 'inbound' : 'outbound'),
    content: cleanEmailReplyBody(m.body),
    bodyHtml: m.bodyHtml || '',
    timestamp: formatMessageTimestamp(m.senderName, m.createdAt),
    createdAt: m.createdAt,
    attachments: (m.attachments || []).map(a => ({
      id: a._id ? a._id.toString() : undefined,
      url: a.url,
      filename: a.filename || 'attachment',
      mimeType: a.mimeType,
      size: a.size,
    })),
    deliveryStatus: m.deliveryStatus || 'none',
    error: m.error || '',
  }));

  const cleanPreview = cleanEmailReplyBody(
    conv.lastMessagePreview || (messages.length > 0 ? messages[messages.length - 1].body : '')
  );

  // Normalize status casing: Capitalized for UI consistency (Open, Replied, Resolved)
  const normStatus = conv.status ? conv.status.charAt(0).toUpperCase() + conv.status.slice(1).toLowerCase() : 'Open';

  return {
    id: conv._id.toString(),
    ticketNumber: conv.ticketNumber,
    customer: {
      id: conv.customer?._id?.toString() || (conv.customer ? conv.customer.toString() : ''),
      name: conv.customerName,
      email: conv.customerEmail,
      phone: conv.customer?.phone || '',
      avatar,
      since: conv.customer?.createdAt ? formatSince(conv.customer.createdAt) : formatSince(conv.createdAt),
      recentOrder: conv.linkedOrderNumber ? (conv.linkedOrderNumber.startsWith('#') ? conv.linkedOrderNumber : `#${conv.linkedOrderNumber}`) : '-',
      orderStatus: conv.linkedOrderStatus || '-',
    },
    subject: conv.subject,
    preview: cleanPreview ? cleanPreview.slice(0, 140) : '',
    timestamp: formatRelativeTime(conv.lastMessageAt || conv.createdAt),
    status: normStatus,
    priority: conv.priority || 'normal',
    unread: !!conv.unreadForAdmin,
    isUnreadForAdmin: !!conv.unreadForAdmin,
    assignedTo: conv.assignedToName || 'Unassigned',
    assigneeId: conv.assignedTo?.toString() || null,
    topic: conv.topic || 'General',
    channel: conv.channel || 'web_form',
    source: conv.channel || 'web_form',
    firstResponseAt: conv.firstResponseAt,
    resolvedAt: conv.resolvedAt,
    isArchived: !!conv.isArchived,
    isSpam: !!conv.isSpam,
    messages: formattedMessages,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

/**
 * Get conversations for admin with full filtering, searching, and tab counts
 */
export async function getAdminConversations({
  status,
  topic,
  assignedTo,
  dateRange,
  unreadOnly,
  unread,
  search,
  q,
  page = 1,
  limit = 50,
}) {
  const filter = { isArchived: { $ne: true }, isSpam: { $ne: true } };

  // Status filtering (support both capitalized and lowercase)
  const effectiveStatus = status;
  if (effectiveStatus && effectiveStatus !== 'All' && effectiveStatus !== 'all') {
    const capitalized = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1).toLowerCase();
    filter.status = { $in: [capitalized, effectiveStatus.toLowerCase()] };
  }

  // Topic filtering
  if (topic && topic !== 'All Topics' && topic !== 'all') {
    filter.topic = new RegExp(`^${topic}$`, 'i');
  }

  // Assignee filtering
  if (assignedTo && assignedTo !== 'All Assignees' && assignedTo !== 'all') {
    if (assignedTo === 'Unassigned') {
      filter.$or = [{ assignedTo: null }, { assignedToName: 'Unassigned' }];
    } else if (assignedTo.match(/^[0-9a-fA-F]{24}$/)) {
      filter.assignedTo = assignedTo;
    } else {
      filter.assignedToName = assignedTo;
    }
  }

  // Unread filter
  const isUnreadFilter = unreadOnly === true || unreadOnly === 'true' || unread === true || unread === 'true';
  if (isUnreadFilter) {
    filter.unreadForAdmin = true;
  }

  // Date filtering
  const now = new Date();
  if (dateRange === 'Today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filter.lastMessageAt = { $gte: startOfToday };
  } else if (dateRange === 'Yesterday') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    filter.lastMessageAt = { $gte: startOfYesterday, $lt: startOfToday };
  } else if (dateRange === 'Last 7 days' || dateRange === '7d') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filter.lastMessageAt = { $gte: sevenDaysAgo };
  }

  // Search filter across customer name, email, subject, order, ticket number, message preview or message body
  const searchQuery = (search || q || '').trim();
  if (searchQuery) {
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Also find matching messages by body text
    const matchingMsgs = await Message.find({ body: regex }).distinct('conversation');

    const searchConditions = [
      { customerName: regex },
      { customerEmail: regex },
      { subject: regex },
      { linkedOrderNumber: regex },
      { ticketNumber: regex },
      { lastMessagePreview: regex },
    ];

    if (matchingMsgs.length > 0) {
      searchConditions.push({ _id: { $in: matchingMsgs } });
    }

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  // Tab counts query (ignoring status filter, but keeping other active filters)
  const baseCountFilter = { ...filter };
  delete baseCountFilter.status;

  const [allCount, openCount, repliedCount, resolvedCount, totalFiltered, conversations] = await Promise.all([
    Conversation.countDocuments(baseCountFilter),
    Conversation.countDocuments({ ...baseCountFilter, status: { $in: ['Open', 'open'] } }),
    Conversation.countDocuments({ ...baseCountFilter, status: { $in: ['Replied', 'replied'] } }),
    Conversation.countDocuments({ ...baseCountFilter, status: { $in: ['Resolved', 'resolved'] } }),
    Conversation.countDocuments(filter),
    Conversation.find(filter)
      .populate('customer', 'name email phone createdAt')
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Number(limit))
      .limit(Number(limit)),
  ]);

  // Load messages for each returned conversation
  const convIds = conversations.map(c => c._id);
  const allMessages = await Message.find({ conversation: { $in: convIds } })
    .sort({ createdAt: 1 });

  const messagesByConv = {};
  for (const msg of allMessages) {
    const cId = msg.conversation.toString();
    if (!messagesByConv[cId]) messagesByConv[cId] = [];
    messagesByConv[cId].push(msg);
  }

  const items = conversations.map(conv =>
    formatConversationForUI(conv, messagesByConv[conv._id.toString()] || [])
  );

  return {
    items,
    data: items,
    counts: {
      all: allCount,
      open: openCount,
      replied: repliedCount,
      resolved: resolvedCount,
    },
    total: totalFiltered,
    page: Number(page),
    limit: Number(limit),
  };
}

/**
 * Get single conversation detail for admin (includes customer orders, lifetime value, past tickets)
 */
export async function getAdminConversationById(id) {
  const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { ticketNumber: id };
  const conv = await Conversation.findOne(query).populate('customer', 'name email phone createdAt');

  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  const messages = await Message.find({ conversation: conv._id }).sort({ createdAt: 1 });

  // 1. Linked Order Details
  let orderInfo = null;
  if (conv.linkedOrder) {
    orderInfo = await Order.findById(conv.linkedOrder).select('orderNumber status orderStatus totalAmount totalPrice createdAt isPaid paymentStatus items shippingAddress');
  } else if (conv.linkedOrderNumber) {
    const cleanNum = conv.linkedOrderNumber.replace('#', '');
    orderInfo = await Order.findOne({ orderNumber: cleanNum }).select('orderNumber status orderStatus totalAmount totalPrice createdAt isPaid paymentStatus items shippingAddress');
  }

  // 2. Customer Profile, Lifetime Value (LTV), & Past Orders
  let customerOrdersCount = 0;
  let customerLTV = 0;
  let recentOrders = [];
  let pastTickets = [];

  const customerId = conv.customer?._id;
  const customerEmail = conv.customerEmail ? conv.customerEmail.toLowerCase().trim() : null;

  const orderQuery = customerId
    ? { $or: [{ user: customerId }, { customerEmail }] }
    : { customerEmail };

  if (customerEmail || customerId) {
    const customerOrders = await Order.find(orderQuery)
      .sort({ createdAt: -1 })
      .select('orderNumber totalAmount totalPrice status orderStatus createdAt isPaid paymentStatus items')
      .limit(5);

    customerOrdersCount = await Order.countDocuments(orderQuery);

    recentOrders = customerOrders.map(o => ({
      id: o._id.toString(),
      orderNumber: `#${o.orderNumber}`,
      date: o.createdAt ? o.createdAt.toLocaleDateString() : 'Recent',
      amount: `$${(o.totalPrice || o.totalAmount || 0).toFixed(2)}`,
      status: o.status || o.orderStatus || 'Processing',
      itemCount: o.items ? o.items.length : 1,
    }));

    // Calculate LTV from all paid or fulfilled orders
    const paidOrders = await Order.find({ ...orderQuery, $or: [{ isPaid: true }, { paymentStatus: 'completed' }] })
      .select('totalPrice totalAmount');
    customerLTV = paidOrders.reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);

    // Past support tickets
    const pastConvs = await Conversation.find({
      _id: { $ne: conv._id },
      $or: [
        ...(customerId ? [{ customer: customerId }] : []),
        { customerEmail },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('ticketNumber subject status topic createdAt lastMessageAt');

    pastTickets = pastConvs.map(t => ({
      id: t._id.toString(),
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      status: t.status,
      topic: t.topic,
      date: t.createdAt ? t.createdAt.toLocaleDateString() : '',
    }));
  }

  const formatted = formatConversationForUI(conv, messages);

  if (orderInfo) {
    const rawSt = orderInfo.status || orderInfo.orderStatus || formatted.customer.orderStatus;
    formatted.customer.orderStatus = rawSt ? (rawSt.charAt(0).toUpperCase() + rawSt.slice(1)) : formatted.customer.orderStatus;
    formatted.customer.recentOrder = `#${orderInfo.orderNumber}`;
    formatted.orderDetails = {
      id: orderInfo._id.toString(),
      orderNumber: `#${orderInfo.orderNumber}`,
      status: orderInfo.status || orderInfo.orderStatus,
      totalAmount: orderInfo.totalPrice || orderInfo.totalAmount,
      date: orderInfo.createdAt,
      items: orderInfo.items || [],
    };
  }

  formatted.customerDetails = {
    id: formatted.customer.id,
    name: formatted.customer.name,
    email: formatted.customer.email,
    phone: formatted.customer.phone || '—',
    avatar: formatted.customer.avatar,
    memberSince: formatted.customer.since,
    ordersCount: customerOrdersCount,
    lifetimeValue: `$${customerLTV.toFixed(2)}`,
    recentOrders,
    pastTickets,
  };

  return formatted;
}

/**
 * Support stats KPI aggregation
 */
export async function getSupportStats(range = '7d') {
  const now = new Date();
  const days = range === '30d' ? 30 : 7;
  const rangeMs = days * 24 * 60 * 60 * 1000;
  const currentPeriodStart = new Date(now.getTime() - rangeMs);
  const priorPeriodStart = new Date(now.getTime() - 2 * rangeMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Open count & trend
  const openCount = await Conversation.countDocuments({ status: { $in: ['Open', 'open'] }, isArchived: { $ne: true } });
  const openCreatedThisWeek = await Conversation.countDocuments({
    status: { $in: ['Open', 'open'] },
    createdAt: { $gte: currentPeriodStart },
    isArchived: { $ne: true },
  });
  const openCreatedPriorWeek = await Conversation.countDocuments({
    status: { $in: ['Open', 'open'] },
    createdAt: { $gte: priorPeriodStart, $lt: currentPeriodStart },
    isArchived: { $ne: true },
  });
  const openDelta = openCreatedThisWeek - openCreatedPriorWeek;
  const openSubtext = openDelta >= 0 ? `+${openDelta} this week` : `${openDelta} this week`;

  // 2. Unread count & trend
  const unreadCount = await Conversation.countDocuments({ unreadForAdmin: true, isArchived: { $ne: true } });
  const unreadToday = await Conversation.countDocuments({
    unreadForAdmin: true,
    lastMessageAt: { $gte: startOfToday },
    isArchived: { $ne: true },
  });
  const unreadSubtext = `+${unreadToday} today`;

  // 3. Avg First Response time
  const respondedConvs = await Conversation.find({
    firstResponseAt: { $ne: null, $gte: currentPeriodStart },
    isArchived: { $ne: true },
  }).select('createdAt firstResponseAt');

  let avgHours = 0;
  if (respondedConvs.length > 0) {
    const totalDiffHours = respondedConvs.reduce((acc, c) => {
      const diffHours = (new Date(c.firstResponseAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
      return acc + Math.max(0.05, diffHours);
    }, 0);
    avgHours = totalDiffHours / respondedConvs.length;
  } else {
    // Check all-time responded conversations for baseline
    const allResponded = await Conversation.find({ firstResponseAt: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('createdAt firstResponseAt');
    if (allResponded.length > 0) {
      const totalDiffHours = allResponded.reduce((acc, c) => {
        const diffHours = (new Date(c.firstResponseAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
        return acc + Math.max(0.05, diffHours);
      }, 0);
      avgHours = totalDiffHours / allResponded.length;
    } else {
      avgHours = 0;
    }
  }

  // Prior period avg for trend
  const priorResponded = await Conversation.find({
    firstResponseAt: { $ne: null, $gte: priorPeriodStart, $lt: currentPeriodStart },
    isArchived: { $ne: true },
  }).select('createdAt firstResponseAt');

  let priorAvgHours = avgHours;
  if (priorResponded.length > 0) {
    priorAvgHours = priorResponded.reduce((acc, c) => {
      return acc + Math.max(0.05, (new Date(c.firstResponseAt) - new Date(c.createdAt)) / (1000 * 60 * 60));
    }, 0) / priorResponded.length;
  }
  const avgDelta = Number((avgHours - priorAvgHours).toFixed(1));
  const avgSubtext = avgHours === 0 ? '—' : (avgDelta <= 0 ? `${avgDelta} h` : `+${avgDelta} h`);

  // 4. Resolved this week
  const resolvedThisWeek = await Conversation.countDocuments({
    status: { $in: ['Resolved', 'resolved'] },
    resolvedAt: { $gte: currentPeriodStart },
    isArchived: { $ne: true },
  });
  const resolvedPriorWeek = await Conversation.countDocuments({
    status: { $in: ['Resolved', 'resolved'] },
    resolvedAt: { $gte: priorPeriodStart, $lt: currentPeriodStart },
    isArchived: { $ne: true },
  });
  let resolvedTrendPct = 0;
  let resolvedSubtext = '—';
  if (resolvedPriorWeek > 0) {
    resolvedTrendPct = Math.round(((resolvedThisWeek - resolvedPriorWeek) / resolvedPriorWeek) * 100);
    resolvedSubtext = resolvedTrendPct >= 0 ? `+${resolvedTrendPct}%` : `${resolvedTrendPct}%`;
  } else if (resolvedThisWeek > 0) {
    resolvedSubtext = `+${resolvedThisWeek}`;
  }

  return {
    open: {
      value: openCount,
      subtext: openSubtext,
    },
    unread: {
      value: unreadCount,
      subtext: unreadSubtext,
    },
    avgFirstResponse: {
      value: avgHours > 0 ? `${avgHours.toFixed(1)} h` : '—',
      subtext: avgSubtext,
    },
    resolvedThisWeek: {
      value: resolvedThisWeek,
      subtext: resolvedSubtext,
    },
  };
}

/**
 * Admin initiates a new conversation / email to a customer
 */
export async function createAdminConversation(adminUser, {
  customerEmail,
  customerName,
  subject,
  topic = 'General',
  message,
  priority = 'normal',
  relatedOrder,
  attachments = [],
}) {
  if (!customerEmail || !customerEmail.trim()) {
    throw new ApiError(400, 'Customer email is required');
  }
  if (!subject || !subject.trim()) {
    throw new ApiError(400, 'Subject is required');
  }
  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message body cannot be empty');
  }

  const normalizedEmail = customerEmail.trim().toLowerCase();
  const ticketNumber = await generateTicketNumber();

  // Link customer user if exists
  const existingUser = await User.findOne({ email: normalizedEmail });

  // Link order if provided
  let linkedOrder = null;
  let linkedOrderNumber = '';
  let linkedOrderStatus = '';
  if (relatedOrder) {
    const cleanNum = String(relatedOrder).replace('#', '').trim();
    linkedOrder = await Order.findOne({
      $or: [{ _id: cleanNum.match(/^[0-9a-fA-F]{24}$/) ? cleanNum : null }, { orderNumber: cleanNum }],
    });
    if (linkedOrder) {
      linkedOrderNumber = `#${linkedOrder.orderNumber}`;
      linkedOrderStatus = linkedOrder.status || linkedOrder.orderStatus || 'Processing';
    }
  }

  const conv = await Conversation.create({
    ticketNumber,
    subject: subject.trim(),
    topic,
    status: 'Replied',
    priority,
    customer: existingUser?._id || null,
    customerName: customerName ? customerName.trim() : (existingUser?.name || normalizedEmail.split('@')[0]),
    customerEmail: normalizedEmail,
    linkedOrder: linkedOrder?._id || null,
    linkedOrderNumber,
    linkedOrderStatus,
    assignedTo: adminUser?._id || null,
    assignedToName: adminUser?.name || 'Admin',
    channel: 'admin',
    unreadForAdmin: false,
    unreadForCustomer: true,
    lastMessageAt: new Date(),
    lastMessagePreview: message.trim().slice(0, 160),
    firstResponseAt: new Date(),
  });

  const msgDoc = await Message.create({
    conversation: conv._id,
    senderType: 'admin',
    sender: adminUser?._id || null,
    senderName: adminUser?.name || 'NovaShop Support',
    body: message.trim(),
    bodyHtml: sanitizeHtml(message.trim()),
    direction: 'outbound',
    type: 'reply',
    channel: 'web',
    deliveryStatus: 'queued',
    attachments,
  });

  // Outbound email dispatch
  await dispatchOutboundEmail({
    conversation: conv,
    message: msgDoc,
    recipientEmail: normalizedEmail,
    recipientName: conv.customerName,
    content: message.trim(),
  });

  broadcastSupportEvent('conversation.created', { conversationId: conv._id.toString() });

  return formatConversationForUI(conv, [msgDoc]);
}

/**
 * Send admin reply to customer via email and append to conversation
 */
export async function sendAdminReply(conversationId, adminUser, {
  content,
  body,
  attachments = [],
  resolveAfterSending = false,
}) {
  const replyText = (content || body || '').trim();
  if (!replyText) {
    throw new ApiError(400, 'Reply content cannot be empty');
  }

  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Create message doc
  const msgDoc = await Message.create({
    conversation: conv._id,
    senderType: 'admin',
    sender: adminUser?._id || null,
    senderName: adminUser?.name || 'NovaShop Support',
    body: replyText,
    bodyHtml: sanitizeHtml(replyText),
    direction: 'outbound',
    type: 'reply',
    channel: 'web',
    deliveryStatus: 'queued',
    attachments,
  });

  // Update conversation status
  const nextStatus = resolveAfterSending ? 'Resolved' : 'Replied';
  const updates = {
    status: nextStatus,
    unreadForAdmin: false,
    unreadForCustomer: true,
    lastMessageAt: new Date(),
    lastMessagePreview: replyText.slice(0, 160),
  };

  if (!conv.firstResponseAt) {
    updates.firstResponseAt = new Date();
  }
  if (resolveAfterSending) {
    updates.resolvedAt = new Date();
  }

  const updatedConv = await Conversation.findByIdAndUpdate(conv._id, updates, { returnDocument: 'after' });

  // Outbound email dispatch
  await dispatchOutboundEmail({
    conversation: updatedConv,
    message: msgDoc,
    recipientEmail: conv.customerEmail,
    recipientName: conv.customerName,
    content: replyText,
  });

  broadcastSupportEvent('message.created', {
    conversationId: conv._id.toString(),
    messageId: msgDoc._id.toString(),
  });
  broadcastSupportEvent('conversation.updated', {
    conversationId: conv._id.toString(),
    status: nextStatus,
  });

  return formatConversationForUI(
    updatedConv,
    await Message.find({ conversation: conv._id }).sort({ createdAt: 1 })
  );
}

/**
 * Dispatches outbound email to customer with RFC 2822 threading headers
 */
async function dispatchOutboundEmail({ conversation, message, recipientEmail, recipientName, content }) {
  const supportEmail = process.env.EMAIL_USER || 'support@novashop.com';
  const emailSubject = `NovaShop Support: [${conversation.ticketNumber}] ${conversation.subject}`;
  const domain = (process.env.EMAIL_HOST || 'novashop.com').replace(/^smtp\./i, '');
  const outboundMessageId = `<support-${conversation._id.toString()}-${message._id.toString()}@${domain}>`;

  const inReplyTo = conversation.emailThreadId || (conversation.emailMessageIds && conversation.emailMessageIds.length > 0 ? conversation.emailMessageIds[conversation.emailMessageIds.length - 1] : undefined);
  const references = conversation.emailMessageIds && conversation.emailMessageIds.length > 0 ? conversation.emailMessageIds : (inReplyTo ? [inReplyTo] : undefined);

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #231E1B; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <div style="border-bottom: 2px solid #231E1B; padding-bottom: 12px; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0; color: #231E1B;">NovaShop Customer Support</h2>
        <span style="font-size: 12px; color: #7A726C; text-transform: uppercase; letter-spacing: 0.1em;">Ticket ${conversation.ticketNumber}</span>
      </div>

      <p style="font-size: 15px; margin-bottom: 16px;">Hello ${recipientName || 'Customer'},</p>

      <div style="background: #FAF7F2; border-left: 3px solid #231E1B; padding: 16px 20px; margin-bottom: 24px; font-size: 15px; white-space: pre-wrap; color: #231E1B;">${content}</div>

      <div style="font-size: 12px; color: #7A726C; border-top: 1px solid #EAE5DE; padding-top: 16px; margin-top: 32px;">
        <p style="margin: 0 0 4px;">You can reply directly to this email to continue the conversation.</p>
        <p style="margin: 0;">NovaShop Customer Care · ${supportEmail}</p>
      </div>
    </div>
  `;

  const jobPayload = {
    to: recipientEmail,
    subject: emailSubject,
    html: emailHtml,
    text: content,
    messageDocId: message._id.toString(),
    conversationId: conversation._id.toString(),
    inReplyTo,
    references,
    headers: {
      'Message-ID': outboundMessageId,
      'X-NovaShop-Ticket': conversation.ticketNumber,
    },
  };

  // Try queueing via BullMQ; fallback to direct sendEmail if Redis unavailable or in test mode
  let queued = false;
  if (process.env.NODE_ENV !== 'test') {
    try {
      await emailQueue.add('sendSupportEmail', jobPayload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      });
      queued = true;
    } catch (qErr) {
      logger.warn(`[SupportService] Redis email queue failed, falling back to direct delivery: ${qErr.message}`);
    }
  }

  if (!queued) {
    try {
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: content,
        type: 'support_reply',
        statusCategory: 'order',
        inReplyTo,
        references,
        headers: jobPayload.headers,
      });

      await Message.findByIdAndUpdate(message._id, {
        deliveryStatus: emailResult?.success ? 'sent' : 'failed',
        error: emailResult?.error || '',
        'emailHeaders.messageId': emailResult?.messageId || outboundMessageId,
        emailMessageId: emailResult?.messageId || outboundMessageId,
      });
    } catch (err) {
      logger.error(`[SupportService] Failed direct reply email delivery to ${recipientEmail}: ${err.message}`);
      await Message.findByIdAndUpdate(message._id, {
        deliveryStatus: 'failed',
        error: err.message,
      });
    }
  }
}

/**
 * Add internal note to conversation (admin-only, NEVER emailed to customer, NEVER exposed to customer API)
 */
export async function addInternalNote(conversationId, adminUser, { content, body }) {
  const noteText = (content || body || '').trim();
  if (!noteText) {
    throw new ApiError(400, 'Note content cannot be empty');
  }

  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  const msgDoc = await Message.create({
    conversation: conv._id,
    senderType: 'admin',
    sender: adminUser?._id || null,
    senderName: adminUser?.name || 'Admin',
    body: noteText,
    bodyHtml: sanitizeHtml(noteText),
    direction: 'outbound',
    type: 'internal_note',
    channel: 'web',
  });

  broadcastSupportEvent('message.created', {
    conversationId: conv._id.toString(),
    messageId: msgDoc._id.toString(),
    type: 'internal_note',
  });

  return formatConversationForUI(
    conv,
    await Message.find({ conversation: conv._id }).sort({ createdAt: 1 })
  );
}

/**
 * Update conversation status (Open, Replied, Resolved)
 */
export async function updateConversationStatus(conversationId, status) {
  const allowed = ['Open', 'Replied', 'Resolved', 'open', 'replied', 'resolved'];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Invalid status: ${status}`);
  }

  const normStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const updates = { status: normStatus };

  if (normStatus === 'Resolved') {
    updates.resolvedAt = new Date();
    updates.unreadForAdmin = false;
  } else if (normStatus === 'Open') {
    updates.resolvedAt = null;
  }

  const conv = await Conversation.findByIdAndUpdate(conversationId, updates, { returnDocument: 'after' });
  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  broadcastSupportEvent('conversation.updated', {
    conversationId: conv._id.toString(),
    status: normStatus,
  });

  return conv;
}

/**
 * Update conversation metadata (status, assignee, topic, priority)
 */
export async function patchConversation(conversationId, { status, assignee, assigneeId, topic, priority }) {
  const updates = {};

  if (status) {
    const norm = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    updates.status = norm;
    if (norm === 'Resolved') {
      updates.resolvedAt = new Date();
      updates.unreadForAdmin = false;
    } else if (norm === 'Open') {
      updates.resolvedAt = null;
    }
  }

  if (topic) {
    updates.topic = topic;
  }

  if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
    updates.priority = priority;
  }

  if (assignee !== undefined || assigneeId !== undefined) {
    const target = assigneeId || assignee;
    if (!target || target === 'Unassigned') {
      updates.assignedTo = null;
      updates.assignedToName = 'Unassigned';
    } else if (String(target).match(/^[0-9a-fA-F]{24}$/)) {
      const user = await User.findById(target).select('name email role');
      if (user) {
        updates.assignedTo = user._id;
        updates.assignedToName = user.name;
      }
    } else {
      updates.assignedToName = String(target);
    }
  }

  const conv = await Conversation.findByIdAndUpdate(conversationId, updates, { returnDocument: 'after' });
  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  broadcastSupportEvent('conversation.updated', {
    conversationId: conv._id.toString(),
    ...updates,
  });

  return conv;
}

/**
 * Assign conversation
 */
export async function assignConversation(conversationId, assignee) {
  return patchConversation(conversationId, { assignee });
}

/**
 * Mark conversation as unread / read
 */
export async function markConversationUnread(conversationId, unread = true) {
  const conv = await Conversation.findByIdAndUpdate(
    conversationId,
    { unreadForAdmin: Boolean(unread) },
    { returnDocument: 'after' }
  );
  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  broadcastSupportEvent('conversation.updated', {
    conversationId: conv._id.toString(),
    unread: Boolean(unread),
  });

  return conv;
}

/**
 * Soft delete or archive conversation / mark spam
 */
export async function archiveOrDeleteConversation(conversationId, action = 'archive') {
  const updates = {};
  if (action === 'spam') {
    updates.isSpam = true;
    updates.status = 'Resolved';
  } else if (action === 'delete') {
    updates.isArchived = true;
  } else {
    updates.isArchived = true;
  }

  const conv = await Conversation.findByIdAndUpdate(conversationId, updates, { returnDocument: 'after' });
  if (!conv) {
    throw new ApiError(404, 'Conversation not found');
  }

  broadcastSupportEvent('conversation.updated', {
    conversationId: conv._id.toString(),
    isArchived: conv.isArchived,
    isSpam: conv.isSpam,
  });

  return { message: `Conversation ${action}d successfully`, conversation: conv };
}

/**
 * Get available assignees for support dropdown
 */
export async function getAvailableAssignees() {
  const staff = await User.find({ role: { $in: ['admin', 'staff', 'owner'] } })
    .select('name email role')
    .sort({ name: 1 });

  return staff.map(u => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
  }));
}

/**
 * Export customer support data as CSV
 */
export async function exportSupportDataCsv() {
  const conversations = await Conversation.find({ isArchived: { $ne: true } }).sort({ createdAt: -1 });

  const headers = [
    'Ticket Number',
    'Customer Name',
    'Customer Email',
    'Subject',
    'Topic',
    'Priority',
    'Status',
    'Assigned To',
    'Recent Order',
    'Channel',
    'Created At',
    'First Response At',
    'Resolved At',
    'Last Message At',
  ];

  const rows = conversations.map(c => [
    `"${c.ticketNumber || ''}"`,
    `"${(c.customerName || '').replace(/"/g, '""')}"`,
    `"${(c.customerEmail || '').replace(/"/g, '""')}"`,
    `"${(c.subject || '').replace(/"/g, '""')}"`,
    `"${c.topic || ''}"`,
    `"${c.priority || 'normal'}"`,
    `"${c.status || ''}"`,
    `"${c.assignedToName || 'Unassigned'}"`,
    `"${c.linkedOrderNumber || ''}"`,
    `"${c.channel || ''}"`,
    `"${c.createdAt ? c.createdAt.toISOString() : ''}"`,
    `"${c.firstResponseAt ? c.firstResponseAt.toISOString() : ''}"`,
    `"${c.resolvedAt ? c.resolvedAt.toISOString() : ''}"`,
    `"${c.lastMessageAt ? c.lastMessageAt.toISOString() : ''}"`,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Create ticket from customer contact form (/help contact modal or public API)
 */
export async function createCustomerTicket({ name, email, order, message, topic = 'General', userId }) {
  if (!name || !name.trim()) throw new ApiError(400, 'Name is required');
  if (!email || !email.trim()) throw new ApiError(400, 'Email is required');
  if (!message || !message.trim()) throw new ApiError(400, 'Message is required');

  const normalizedEmail = email.trim().toLowerCase();
  const ticketNumber = await generateTicketNumber();

  let customerUser = null;
  if (userId) {
    customerUser = await User.findById(userId);
  }
  if (!customerUser) {
    customerUser = await User.findOne({ email: normalizedEmail });
  }

  let linkedOrder = null;
  let linkedOrderNumber = '';
  let linkedOrderStatus = '';

  const cleanOrderNum = (order || '').replace(/^#/, '').trim();
  if (cleanOrderNum) {
    linkedOrder = await Order.findOne({ orderNumber: cleanOrderNum });
    if (linkedOrder) {
      linkedOrderNumber = `#${linkedOrder.orderNumber}`;
      const rawSt = linkedOrder.status || linkedOrder.orderStatus || 'Processing';
      linkedOrderStatus = rawSt.charAt(0).toUpperCase() + rawSt.slice(1);
    } else {
      linkedOrderNumber = `#${cleanOrderNum}`;
    }
  } else if (customerUser) {
    const recent = await Order.findOne({ user: customerUser._id }).sort({ createdAt: -1 });
    if (recent) {
      linkedOrder = recent;
      linkedOrderNumber = `#${recent.orderNumber}`;
      const rawSt = recent.status || recent.orderStatus || 'Processing';
      linkedOrderStatus = rawSt.charAt(0).toUpperCase() + rawSt.slice(1);
    }
  }

  const subject = `${topic !== 'General' ? `[${topic}] ` : ''}Inquiry from ${name.trim()}`;

  const conv = await Conversation.create({
    ticketNumber,
    subject,
    topic,
    status: 'Open',
    priority: 'normal',
    customer: customerUser?._id || null,
    customerName: name.trim(),
    customerEmail: normalizedEmail,
    linkedOrder: linkedOrder?._id || null,
    linkedOrderNumber,
    linkedOrderStatus,
    channel: 'web_form',
    unreadForAdmin: true,
    unreadForCustomer: false,
    lastMessageAt: new Date(),
    lastMessagePreview: message.trim().slice(0, 160),
  });

  const msgDoc = await Message.create({
    conversation: conv._id,
    senderType: 'customer',
    sender: customerUser?._id || null,
    senderName: name.trim(),
    body: message.trim(),
    bodyHtml: sanitizeHtml(message.trim()),
    direction: 'inbound',
    type: 'reply',
    channel: 'web',
  });

  try {
    await AdminNotification.create({
      type: 'new_ticket',
      title: `New Ticket ${ticketNumber}`,
      message: `${name.trim()} submitted inquiry: "${message.trim().slice(0, 80)}"`,
      entityType: 'conversation',
      entityId: conv._id.toString(),
      link: `/admin/support?conversation=${conv._id.toString()}#message=${msgDoc._id.toString()}`,
      data: {
        ticketNumber,
        conversationId: conv._id.toString(),
        messageId: msgDoc._id.toString(),
        customerEmail: normalizedEmail,
        topic,
      },
    });
  } catch {
    // Non-fatal
  }

  broadcastSupportEvent('conversation.created', { conversationId: conv._id.toString() });

  return {
    ticketNumber,
    conversationId: conv._id.toString(),
    status: conv.status,
    customerName: conv.customerName,
  };
}

/**
 * Get tickets for authenticated customer (strictly excludes internal notes!)
 */
export async function getCustomerTickets(user) {
  if (!user) throw new ApiError(401, 'Authentication required');

  const convs = await Conversation.find({
    $or: [{ customer: user._id }, { customerEmail: user.email.toLowerCase().trim() }],
    isArchived: { $ne: true },
    isSpam: { $ne: true },
  }).sort({ lastMessageAt: -1 });

  const convIds = convs.map(c => c._id);
  // Strict security: customer NEVER sees internal_note
  const msgs = await Message.find({
    conversation: { $in: convIds },
    type: { $ne: 'internal_note' },
  }).sort({ createdAt: 1 });

  const msgsByConv = {};
  for (const m of msgs) {
    const id = m.conversation.toString();
    if (!msgsByConv[id]) msgsByConv[id] = [];
    msgsByConv[id].push(m);
  }

  return convs.map(c => formatConversationForUI(c, msgsByConv[c._id.toString()] || []));
}
