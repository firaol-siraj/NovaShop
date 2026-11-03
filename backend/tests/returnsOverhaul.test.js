import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import ReturnRequest from '../src/models/returnRequestModel.js';
import Payment from '../src/models/paymentModel.js';
import InventoryMovement from '../src/models/inventoryMovementModel.js';
import Setting from '../src/models/settingModel.js';
import { emailQueue } from '../src/queues/emailQueue.js';

const generateAccessToken = (id, role = 'user', adminRole = 'admin', permissions = null) => {
  return jwt.sign(
    { id, role, adminRole, permissions },
    process.env.JWT_SECRET || 'testsecret',
    { expiresIn: '15m' }
  );
};

describe('Returns & Refunds Comprehensive Overhaul Suite', () => {
  let customerUser;
  let adminUser;
  let viewerUser;
  let customerToken;
  let adminToken;
  let viewerToken;
  let testProduct;
  let testOrder;

  beforeAll(() => {
    emailQueue.add = jest.fn().mockResolvedValue(true);
  });

  beforeEach(async () => {
    emailQueue.add.mockClear();

    await Order.deleteMany({});
    await User.deleteMany({});
    await ReturnRequest.deleteMany({});
    await Payment.deleteMany({});
    await Product.deleteMany({});
    await InventoryMovement.deleteMany({});
    await Category.deleteMany({});
    await Setting.deleteMany({});

    await Setting.create({
      store: { storeName: 'NovaShop Test' },
      operational: {
        returnWindowDays: 14,
        returnRateThreshold: 5.0,
      },
    });

    customerUser = await User.create({
      name: 'Firaol RealDev',
      email: 'firaol.real@example.com',
      password: 'Password123!',
      role: 'customer',
    });

    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'admin',
      permissions: { returns: ['read', 'write'] },
    });

    viewerUser = await User.create({
      name: 'Viewer Staff',
      email: 'viewer@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'viewer',
      permissions: { returns: ['read'] },
    });

    customerToken = generateAccessToken(customerUser._id, 'user');
    adminToken = generateAccessToken(adminUser._id, 'admin', 'admin', { returns: ['read', 'write'] });
    viewerToken = generateAccessToken(viewerUser._id, 'admin', 'viewer', { returns: ['read'] });

    const category = await Category.create({ name: 'Accessories', slug: 'accessories' });

    testProduct = await Product.create({
      user: adminUser._id,
      name: 'Leather Weekend Bag',
      slug: 'leather-weekend-bag',
      price: 150,
      countInStock: 20,
      description: 'Premium handcrafted leather bag',
      image: 'https://example.com/bag.jpg',
      category: category._id,
    });

    testOrder = await Order.create({
      user: customerUser._id,
      orderNumber: 'NS-998877',
      orderItems: [
        {
          name: testProduct.name,
          qty: 2,
          price: 150,
          image: testProduct.image,
          product: testProduct._id,
          sku: 'BAG-LTH-01',
          size: 'OS',
          color: 'Cognac',
        },
      ],
      shippingAddress: {
        recipientName: 'Firaol RealDev',
        phone: '+251911000000',
        address: 'Bole Road',
        city: 'Addis Ababa',
        postalCode: '1000',
        country: 'Ethiopia',
      },
      paymentMethod: 'Chapa',
      totalPrice: 300,
      totalPriceETB: 36000,
      isPaid: true,
      paidAt: new Date(),
      status: 'delivered',
      isDelivered: true,
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });

    await Payment.create({
      order: testOrder._id,
      user: customerUser._id,
      txRef: 'TX-TEST-' + Date.now(),
      amountUSD: 300,
      amountETB: 36000,
      currency: 'USD',
      method: 'Chapa Hosted Checkout',
      status: 'success',
    });
  });

  describe('1. Customer Identity & Authoritative User Resolution', () => {
    it('always resolves customer name and email from real linked User document', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
          customerNote: 'Too large for daily commute',
          resolution: 'Refund',
        });

      expect(res.status).toBe(201);
      const ret = res.body.data;
      expect(ret.customerName).toBe('Firaol RealDev');
      expect(ret.customerEmail).toBe('firaol.real@example.com');
      expect(ret.customerEmail).not.toBe('amelia.chen@example.com');
      expect(ret.customerEmail).not.toBe('james.okafor@example.com');
    });
  });

  describe('2. Status Transitions Validation', () => {
    let activeReturnId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });
      activeReturnId = createRes.body.data._id;
    });

    it('rejects invalid status jump: cannot refund directly from requested', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountUSD: 150 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/items must be marked received first/i);
    });

    it('requires rejection reason when rejecting a return', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/rejection reason is required/i);
    });

    it('allows valid rejection with reason', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Item returned with tags removed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
      expect(res.body.data.rejectionReason).toBe('Item returned with tags removed');
    });
  });

  describe('3. Restock Exactly Once (Idempotent Inventory Movement)', () => {
    let activeReturnId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });
      activeReturnId = createRes.body.data._id;

      await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
    });

    it('records return_restore inventory movement exactly once upon receive', async () => {
      const initialStock = testProduct.countInStock; // 20

      // First receive
      const receiveRes = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ restock: true });

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.data.status).toBe('received');

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.countInStock).toBe(initialStock + 1); // 21

      const movements = await InventoryMovement.find({
        type: 'return_restore',
      });
      expect(movements.length).toBe(1);
      expect(movements[0].quantityChange).toBe(1);

      // Subsequent call cannot double-restock
      const secondCall = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ restock: true });

      expect(secondCall.status).toBe(400); // Already received

      const movementsAfter = await InventoryMovement.find({
        type: 'return_restore',
      });
      expect(movementsAfter.length).toBe(1);
    });
  });

  describe('4. Refund Idempotency and Over-Refund Protection', () => {
    let activeReturnId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });
      activeReturnId = createRes.body.data._id;

      await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ restock: true });
    });

    it('blocks over-refund when requested amount exceeds maximum refundable', async () => {
      // Order total is $300
      const res = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountUSD: 350 }); // Exceeds $300

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds maximum refundable/i);
    });

    it('blocks double refund on already refunded return', async () => {
      const firstRefund = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountUSD: 150 });

      expect(firstRefund.status).toBe(200);
      expect(firstRefund.body.data.status).toBe('refunded');

      // Second attempt must be blocked
      const secondRefund = await request(app)
        .post(`/api/v1/admin/returns/${activeReturnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountUSD: 150 });

      expect(secondRefund.status).toBe(400);
      expect(secondRefund.body.message).toMatch(/already been refunded/i);
    });
  });

  describe('5. Filters and Search Query Parameters', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });
    });

    it('filters returns by customer, order, and search', async () => {
      // Filter by customer
      const resCust = await request(app)
        .get(`/api/v1/admin/returns?customer=${customerUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resCust.status).toBe(200);
      expect(resCust.body.data.returns.length).toBe(1);

      // Filter by order number
      const resOrder = await request(app)
        .get(`/api/v1/admin/returns?order=NS-998877`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resOrder.status).toBe(200);
      expect(resOrder.body.data.returns.length).toBe(1);

      // Search term matching customer name
      const resSearch = await request(app)
        .get(`/api/v1/admin/returns?search=Firaol`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resSearch.status).toBe(200);
      expect(resSearch.body.data.returns.length).toBe(1);

      // Search term not matching
      const resNoMatch = await request(app)
        .get(`/api/v1/admin/returns?search=NonExistentPerson`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resNoMatch.status).toBe(200);
      expect(resNoMatch.body.data.returns.length).toBe(0);
    });
  });

  describe('6. Role & Permission Enforcement', () => {
    it('blocks viewer from executing mutations (approve, reject, receive, refund)', async () => {
      const createRes = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });
      const returnId = createRes.body.data._id;

      // Viewer attempts to approve
      const approveRes = await request(app)
        .post(`/api/v1/admin/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({});

      expect(approveRes.status).toBe(403);
      expect(approveRes.body.message).toMatch(/permission/i);

      // Customer attempts admin stats
      const statsRes = await request(app)
        .get('/api/v1/admin/returns/stats')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(statsRes.status).toBe(403);
    });
  });

  describe('7. Shared Return Rate Definition & Stats Deliberate Delta', () => {
    it('computes accurate return rate numerator and denominator with "-" when previous is zero', async () => {
      // 1 delivered order with 2 units.
      // 1 return request for 1 unit.
      await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });

      const statsRes = await request(app)
        .get('/api/v1/admin/returns/stats?periodDays=30')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      const data = statsRes.body.data;

      // 1 unit returned / 2 units delivered = 50.0%
      expect(data.returnRate.numerator).toBe(1);
      expect(data.returnRate.denominator).toBe(2);
      expect(data.returnRate.rate).toBe('50.0%');

      // Previous period was 0, so delta trend is '-'
      expect(data.totalReturns.trend).toBe('-');
    });
  });
});
