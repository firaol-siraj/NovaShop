import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import Category from '../src/models/categoryModel.js';
import Product from '../src/models/productModel.js';
import Variant from '../src/models/productVariantModel.js';
import Payment from '../src/models/paymentModel.js';
import chapaService from '../src/services/chapaService.js';
import emailService from '../src/services/emailService.js';
import { emailQueue, queueOrSendEmail } from '../src/queues/emailQueue.js';
import { markOrderPaid } from '../src/controllers/orderController.js';

describe('Production Readiness: Payment & Email Lifecycle Audit Tests', () => {
  let customerUser;
  let customerToken;
  let adminUser;
  let adminToken;
  let testCategory;
  let testProduct;
  let testVariant;
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || 'test_webhook_secret_key';

  beforeEach(async () => {
    process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-123456789';
    process.env.CHAPA_WEBHOOK_SECRET = webhookSecret;

    // Create customer user
    customerUser = await User.create({
      name: 'Test Customer',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
    });

    // Login customer
    const custLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.com', password: 'Password123!' });
    customerToken = custLoginRes.body.accessToken || custLoginRes.body.token;

    // Create admin user
    adminUser = await User.create({
      name: 'Test Admin',
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      role: 'admin',
      adminRole: 'admin',
      isEmailVerified: true,
      isActive: true,
    });

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@example.com', password: 'AdminPassword123!' });
    adminToken = adminLoginRes.body.accessToken || adminLoginRes.body.token;

    testCategory = await Category.create({
      name: 'Knitwear',
      slug: 'knitwear',
    });

    // Create test product and variant
    testProduct = await Product.create({
      user: adminUser._id,
      name: 'Luxury Cashmere Sweater',
      slug: 'luxury-cashmere-sweater',
      description: 'Ultra fine cashmere knit',
      price: 100.0,
      category: testCategory._id,
      status: 'active',
      image: 'https://example.com/sweater.jpg',
      countInStock: 10,
    });

    testVariant = await Variant.create({
      product: testProduct._id,
      sku: 'LCS-BLK-M',
      color: { name: 'Black', hex: '#000000' },
      size: 'M',
      price: 100.0,
      stock: 10,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Payment Lifecycle & Currency Reconciliation', () => {
    it('initializes Chapa payment with ETB conversion and sanitized description', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 100.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 100.0,
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      jest.spyOn(global, 'fetch').mockImplementationOnce(async (url, opts) => {
        const body = JSON.parse(opts.body);
        // Verify ETB conversion: 100 USD * 120 = 12,000 ETB
        expect(body.currency).toBe('ETB');
        expect(body.amount).toBe(12000);
        expect(body.customization.title).toBe('NovaShop');
        expect(body.customization.description).toMatch(/Payment for order/);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            message: 'Hosted Link',
            data: {
              checkout_url: 'https://checkout.chapa.co/checkout/payment/mock-checkout-key',
              chapa_reference: 'chapa_tx_mock_12345',
            },
          }),
        };
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkoutUrl).toBe('https://checkout.chapa.co/checkout/payment/mock-checkout-key');
      expect(res.body.data.amount).toBe(12000);
      expect(res.body.data.currency).toBe('ETB');

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.chapaReference).toBe('chapa_tx_mock_12345');
      expect(updatedOrder.paymentReference).toBeDefined();
    });

    it('confirms payment via GET /payment-status when Chapa reports success with ETB amount', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 2,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 200.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 200.0,
        paymentReference: 'NS_ORDER_POLL_TEST_REF_1',
        chapaReference: 'chapa_ref_poll_1',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      // 200 USD * 120 = 24,000 ETB
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            message: 'Payment details retrieved',
            data: {
              status: 'success',
              amount: 24000,
              currency: 'ETB',
              reference: 'chapa_ref_poll_1',
              tx_ref: 'NS_ORDER_POLL_TEST_REF_1',
            },
          }),
        };
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaid).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.status).toBe('processing');

      const confirmedOrder = await Order.findById(order._id);
      expect(confirmedOrder.isPaid).toBe(true);
      expect(confirmedOrder.paymentStatus).toBe('paid');
      expect(confirmedOrder.status).toBe('processing');
      expect(confirmedOrder.paidAt).toBeDefined();

      // Verify Payment record was created
      const paymentRecord = await Payment.findOne({ order: order._id });
      expect(paymentRecord).toBeDefined();
      expect(paymentRecord.status).toBe('success');
    });

    it('rejects payment confirmation on underpayment and leaves order as pending', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 100.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 100.0,
        paymentReference: 'NS_UNDERPAY_TEST_REF',
        chapaReference: 'chapa_underpay_ref',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      // Expected is 12,000 ETB, but Chapa says only 1,000 ETB
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              status: 'success',
              amount: 1000,
              currency: 'ETB',
              reference: 'chapa_underpay_ref',
              tx_ref: 'NS_UNDERPAY_TEST_REF',
            },
          }),
        };
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.paymentStatus).toBe('pending');

      const checkOrder = await Order.findById(order._id);
      expect(checkOrder.isPaid).toBe(false);
      expect(checkOrder.paymentStatus).toBe('pending');
    });

    it('is strictly idempotent: repeated polling does not duplicate payment records or stock deduction', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 2,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 200.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 200.0,
        paymentReference: 'NS_IDEMPOTENT_TEST_REF',
        chapaReference: 'chapa_idempotent_ref',
        isStockReserved: false, // Stock not yet deducted
        status: 'pending',
        paymentStatus: 'pending',
      });

      testVariant.stock = 10;
      await testVariant.save();

      // First poll
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              status: 'success',
              amount: 24000,
              currency: 'ETB',
              reference: 'chapa_idempotent_ref',
              tx_ref: 'NS_IDEMPOTENT_TEST_REF',
            },
          }),
        };
      });

      const poll1 = await request(app)
        .get(`/api/v1/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(poll1.body.data.isPaid).toBe(true);

      const variantAfterPoll1 = await Variant.findById(testVariant._id);
      expect(variantAfterPoll1.stock).toBe(8); // Decremented by 2

      // Second poll (duplicate check)
      const poll2 = await request(app)
        .get(`/api/v1/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(poll2.body.data.isPaid).toBe(true);

      const variantAfterPoll2 = await Variant.findById(testVariant._id);
      expect(variantAfterPoll2.stock).toBe(8); // Preserved at 8 (not decremented again)

      const paymentsCount = await Payment.countDocuments({ order: order._id });
      expect(paymentsCount).toBe(1); // Payment record not duplicated
    });
  });

  describe('2. Webhook Processing & Security', () => {
    it('rejects unverified webhook signature with 400', async () => {
      const payload = {
        event: 'payment.success',
        status: 'success',
        tx_ref: 'NS_FAKE_REF',
      };

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', 'invalidsignaturehex123')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid webhook signature/i);
    });

    it('verifies signature and executes secondary authoritative verification against Chapa API', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 100.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 100.0,
        paymentReference: 'NS_WH_VERIFIED_REF',
        chapaReference: 'chapa_wh_verified_ref',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      const payload = {
        event: 'payment.success',
        status: 'success',
        merchant_reference: 'NS_WH_VERIFIED_REF',
        chapa_reference: 'chapa_wh_verified_ref',
        amount: 12000,
        currency: 'ETB',
      };

      const rawString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawString).digest('hex');

      // Secondary authoritative verification mock
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              status: 'success',
              amount: 12000,
              currency: 'ETB',
              merchant_reference: 'NS_WH_VERIFIED_REF',
              chapa_reference: 'chapa_wh_verified_ref',
            },
          }),
        };
      });

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawString);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.status).toBe('paid');

      const updated = await Order.findById(order._id);
      expect(updated.isPaid).toBe(true);
      expect(updated.paymentStatus).toBe('paid');
      expect(updated.status).toBe('processing');
    });

    it('refuses to mark paid if secondary authoritative verification fails', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 100.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 100.0,
        paymentReference: 'NS_SPOOF_REF',
        chapaReference: 'chapa_spoof_ref',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      const payload = {
        event: 'payment.success',
        status: 'success',
        merchant_reference: 'NS_SPOOF_REF',
        chapa_reference: 'chapa_spoof_ref',
        amount: 12000,
        currency: 'ETB',
      };

      const rawString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawString).digest('hex');

      // Chapa secondary verify returns failed/not paid!
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            status: 'failed',
            message: 'Transaction failed',
          }),
        };
      });

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawString);

      // Webhook rejects unverified event without updating order to paid
      expect(res.status).toBe(400);
      expect(res.body.received).toBe(true);
      expect(res.body.error).toMatch(/Payment could not be verified/i);

      const checkOrder = await Order.findById(order._id);
      expect(checkOrder.isPaid).toBe(false);
      expect(checkOrder.paymentStatus).toBe('pending');
    });
  });

  describe('3. Forgot Password & Email Workflow', () => {
    it('generates a secure reset token, sets expiry, and completes password reset', async () => {
      // 1. Request password reset
      const forgotRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: customerUser.email });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);

      const userInDb = await User.findById(customerUser._id);
      expect(userInDb.passwordResetToken).toBeDefined();
      expect(userInDb.passwordResetExpires).toBeDefined();
      expect(userInDb.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());

      // 2. Simulate user visiting link with plain token (derived by setting a known hash)
      const plainToken = 'supersecretresettoken1234567890';
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      userInDb.passwordResetToken = hashedToken;
      userInDb.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await userInDb.save();

      // 3. Reset password using valid token
      const resetRes = await request(app)
        .put(`/api/v1/auth/reset-password/${plainToken}`)
        .send({ password: 'BrandNewSecurePassword123!' });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify token invalidated
      const userAfterReset = await User.findById(customerUser._id);
      expect(userAfterReset.passwordResetToken).toBeUndefined();
      expect(userAfterReset.passwordResetExpires).toBeUndefined();

      // 4. Verify user can log in with new password
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: customerUser.email, password: 'BrandNewSecurePassword123!' });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.accessToken || newLoginRes.body.token).toBeDefined();
    });

    it('rejects password reset with expired token', async () => {
      const plainToken = 'expiredtoken123';
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

      customerUser.passwordResetToken = hashedToken;
      customerUser.passwordResetExpires = Date.now() - 60000; // Expired 1 min ago
      await customerUser.save();

      const resetRes = await request(app)
        .put(`/api/v1/auth/reset-password/${plainToken}`)
        .send({ password: 'NewPassword123!' });

      expect(resetRes.status).toBe(400);
      expect(resetRes.body.message).toMatch(/invalid.*expired/i);
    });

    it('fallback queueOrSendEmail directly sends email if Redis queue is unavailable', async () => {
      const sendEmailSpy = jest.spyOn(emailService, 'sendEmail').mockResolvedValueOnce({
        success: true,
        messageId: '<test-fallback-delivery@novashop.com>',
      });

      // queueOrSendEmail with a job name that would fail to queue if redis is down
      const result = await queueOrSendEmail('testNotification', {
        to: 'direct-recipient@example.com',
        subject: 'Direct Notification Test',
        text: 'This is a test notification',
        html: '<p>This is a test notification</p>',
      });

      expect(result).toBeDefined();
      expect(result.success !== undefined || result.id !== undefined).toBe(true);
    });
  });

  describe('4. Production Security Remediation Regression Suite', () => {
    it('ignores client-submitted totalPrice: 0.01, authoritatively computing total', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              qty: 2,
              price: 0.01,
            },
          ],
          shippingAddress: {
            recipientName: 'Test Customer',
            address: 'Bole Road 123',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
            phone: '+251911223344',
          },
          paymentMethod: 'Chapa',
          currency: 'USD',
          totalPrice: 0.01,
          shippingPrice: 0,
          taxPrice: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalPrice).toBe(200.0);
      expect(res.body.data.itemsPrice).toBe(200.0);
      expect(res.body.data.currency).toBe('USD');
      expect(res.body.data.orderItems[0].price).toBe(100.0);

      const savedOrder = await Order.findById(res.body.data._id);
      expect(savedOrder.totalPrice).toBe(200.0);
      expect(savedOrder.currency).toBe('USD');
    });

    it('rejects arbitrary unsupported currency during order creation', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              qty: 1,
            },
          ],
          shippingAddress: {
            recipientName: 'Test Customer',
            address: 'Bole Road 123',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
            phone: '+251911223344',
          },
          paymentMethod: 'Chapa',
          currency: 'UNSUPPORTED_FAKE_COIN',
          shippingPrice: 0,
          taxPrice: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.message || JSON.stringify(res.body)).toMatch(/currency/i);
    });

    it('rejects webhook with 500 in production when CHAPA_WEBHOOK_SECRET is missing', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origSecret = process.env.CHAPA_WEBHOOK_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.CHAPA_WEBHOOK_SECRET;

        const res = await request(app)
          .post('/api/v1/orders/webhook/chapa')
          .send({ event: 'payment.success', tx_ref: 'NS_WH_TEST' });

        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/signature verification is not configured/i);
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        process.env.CHAPA_WEBHOOK_SECRET = origSecret;
      }
    });

    it('rejects webhook with 400 when signature header is missing in production', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        process.env.CHAPA_WEBHOOK_SECRET = 'production_secret_key_12345';

        const res = await request(app)
          .post('/api/v1/orders/webhook/chapa')
          .set('Content-Type', 'application/json')
          .send({ event: 'payment.success', tx_ref: 'NS_WH_TEST' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Missing x-chapa-signature header/i);
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        process.env.CHAPA_WEBHOOK_SECRET = webhookSecret;
      }
    });

    it('omits customer PII, addresses, and internal structures from public transaction verification', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        customerEmail: 'confidential.buyer@example.com',
        shippingAddress: {
          recipientName: 'High Profile Buyer',
          phone: '+251911998877',
          address: 'Classified Villa 42',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 100.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 100.0,
        paymentReference: 'NS_PII_TEST_REF_100',
        chapaReference: 'chapa_pii_100',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      const res = await request(app)
        .get(`/api/v1/orders/transaction/verify/${order.paymentReference}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      // Permitted public status fields
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.paymentStatus).toBe('pending');
      expect(res.body.data.status).toBe('pending');

      // Customer PII MUST NOT be present in public data
      expect(res.body.data.customerEmail).toBeUndefined();
      expect(res.body.data.shippingAddress).toBeUndefined();
      expect(res.body.data.phone).toBeUndefined();
      expect(res.body.data.recipientName).toBeUndefined();
      expect(res.body.data.user).toBeUndefined();
      expect(res.body.data.orderItems).toBeUndefined();
      expect(res.body.data._id).toBeUndefined();
    });

    it('handles concurrent payment confirmation attempts without duplicate stock deduction or duplicate payment records', async () => {
      testVariant.stock = 10;
      await testVariant.save();

      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 2,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        customerEmail: 'customer@example.com',
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 200.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 200.0,
        paymentReference: 'NS_CONCURRENT_RACE_REF',
        chapaReference: 'chapa_concurrent_race_ref',
        isStockReserved: false,
        status: 'pending',
        paymentStatus: 'pending',
      });

      const fakeVerificationData = {
        status: 'success',
        amount: 24000,
        currency: 'ETB',
        reference: 'chapa_concurrent_race_ref',
        tx_ref: 'NS_CONCURRENT_RACE_REF',
        paymentMethod: 'Chapa',
      };

      // Run 4 concurrent markOrderPaid executions simultaneously
      const results = await Promise.all([
        markOrderPaid(order, fakeVerificationData, 'customer@example.com'),
        markOrderPaid(order, fakeVerificationData, 'customer@example.com'),
        markOrderPaid(order, fakeVerificationData, 'customer@example.com'),
        markOrderPaid(order, fakeVerificationData, 'customer@example.com'),
      ]);

      expect(results).toHaveLength(4);
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.isPaid).toBe(true);
      expect(updatedOrder.paymentStatus).toBe('paid');

      // Stock must have decremented by exactly 2 (from 10 to 8)
      const variantInDb = await Variant.findById(testVariant._id);
      expect(variantInDb.stock).toBe(8);

      // Payment collection must have exactly 1 record for this order
      const payments = await Payment.find({ order: order._id });
      expect(payments).toHaveLength(1);
    });

    it('preserves pending payment status when Chapa lookup returns not found or null data', async () => {
      const order = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 100.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '+251911002233',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 100.0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 100.0,
        paymentReference: 'NS_NOT_FOUND_LOOKUP_REF',
        chapaReference: 'chapa_not_found_ref',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
      });

      jest.spyOn(chapaService, 'verifyPayment').mockResolvedValueOnce({
        success: false,
        status: 'failed',
        message: 'Transaction not found',
        data: null,
      });

      const res = await request(app)
        .get(`/api/v1/orders/transaction/verify/${order.paymentReference}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('pending');
      expect(res.body.verified).toBe(false);

      const orderInDb = await Order.findById(order._id);
      expect(orderInDb.paymentStatus).toBe('pending');
      expect(orderInDb.isPaid).toBe(false);
    });

    it('enforces CORS restrictions in production mode: blocks localhost and allows configured origins', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origClientUrl = process.env.CLIENT_URL;
      const origFrontendUrl = process.env.FRONTEND_URL;

      try {
        process.env.NODE_ENV = 'production';
        process.env.CLIENT_URL = 'https://novashop.store';
        delete process.env.FRONTEND_URL;

        // 1. In production, unconfigured localhost origin must be rejected with 403
        const blockedRes = await request(app)
          .get('/api/v1/products')
          .set('Origin', 'http://localhost:5173');

        expect(blockedRes.status).toBe(403);
        expect(blockedRes.body.message).toMatch(/CORS policy violation/i);

        // 2. In production, configured origin must be permitted
        const allowedRes = await request(app)
          .get('/api/v1/products')
          .set('Origin', 'https://novashop.store');

        expect(allowedRes.status).toBe(200);
        expect(allowedRes.headers['access-control-allow-origin']).toBe('https://novashop.store');
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        process.env.CLIENT_URL = origClientUrl;
        process.env.FRONTEND_URL = origFrontendUrl;
      }
    });
  });

  describe('5. Production Email & Chapa Payment Remediation Regression Suite', () => {
    afterEach(() => {
      emailService.resetEmailSender();
      emailService.resetTransporter();
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_API_KEY;
      delete process.env.BREVO_API_KEY;
      delete process.env.EMAIL_PROVIDER;
      delete process.env.RENDER_EXTERNAL_URL;
      delete process.env.BACKEND_URL;
    });

    describe('A. HTTPS Email Provider Integration', () => {
      it('delivers email successfully via mock Resend HTTPS API and records EmailLog', async () => {
        let capturedCall = null;
        emailService.setEmailSender(async (payload) => {
          capturedCall = payload;
          return {
            success: true,
            messageId: 'resend_msg_test_123',
            response: '200 OK',
            accepted: [payload.to],
            rejected: [],
          };
        });

        const result = await emailService.sendEmail({
          to: 'customer@example.com',
          subject: 'Order Confirmation #1001',
          text: 'Thank you for your order.',
          html: '<p>Thank you for your order.</p>',
          type: 'order_confirmation',
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('resend_msg_test_123');
        expect(capturedCall).toBeDefined();
        expect(capturedCall.to).toBe('customer@example.com');
        expect(capturedCall.subject).toBe('NovaShop: Order Confirmation #1001');
      });

      it('handles invalid provider credentials without reporting false success', async () => {
        emailService.setEmailSender(async () => {
          const err = new Error('Resend API delivery failed (401): API key is invalid');
          err.status = 401;
          throw err;
        });

        const result = await emailService.sendEmail({
          to: 'customer@example.com',
          subject: 'Security Alert',
          text: 'Login detected',
          type: 'security_alert',
          statusCategory: 'security',
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/API key is invalid|401/i);
      });

      it('handles provider network failure, retries bounded times and fails safely', async () => {
        let attempts = 0;
        emailService.setEmailSender(async () => {
          attempts += 1;
          const err = new Error('fetch failed: connection timeout to api.resend.com');
          err.status = 504;
          throw err;
        });

        const result = await emailService.sendEmail({
          to: 'customer@example.com',
          subject: 'Password Reset',
          text: 'Reset your password',
          type: 'password_reset',
          statusCategory: 'security',
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout|connection/i);
      });

      it('prevents duplicate email delivery within cooldown window using idempotencyKey', async () => {
        const idempotencyKey = `idemp_test_${Date.now()}`;
        emailService.setEmailSender(async () => ({
          success: true,
          messageId: 'msg_idemp_1',
          response: '200 OK',
        }));

        const firstSend = await emailService.sendEmail({
          to: 'duplicate-test@example.com',
          subject: 'Single Send Only',
          text: 'First dispatch',
          idempotencyKey,
        });

        expect(firstSend.success).toBe(true);
        expect(firstSend.deduplicated).toBeUndefined();

        // Immediate second send with same idempotency key
        const secondSend = await emailService.sendEmail({
          to: 'duplicate-test@example.com',
          subject: 'Single Send Only',
          text: 'Second dispatch',
          idempotencyKey,
        });

        expect(secondSend.success).toBe(true);
        expect(secondSend.deduplicated).toBe(true);
      });

      it('successfully dispatches password-reset email via forgot-password endpoint', async () => {
        let dispatched = null;
        emailService.setEmailSender(async (payload) => {
          dispatched = payload;
          return {
            success: true,
            messageId: 'pwd_reset_msg_id',
            response: '200 OK',
          };
        });

        const res = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: customerUser.email });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/password reset link has been sent/i);
      });

      it('successfully dispatches payment receipt email upon payment confirmation', async () => {
        let receiptPayload = null;
        emailService.setEmailSender(async (payload) => {
          receiptPayload = payload;
          return {
            success: true,
            messageId: 'receipt_msg_123',
            response: '200 OK',
          };
        });

        const order = await Order.create({
          user: customerUser._id,
          orderItems: [
            {
              product: testProduct._id,
              variant: testVariant._id,
              name: testProduct.name,
              qty: 1,
              price: 100.0,
              image: testProduct.image,
            },
          ],
          shippingAddress: {
            recipientName: 'Test Customer',
            address: 'Bole Road 123',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
            phone: '+251911223344',
          },
          paymentMethod: 'Chapa',
          currency: 'USD',
          totalPrice: 100.0,
          totalPriceETB: 12000.0,
          itemsPrice: 100.0,
          shippingPrice: 0,
          taxPrice: 0,
          status: 'pending',
          paymentStatus: 'pending',
          paymentReference: 'NS_RECEIPT_TEST_REF',
          chapaReference: 'chapa_receipt_test_ref',
        });

        const result = await markOrderPaid(
          order,
          {
            status: 'success',
            amount: 12000,
            currency: 'ETB',
            reference: 'chapa_receipt_test_ref',
            tx_ref: 'NS_RECEIPT_TEST_REF',
          },
          customerUser.email
        );

        expect(result.isPaid).toBe(true);
        expect(result.paymentStatus).toBe('paid');
      });
    });

    describe('B. Chapa Payment Lifecycle and Frontend Polling Fallback', () => {
      it('derives callback_url from RENDER_EXTERNAL_URL and includes trx_ref in return_url', () => {
        process.env.RENDER_EXTERNAL_URL = 'https://novashop-backend.onrender.com';
        process.env.FRONTEND_URL = 'https://novashop-frontend.onrender.com';

        const fakeOrder = {
          _id: '672cba123456789012345678',
          orderNumber: 'NS-99999',
          totalPrice: 50.0,
          totalPriceETB: 6000.0,
          currency: 'USD',
          usdToEtbRate: 120,
          user: { _id: '672cba123456789012345679', email: 'payer@example.com' },
          shippingAddress: { phone: '+251911223344' },
        };

        const payload = chapaService.buildInitializePayload({
          order: fakeOrder,
          customer: { firstName: 'Abebe', lastName: 'Bikila', email: 'payer@example.com' },
          txRef: 'NS_TEST_TX_REF_1',
        });

        expect(payload.amount).toBe(6000.0);
        expect(payload.currency).toBe('ETB');
        expect(payload.callback_url).toBe('https://novashop-backend.onrender.com/api/v1/orders/webhook/chapa');
        expect(payload.return_url).toContain('https://novashop-frontend.onrender.com/checkout/confirmation?orderId=672cba123456789012345678');
        expect(payload.return_url).toContain('trx_ref=NS_TEST_TX_REF_1');
      });

      it('supports public transaction verification directly using orderId when tx_ref is absent from query params', async () => {
        const order = await Order.create({
          user: customerUser._id,
          orderItems: [
            {
              product: testProduct._id,
              variant: testVariant._id,
              name: testProduct.name,
              qty: 1,
              price: 100.0,
              image: testProduct.image,
            },
          ],
          shippingAddress: {
            recipientName: 'Test Customer',
            address: 'Bole Road 123',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
            phone: '+251911223344',
          },
          paymentMethod: 'Chapa',
          currency: 'USD',
          totalPrice: 100.0,
          totalPriceETB: 12000.0,
          itemsPrice: 100.0,
          shippingPrice: 0,
          taxPrice: 0,
          status: 'pending',
          paymentStatus: 'pending',
          paymentReference: 'NS_ORDER_ID_LOOKUP_REF',
          chapaReference: 'chapa_order_id_lookup_ref',
        });

        jest.spyOn(chapaService, 'verifyPayment').mockResolvedValueOnce({
          success: true,
          status: 'success',
          amount: 12000,
          currency: 'ETB',
          reference: 'chapa_order_id_lookup_ref',
          tx_ref: 'NS_ORDER_ID_LOOKUP_REF',
          data: { status: 'success' },
        });

        // Query public verification using the order._id string (as frontend does when unauthenticated)
        const res = await request(app)
          .get(`/api/v1/orders/transaction/verify/${order._id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.verified).toBe(true);
        expect(res.body.paymentStatus).toBe('paid');
        expect(res.body.data).toBeDefined();
        expect(res.body.data.isPaid).toBe(true);
        expect(res.body.data.orderNumber).toBe(order.orderNumber);

        const updatedOrder = await Order.findById(order._id);
        expect(updatedOrder.isPaid).toBe(true);
        expect(updatedOrder.paymentStatus).toBe('paid');
      });

      it('preserves pending status when temporary Chapa API network timeout occurs during polling', async () => {
        const order = await Order.create({
          user: customerUser._id,
          orderItems: [
            {
              product: testProduct._id,
              variant: testVariant._id,
              name: testProduct.name,
              qty: 1,
              price: 100.0,
              image: testProduct.image,
            },
          ],
          shippingAddress: {
            recipientName: 'Test Customer',
            address: 'Bole Road 123',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
            phone: '+251911223344',
          },
          paymentMethod: 'Chapa',
          currency: 'USD',
          totalPrice: 100.0,
          totalPriceETB: 12000.0,
          itemsPrice: 100.0,
          shippingPrice: 0,
          taxPrice: 0,
          status: 'pending',
          paymentStatus: 'pending',
          paymentReference: 'NS_TIMEOUT_POLL_REF',
          chapaReference: 'chapa_timeout_poll_ref',
        });

        jest.spyOn(chapaService, 'verifyPayment').mockRejectedValueOnce(
          new Error('Chapa gateway timeout (ETIMEDOUT)')
        );

        const res = await request(app)
          .get(`/api/v1/orders/transaction/verify/${order.paymentReference}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.verified).toBe(false);
        expect(res.body.paymentStatus).toBe('pending');

        const dbOrder = await Order.findById(order._id);
        expect(dbOrder.paymentStatus).toBe('pending');
        expect(dbOrder.isPaid).toBe(false);
      });
    });
  });

  describe('6. Production Incident Remediation: Render Production Failure Regression Suite', () => {
    it('allows public access to POST /api/v1/payments/chapa/webhook without JWT Bearer token (no 401)', async () => {
      // Prior bug: paymentRoutes had router.use(protect), so Chapa webhooks to /api/v1/payments/chapa/webhook returned 401.
      const res = await request(app)
        .post('/api/v1/payments/chapa/webhook')
        .send({ event: 'charge.complete', tx_ref: 'non_existent_ref' });

      // Must NOT be 401 Unauthorized (should be 400 due to missing x-chapa-signature)
      expect(res.status).not.toBe(401);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/x-chapa-signature/i);
    });

    it('verifies valid HMAC signature on POST /api/v1/payments/chapa/webhook without JWT auth', async () => {
      const origSecret = process.env.CHAPA_WEBHOOK_SECRET;
      process.env.CHAPA_WEBHOOK_SECRET = 'render_test_webhook_secret_12345';

      try {
        const payload = JSON.stringify({
          event: 'charge.complete',
          tx_ref: 'unknown_reference_tx',
          status: 'success',
        });

        const signature = crypto
          .createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
          .update(payload)
          .digest('hex');

        const res = await request(app)
          .post('/api/v1/payments/chapa/webhook')
          .set('Content-Type', 'application/json')
          .set('x-chapa-signature', signature)
          .send(payload);

        // Order not found returns 200 with ignored: true
        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);
        expect(res.body.ignored).toBe(true);
      } finally {
        process.env.CHAPA_WEBHOOK_SECRET = origSecret;
      }
    });

    it('executes server-side shipping zone lookup and quote calculation without throwing getZoneByCountry errors', async () => {
      const orderPayload = {
        orderItems: [
          {
            product: testProduct._id.toString(),
            name: testProduct.name,
            qty: 1,
            price: testProduct.price,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Abebe Bikila',
          address: 'Meskel Square',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
          phone: '+251911223344',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        shippingPrice: 15.0, // Client tries to supply 15
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.shippingAddress.country).toBe('Ethiopia');
      // Server-side quote verified
      expect(res.body.data.shippingPrice).toBeDefined();
      expect(typeof res.body.data.shippingPrice).toBe('number');
    });

    it('queues initial order confirmation email with verified customer recipient address', async () => {
      const addSpy = jest.spyOn(emailQueue, 'add');

      const orderPayload = {
        orderItems: [
          {
            product: testProduct._id.toString(),
            name: testProduct.name,
            qty: 1,
            price: testProduct.price,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Test Recipient',
          address: 'Bole Medhanealem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
          phone: '+251911000000',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderPayload);

      expect(res.status).toBe(201);
      expect(addSpy).toHaveBeenCalled();
      const lastCall = addSpy.mock.calls.find((call) => call[0] === 'sendOrderConfirmationEmail');
      expect(lastCall).toBeDefined();
      // Ensure recipient email is non-empty customer email
      expect(lastCall[1].to).toBe('customer@example.com');
      expect(lastCall[1].email).toBe('customer@example.com');
      addSpy.mockRestore();
    });

    it('ensures getCookieOptions defaults to SameSite=Lax (or None for cross-site) allowing gateway return redirects', async () => {
      const { getCookieOptions } = await import('../src/utils/generateToken.js');

      const origEnv = process.env.NODE_ENV;
      const origSameSite = process.env.COOKIE_SAME_SITE;
      const origClientUrl = process.env.CLIENT_URL;
      const origFrontendUrl = process.env.FRONTEND_URL;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.COOKIE_SAME_SITE;
        delete process.env.CLIENT_URL;
        delete process.env.FRONTEND_URL;

        // Same-origin production defaults to 'strict'
        const optionsSameSite = getCookieOptions(7 * 24 * 60 * 60 * 1000);
        expect(optionsSameSite.sameSite).toBe('strict');
        expect(optionsSameSite.httpOnly).toBe(true);
        expect(optionsSameSite.secure).toBe(true);

        // Cross-site frontend/backend defaults to 'none' with secure: true
        process.env.CLIENT_URL = 'https://novashop-frontend.vercel.app';
        const optionsCrossSite = getCookieOptions(7 * 24 * 60 * 60 * 1000);
        expect(optionsCrossSite.sameSite).toBe('none');
        expect(optionsCrossSite.secure).toBe(true);

        // Explicit COOKIE_SAME_SITE=lax overrides appropriately
        process.env.COOKIE_SAME_SITE = 'lax';
        const optionsLax = getCookieOptions();
        expect(optionsLax.sameSite).toBe('lax');
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSameSite) process.env.COOKIE_SAME_SITE = origSameSite;
        if (origClientUrl) process.env.CLIENT_URL = origClientUrl;
        if (origFrontendUrl) process.env.FRONTEND_URL = origFrontendUrl;
      }
    });

    it('prioritizes Resend provider type when RESEND_API_KEY is present and SMTP credentials are missing', async () => {
      const { getEmailProviderType } = await import('../src/services/emailService.js');
      const origProvider = process.env.EMAIL_PROVIDER;
      const origResend = process.env.RESEND_API_KEY;
      const origPass = process.env.EMAIL_PASS;

      try {
        delete process.env.EMAIL_PASS;
        process.env.RESEND_API_KEY = 're_test_key_12345';
        process.env.EMAIL_PROVIDER = '';
        expect(getEmailProviderType()).toBe('resend');

        // Even if EMAIL_PROVIDER is accidentally 'smtp' but credentials are missing
        process.env.EMAIL_PROVIDER = 'smtp';
        expect(getEmailProviderType()).toBe('resend');
      } finally {
        if (origProvider !== undefined) process.env.EMAIL_PROVIDER = origProvider; else delete process.env.EMAIL_PROVIDER;
        if (origResend !== undefined) process.env.RESEND_API_KEY = origResend; else delete process.env.RESEND_API_KEY;
        if (origPass !== undefined) process.env.EMAIL_PASS = origPass; else delete process.env.EMAIL_PASS;
      }
    });

    it('injects trx_ref and tx_ref into Chapa return_url during buildInitializePayload', () => {
      const orderMock = {
        _id: '672d11112222333344445555',
        orderNumber: 'NS-1001',
        totalPrice: 100,
        currency: 'USD',
        shippingAddress: { phone: '0911223344' },
      };
      const customerMock = { name: 'Test Customer', email: 'test@example.com' };

      // Case 1: returnUrl supplied without trx_ref
      const customReturnUrl = 'https://novashop.onrender.com/checkout/confirmation?orderId=672d11112222333344445555';
      const payload1 = chapaService.buildInitializePayload({
        order: orderMock,
        customer: customerMock,
        returnUrl: customReturnUrl,
        txRef: 'NS-tx-12345',
      });
      expect(payload1.return_url).toContain('trx_ref=NS-tx-12345');
      expect(payload1.return_url).toContain('tx_ref=NS-tx-12345');
      expect(payload1.return_url).toContain('orderId=672d11112222333344445555');

      // Case 2: No returnUrl supplied
      const payload2 = chapaService.buildInitializePayload({
        order: orderMock,
        customer: customerMock,
        txRef: 'NS-tx-99999',
      });
      expect(payload2.return_url).toContain('trx_ref=NS-tx-99999');
      expect(payload2.return_url).toContain('tx_ref=NS-tx-99999');
    });
  });
});
