import '../src/config/env.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Conversation from '../src/models/conversationModel.js';
import Message from '../src/models/messageModel.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';

const FAKE_NAMES = [
  'Amelia Chen',
  'James Okafor',
  'Sofia Rossi',
  'Lucas Meyer',
  'Priya Raman',
  'Hannah Becker',
  'Daniel Kim',
];

const FAKE_ORDER_NUMBERS = [
  '#SB-10482',
  '#SB-10483',
  '#SB-10484',
  '#SB-10485',
  '#SB-10486',
  '#SB-10487',
  '#SB-10488',
  '#NS-10482',
  '#NS-10483',
  '#NS-10484',
  '#NS-10485',
  '#NS-10486',
  '#NS-10487',
  '#NS-10488',
];

async function cleanupFakeSupport() {
  await connectDB();
  console.log('Connected to MongoDB for Fake Support Data Cleanup...');

  // 1. Find and delete fake conversations
  const fakeConversations = await Conversation.find({
    $or: [
      { customerName: { $in: FAKE_NAMES } },
      { customerEmail: { $regex: /@email\.com$/i } },
      { customerEmail: { $regex: /@example\.com$/i } },
      { linkedOrderNumber: { $in: FAKE_ORDER_NUMBERS } },
    ],
  });

  const fakeIds = fakeConversations.map(c => c._id);
  console.log(`Found ${fakeIds.length} fake/mock conversation(s) to remove.`);

  if (fakeIds.length > 0) {
    const deletedMessages = await Message.deleteMany({ conversation: { $in: fakeIds } });
    console.log(`Deleted ${deletedMessages.deletedCount} associated mock message(s).`);

    const deletedConvs = await Conversation.deleteMany({ _id: { $in: fakeIds } });
    console.log(`Deleted ${deletedConvs.deletedCount} mock conversation(s).`);
  }

  // 2. Check if real customers exist in DB to create real support tickets
  const realUsers = await User.find({ role: 'customer' }).sort({ createdAt: 1 });
  console.log(`\nFound ${realUsers.length} real customer(s) in database.`);

  const existingRealConvs = await Conversation.countDocuments();
  if (existingRealConvs === 0 && realUsers.length > 0) {
    console.log('Generating real support inquiries linked to actual database customers and orders...');

    // Fetch real orders
    const firaTestUser = realUsers.find(u => u.email === 'firatest@gmail.com') || realUsers[0];
    const firaDevUser = realUsers.find(u => u.email === 'firaolsiraj17@gmail.com') || realUsers[1] || realUsers[0];
    const firaDev2User = realUsers.find(u => u.email === 'firaolsiraj999@gmail.com') || realUsers[2] || realUsers[0];
    const firaolSirajUser = realUsers.find(u => u.email === 'firaolsiraj99@gmail.com') || realUsers[3] || realUsers[0];

    const orderTest = await Order.findOne({ user: firaTestUser._id }).sort({ createdAt: -1 });
    const orderDev = await Order.findOne({ user: firaDevUser._id }).sort({ createdAt: -1 });
    const orderDev2 = await Order.findOne({ user: firaDev2User._id }).sort({ createdAt: -1 });

    const realConversations = [
      {
        ticketNumber: 'NS-T-2001',
        customer: firaTestUser._id,
        customerName: firaTestUser.name || 'fira test',
        customerEmail: firaTestUser.email,
        customerAvatar: 'FT',
        subject: 'Fulfillment update for my order',
        topic: 'Shipping',
        status: 'Open',
        assignedToName: 'Unassigned',
        channel: 'web_form',
        unreadForAdmin: true,
        unreadForCustomer: false,
        linkedOrder: orderTest?._id || null,
        linkedOrderNumber: orderTest ? `#${orderTest.orderNumber}` : '',
        linkedOrderStatus: orderTest ? (orderTest.status?.charAt(0).toUpperCase() + orderTest.status?.slice(1)) : 'Processing',
        lastMessagePreview: 'Hello, I placed order #NS-864048780 recently. Could you let me know when it will be dispatched?',
        lastMessageAt: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago
        messages: [
          {
            senderType: 'customer',
            sender: firaTestUser._id,
            senderName: firaTestUser.name || 'fira test',
            body: `Hello, I placed order ${orderTest ? '#' + orderTest.orderNumber : ''} recently for the Valerian Velvet dress. Could you let me know when it will be dispatched?`,
            type: 'reply',
            createdAt: new Date(Date.now() - 25 * 60 * 1000),
          },
        ],
      },
      {
        ticketNumber: 'NS-T-2002',
        customer: firaDevUser._id,
        customerName: firaDevUser.name || 'fira dev',
        customerAvatar: 'FD',
        customerEmail: firaDevUser.email,
        subject: 'Exchange question regarding delivered item',
        topic: 'Returns',
        status: 'Open',
        assignedToName: 'Me',
        channel: 'email',
        unreadForAdmin: false,
        unreadForCustomer: false,
        linkedOrder: orderDev?._id || null,
        linkedOrderNumber: orderDev ? `#${orderDev.orderNumber}` : '',
        linkedOrderStatus: orderDev ? (orderDev.status?.charAt(0).toUpperCase() + orderDev.status?.slice(1)) : 'Delivered',
        lastMessagePreview: 'The Aero-Fit Performance Tee arrived yesterday. It looks great, but is it possible to exchange for a different size?',
        lastMessageAt: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago
        messages: [
          {
            senderType: 'customer',
            sender: firaDevUser._id,
            senderName: firaDevUser.name || 'fira dev',
            body: 'The Aero-Fit Performance Tee arrived yesterday. It looks great, but is it possible to exchange for a different size?',
            type: 'reply',
            createdAt: new Date(Date.now() - 90 * 60 * 1000),
          },
          {
            senderType: 'admin',
            senderName: 'Staff Note',
            body: 'Customer qualifies for standard 14-day exchange window. Reserved alternative size in stock.',
            type: 'internal_note',
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
          },
        ],
      },
      {
        ticketNumber: 'NS-T-2003',
        customer: firaDev2User._id,
        customerName: firaDev2User.name || 'fira dev2',
        customerAvatar: 'FD',
        customerEmail: firaDev2User.email,
        subject: 'Tracking carrier link request',
        topic: 'Shipping',
        status: 'Replied',
        assignedToName: 'Me',
        channel: 'web_form',
        unreadForAdmin: false,
        unreadForCustomer: false,
        linkedOrder: orderDev2?._id || null,
        linkedOrderNumber: orderDev2 ? `#${orderDev2.orderNumber}` : '',
        linkedOrderStatus: orderDev2 ? (orderDev2.status?.charAt(0).toUpperCase() + orderDev2.status?.slice(1)) : 'Shipped',
        lastMessagePreview: 'Thank you for providing the direct courier link!',
        lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        firstResponseAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
        messages: [
          {
            senderType: 'customer',
            sender: firaDev2User._id,
            senderName: firaDev2User.name || 'fira dev2',
            body: `Hi, my order ${orderDev2 ? '#' + orderDev2.orderNumber : ''} is marked shipped. Where can I track the live delivery?`,
            type: 'reply',
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          },
          {
            senderType: 'admin',
            senderName: 'NovaShop Support',
            body: 'Hello! Your package is moving with express transit. You can track real-time milestones under Account → Orders or via our shipping portal.',
            type: 'reply',
            createdAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
          },
          {
            senderType: 'customer',
            sender: firaDev2User._id,
            senderName: firaDev2User.name || 'fira dev2',
            body: 'Thank you for providing the direct courier link!',
            type: 'reply',
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          },
        ],
      },
      {
        ticketNumber: 'NS-T-2004',
        customer: firaolSirajUser._id,
        customerName: firaolSirajUser.name || 'firaol siraj',
        customerAvatar: 'FS',
        customerEmail: firaolSirajUser.email,
        subject: 'International shipping inquiry',
        topic: 'Shipping',
        status: 'Resolved',
        assignedToName: 'Me',
        channel: 'email',
        unreadForAdmin: false,
        unreadForCustomer: false,
        lastMessagePreview: 'Great, thanks for clarifying the $300 free shipping policy!',
        lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        firstResponseAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        messages: [
          {
            senderType: 'customer',
            sender: firaolSirajUser._id,
            senderName: firaolSirajUser.name || 'firaol siraj',
            body: 'Hello, what is the threshold for free express shipping?',
            type: 'reply',
            createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          },
          {
            senderType: 'admin',
            senderName: 'NovaShop Support',
            body: 'Hi Firaol, we offer complimentary express global shipping on all orders over $300 USD. Orders below that amount calculate at standard regional rates at checkout.',
            type: 'reply',
            createdAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000),
          },
          {
            senderType: 'customer',
            sender: firaolSirajUser._id,
            senderName: firaolSirajUser.name || 'firaol siraj',
            body: 'Great, thanks for clarifying the $300 free shipping policy!',
            type: 'reply',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        ],
      },
    ];

    for (const cData of realConversations) {
      const { messages, ...convFields } = cData;
      const createdConv = await Conversation.create(convFields);
      for (const m of messages) {
        await Message.create({
          conversation: createdConv._id,
          ...m,
        });
      }
    }
    console.log(`Created ${realConversations.length} real tickets for actual database users and orders.`);
  }

  console.log('\nCleanup completed successfully! Real database data is active.');
  process.exit(0);
}

cleanupFakeSupport().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
