import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import Category from '../src/models/categoryModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Discount from '../src/models/discountModel.js';
import DiscountRedemption from '../src/models/discountRedemptionModel.js';
import AnalyticsEvent from '../src/models/analyticsEventModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';

describe('Admin Analytics & Telemetry API Suite', () => {
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let category;
  let testProduct;
  let testVariant;
  let testDiscount;

  beforeEach(async () => {
    // 1. Create Admin
    adminUser = await User.create({
      name: 'Admin Firaol',
      email: 'admin.analytics@novashop.com',
      password: 'Password123!',
      role: 'admin',
      isVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    // 2. Create Customer
    customerUser = await User.create({
      name: 'Customer Birhanu',
      email: 'birhanu@example.com',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
    });
    customerToken = generateAccessToken(customerUser._id, 0, 'customer');

    // 3. Create Category
    category = await Category.create({
      name: 'Outerwear',
      slug: 'outerwear',
      description: 'Outerwear collection',
    });

    // 4. Create Product & Variant
    testProduct = await Product.create({
      user: adminUser._id,
      name: 'Cashmere Overcoat',
      slug: 'cashmere-overcoat',
      brand: 'NovaShop',
      category: category._id,
      price: 350,
      image: '/images/coat.jpg',
      description: 'Luxury winter overcoat',
      countInStock: 20,
    });

    testVariant = await ProductVariant.create({
      product: testProduct._id,
      sku: 'NS-COAT-001',
      size: 'L',
      color: { name: 'Charcoal', hex: '#333333' },
      stock: 4,
      stockQuantity: 4, // low stock
      price: 350,
    });

    // 5. Create Discount
    testDiscount = await Discount.create({
      name: 'Welcome Offer',
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      isActive: true,
    });
  });

  describe('Security & Access Control', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/analytics/overview');
      expect(res.status).toBe(401);
    });

    it('should reject customer tokens with 403 on admin analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Storefront Telemetry (POST /api/track)', () => {
    it('should record tracking events with derived traffic channel', async () => {
      const payload = {
        sessionId: 'test-session-12345',
        eventType: 'session_start',
        referrer: 'https://www.google.com/search?q=novashop',
        utmSource: 'google',
        utmMedium: 'organic',
        landingPage: '/shop',
        deviceType: 'desktop',
      };

      const res = await request(app).post('/api/track').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const event = await AnalyticsEvent.findOne({ sessionId: 'test-session-12345' });
      expect(event).toBeTruthy();
      expect(event.trafficChannel).toBe('Organic search');
    });

    it('should ignore automated bot user agents with 204 status', async () => {
      const payload = {
        sessionId: 'bot-session-999',
        eventType: 'session_start',
      };

      const res = await request(app)
        .post('/api/track')
        .set('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
        .send(payload);

      expect(res.status).toBe(204);
      const count = await AnalyticsEvent.countDocuments({ sessionId: 'bot-session-999' });
      expect(count).toBe(0);
    });

    it('should respect Do-Not-Track (DNT: 1) header with 204 status', async () => {
      const payload = {
        sessionId: 'dnt-session-888',
        eventType: 'session_start',
      };

      const res = await request(app)
        .post('/api/track')
        .set('DNT', '1')
        .send(payload);

      expect(res.status).toBe(204);
      const count = await AnalyticsEvent.countDocuments({ sessionId: 'dnt-session-888' });
      expect(count).toBe(0);
    });
  });

  describe('Analytics Overview (GET /api/admin/analytics/overview)', () => {
    it('should accurately calculate KPIs and funnel from paid orders and events', async () => {
      const now = new Date();

      // Create tracking events
      await AnalyticsEvent.create({
        sessionId: 'sess-1',
        eventType: 'session_start',
        trafficChannel: 'Direct',
        createdAt: now,
      });
      await AnalyticsEvent.create({
        sessionId: 'sess-1',
        eventType: 'add_to_cart',
        createdAt: now,
      });
      await AnalyticsEvent.create({
        sessionId: 'sess-1',
        eventType: 'begin_checkout',
        createdAt: now,
      });

      // Create Paid order
      await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            name: 'Cashmere Overcoat',
            qty: 2,
            image: '/images/coat.jpg',
            price: 350,
            product: testProduct._id,
          },
        ],
        shippingAddress: {
          address: 'Bole Medhanialem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
          countryOrRegion: 'Ethiopia',
        },
        paymentMethod: 'Telebirr',
        sessionId: 'sess-1',
        isPaid: true,
        paidAt: now,
        status: 'processing',
        paymentStatus: 'paid',
        itemsPrice: 700,
        totalPrice: 700,
        discountAmount: 0,
      });

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis.revenue.value).toBe(700);
      expect(res.body.data.kpis.orders.value).toBe(1);
      expect(res.body.data.kpis.aov.value).toBe(700);
      expect(res.body.data.funnel.hasTracking).toBe(true);
      expect(res.body.data.funnel.steps[0].value).toBe(1); // 1 session
      expect(res.body.data.funnel.steps[1].value).toBe(1); // 1 add to cart
      expect(res.body.data.funnel.steps[2].value).toBe(1); // 1 checkout
      expect(res.body.data.funnel.steps[3].value).toBe(1); // 1 purchased
      expect(res.body.data.topProducts.length).toBe(1);
      expect(res.body.data.topProducts[0].name).toBe('Cashmere Overcoat');
      expect(res.body.data.topProducts[0].units).toBe(2);
      expect(res.body.data.salesByCountry[0].label).toBe('Ethiopia');
    });
  });

  describe('Sales Analytics (GET /api/admin/analytics/sales)', () => {
    it('should aggregate gross sales, net sales, refunds, and heatmap in store timezone', async () => {
      const now = new Date();

      // 1. Paid order with discount
      const paidOrderWithDiscount = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            name: 'Cashmere Overcoat',
            qty: 1,
            image: '/images/coat.jpg',
            price: 350,
            product: testProduct._id,
          },
        ],
        shippingAddress: {
          address: 'Kazanchis',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'CBE Birr',
        discountCode: 'WELCOME10',
        discountAmount: 35,
        isPaid: true,
        paidAt: now,
        status: 'delivered',
        paymentStatus: 'paid',
        itemsPrice: 350,
        totalPrice: 315,
      });

      const disc = testDiscount;

      await DiscountRedemption.create({
        discount: disc._id,
        code: 'WELCOME10',
        order: paidOrderWithDiscount._id,
        user: customerUser._id,
        amountDiscounted: 35,
        orderTotal: 315,
        createdAt: now,
      });

      // 2. Refunded order
      await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            name: 'Cashmere Overcoat',
            qty: 1,
            image: '/images/coat.jpg',
            price: 350,
            product: testProduct._id,
          },
        ],
        shippingAddress: {
          address: 'Bole',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Telebirr',
        isPaid: true,
        paidAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        refundedAt: now,
        status: 'refunded',
        paymentStatus: 'refunded',
        totalPrice: 350,
      });

      const res = await request(app)
        .get('/api/admin/analytics/sales')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis.grossSales.value).toBe(700); // (315+35) + 350
      expect(res.body.data.kpis.refunds.value).toBe(350);
      expect(res.body.data.kpis.netSales.value).toBe(315); // 700 - 35 - 350
      expect(res.body.data.heatmap.matrix.length).toBe(7); // 7 days
      expect(res.body.data.heatmap.matrix[0].length).toBe(6); // 6 slots
      expect(res.body.data.paymentMethods.length).toBeGreaterThan(0);
      expect(res.body.data.discountPerformance.length).toBe(1);
      expect(res.body.data.discountPerformance[0].code).toBe('WELCOME10');
    });
  });

  describe('Product Analytics (GET /api/admin/analytics/products)', () => {
    it('should return restock alerts for low stock variants', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restockAlerts.length).toBeGreaterThan(0);
      expect(res.body.data.restockAlerts[0].sku).toBe('NS-COAT-001');
    });
  });

  describe('Customer Analytics (GET /api/admin/analytics/customers)', () => {
    it('should return customer metrics and top customers list', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/customers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis.totalCustomers.value).toBeGreaterThanOrEqual(1);
      expect(res.body.data.ordersPerCustomer.length).toBe(4);
    });
  });

  describe('CSV Export (GET /api/admin/analytics/export)', () => {
    it('should export valid CSV with proper headers', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/export?page=overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('"Metric","Value"');
      expect(res.text).toContain('"Revenue"');
    });
  });
});
