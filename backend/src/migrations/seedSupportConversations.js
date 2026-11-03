import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import logger from '../utils/logger.js';

export async function seedRealisticSupportConversations() {
  const existingCount = await Conversation.countDocuments();
  if (existingCount > 0) {
    logger.info(`[SupportSeed] Support conversations already exist (${existingCount} found). Skipping seed.`);
    return;
  }

  logger.info('[SupportSeed] Seeding realistic initial customer support conversations...');

  // Try to find registered users or create snapshots
  let user1 = await User.findOne({ role: 'customer' });
  if (!user1) {
    user1 = await User.create({
      name: 'Amelia Chen',
      email: 'amelia.chen@example.com',
      password: 'Password123!',
      role: 'customer',
    }).catch(() => null);
  }

  let adminUser = await User.findOne({ role: 'admin' });

  // Try to find a recent order
  const order1 = await Order.findOne();

  // Conversation 1: High Priority Return Request
  const conv1 = await Conversation.create({
    ticketNumber: 'NS-T-2041',
    subject: 'Return & Exchange sizing for Order #NS-2041',
    topic: 'Returns',
    status: 'Open',
    priority: 'high',
    customer: user1?._id || null,
    customerName: user1?.name || 'Amelia Chen',
    customerEmail: user1?.email || 'amelia.chen@example.com',
    linkedOrder: order1?._id || null,
    linkedOrderNumber: order1 ? `#${order1.orderNumber}` : '#NS-2041',
    linkedOrderStatus: order1 ? (order1.status || 'Delivered') : 'Delivered',
    channel: 'email',
    unreadForAdmin: true,
    unreadForCustomer: false,
    lastMessageAt: new Date(Date.now() - 35 * 60 * 1000), // 35 mins ago
    lastMessagePreview: 'Hi, I received my order yesterday but the coat size M is a bit too large. Can I exchange it for a size S?',
  });

  await Message.create({
    conversation: conv1._id,
    senderType: 'customer',
    sender: user1?._id || null,
    senderName: conv1.customerName,
    body: 'Hi, I received my order yesterday but the coat size M is a bit too large. Can I exchange it for a size S or request a return slip?',
    direction: 'inbound',
    type: 'reply',
    channel: 'email',
    createdAt: new Date(Date.now() - 35 * 60 * 1000),
  });

  // Conversation 2: Replied Shipping Inquiry
  const conv2 = await Conversation.create({
    ticketNumber: 'NS-T-2005',
    subject: 'Tracking update on expedited delivery',
    topic: 'Shipping',
    status: 'Replied',
    priority: 'normal',
    customerName: 'Marcus Vance',
    customerEmail: 'marcus.vance@example.com',
    channel: 'web_form',
    unreadForAdmin: false,
    unreadForCustomer: true,
    lastMessageAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
    firstResponseAt: new Date(Date.now() - 2 * 3600 * 1000),
    lastMessagePreview: 'Hello Marcus, we checked with DHL Express and your package cleared customs. Estimated delivery is tomorrow by 4 PM.',
  });

  await Message.create([
    {
      conversation: conv2._id,
      senderType: 'customer',
      senderName: 'Marcus Vance',
      body: 'Hello, the tracking number indicates departed transit facility 3 days ago. Could you verify if the delivery date is still Friday?',
      direction: 'inbound',
      type: 'reply',
      channel: 'web',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    {
      conversation: conv2._id,
      senderType: 'admin',
      sender: adminUser?._id || null,
      senderName: adminUser?.name || 'Support Staff',
      body: 'Hello Marcus, we checked with DHL Express and your package cleared customs. Estimated delivery is tomorrow by 4 PM. We will notify you when it is out for delivery.',
      direction: 'outbound',
      type: 'reply',
      channel: 'web',
      deliveryStatus: 'delivered',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
  ]);

  // Conversation 3: Resolved Payments / Tax Invoice
  const conv3 = await Conversation.create({
    ticketNumber: 'NS-T-1988',
    subject: 'VAT Invoice copy for accounting department',
    topic: 'Payments',
    status: 'Resolved',
    priority: 'low',
    customerName: 'Elena Rostova',
    customerEmail: 'elena.rostova@example.com',
    channel: 'email',
    unreadForAdmin: false,
    unreadForCustomer: false,
    lastMessageAt: new Date(Date.now() - 24 * 3600 * 1000),
    firstResponseAt: new Date(Date.now() - 26 * 3600 * 1000),
    resolvedAt: new Date(Date.now() - 23 * 3600 * 1000),
    lastMessagePreview: 'Thank you very much, the PDF invoice is exactly what we needed!',
  });

  await Message.create([
    {
      conversation: conv3._id,
      senderType: 'customer',
      senderName: 'Elena Rostova',
      body: 'Could you please email a formal VAT receipt for order #NS-1890 with company registration details?',
      direction: 'inbound',
      type: 'reply',
      channel: 'email',
      createdAt: new Date(Date.now() - 28 * 3600 * 1000),
    },
    {
      conversation: conv3._id,
      senderType: 'admin',
      sender: adminUser?._id || null,
      senderName: adminUser?.name || 'NovaShop Accounts',
      body: 'Hello Elena, please find the tax receipt attached with your VAT registration number included.',
      direction: 'outbound',
      type: 'reply',
      channel: 'email',
      deliveryStatus: 'sent',
      createdAt: new Date(Date.now() - 26 * 3600 * 1000),
    },
    {
      conversation: conv3._id,
      senderType: 'customer',
      senderName: 'Elena Rostova',
      body: 'Thank you very much, the PDF invoice is exactly what we needed!',
      direction: 'inbound',
      type: 'reply',
      channel: 'email',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  ]);

  logger.info('[SupportSeed] ✓ Successfully seeded 3 realistic support conversations (NS-T-2041, NS-T-2005, NS-T-1988)');
}
