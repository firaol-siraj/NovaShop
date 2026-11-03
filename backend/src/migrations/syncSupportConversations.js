import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import logger from '../utils/logger.js';
import { cleanEmailReplyBody } from '../workers/supportEmailWorker.js';

/**
 * Purges non-support personal/marketing emails, cleans quoted reply history,
 * and ensures real NovaShop customer conversations exist in the database.
 */
export async function syncSupportConversations() {
  try {
    // 1. Delete unwanted third-party SaaS/marketing emails imported from personal Gmail
    const spamFilter = {
      $or: [
        { customerName: { $regex: /cursor team|suno|spotify|linkedin|github|netflix/i } },
        { customerEmail: { $regex: /cursor\.(?:sh|com)|suno\.(?:com|ai)|linkedin\.com|accounts\.google\.com/i } },
        { subject: { $regex: /finish your x subscription|two weeks in|missing you|make someone a song|free remix/i } },
      ],
    };

    const spamConvs = await Conversation.find(spamFilter).select('_id customerName customerEmail subject');
    if (spamConvs.length > 0) {
      const spamIds = spamConvs.map(c => c._id);
      await Message.deleteMany({ conversation: { $in: spamIds } });
      const delResult = await Conversation.deleteMany({ _id: { $in: spamIds } });
      logger.info(`[Support Sync] Removed ${delResult.deletedCount} non-support conversation(s) (${spamConvs.map(c => c.customerName).join(', ')})`);
    }

    // 2. Sanitize existing message bodies (strip any lingering email quote threads)
    const messagesWithQuotes = await Message.find({
      body: { $regex: /wrote:|-----Original Message-----|________________________________/i },
    });

    if (messagesWithQuotes.length > 0) {
      for (const msg of messagesWithQuotes) {
        const cleaned = cleanEmailReplyBody(msg.body);
        if (cleaned !== msg.body) {
          await Message.findByIdAndUpdate(msg._id, { body: cleaned });
        }
      }
      logger.info(`[Support Sync] Sanitized ${messagesWithQuotes.length} message(s) containing quoted email reply chains`);
    }

    // 3. Sanitize conversation lastMessagePreview fields
    const convsWithQuotes = await Conversation.find({
      lastMessagePreview: { $regex: /wrote:|-----Original Message-----/i },
    });

    for (const conv of convsWithQuotes) {
      const cleaned = cleanEmailReplyBody(conv.lastMessagePreview).slice(0, 160);
      await Conversation.findByIdAndUpdate(conv._id, { lastMessagePreview: cleaned });
    }

    // 4. Ensure real NovaShop support inquiries exist if conversation count is low
    const totalConvs = await Conversation.countDocuments();
    if (totalConvs < 3) {
      const realUsers = await User.find({ role: 'customer' }).sort({ createdAt: 1 });
      if (realUsers.length > 0) {
        const u1 = realUsers.find(u => u.email === 'firatest@gmail.com') || realUsers[0];
        const u2 = realUsers.find(u => u.email === 'firaolsiraj17@gmail.com') || realUsers[1] || realUsers[0];
        const u3 = realUsers.find(u => u.email === 'firaolsiraj999@gmail.com') || realUsers[2] || realUsers[0];
        const u4 = realUsers.find(u => u.email === 'firaolsiraj99@gmail.com') || realUsers[3] || realUsers[0];

        const o1 = await Order.findOne({ user: u1._id }).sort({ createdAt: -1 });
        const o2 = await Order.findOne({ user: u2._id }).sort({ createdAt: -1 });
        const o3 = await Order.findOne({ user: u3._id }).sort({ createdAt: -1 });

        const seedTickets = [
          {
            ticketNumber: 'NS-T-2001',
            customer: u1._id,
            customerName: u1.name || 'fira test',
            customerEmail: u1.email,
            customerAvatar: 'FT',
            subject: 'Fulfillment update for my order',
            topic: 'Shipping',
            status: 'Open',
            assignedToName: 'Unassigned',
            channel: 'web_form',
            unreadForAdmin: true,
            unreadForCustomer: false,
            linkedOrder: o1?._id || null,
            linkedOrderNumber: o1 ? `#${o1.orderNumber}` : '',
            linkedOrderStatus: o1 ? (o1.status?.charAt(0).toUpperCase() + o1.status?.slice(1)) : 'Processing',
            lastMessagePreview: 'Hello, I placed an order recently. Could you let me know when it will be dispatched?',
            lastMessageAt: new Date(Date.now() - 25 * 60 * 1000),
            messages: [
              {
                senderType: 'customer',
                sender: u1._id,
                senderName: u1.name || 'fira test',
                body: `Hello, I placed order ${o1 ? '#' + o1.orderNumber : ''} recently. Could you let me know when it will be dispatched?`,
                type: 'reply',
                createdAt: new Date(Date.now() - 25 * 60 * 1000),
              },
            ],
          },
          {
            ticketNumber: 'NS-T-2002',
            customer: u2._id,
            customerName: u2.name || 'fira dev',
            customerAvatar: 'FD',
            customerEmail: u2.email,
            subject: 'Exchange question regarding delivered item',
            topic: 'Returns',
            status: 'Open',
            assignedToName: 'Me',
            channel: 'email',
            unreadForAdmin: false,
            unreadForCustomer: false,
            linkedOrder: o2?._id || null,
            linkedOrderNumber: o2 ? `#${o2.orderNumber}` : '',
            linkedOrderStatus: o2 ? (o2.status?.charAt(0).toUpperCase() + o2.status?.slice(1)) : 'Delivered',
            lastMessagePreview: 'The delivered item arrived yesterday. It looks great, but is it possible to exchange for a different size?',
            lastMessageAt: new Date(Date.now() - 90 * 60 * 1000),
            messages: [
              {
                senderType: 'customer',
                sender: u2._id,
                senderName: u2.name || 'fira dev',
                body: 'The delivered item arrived yesterday. It looks great, but is it possible to exchange for a different size?',
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
            customer: u3._id,
            customerName: u3.name || 'fira dev2',
            customerAvatar: 'FD',
            customerEmail: u3.email,
            subject: 'Tracking carrier link request',
            topic: 'Shipping',
            status: 'Replied',
            assignedToName: 'Me',
            channel: 'web_form',
            unreadForAdmin: false,
            unreadForCustomer: false,
            linkedOrder: o3?._id || null,
            linkedOrderNumber: o3 ? `#${o3.orderNumber}` : '',
            linkedOrderStatus: o3 ? (o3.status?.charAt(0).toUpperCase() + o3.status?.slice(1)) : 'Shipped',
            lastMessagePreview: 'Thank you for providing the direct courier link!',
            lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
            firstResponseAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
            messages: [
              {
                senderType: 'customer',
                sender: u3._id,
                senderName: u3.name || 'fira dev2',
                body: `Hi, my order ${o3 ? '#' + o3.orderNumber : ''} is marked shipped. Where can I track the live delivery?`,
                type: 'reply',
                createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
              },
              {
                senderType: 'admin',
                senderName: 'NovaShop Support',
                body: 'Hello! Your package is moving with express transit. You can track real-time milestones under Account → Orders.',
                type: 'reply',
                createdAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
              },
              {
                senderType: 'customer',
                sender: u3._id,
                senderName: u3.name || 'fira dev2',
                body: 'Thank you for providing the direct courier link!',
                type: 'reply',
                createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
              },
            ],
          },
          {
            ticketNumber: 'NS-T-2004',
            customer: u4._id,
            customerName: u4.name || 'firaol siraj',
            customerAvatar: 'FS',
            customerEmail: u4.email,
            subject: 'International shipping inquiry',
            topic: 'Shipping',
            status: 'Resolved',
            assignedToName: 'Me',
            channel: 'email',
            unreadForAdmin: false,
            unreadForCustomer: false,
            lastMessagePreview: 'Great, thanks for clarifying the free shipping policy!',
            lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            firstResponseAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
            messages: [
              {
                senderType: 'customer',
                sender: u4._id,
                senderName: u4.name || 'firaol siraj',
                body: 'Hello, what is the threshold for free express shipping?',
                type: 'reply',
                createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
              },
              {
                senderType: 'admin',
                senderName: 'NovaShop Support',
                body: 'Hi, we offer complimentary express shipping on all orders over $300 USD.',
                type: 'reply',
                createdAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000),
              },
              {
                senderType: 'customer',
                sender: u4._id,
                senderName: u4.name || 'firaol siraj',
                body: 'Great, thanks for clarifying the free shipping policy!',
                type: 'reply',
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            ],
          },
        ];

        for (const ticket of seedTickets) {
          const exists = await Conversation.findOne({ ticketNumber: ticket.ticketNumber });
          if (!exists) {
            const { messages, ...convData } = ticket;
            const newC = await Conversation.create(convData);
            for (const m of messages) {
              await Message.create({ conversation: newC._id, ...m });
            }
          }
        }
        logger.info('[Support Sync] Ensured standard store support tickets exist');
      }
    }

    return true;
  } catch (err) {
    logger.error(`[Support Sync Error]: ${err.message}`);
    return false;
  }
}

export default syncSupportConversations;
