import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Conversation from '../src/models/conversationModel.js';
import Message from '../src/models/messageModel.js';
import AdminNotification from '../src/models/adminNotificationModel.js';
import AuditLog from '../src/models/auditLogModel.js';
import Setting from '../src/models/settingModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { emailQueue } from '../src/queues/emailQueue.js';

describe('Admin Notifications Routing & Admin Profile Suite', () => {
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let testConversation;
  let testMessage;

  beforeEach(async () => {
    if (emailQueue) {
      emailQueue.add = () => Promise.resolve(true);
    }

    // 1. Create Admin
    adminUser = await User.create({
      name: 'Firaol Siraj',
      firstName: 'Firaol',
      lastName: 'Siraj',
      displayName: 'Firaol Siraj',
      email: 'firaolsiraj17@gmail.com',
      password: 'OldPassword123!',
      role: 'admin',
      adminRole: 'owner',
      isVerified: true,
      sessions: [
        {
          sessionId: 'session_active_1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          device: 'Mac Desktop (Chrome)',
          browser: 'Chrome 122.0',
          ip: '197.156.103.45',
          lastActive: new Date(),
          isCurrent: true,
        },
        {
          sessionId: 'session_other_2',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          device: 'Apple iPhone (Safari)',
          browser: 'Mobile Safari 17.0',
          ip: '197.156.103.88',
          lastActive: new Date(Date.now() - 3600000),
          isCurrent: false,
        },
      ],
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    // 2. Create storefront Customer
    customerUser = await User.create({
      name: 'John Customer',
      email: 'john@example.com',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
    });
    customerToken = generateAccessToken(customerUser._id, 0, 'customer');

    // 3. Create Support Conversation and initial Message
    testConversation = await Conversation.create({
      ticketNumber: 'TICK-9999',
      customer: customerUser._id,
      customerName: 'John Customer',
      customerEmail: 'john@example.com',
      subject: 'Where is my winter jacket order?',
      status: 'Open',
    });

    testMessage = await Message.create({
      conversation: testConversation._id,
      senderType: 'customer',
      sender: customerUser._id,
      senderName: 'John Customer',
      senderEmail: 'john@example.com',
      body: 'Hello, I ordered 3 days ago and have not received a tracking number.',
    });
  });

  describe('Task 1: Support Conversation Lookup & Notification Routing', () => {
    it('GET /api/admin/support/conversations/:id fetches the exact conversation directly', async () => {
      const res = await request(app)
        .get(`/api/admin/support/conversations/${testConversation._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testConversation._id.toString());
      expect(res.body.data.subject).toBe('Where is my winter jacket order?');
      expect(res.body.data.messages.length).toBe(1);
    });

    it('GET /api/admin/support/conversations/:id returns 404 friendly error for non-existent conversation', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/support/conversations/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('creates support notification with conversation entityType and exact link', async () => {
      const notif = await AdminNotification.create({
        type: 'new_ticket',
        title: 'New Customer Ticket',
        message: `Support request: ${testConversation.subject}`,
        entityType: 'conversation',
        entityId: testConversation._id.toString(),
        link: `/admin/support?conversation=${testConversation._id}#message=${testMessage._id}`,
        data: {
          conversationId: testConversation._id.toString(),
          messageId: testMessage._id.toString(),
        },
      });

      expect(notif.entityType).toBe('conversation');
      expect(notif.entityId).toBe(testConversation._id.toString());
      expect(notif.link).toBe(`/admin/support?conversation=${testConversation._id}#message=${testMessage._id}`);
    });

    it('creates order, inventory, customer, return, and payment notifications with exact target links', async () => {
      const orderNotif = await AdminNotification.create({
        type: 'new_order',
        title: 'New Paid Order',
        message: 'Order #1001 paid',
        entityType: 'order',
        entityId: 'ord_123',
        link: '/admin/orders/ord_123',
      });
      expect(orderNotif.link).toBe('/admin/orders/ord_123');

      const invNotif = await AdminNotification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: 'SKU-HOODIE-M is running low',
        entityType: 'variant',
        entityId: 'SKU-HOODIE-M',
        link: '/admin/inventory?search=SKU-HOODIE-M',
      });
      expect(invNotif.link).toBe('/admin/inventory?search=SKU-HOODIE-M');

      const custNotif = await AdminNotification.create({
        type: 'new_customer',
        title: 'New Customer',
        message: 'New user registered',
        entityType: 'customer',
        entityId: customerUser._id.toString(),
        link: `/admin/customers/${customerUser._id}`,
      });
      expect(custNotif.link).toBe(`/admin/customers/${customerUser._id}`);

      const returnNotif = await AdminNotification.create({
        type: 'refund_request',
        title: 'Return Request',
        message: 'Return submitted for order #1001',
        entityType: 'return',
        entityId: 'ret_456',
        link: '/admin/returns/ret_456',
      });
      expect(returnNotif.link).toBe('/admin/returns/ret_456');

      const paymentNotif = await AdminNotification.create({
        type: 'failed_payment',
        title: 'Payment Failed',
        message: 'Payment attempt failed for order #1002',
        entityType: 'order',
        entityId: 'ord_1002',
        link: '/admin/orders/ord_1002',
      });
      expect(paymentNotif.link).toBe('/admin/orders/ord_1002');
    });
  });

  describe('Task 2 & 3: Admin Profile Endpoints & Security', () => {
    it('GET /api/admin/me returns authenticated admin profile without password hash', async () => {
      const res = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Firaol Siraj');
      expect(res.body.data.email).toBe('firaolsiraj17@gmail.com');
      expect(res.body.data.roleLabel).toBe('Owner');
      expect(res.body.data.adminRole).toBe('owner');
      expect(res.body.data.permissions).toBeDefined();
      expect(res.body.data.password).toBeUndefined();
    });

    it('rejects non-admin customer token on /api/admin/me with 403', async () => {
      const res = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('PATCH /api/admin/me updates personal information and creates AuditLog entry', async () => {
      const res = await request(app)
        .patch('/api/admin/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          displayName: 'Firaol S.',
          phone: '+251911223344',
          jobTitle: 'Lead Store Administrator',
          bio: 'Managing store catalog and operations.',
          timezone: 'Africa/Addis_Ababa',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('Firaol S.');
      expect(res.body.data.phone).toBe('+251911223344');
      expect(res.body.data.jobTitle).toBe('Lead Store Administrator');

      // Verify audit log
      const audit = await AuditLog.findOne({ section: 'profile', performedBy: adminUser._id });
      expect(audit).not.toBeNull();
      expect(audit.action).toBe('admin_profile_updated');
    });

    it('PATCH /api/admin/me rejects email update without current password', async () => {
      const res = await request(app)
        .patch('/api/admin/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newadmin@novashop.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/current password is required/i);
    });

    it('PATCH /api/admin/me ignores attempts to escalate adminRole or role', async () => {
      const res = await request(app)
        .patch('/api/admin/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          displayName: 'Firaol Updated',
          role: 'super_root',
          adminRole: 'super_owner',
        });

      expect(res.status).toBe(200);
      const user = await User.findById(adminUser._id);
      expect(user.role).toBe('admin');
      expect(user.adminRole).toBe('owner');
    });

    it('PATCH /api/admin/me/password updates password and increments tokenVersion to revoke sessions', async () => {
      const res = await request(app)
        .patch('/api/admin/me/password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'BrandNewPassword456!',
          confirmPassword: 'BrandNewPassword456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();

      // Old token should now be rejected because tokenVersion incremented
      const rejectedRes = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rejectedRes.status).toBe(401);

      // New token works
      const acceptedRes = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(acceptedRes.status).toBe(200);
    });

    it('GET /api/admin/me/sessions lists active sessions with masked IP and device', async () => {
      const res = await request(app)
        .get('/api/admin/me/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].device).toBe('Mac Desktop (Chrome)');
      expect(res.body.data[0].ip).toMatch(/\*+/); // masked
    });

    it('DELETE /api/admin/me/sessions/:id revokes a specific session', async () => {
      const res = await request(app)
        .delete('/api/admin/me/sessions/session_other_2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findById(adminUser._id);
      expect(user.sessions.some((s) => s.sessionId === 'session_other_2')).toBe(false);
    });

    it('GET /api/admin/me/activity returns paginated activity audit trail', async () => {
      await AuditLog.create({
        action: 'admin_profile_updated',
        section: 'profile',
        performedBy: adminUser._id,
        performerEmail: adminUser.email,
        targetEntityId: adminUser._id.toString(),
        changes: [{ field: 'displayName', oldValue: 'Firaol Siraj', newValue: 'Firaol S.' }],
      });

      const res = await request(app)
        .get('/api/admin/me/activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.logs[0].action).toBe('admin_profile_updated');
    });
  });
});
