import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Conversation from '../src/models/conversationModel.js';
import Message from '../src/models/messageModel.js';
import HelpArticle from '../src/models/helpArticleModel.js';
import Setting from '../src/models/settingModel.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';
import { processInboundEmail } from '../src/workers/supportEmailWorker.js';

const generateAccessToken = (id, role = 'user') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '15m',
  });
};

describe('Customer Support & Help Integration Suite', () => {
  let customerUser;
  let adminUser;
  let customerToken;
  let adminToken;
  let sampleOrder;

  beforeEach(async () => {
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await HelpArticle.deleteMany({});
    await Setting.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});

    customerUser = await User.create({
      name: 'Amelia Chen',
      email: 'amelia.chen@email.com',
      password: 'Password123!',
      role: 'customer',
    });

    adminUser = await User.create({
      name: 'Support Agent',
      email: 'agent@novashop.com',
      password: 'Password123!',
      role: 'admin',
    });

    customerToken = generateAccessToken(customerUser._id, 'customer');
    adminToken = generateAccessToken(adminUser._id, 'admin');

    sampleOrder = await Order.create({
      user: customerUser._id,
      customerEmail: customerUser.email,
      orderNumber: 'NS-9999',
      status: 'processing',
      orderStatus: 'Processing',
      totalAmount: 180,
      currency: 'USD',
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          name: 'Silk Slip Dress',
          price: 180,
          quantity: 1,
        },
      ],
      shippingAddress: {
        address: '123 Market St',
        city: 'Singapore',
        country: 'Singapore',
        postalCode: '10001',
      },
    });

    // Seed help articles
    await HelpArticle.create([
      {
        topic: 'shipping',
        question: 'What is your return policy?',
        answer: 'Returns accepted within 14 days of delivery.',
        sortOrder: 1,
        status: 'published',
      },
      {
        topic: 'orders',
        question: 'How do I track my package?',
        answer: 'Tracking details are visible in Account -> Orders.',
        sortOrder: 2,
        status: 'published',
      },
    ]);

    await Setting.setSetting('support_email', 'support@novashop.com');
    await Setting.setSetting('return_window_days', 14);
    await Setting.setSetting('free_shipping_threshold', 300);
  });

  describe('1. Help Page Endpoints', () => {
    it('GET /api/v1/help/faqs returns published FAQs', async () => {
      const res = await request(app).get('/api/v1/help/faqs');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].q).toBe('What is your return policy?');
    });

    it('GET /api/v1/help/faqs?search=track filters FAQs', async () => {
      const res = await request(app).get('/api/v1/help/faqs').query({ search: 'track' });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].q).toContain('track');
    });

    it('GET /api/v1/help/settings returns public support settings', async () => {
      const res = await request(app).get('/api/v1/help/settings');
      expect(res.status).toBe(200);
      expect(res.body.data.returnWindowDays).toBe(14);
      expect(res.body.data.freeShippingThreshold).toBe(300);
    });
  });

  describe('2. Customer Contact Form & Ticket Submission', () => {
    it('POST /api/v1/support/contact creates a support conversation linked to recent order', async () => {
      const payload = {
        name: 'Amelia Chen',
        email: 'amelia.chen@email.com',
        order: '#NS-9999',
        message: 'Where is my order? I have not received shipping notification.',
      };

      const res = await request(app).post('/api/v1/support/contact').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.ticketNumber).toMatch(/^NS-T-/);

      const conv = await Conversation.findOne({ ticketNumber: res.body.data.ticketNumber });
      expect(conv).toBeTruthy();
      expect(conv.customerName).toBe('Amelia Chen');
      expect(conv.linkedOrderNumber).toBe('#NS-9999');
      expect(conv.linkedOrderStatus).toBe('Processing');
      expect(conv.status).toBe('Open');
      expect(conv.unreadForAdmin).toBe(true);

      const messages = await Message.find({ conversation: conv._id });
      expect(messages.length).toBe(1);
      expect(messages[0].senderType).toBe('customer');
      expect(messages[0].type).toBe('reply');
    });
  });

  describe('3. Internal Notes Privacy & Customer Ticket Isolation', () => {
    it('STRICT SECURITY: Customer cannot view internal notes in /my-tickets', async () => {
      const conv = await Conversation.create({
        ticketNumber: 'NS-T-2001',
        customer: customerUser._id,
        customerName: customerUser.name,
        customerEmail: customerUser.email,
        subject: 'Need help with return',
        topic: 'Returns',
        status: 'Open',
        unreadForAdmin: false,
      });

      // Customer message
      await Message.create({
        conversation: conv._id,
        senderType: 'customer',
        senderName: customerUser.name,
        body: 'Can I return this?',
        type: 'reply',
      });

      // Internal note by staff
      await Message.create({
        conversation: conv._id,
        senderType: 'admin',
        sender: adminUser._id,
        senderName: 'Staff Note',
        body: 'CONFIDENTIAL: Customer is high-tier VIP. Free return approved without fee.',
        type: 'internal_note',
      });

      // Public reply by staff
      await Message.create({
        conversation: conv._id,
        senderType: 'admin',
        sender: adminUser._id,
        senderName: 'NovaShop Support',
        body: 'Yes, your return has been approved! Prepaid label sent.',
        type: 'reply',
      });

      // Fetch customer tickets
      const res = await request(app)
        .get('/api/v1/support/my-tickets')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      const ticket = res.body.data[0];
      expect(ticket.messages.length).toBe(2); // Only customer reply + public reply, NO internal note!

      const bodies = ticket.messages.map(m => m.content);
      expect(bodies).toContain('Can I return this?');
      expect(bodies).toContain('Yes, your return has been approved! Prepaid label sent.');
      expect(bodies.some(b => b.includes('CONFIDENTIAL'))).toBe(false);
    });
  });

  describe('4. Admin Support Operations', () => {
    let testConv;

    beforeEach(async () => {
      testConv = await Conversation.create({
        ticketNumber: 'NS-T-3001',
        customer: customerUser._id,
        customerName: customerUser.name,
        customerEmail: customerUser.email,
        subject: 'Wrong size delivered',
        topic: 'Returns',
        status: 'Open',
        unreadForAdmin: true,
        assignedToName: 'Unassigned',
        lastMessagePreview: 'I received the wrong size.',
        lastMessageAt: new Date(),
      });

      await Message.create({
        conversation: testConv._id,
        senderType: 'customer',
        senderName: customerUser.name,
        body: 'I received the wrong size.',
        type: 'reply',
      });
    });

    it('GET /api/v1/admin/support/conversations returns list with tab counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/support/conversations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.counts.open).toBe(1);
      expect(res.body.data[0].customer.name).toBe('Amelia Chen');
      expect(res.body.data[0].status).toBe('Open');
    });

    it('POST /api/v1/admin/support/conversations/:id/reply sends reply and updates status to Replied', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/support/conversations/${testConv._id}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'We apologize. A replacement has been dispatched.' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Replied');
      expect(res.body.data.unread).toBe(false);

      const convInDb = await Conversation.findById(testConv._id);
      expect(convInDb.status).toBe('Replied');
      expect(convInDb.firstResponseAt).toBeTruthy();
    });

    it('POST /api/v1/admin/support/conversations/:id/note adds internal note without changing status', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/support/conversations/${testConv._id}/note`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'Internal note: checked warehouse inventory' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Open'); // Still open!

      const messages = await Message.find({ conversation: testConv._id, type: 'internal_note' });
      expect(messages.length).toBe(1);
      expect(messages[0].body).toBe('Internal note: checked warehouse inventory');
    });

    it('PATCH /api/v1/admin/support/conversations/:id/status updates status to Resolved', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/support/conversations/${testConv._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Resolved' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Resolved');

      const convInDb = await Conversation.findById(testConv._id);
      expect(convInDb.status).toBe('Resolved');
      expect(convInDb.resolvedAt).toBeTruthy();
    });

    it('PATCH /api/v1/admin/support/conversations/:id/assign assigns conversation to Me', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/support/conversations/${testConv._id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedTo: 'Me' });

      expect(res.status).toBe(200);
      expect(res.body.data.assignedToName).toBe('Me');
    });

    it('GET /api/v1/admin/support/stats returns KPI stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/support/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.open.value).toBe(1);
      expect(res.body.data.unread.value).toBe(1);
      expect(res.body.data.avgFirstResponse.value).toBeDefined();
    });

    it('GET /api/v1/admin/support/export downloads CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/support/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toContain('Ticket Number');
      expect(res.text).toContain('NS-T-3001');
    });
  });

  describe('5. Inbound Email Processing Logic', () => {
    it('appends reply and reopens ticket when email references ticket in subject', async () => {
      const conv = await Conversation.create({
        ticketNumber: 'NS-T-4001',
        customerName: 'Lucas Meyer',
        customerEmail: 'lucas@example.com',
        subject: 'Overcoat inquiry',
        topic: 'Product Inquiry',
        status: 'Resolved',
        resolvedAt: new Date(),
        unreadForAdmin: false,
      });

      const parsedMockEmail = {
        from: { value: [{ address: 'lucas@example.com', name: 'Lucas Meyer' }] },
        subject: 'Re: [NS-T-4001] Overcoat inquiry',
        text: 'Thanks! Does it also come in camel?',
        headers: new Map(),
        messageId: '<inbound-msg-123@example.com>',
      };

      const result = await processInboundEmail(parsedMockEmail);
      expect(result.status).toBe('appended');
      expect(result.ticketNumber).toBe('NS-T-4001');

      const updated = await Conversation.findById(conv._id);
      expect(updated.status).toBe('Open'); // Reopened!
      expect(updated.unreadForAdmin).toBe(true);

      const msgs = await Message.find({ conversation: conv._id });
      expect(msgs.length).toBe(1);
      expect(msgs[0].body).toBe('Thanks! Does it also come in camel?');
    });

    it('ignores auto-reply emails to prevent loop', async () => {
      const headersMap = new Map();
      headersMap.set('auto-submitted', 'auto-replied');

      const parsedAutoReply = {
        from: { value: [{ address: 'bot@example.com', name: 'Mail Delivery Subsystem' }] },
        subject: 'Automatic reply: Out of office',
        text: 'I am away until Monday.',
        headers: headersMap,
      };

      const result = await processInboundEmail(parsedAutoReply);
      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('auto_reply_or_self');
    });

    it('strips quoted email reply history so only new customer text is saved', async () => {
      const conv = await Conversation.create({
        ticketNumber: 'NS-T-4002',
        customerName: 'fira dev2',
        customerEmail: 'firaolsiraj999@gmail.com',
        subject: 'I did not receive my order yet',
        topic: 'Shipping',
        status: 'Replied',
        unreadForAdmin: false,
      });

      const replyWithQuote = {
        from: { value: [{ address: 'firaolsiraj999@gmail.com', name: 'fira dev2' }] },
        subject: 'Re: NovaShop Support: [NS-T-4002] I did not receive my order yet',
        text: 'Now I got my product,thank you On Sun, Oct 25, 2026, 3:48 PM firaol siraj <firaolsiraj999@gmail.com> wrote: > Alright > > On Sun, Oct 25, 2026, 3:42 PM NovaShop wrote: > >> Ticket NS-T-4002',
        headers: new Map(),
        messageId: '<cust-reply-999@gmail.com>',
      };

      const result = await processInboundEmail(replyWithQuote);
      expect(result.status).toBe('appended');
      expect(result.ticketNumber).toBe('NS-T-4002');

      const msgs = await Message.find({ conversation: conv._id }).sort({ createdAt: -1 });
      expect(msgs[0].body).toBe('Now I got my product,thank you');

      const updatedConv = await Conversation.findById(conv._id);
      expect(updatedConv.lastMessagePreview).toBe('Now I got my product,thank you');
    });

    it('ignores marketing emails with List-Unsubscribe header (e.g. Suno / Cursor)', async () => {
      const headersMap = new Map();
      headersMap.set('list-unsubscribe', '<mailto:unsubscribe@suno.com>');

      const marketingEmail = {
        from: { value: [{ address: 'newsletter@suno.com', name: 'Suno' }] },
        subject: 'Two weeks in. How is it going?',
        text: 'Check out new AI music features.',
        headers: headersMap,
      };

      const result = await processInboundEmail(marketingEmail);
      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('auto_reply_or_self');
    });

    it('ignores unrelated personal/marketing emails from unknown senders without store context', async () => {
      const randomEmail = {
        from: { value: [{ address: 'promotions@randomdomain.xyz', name: 'Random Promo' }] },
        subject: 'Claim your prize today',
        text: 'Click here to redeem your reward.',
        headers: new Map(),
      };

      const result = await processInboundEmail(randomEmail);
      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('unrelated_non_support_email');
    });
  });

  describe('6. Advanced Support API & Webhook Suite', () => {
    it('POST /api/v1/admin/support/conversations starts a new ticket to customer', async () => {
      const payload = {
        customerEmail: 'newcustomer@example.com',
        customerName: 'New Customer',
        subject: 'Welcome to NovaShop VIP',
        topic: 'Product Inquiry',
        message: 'Hello, we noticed you joined our VIP preview. How can we assist you today?',
        priority: 'normal',
      };

      const res = await request(app)
        .post('/api/v1/admin/support/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.ticketNumber).toMatch(/^NS-T-/);
      expect(res.body.data.customer.email).toBe('newcustomer@example.com');
      expect(res.body.data.messages.length).toBe(1);
      expect(res.body.data.messages[0].type).toBe('admin');
    });

    it('POST /api/v1/admin/support/conversations/:id/messages with resolveAfterSending resolves conversation', async () => {
      const conv = await Conversation.create({
        ticketNumber: 'NS-T-5001',
        customerName: 'Amelia Chen',
        customerEmail: 'amelia.chen@email.com',
        subject: 'Where is my order?',
        topic: 'Shipping',
        status: 'Open',
        unreadForAdmin: true,
      });

      const res = await request(app)
        .post(`/api/v1/admin/support/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Your order was delivered today at 11:30 AM. Closing this ticket!',
          resolveAfterSending: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Resolved');
      expect(res.body.data.unread).toBe(false);

      const updated = await Conversation.findById(conv._id);
      expect(updated.status).toBe('Resolved');
      expect(updated.resolvedAt).toBeTruthy();
    });

    it('GET /api/v1/admin/support/conversations/:id returns enriched customer profile & LTV', async () => {
      // Mark sample order as paid
      await Order.findByIdAndUpdate(sampleOrder._id, { isPaid: true, totalPrice: 180 });

      const conv = await Conversation.create({
        ticketNumber: 'NS-T-5002',
        customer: customerUser._id,
        customerName: customerUser.name,
        customerEmail: customerUser.email,
        subject: 'Care instructions for silk dress',
        topic: 'Product Inquiry',
        status: 'Open',
        linkedOrder: sampleOrder._id,
        linkedOrderNumber: sampleOrder.orderNumber,
      });

      const res = await request(app)
        .get(`/api/v1/admin/support/conversations/${conv._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerDetails).toBeTruthy();
      expect(res.body.data.customerDetails.ordersCount).toBe(1);
      expect(res.body.data.customerDetails.lifetimeValue).toBe('$180.00');
      expect(res.body.data.customerDetails.recentOrders.length).toBe(1);
    });

    it('GET /api/v1/admin/support/assignees returns team members', async () => {
      const res = await request(app)
        .get('/api/v1/admin/support/assignees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some(u => u.name === 'Support Agent')).toBe(true);
    });

    it('POST /api/v1/webhooks/inbound-email processes external email webhook', async () => {
      const conv = await Conversation.create({
        ticketNumber: 'NS-T-5003',
        customerName: 'Marcus Vance',
        customerEmail: 'marcus.vance@example.com',
        subject: 'Size exchange question',
        topic: 'Returns',
        status: 'Replied',
        unreadForAdmin: false,
      });

      const webhookPayload = {
        from: 'Marcus Vance <marcus.vance@example.com>',
        to: 'support@novashop.com',
        subject: 'Re: [NS-T-5003] Size exchange question',
        text: 'Size S fits wonderfully, thank you for checking!',
        messageId: '<webhook-test-123@mailer.com>',
      };

      const res = await request(app)
        .post('/api/v1/webhooks/inbound-email')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('appended');
      expect(res.body.data.ticketNumber).toBe('NS-T-5003');

      const updated = await Conversation.findById(conv._id);
      expect(updated.status).toBe('Open');
      expect(updated.unreadForAdmin).toBe(true);
    });

    it('sanitizes malicious script tags in messages to prevent XSS', async () => {
      const conv = await Conversation.create({
        ticketNumber: 'NS-T-5004',
        customerName: 'Hacker Test',
        customerEmail: 'hacker@example.com',
        subject: 'Inquiry',
        topic: 'General',
        status: 'Open',
      });

      const res = await request(app)
        .post(`/api/v1/admin/support/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: '<script>alert("XSS")</script>Hello <b>World</b>',
        });

      expect(res.status).toBe(200);
      const savedMsg = await Message.findOne({ conversation: conv._id });
      expect(savedMsg.bodyHtml).not.toContain('<script>');
      expect(savedMsg.bodyHtml).toContain('Hello <b>World</b>');
    });
  });
});
