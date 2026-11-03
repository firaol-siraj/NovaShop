import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Category from '../src/models/categoryModel.js';
import { ShippingZone, ShippingMethod, ShippingRate } from '../src/models/shippingModel.js';
import ReturnRequest from '../src/models/returnRequestModel.js';
import Payment from '../src/models/paymentModel.js';
import { emailQueue } from '../src/queues/emailQueue.js';

const generateAccessToken = (id, role = 'user') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '15m',
  });
};

describe('Shipping & Returns End-to-End Integration Suite', () => {
  let customerUser;
  let adminUser;
  let customerToken;
  let adminToken;
  let testZone;
  let testMethod;
  let testRate;
  let testOrder;
  let testProduct;

  beforeAll(() => {
    emailQueue.add = jest.fn().mockResolvedValue(true);
  });

  beforeEach(async () => {
    emailQueue.add.mockClear();

    await Order.deleteMany({});
    await User.deleteMany({});
    await ShippingZone.deleteMany({});
    await ShippingMethod.deleteMany({});
    await ShippingRate.deleteMany({});
    await ReturnRequest.deleteMany({});
    await Payment.deleteMany({});
    await Product.deleteMany({});

    customerUser = await User.create({
      name: 'Alice Wonder',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
    });

    adminUser = await User.create({
      name: 'Admin Boss',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
    });

    customerToken = generateAccessToken(customerUser._id, 'user');
    adminToken = generateAccessToken(adminUser._id, 'admin');

    const testCategory = await Category.create({
      name: 'Dresses',
      slug: 'dresses',
    });

    testProduct = await Product.create({
      user: adminUser._id,
      name: 'Silk Evening Dress',
      slug: 'silk-evening-dress',
      price: 250,
      countInStock: 10,
      description: 'Elegant silk dress',
      image: 'https://example.com/dress.jpg',
      category: testCategory._id,
    });

    testZone = await ShippingZone.create({
      name: 'Addis Ababa',
      countries: ['Ethiopia'],
      regions: ['Addis Ababa'],
      status: 'active',
      freeOverThresholdUSD: 300,
    });

    testMethod = await ShippingMethod.create({
      name: 'Standard Courier',
      zone: testZone._id,
      carrier: 'Nova Logistics',
      rateStructure: 'Flat rate',
      status: 'active',
      estimatedMinDays: 2,
      estimatedMaxDays: 3,
    });

    testRate = await ShippingRate.create({
      method: testMethod._id,
      zone: testZone._id,
      amountUSD: 5,
      amountETB: 150,
      freeOverThresholdUSD: 300,
    });

    testOrder = await Order.create({
      user: customerUser._id,
      orderNumber: 'NS-TEST-RT100',
      orderItems: [
        {
          name: testProduct.name,
          qty: 1,
          price: 250,
          image: testProduct.image,
          product: testProduct._id,
          size: 'M',
          color: 'Navy',
        },
      ],
      shippingAddress: {
        recipientName: 'Alice Wonder',
        phone: '+251911223344',
        address: 'Bole Medhanealem',
        city: 'Addis Ababa',
        postalCode: '1000',
        country: 'Ethiopia',
      },
      paymentMethod: 'Chapa',
      totalPrice: 255,
      totalPriceETB: 30600,
      isPaid: true,
      paidAt: new Date(),
      status: 'delivered',
      isDelivered: true,
      deliveredAt: new Date(),
    });
  });

  describe('1. Shipping Quote Endpoint (POST /api/v1/shipping/quote)', () => {
    it('should return standard rate when cart total is below free shipping threshold', async () => {
      const res = await request(app)
        .post('/api/v1/shipping/quote')
        .send({
          country: 'Ethiopia',
          region: 'Addis Ababa',
          cartTotalUSD: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const quote = res.body.data[0];
      expect(quote.priceUSD).toBe(5);
      expect(quote.isFree).toBe(false);
    });

    it('should return 0 price (free shipping) when cart total reaches or exceeds $300 threshold', async () => {
      const res = await request(app)
        .post('/api/v1/shipping/quote')
        .send({
          country: 'Ethiopia',
          region: 'Addis Ababa',
          cartTotalUSD: 350,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const quote = res.body.data[0];
      expect(quote.priceUSD).toBe(0);
      expect(quote.isFree).toBe(true);
    });
  });

  describe('2. Customer Returns & Admin Processing', () => {
    it('should create customer return request for delivered order within 14 days', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [
            {
              orderItemIndex: 0,
              qty: 1,
              reason: 'Wrong size',
            },
          ],
          customerNote: 'Need smaller size',
          resolution: 'refund',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.returnNumber).toMatch(/^RT-/);
      expect(res.body.data.refundAmountUSD).toBe(250);
      expect(res.body.data.status).toBe('requested');

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.returnRequested).toBe(true);
    });

    it('should reject return if order is not delivered', async () => {
      testOrder.isDelivered = false;
      testOrder.status = 'processing';
      await testOrder.save();

      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/delivered/i);
    });

    it('should allow admin to approve, receive (restock), and refund return request', async () => {
      // 1. Customer initiates return
      const createRes = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: testOrder._id,
          items: [{ orderItemIndex: 0, qty: 1, reason: 'Wrong size' }],
          resolution: 'refund',
        });

      const returnId = createRes.body.data._id;

      // 2. Admin approves return
      const approveRes = await request(app)
        .post(`/api/v1/admin/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ trackingNumber: 'WB-998811' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('approved');

      // 3. Admin receives returned goods (restock)
      const initialStock = testProduct.countInStock;
      const receiveRes = await request(app)
        .post(`/api/v1/admin/returns/${returnId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ restock: true });

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.data.status).toBe('received');

      const checkProduct = await Product.findById(testProduct._id);
      expect(checkProduct.countInStock).toBe(initialStock + 1);

      // 4. Admin executes refund
      const refundRes = await request(app)
        .post(`/api/v1/admin/returns/${returnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountUSD: 250, refundMethod: 'Chapa (Original)' });

      expect(refundRes.status).toBe(200);
      expect(refundRes.body.data.status).toBe('refunded');

      // Check updated order refunded amounts
      const refundedOrder = await Order.findById(testOrder._id);
      expect(refundedOrder.refundedAmountUSD).toBe(250);
    });
  });

  describe('3. Admin Shipping & Payments Management APIs', () => {
    it('should return real shipping dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/shipping/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.zonesCount).toBeDefined();
      expect(res.body.data.deliveryZones).toBeInstanceOf(Array);
      expect(res.body.data.shippingMethods).toBeInstanceOf(Array);
      expect(res.body.data.shippingRates).toBeInstanceOf(Array);
      expect(res.body.data.deliveryTimes).toBeInstanceOf(Array);
    });

    it('should return real payments dashboard stats & transactions', async () => {
      const statsRes = await request(app)
        .get('/api/v1/admin/payments/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.success).toBe(true);
      expect(statsRes.body.data.totalReceived).toBeDefined();
      expect(statsRes.body.data.tabCounts).toBeDefined();

      const txnsRes = await request(app)
        .get('/api/v1/admin/payments/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(txnsRes.status).toBe(200);
      expect(txnsRes.body.success).toBe(true);
      expect(txnsRes.body.data.transactions).toBeInstanceOf(Array);
    });
  });
});
