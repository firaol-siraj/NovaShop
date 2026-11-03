import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';
import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import Address from '../src/models/addressModel.js';
import EmailLog from '../src/models/emailLogModel.js';
import Conversation from '../src/models/conversationModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { setTransporter, resetTransporter } from '../src/services/emailService.js';
import { calculateCustomerStats } from '../src/controllers/adminController.js';

describe('Admin Customers End-to-End Suite', () => {
  let ownerUser;
  let ownerToken;
  let viewerUser;
  let viewerToken;
  let sampleProduct;

  beforeEach(async () => {
    resetTransporter();

    // Create Owner admin (full permissions)
    ownerUser = await User.create({
      name: 'Store Owner',
      email: 'owner@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'owner',
      isVerified: true,
    });
    ownerToken = generateAccessToken(ownerUser._id, 0, 'admin');

    // Create Viewer admin (read-only, lacks write or email permissions on customers)
    viewerUser = await User.create({
      name: 'Viewer Admin',
      email: 'viewer@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'viewer',
      isVerified: true,
    });
    viewerToken = generateAccessToken(viewerUser._id, 0, 'admin');

    // Create category and product for order tests
    const category = await Category.create({
      name: 'Apparel',
      slug: `apparel-${Date.now()}`,
    });
    sampleProduct = await Product.create({
      user: ownerUser._id,
      name: 'Tailored Cashmere Coat',
      slug: `tailored-coat-${Date.now()}`,
      brand: 'NovaShop',
      category: category._id,
      price: 250,
      image: '/images/coat.jpg',
      description: 'Luxury coat',
    });
  });

  afterEach(() => {
    resetTransporter();
  });

  // =========================================================================
  // PART 2: ADD CUSTOMER
  // =========================================================================
  describe('Part 2: Add Customer End-to-End', () => {
    it('creates customer in invited status, sends signed single-use invite email, and defaults marketingConsent to false', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'mock-invite-msg-123' });
      setTransporter({ sendMail: sendMailMock });

      const res = await request(app)
        .post('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Abebe',
          lastName: 'Bikila',
          email: 'Abebe.Bikila@Example.COM', // Tests lowercase normalization
          phone: '+251 91 123 4567',
          city: 'Addis Ababa',
          country: 'Ethiopia',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('abebe.bikila@example.com');
      expect(res.body.data.status).toBe('invited');
      expect(res.body.data.marketingConsent).toBe(false);
      // Secrets and tokens must never be returned in API response
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.inviteToken).toBeUndefined();
      expect(res.body.data.passwordResetToken).toBeUndefined();

      // Check email was dispatched with invite link
      expect(sendMailMock).toHaveBeenCalled();
      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('abebe.bikila@example.com');
      expect(callArgs.subject).toContain('Welcome! Set your account password');
      expect(callArgs.text).toContain('/reset-password?token=');
    });

    it('rejects duplicate email with a clear case-insensitive message', async () => {
      await User.create({
        name: 'Existing Customer',
        email: 'duplicate@example.com',
        password: 'Password123!',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Duplicate',
          lastName: 'User',
          email: 'DUPLICATE@EXAMPLE.COM',
          phone: '+251911223344',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects invalid phone number that violates phone validation', async () => {
      const res = await request(app)
        .post('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Bad',
          lastName: 'Phone',
          email: 'badphone@example.com',
          phone: '12345', // Invalid
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/valid phone number/i);
    });

    it('rejects creation when admin lacks permission (permission denied)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          firstName: 'Forbidden',
          lastName: 'Customer',
          email: 'forbidden@example.com',
          phone: '+251911223344',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access Denied/i);
    });

    it('enforces invite token single-use, expires correctly, and activates customer upon setting password', async () => {
      // Create user with valid invite token
      const inviteToken = 'test-secret-invite-token-12345';
      const user = await User.create({
        name: 'Invited User',
        email: 'invited@example.com',
        password: 'TemporaryPassword!',
        role: 'customer',
        status: 'invited',
        isInvited: true,
        isVerified: false,
        inviteToken,
        inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // 1. First reset succeeds
      const resetRes = await request(app)
        .put(`/api/v1/auth/reset-password/${inviteToken}`)
        .send({
          password: 'NewStrongPassword123!',
          confirmPassword: 'NewStrongPassword123!',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify user transitioned to active
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.status).toBe('active');
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.isInvited).toBe(false);
      expect(updatedUser.inviteToken).toBeUndefined();

      // 2. Second attempt fails (single-use enforcement)
      const reuseRes = await request(app)
        .put(`/api/v1/auth/reset-password/${inviteToken}`)
        .send({
          password: 'AnotherPassword123!',
          confirmPassword: 'AnotherPassword123!',
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.message).toMatch(/invalid or has expired/i);
    });

    it('rejects expired invite token', async () => {
      const expiredToken = 'expired-token-999';
      await User.create({
        name: 'Expired User',
        email: 'expired@example.com',
        password: 'TemporaryPassword!',
        role: 'customer',
        status: 'invited',
        inviteToken: expiredToken,
        inviteExpires: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      });

      const res = await request(app)
        .put(`/api/v1/auth/reset-password/${expiredToken}`)
        .send({
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });
  });

  // =========================================================================
  // PART 3: DELETE / SAFE DELETE
  // =========================================================================
  describe('Part 3: Safe Delete Customer', () => {
    it('blocks hard delete when customer has order records and suggests anonymize', async () => {
      const customer = await User.create({
        name: 'Active Shopper',
        email: 'shopper@example.com',
        password: 'Password123!',
        role: 'customer',
      });

      await Order.create({
        user: customer._id,
        orderNumber: 'ORD-9901',
        totalPrice: 150,
        itemsPrice: 150,
        isPaid: true,
        orderItems: [
          {
            name: 'Silk Shirt',
            qty: 1,
            image: '/images/shirt.jpg',
            price: 150,
            product: sampleProduct._id,
          },
        ],
        shippingAddress: {
          recipientName: 'Active Shopper',
          address: 'Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
          phone: '+251911223344',
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/customers/${customer._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.hasActivity).toBe(true);
      expect(res.body.message).toMatch(/Anonymize and deactivate/i);
    });

    it('safely anonymizes customer with orders, preserving records while wiping PII', async () => {
      const customer = await User.create({
        name: 'GDPR Customer',
        email: 'gdpr@example.com',
        phone: '+251911999888',
        password: 'Password123!',
        role: 'customer',
      });

      await Order.create({
        user: customer._id,
        orderNumber: 'ORD-9902',
        totalPrice: 200,
        itemsPrice: 200,
        isPaid: true,
        orderItems: [
          {
            name: 'Wool Trousers',
            qty: 1,
            image: '/images/trousers.jpg',
            price: 200,
            product: sampleProduct._id,
          },
        ],
        shippingAddress: {
          recipientName: 'GDPR Customer',
          address: 'Kazanchis',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
          phone: '+251911999888',
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/customers/${customer._id}?action=anonymize`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.anonymized).toBe(true);

      const anonymizedUser = await User.findById(customer._id);
      expect(anonymizedUser.name).toBe('Deleted Customer');
      expect(anonymizedUser.email).toContain('deleted_');
      expect(anonymizedUser.phone).toBe('');
      expect(anonymizedUser.status).toBe('deactivated');
      expect(anonymizedUser.isActive).toBe(false);

      // Verify order record still exists
      const orderCount = await Order.countDocuments({ user: customer._id });
      expect(orderCount).toBe(1);
    });

    it('allows full permanent delete for customer with zero activity records', async () => {
      const customer = await User.create({
        name: 'No Activity Customer',
        email: 'noactivity@example.com',
        password: 'Password123!',
        role: 'customer',
      });

      const res = await request(app)
        .delete(`/api/v1/admin/customers/${customer._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedUser = await User.findById(customer._id);
      expect(deletedUser).toBeNull();
    });
  });

  // =========================================================================
  // PART 4: SEND EMAIL & LOGS
  // =========================================================================
  describe('Part 4: Send Customer Admin Email', () => {
    let customer;

    beforeEach(async () => {
      customer = await User.create({
        name: 'Marta Hailu',
        email: 'marta@example.com',
        password: 'Password123!',
        role: 'customer',
        status: 'active',
      });
    });

    it('dispatches email with NovaShop prefix, ticket number, creates conversation thread, and logs "sent" in EmailLog', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'smtp-msg-abc-123' });
      setTransporter({ sendMail: sendMailMock });

      const res = await request(app)
        .post(`/api/v1/admin/customers/${customer._id}/email`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          subject: 'Your order delivery update',
          message: 'Hello Marta, your package has been shipped via express courier.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check sendMail call
      expect(sendMailMock).toHaveBeenCalled();
      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('marta@example.com');
      expect(callArgs.subject).toMatch(/^NovaShop: \[NS-T-\d+\] Your order delivery update$/);

      // Verify EmailLog created with "sent" status
      const log = await EmailLog.findOne({ userId: customer._id });
      expect(log).not.toBeNull();
      expect(log.status).toBe('sent');
      expect(log.type).toBe('admin_message');
      expect(log.subject).toMatch(/^NovaShop: \[NS-T-\d+\]/);

      // Verify Conversation created in support system with matching ticketNumber
      const ticketMatch = callArgs.subject.match(/\[(NS-T-\d+)\]/);
      expect(ticketMatch).not.toBeNull();
      const conv = await Conversation.findOne({ ticketNumber: ticketMatch[1] });
      expect(conv).not.toBeNull();
      expect(conv.customerEmail).toBe('marta@example.com');
    });

    it('records "failed" in EmailLog and returns error message when SMTP dispatch fails', async () => {
      const sendMailMock = jest.fn().mockRejectedValue(new Error('SMTP Connection timeout to Gmail'));
      setTransporter({ sendMail: sendMailMock });

      const res = await request(app)
        .post(`/api/v1/admin/customers/${customer._id}/email`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          subject: 'Payment receipt inquiry',
          message: 'We are verifying your transaction with the bank.',
        });

      expect(res.status).toBe(200); // Handled response returning error details
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/SMTP Connection timeout/i);

      // Verify EmailLog status is "failed"
      const log = await EmailLog.findOne({ userId: customer._id });
      expect(log).not.toBeNull();
      expect(log.status).toBe('failed');
      expect(log.error).toContain('SMTP Connection timeout');
    });

    it('rejects sending manual email to blocked or anonymized customer', async () => {
      customer.status = 'blocked';
      await customer.save();

      const res = await request(app)
        .post(`/api/v1/admin/customers/${customer._id}/email`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          subject: 'Test subject',
          message: 'Test message body',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/blocked or anonymized customer/i);
    });

    it('sanitizes message body, escaping raw HTML while rendering bold and markdown formatting', async () => {
      let dispatchedHtml = '';
      const sendMailMock = jest.fn().mockImplementation(async (opts) => {
        dispatchedHtml = opts.html;
        return { messageId: 'msg-456' };
      });
      setTransporter({ sendMail: sendMailMock });

      const res = await request(app)
        .post(`/api/v1/admin/customers/${customer._id}/email`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          subject: 'Important safety notice',
          message: 'Notice: <script>alert("hack")</script> **Very Important** [NovaShop](https://novashop.com)',
        });

      expect(res.status).toBe(200);
      // Raw HTML script tags must be escaped
      expect(dispatchedHtml).not.toContain('<script>');
      expect(dispatchedHtml).toContain('&lt;script&gt;');
      // **bold** formatted as strong
      expect(dispatchedHtml).toContain('<strong>Very Important</strong>');
      // [text](url) formatted as anchor link
      expect(dispatchedHtml).toContain('<a href="https://novashop.com"');
    });

    it('rejects email with header injection characters in subject', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${customer._id}/email`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          subject: 'Subject with\r\nBcc: evil@hacker.com',
          message: 'Hello world',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid characters in email subject/i);
    });

    it('denies sending email when admin lacks email permission (permission denied)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${customer._id}/email`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          subject: 'Unauthorized email',
          message: 'Should be rejected',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access Denied/i);
    });
  });

  // =========================================================================
  // PART 5: DATA CONSISTENCY & STATS
  // =========================================================================
  describe('Part 5: Customer Stats Calculation & Consistency', () => {
    it('calculates consistent stats where total equals active + inactive + blocked', async () => {
      // Create 2 active, 1 invited, 1 unverified, 1 blocked
      await User.create([
        { name: 'C1', email: 'c1@test.com', password: 'Password123!', role: 'customer', status: 'active' },
        { name: 'C2', email: 'c2@test.com', password: 'Password123!', role: 'customer', status: 'active' },
        { name: 'C3', email: 'c3@test.com', password: 'Password123!', role: 'customer', status: 'invited' },
        { name: 'C4', email: 'c4@test.com', password: 'Password123!', role: 'customer', status: 'inactive' },
        { name: 'C5', email: 'c5@test.com', password: 'Password123!', role: 'customer', status: 'blocked' },
      ]);

      const stats = await calculateCustomerStats();

      expect(stats.totalCustomers).toBe(5);
      expect(stats.activeCustomers).toBe(2);
      expect(stats.inactiveCustomers).toBe(2); // invited + inactive
      expect(stats.blockedCustomers).toBe(1);

      // Verify exact sum consistency
      expect(stats.totalCustomers).toBe(
        stats.activeCustomers + stats.inactiveCustomers + stats.blockedCustomers
      );
      expect(stats.tabCounts.all).toBe(stats.totalCustomers);
    });
  });
});
