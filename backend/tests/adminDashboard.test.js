import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Category from '../src/models/categoryModel.js';
import AdminNotification from '../src/models/adminNotificationModel.js';
import Setting from '../src/models/settingModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';

describe('Admin Dashboard Endpoints', () => {
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let category;
  let product;
  let variantLow;
  let variantCritical;
  let paidOrder;
  let deliveredOrder;

  beforeEach(async () => {
    // 1. Create Admin & Customer users
    adminUser = await User.create({
      name: 'Test Administrator',
      email: 'admin-dashboard@example.com',
      password: 'Password123!',
      role: 'admin',
      isVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    customerUser = await User.create({
      name: 'Regular Customer',
      email: 'customer-dashboard@example.com',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
    });
    customerToken = generateAccessToken(customerUser._id, 0, 'customer');

    // 2. Create Category, Product, and Variants
    category = await Category.create({
      name: 'Apparel',
      slug: 'apparel',
      description: 'Apparel category',
    });

    product = await Product.create({
      user: adminUser._id,
      name: 'Tailored Cashmere Coat',
      slug: 'tailored-cashmere-coat',
      brand: 'NovaShop',
      category: category._id,
      price: 450,
      image: '/images/coat.jpg',
      description: 'Luxury coat',
    });

    variantLow = await ProductVariant.create({
      product: product._id,
      sku: 'COAT-BLK-M',
      size: 'M',
      color: { name: 'Black', hex: '#000000' },
      stock: 3, // Low stock (<= 5)
      price: 450,
    });

    variantCritical = await ProductVariant.create({
      product: product._id,
      sku: 'COAT-BLK-S',
      size: 'S',
      color: { name: 'Black', hex: '#000000' },
      stock: 0, // Critical stock (0)
      price: 450,
    });

    // 3. Create Orders
    const now = new Date();
    const paidAtTime = new Date(now.getTime() - 2 * 3600000); // 2 hours ago

    paidOrder = await Order.create({
      user: customerUser._id,
      orderNumber: 'NS-99990001',
      orderItems: [
        {
          name: 'Tailored Cashmere Coat',
          qty: 1,
          image: '/images/coat.jpg',
          price: 450,
          product: product._id,
          variant: variantLow._id,
          sku: 'COAT-BLK-M',
          size: 'M',
          color: 'Black',
        },
      ],
      shippingAddress: {
        recipientName: 'Regular Customer',
        phone: '+251911223344',
        address: 'Bole Subcity',
        city: 'Addis Ababa',
        postalCode: '1000',
        country: 'Ethiopia',
      },
      paymentMethod: 'Chapa',
      status: 'processing',
      isPaid: true,
      paidAt: paidAtTime,
      totalPrice: 450,
      itemsPrice: 450,
      taxPrice: 0,
      shippingPrice: 0,
    });

    deliveredOrder = await Order.create({
      user: customerUser._id,
      orderNumber: 'NS-99990002',
      orderItems: [
        {
          name: 'Tailored Cashmere Coat',
          qty: 2,
          image: '/images/coat.jpg',
          price: 450,
          product: product._id,
          variant: variantLow._id,
          sku: 'COAT-BLK-M',
          size: 'M',
          color: 'Black',
        },
      ],
      shippingAddress: {
        recipientName: 'Regular Customer',
        address: 'Bole Subcity',
        city: 'Addis Ababa',
        postalCode: '1000',
        country: 'Ethiopia',
      },
      paymentMethod: 'Chapa',
      status: 'delivered',
      isPaid: true,
      paidAt: paidAtTime,
      isDelivered: true,
      deliveredAt: new Date(paidAtTime.getTime() + 5 * 3600000), // Delivered within 5 hours (timely!)
      totalPrice: 900,
      itemsPrice: 900,
      taxPrice: 0,
      shippingPrice: 0,
    });

    // 4. Default Setting
    await Setting.create({
      key: 'lowStockThreshold',
      value: 5,
    });
  });

  describe('Security & Access Control', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('should reject customer tokens with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/summary')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/dashboard/summary', () => {
    it('should calculate accurate KPIs from real orders and catalog', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { revenue, ordersFulfilled, activeCustomers, catalogHealth } = res.body.data;

      // Net Revenue: 450 + 900 = 1350
      expect(revenue.totalNetRevenue).toBe(1350);
      expect(Array.isArray(revenue.sparkline)).toBe(true);

      // Orders Fulfilled: 1 (deliveredOrder)
      expect(ordersFulfilled.totalFulfilled).toBe(1);
      expect(ordersFulfilled.timelyDispatchRate).toBe(100);

      // Active Customers: 1
      expect(activeCustomers.totalActiveCustomers).toBe(1);
      expect(activeCustomers.repeatCustomerRate).toBe(100); // customerUser has 2 paid orders

      // Catalog Health: 2 variants total (1 critical, 1 low)
      expect(catalogHealth.totalSKUs).toBe(2);
      expect(catalogHealth.critical).toBe(1);
      expect(catalogHealth.lowStock).toBe(1);
      expect(catalogHealth.lowStockThreshold).toBe(5);
    });
  });

  describe('GET /api/v1/admin/dashboard/revenue', () => {
    it('should return continuous revenue velocity timeline series with peak day', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/revenue?interval=day')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { netSales, aov, conversionRateTracked, peakDay, currentSeries } = res.body.data;

      expect(netSales).toBe(1350);
      expect(aov).toBe(675); // 1350 / 2 paid orders
      expect(conversionRateTracked).toBe(false);
      expect(peakDay).toBeDefined();
      expect(peakDay.revenue).toBe(1350);
      expect(Array.isArray(currentSeries)).toBe(true);
      expect(currentSeries.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/admin/dashboard/top-products', () => {
    it('should aggregate top products by units sold for paid orders', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/top-products?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalCatalogCount).toBe(1);

      const top = res.body.data.topProducts;
      expect(top.length).toBe(1);
      expect(top[0].name).toBe('Tailored Cashmere Coat');
      expect(top[0].unitsSold).toBe(3); // 1 + 2
      expect(top[0].totalRevenue).toBe(1350);
    });
  });

  describe('GET /api/v1/admin/dashboard/inventory-alerts', () => {
    it('should list out-of-stock and low-stock variants sorted by urgency', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/inventory-alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { alerts, criticalCount } = res.body.data;

      expect(alerts.length).toBe(2);
      expect(criticalCount).toBe(1);
      // Urgency sort: stock 0 comes first!
      expect(alerts[0].sku).toBe('COAT-BLK-S');
      expect(alerts[0].isCritical).toBe(true);
      expect(alerts[1].sku).toBe('COAT-BLK-M');
      expect(alerts[1].isLow).toBe(true);
    });
  });

  describe('GET /api/v1/admin/dashboard/fulfillment-queue and Dispatch', () => {
    it('should fetch queued orders and dispatch them with status history and notifications', async () => {
      // 1. Queue check
      const queueRes = await request(app)
        .get('/api/v1/admin/dashboard/fulfillment-queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(queueRes.status).toBe(200);
      expect(queueRes.body.data.count).toBe(1); // paidOrder is in status 'processing'
      expect(queueRes.body.data.orders[0].orderNumber).toBe('NS-99990001');

      // 2. Dispatch
      const dispatchRes = await request(app)
        .post('/api/v1/admin/orders/dispatch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Handed to DHL courier' });

      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.dispatchedCount).toBe(1);

      // Verify order status changed to shipped
      const updatedOrder = await Order.findById(paidOrder._id);
      expect(updatedOrder.status).toBe('shipped');
      expect(updatedOrder.statusHistory.length).toBeGreaterThan(0);
      expect(updatedOrder.statusHistory.at(-1).status).toBe('shipped');
      expect(updatedOrder.statusHistory.at(-1).note).toBe('Handed to DHL courier');
    });
  });

  describe('GET /api/v1/admin/orders', () => {
    it('should return paginated orders with search and status filtering', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?page=1&limit=6&search=99990001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orders.length).toBe(1);
      expect(res.body.data.orders[0].orderNumber).toBe('NS-99990001');
      expect(res.body.data.pagination.total).toBe(1);
    });
  });

  describe('Admin Notifications and Search', () => {
    it('should handle admin notifications lifecycle', async () => {
      const notifRes = await request(app)
        .get('/api/v1/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(notifRes.status).toBe(200);
      expect(notifRes.body.success).toBe(true);

      const notifId = notifRes.body.data.notifications[0]?._id;
      if (notifId) {
        const readRes = await request(app)
          .patch(`/api/v1/admin/notifications/${notifId}/read`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(readRes.status).toBe(200);
      }
    });

    it('should return global search results for ⌘K', async () => {
      const searchRes = await request(app)
        .get('/api/v1/admin/search?q=Coat')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.products.length).toBe(1);
      expect(searchRes.body.data.products[0].name).toBe('Tailored Cashmere Coat');
    });

    it('should export CSV report with real headers and data', async () => {
      const exportRes = await request(app)
        .get('/api/v1/admin/reports/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('text/csv');
      expect(exportRes.text).toContain('NOVASHOP STORE PERFORMANCE REPORT');
      expect(exportRes.text).toContain('NS-99990001');
    });
  });
});
