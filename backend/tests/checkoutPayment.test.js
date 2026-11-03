import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import app from '../src/app.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Category from '../src/models/categoryModel.js';
import Cart from '../src/models/cartModel.js';
import { emailQueue } from '../src/queues/emailQueue.js';

const generateAccessToken = (id, role = 'user') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '15m',
  });
};

describe('Milestone 6: Checkout, Order Security, and Chapa Payment Integration', () => {
  let customerUser;
  let otherUser;
  let adminUser;
  let customerToken;
  let otherToken;
  let adminToken;
  let testCategory;
  let testProduct;
  let testVariant;
  const originalEnv = { ...process.env };

  beforeAll(() => {
    emailQueue.add = jest.fn().mockResolvedValue(true);
  });

  beforeEach(async () => {
    emailQueue.add.mockClear();
    process.env.CHAPA_SECRET_KEY = 'chapa_sec_test_mock_key';
    process.env.CHAPA_WEBHOOK_SECRET = 'chapa_webhook_secret_key';
    process.env.CHAPA_MODE = 'test';

    await Order.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await ProductVariant.deleteMany({});
    await Category.deleteMany({});
    await Cart.deleteMany({});

    customerUser = await User.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'Password123!',
      role: 'customer',
    });

    otherUser = await User.create({
      name: 'John Stranger',
      email: 'john@example.com',
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
    otherToken = generateAccessToken(otherUser._id, 'user');
    adminToken = generateAccessToken(adminUser._id, 'admin');

    testCategory = await Category.create({
      name: 'Apparel',
      slug: 'apparel',
    });

    testProduct = await Product.create({
      user: adminUser._id,
      name: 'Classic Linen Shirt',
      slug: 'classic-linen-shirt',
      price: 80.0,
      countInStock: 20,
      description: 'Pure linen relaxed shirt',
      image: 'https://example.com/linen-shirt.jpg',
      category: testCategory._id,
      status: 'active',
    });

    testVariant = await ProductVariant.create({
      product: testProduct._id,
      sku: 'CLS-WHT-M',
      size: 'M',
      color: { name: 'White', hex: '#FFFFFF' },
      stock: 10,
      price: 85.0, // variant specific price override
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (global.fetch && global.fetch.mockRestore) {
      global.fetch.mockRestore();
    }
  });

  describe('1. Order Creation & Authoritative Pricing Security', () => {
    it('should reject unauthenticated checkout request (401)', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          orderItems: [{ product: testProduct._id, qty: 1 }],
          shippingAddress: { address: 'Main St', city: 'Addis Ababa', postalCode: '1000', country: 'Ethiopia' },
        });

      expect(res.status).toBe(401);
    });

    it('should reject checkout when order cart is empty (400)', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [],
          shippingAddress: { address: 'Main St', city: 'Addis Ababa', postalCode: '1000', country: 'Ethiopia' },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/empty/i);
    });

    it('should reject checkout when product is inactive or not found', async () => {
      const inactiveProduct = await Product.create({
        user: adminUser._id,
        name: 'Archived Dress',
        slug: 'archived-dress',
        price: 120.0,
        countInStock: 5,
        description: 'No longer for sale',
        image: 'https://example.com/dress.jpg',
        category: testCategory._id,
        status: 'archived',
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [{ product: inactiveProduct._id.toString(), qty: 1 }],
          shippingAddress: { address: 'Main St', city: 'Addis Ababa', postalCode: '1000', country: 'Ethiopia' },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not available/i);
    });

    it('should reject checkout when requested quantity exceeds variant stock', async () => {
      const initialVariantStock = testVariant.stock;

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              qty: initialVariantStock + 5, // 15 requested when only 10 in stock
            },
          ],
          shippingAddress: { address: 'Main St', city: 'Addis Ababa', postalCode: '1000', country: 'Ethiopia' },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Insufficient stock/i);

      // Verify stock was NOT decremented
      const checkVariant = await ProductVariant.findById(testVariant._id);
      expect(checkVariant.stock).toBe(initialVariantStock);
    });

    it('should reject checkout if variant does not belong to specified product', async () => {
      const otherProduct = await Product.create({
        user: adminUser._id,
        name: 'Different Product',
        slug: 'diff-prod',
        price: 50.0,
        countInStock: 10,
        description: 'Other item',
        image: 'https://example.com/other.jpg',
        category: testCategory._id,
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: otherProduct._id.toString(),
              variant: testVariant._id.toString(), // Belongs to testProduct, not otherProduct!
              qty: 1,
            },
          ],
          shippingAddress: { address: 'Main St', city: 'Addis Ababa', postalCode: '1000', country: 'Ethiopia' },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Variant does not belong/i);
    });

    it('should ignore client-tampered prices and calculate authoritative server price and reserve stock', async () => {
      const requestedQty = 2;
      const initialStock = testVariant.stock;

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              qty: requestedQty,
              price: 1.0, // TAMPERED PRICE: Client tried to pay $1 instead of $85!
            },
          ],
          shippingAddress: {
            recipientName: 'Jane Doe',
            phone: '+251911223344',
            address: '123 Bole Road',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
          },
          paymentMethod: 'Chapa',
          shippingPrice: 10.0,
          taxPrice: 5.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const orderData = res.body.data;
      expect(orderData._id).toBeDefined();
      expect(orderData.orderNumber).toMatch(/^NS-/);
      expect(orderData.orderItems[0].price).toBe(85.0); // Authoritative variant price!
      expect(orderData.itemsPrice).toBe(170.0); // 85 * 2
      expect(orderData.shippingPrice).toBe(10.0);
      expect(orderData.taxPrice).toBe(5.0);
      expect(orderData.totalPrice).toBe(185.0); // 170 + 10 + 5
      expect(orderData.isPaid).toBe(false);
      expect(orderData.paymentStatus).toBe('pending');
      expect(orderData.status).toBe('pending');
      expect(orderData.isStockReserved).toBe(false);

      // Verify variant stock was NOT decremented yet for unpaid online payment
      const updatedVariant = await ProductVariant.findById(testVariant._id);
      expect(updatedVariant.stock).toBe(initialStock);
    });

    it('should create Cash on Delivery orders as processing and decrement stock immediately', async () => {
      const initialStock = testVariant.stock;
      await Cart.create({
        user: customerUser._id,
        items: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            quantity: 1,
            price: 85.0,
          },
        ],
      });

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
            recipientName: 'Jane Doe',
            phone: '+251911223344',
            address: '123 Bole Road',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
          },
          paymentMethod: 'Cash on Delivery',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentMethod).toBe('Cash on Delivery');
      expect(res.body.data.status).toBe('processing');
      expect(res.body.data.isPaid).toBe(false);

      // Verify stock was decremented immediately for COD
      const checkVariant = await ProductVariant.findById(testVariant._id);
      expect(checkVariant.stock).toBe(initialStock - 1);

      // Cart should be reconciled
      const updatedCart = await Cart.findOne({ user: customerUser._id });
      expect(updatedCart.items.length).toBe(0);
    });

    it('should reject checkout when delivery address is incomplete', async () => {
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
            address: '', // Invalid: missing address
            city: '',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/shippingAddress/i);
    });

    it('should automatically populate order items from user server cart when orderItems is omitted', async () => {
      await Cart.create({
        user: customerUser._id,
        items: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            quantity: 1,
          },
        ],
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            recipientName: 'Jane Doe',
            phone: '+251911223344',
            address: '123 Bole Road',
            city: 'Addis Ababa',
            postalCode: '1000',
            country: 'Ethiopia',
          },
          paymentMethod: 'Chapa',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderItems.length).toBe(1);
      expect(res.body.data.orderItems[0].price).toBe(85.0);
      expect(res.body.data.isStockReserved).toBe(false);
    });
  });

  describe('2. Chapa Payment Initialization (POST /api/v1/orders/:id/initialize-payment)', () => {
    let pendingOrder;

    beforeEach(async () => {
      pendingOrder = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 85.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Jane Doe',
          phone: '+251911223344',
          address: '123 Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 85.0,
        shippingPrice: 10.0,
        taxPrice: 0,
        totalPrice: 95.0,
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
        isPaid: false,
      });
    });

    it('should fail safely with 500 when CHAPA_SECRET_KEY is missing', async () => {
      delete process.env.CHAPA_SECRET_KEY;

      const res = await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ returnUrl: 'http://localhost:5173/order-confirmation' });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/CHAPA_SECRET_KEY is missing/i);
    });

    it('should prevent unauthorized users from initializing payment for another users order', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ returnUrl: 'http://localhost:5173/order-confirmation' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Not authorized/i);
    });

    it('should successfully call Chapa API v1 transaction endpoint and return checkout URL', async () => {
      const mockCheckoutUrl = 'https://checkout.chapa.co/checkout/payment/mock-checkout-session-123';
      const mockChapaRef = 'chapa-tx-ref-987';

      jest.spyOn(global, 'fetch').mockImplementationOnce(async (url, options) => {
        expect(url).toBe('https://api.chapa.co/v1/transaction/initialize');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(`Bearer ${process.env.CHAPA_SECRET_KEY}`);

        const parsedBody = JSON.parse(options.body);
        expect(parsedBody.amount).toBe(95.0 * 120);
        expect(parsedBody.currency).toBe('ETB');
        expect(parsedBody.tx_ref).toBeDefined();

        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Hosted payment URL created.',
            status: 'success',
            data: {
              checkout_url: mockCheckoutUrl,
              chapa_reference: mockChapaRef,
            },
          }),
        };
      });

      const res = await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ returnUrl: 'http://localhost:5173/order-confirmation' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkoutUrl).toBe(mockCheckoutUrl);
      expect(res.body.data.merchantReference).toBeDefined();
      expect(res.body.data.chapaReference).toBe(mockChapaRef);

      // Verify references were saved on the order
      const updatedOrder = await Order.findById(pendingOrder._id);
      expect(updatedOrder.paymentReference).toBe(res.body.data.merchantReference);
      expect(updatedOrder.chapaReference).toBe(mockChapaRef);
    });

    it('should reject payment initialization for orders that are already paid', async () => {
      pendingOrder.isPaid = true;
      pendingOrder.paymentStatus = 'paid';
      await pendingOrder.save();

      const res = await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already paid/i);
    });

    it('should preserve inventory stock without double-decrementing during payment retry initialization', async () => {
      const initialStock = testVariant.stock;

      jest.spyOn(global, 'fetch').mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: {
            checkout_url: 'https://checkout.chapa.co/checkout/payment/mock-session-retry',
            chapa_reference: 'chapa-tx-retry-1',
          },
        }),
      }));

      // First initialization attempt
      await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      // Second initialization attempt (retry)
      await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      // Stock must remain unchanged after initialization retries
      const checkVariant = await ProductVariant.findById(testVariant._id);
      expect(checkVariant.stock).toBe(initialStock);
    });

    it('should sanitize customization fields and names to strictly match /^[a-zA-Z0-9\\-_. ]*$/ even with special chars and emojis', async () => {
      // Set special characters and symbols in user name and order number
      customerUser.name = "John O'Connor & Sons #1 🔥";
      await customerUser.save();

      pendingOrder.orderNumber = 'Order #NS-667056574:Summer/Sale ($95) 👗';
      pendingOrder.isPaid = false;
      pendingOrder.paymentStatus = 'pending';
      await pendingOrder.save();

      let interceptedPayload = null;

      jest.spyOn(global, 'fetch').mockImplementationOnce(async (url, options) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              checkout_url: 'https://checkout.chapa.co/checkout/payment/mock-clean-session',
              chapa_reference: 'chapa-tx-clean-1',
            },
          }),
        };
      });

      const res = await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ returnUrl: 'http://localhost:5173/checkout/confirmation?orderId=' + pendingOrder._id });

      expect(res.status).toBe(200);
      expect(interceptedPayload).not.toBeNull();

      const chapaSafeRegex = /^[a-zA-Z0-9\-_. ]*$/;
      expect(chapaSafeRegex.test(interceptedPayload.customization.title)).toBe(true);
      expect(chapaSafeRegex.test(interceptedPayload.customization.description)).toBe(true);
      expect(chapaSafeRegex.test(interceptedPayload.first_name)).toBe(true);
      expect(chapaSafeRegex.test(interceptedPayload.last_name)).toBe(true);
      expect(chapaSafeRegex.test(interceptedPayload.tx_ref)).toBe(true);

      // Verify specific expected values: no #, :, /, $, &, or emojis
      expect(interceptedPayload.customization.title).toBe('NovaShop');
      expect(interceptedPayload.customization.description).not.toContain('#');
      expect(interceptedPayload.customization.description).not.toContain(':');
      expect(interceptedPayload.customization.description).not.toContain('/');
      expect(interceptedPayload.customization.description).not.toContain('$');
      expect(interceptedPayload.first_name).toBe('John');
      expect(interceptedPayload.last_name).toBe('O Connor Sons 1');
    });

    it('should return friendly error message and safe error code without leaking server filesystem paths when Chapa fails', async () => {
      pendingOrder.isPaid = false;
      pendingOrder.paymentStatus = 'pending';
      await pendingOrder.save();

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          status: 'failed',
          message: 'The customization.description field format is invalid.',
          errors: {
            'customization.description': ['The customization.description may only contain letters, numbers, hyphens, underscores, spaces, and dots.'],
          },
        }),
      }));

      const res = await request(app)
        .post(`/api/v1/orders/${pendingOrder._id}/initialize-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("We couldn't start your payment. Please try again.");
      expect(res.body.code).toBe('PAYMENT_INITIALIZATION_FAILED');

      // Ensure no raw server filesystem paths (/home/...) are leaked in response body
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toMatch(/\/home\//);
      expect(responseStr).not.toMatch(/\/Users\//);
      expect(responseStr).not.toMatch(/backend\/src\//);
    });
  });

  describe('3. Payment Verification & Status Check (GET /api/v1/orders/:id/payment-status)', () => {
    let orderWithPaymentRef;

    beforeEach(async () => {
      orderWithPaymentRef = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 1,
            price: 85.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Jane Doe',
          phone: '+251911223344',
          address: '123 Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 85.0,
        shippingPrice: 10.0,
        taxPrice: 0,
        totalPrice: 95.0,
        paymentReference: 'NS_TEST_REF_123',
        chapaReference: 'chapa_tx_mock_ref_456',
        isStockReserved: false,
        status: 'pending',
        paymentStatus: 'pending',
        isPaid: false,
      });

      // User has this item in their server-side cart
      await Cart.create({
        user: customerUser._id,
        items: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            quantity: 1,
            price: 85.0,
          },
        ],
      });
    });

    it('should reject unauthorized user querying another user payment status (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderWithPaymentRef._id}/payment-status`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it('should verify with Chapa and mark order paid when Chapa reports success', async () => {
      const initialStock = testVariant.stock;
      jest.spyOn(global, 'fetch').mockImplementationOnce(async (url, options) => {
        expect(url).toContain('/transaction/verify/chapa_tx_mock_ref_456');
        expect(options.method).toBe('GET');

        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Payment details',
            status: 'success',
            data: {
              status: 'success',
              amount: 95.0,
              currency: 'USD',
              chapa_reference: 'chapa_tx_mock_ref_456',
              merchant_reference: 'NS_TEST_REF_123',
            },
          }),
        };
      });

      const res = await request(app)
        .get(`/api/v1/orders/${orderWithPaymentRef._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.status).toBe('processing');

      // Verify order updated in DB
      const dbOrder = await Order.findById(orderWithPaymentRef._id);
      expect(dbOrder.isPaid).toBe(true);
      expect(dbOrder.paymentStatus).toBe('paid');
      expect(dbOrder.paidAt).toBeDefined();
      expect(dbOrder.isStockReserved).toBe(true);

      // Verify variant stock was decremented from 10 to 9 after verified payment
      const checkVariant = await ProductVariant.findById(testVariant._id);
      expect(checkVariant.stock).toBe(initialStock - 1);

      // Verify cart was reconciled
      const dbCart = await Cart.findOne({ user: customerUser._id });
      expect(dbCart.items.length).toBe(0);

      // Verify confirmation email was queued
      expect(emailQueue.add).toHaveBeenCalledWith(
        'sendPaymentReceiptEmail',
        expect.objectContaining({
          email: customerUser.email,
        })
      );
    });

    it('should NOT mark order paid if verified amount or currency does not match', async () => {
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Payment details',
            status: 'success',
            data: {
              status: 'success',
              amount: 40.0, // MISMATCHED AMOUNT: 40 != 95
              currency: 'USD',
              chapa_reference: 'chapa_tx_mock_ref_456',
            },
          }),
        };
      });

      const res = await request(app)
        .get(`/api/v1/orders/${orderWithPaymentRef._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.paymentStatus).toBe('pending');

      const dbOrder = await Order.findById(orderWithPaymentRef._id);
      expect(dbOrder.isPaid).toBe(false);
    });

    it('should NOT mark order paid if verified currency does not match stored order currency', async () => {
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Payment details',
            status: 'success',
            data: {
              status: 'success',
              amount: 95.0,
              currency: 'ETB', // MISMATCHED CURRENCY: ETB != USD
              chapa_reference: 'chapa_tx_mock_ref_456',
            },
          }),
        };
      });

      const res = await request(app)
        .get(`/api/v1/orders/${orderWithPaymentRef._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.paymentStatus).toBe('pending');

      const dbOrder = await Order.findById(orderWithPaymentRef._id);
      expect(dbOrder.isPaid).toBe(false);
    });

    it('should handle provider failure or invalid reference without crashing or marking order paid', async () => {
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            message: 'Transaction reference not found',
            status: 'failed',
          }),
        };
      });

      const res = await request(app)
        .get(`/api/v1/orders/${orderWithPaymentRef._id}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.paymentStatus).toBe('pending');
    });
  });

  describe('4. Chapa Webhook Processing (POST /api/v1/orders/webhook/chapa)', () => {
    let webhookOrder;
    const webhookSecret = 'chapa_webhook_secret_key';

    const generateSignature = (payloadObj) => {
      const rawString = JSON.stringify(payloadObj);
      const hmac = crypto.createHmac('sha256', webhookSecret).update(rawString).digest('hex');
      return { signature: hmac, rawBody: rawString };
    };

    beforeEach(async () => {
      webhookOrder = await Order.create({
        user: customerUser._id,
        orderItems: [
          {
            product: testProduct._id,
            variant: testVariant._id,
            name: testProduct.name,
            qty: 2,
            price: 85.0,
            image: testProduct.image,
          },
        ],
        shippingAddress: {
          recipientName: 'Jane Doe',
          phone: '+251911223344',
          address: '123 Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 170.0,
        shippingPrice: 10.0,
        taxPrice: 0,
        totalPrice: 180.0,
        paymentReference: 'NS_WEBHOOK_MERCHANT_REF_789',
        chapaReference: 'chapa_wh_ref_999',
        isStockReserved: true,
        status: 'pending',
        paymentStatus: 'pending',
        isPaid: false,
      });

      // Stock was reserved (variant stock = 8)
      testVariant.stock = 8;
      await testVariant.save();
    });

    it('should reject webhook with invalid signature when secret is configured (400)', async () => {
      const payload = {
        event: 'payment.success',
        status: 'success',
        merchant_reference: 'NS_WEBHOOK_MERCHANT_REF_789',
        amount: 180.0,
        currency: 'USD',
      };

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', 'fake_invalid_hex_signature_abcdef1234567890abcdef1234567890')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid webhook signature/i);
    });

    it('should successfully process valid payment.success webhook and mark order paid', async () => {
      const payload = {
        event: 'payment.success',
        status: 'success',
        merchant_reference: 'NS_WEBHOOK_MERCHANT_REF_789',
        chapa_reference: 'chapa_wh_ref_999',
        amount: 180.0,
        currency: 'USD',
      };

      const { signature, rawBody } = generateSignature(payload);

      // Provider secondary verification mock
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              status: 'success',
              amount: 180.0,
              currency: 'USD',
              merchant_reference: 'NS_WEBHOOK_MERCHANT_REF_789',
              chapa_reference: 'chapa_wh_ref_999',
            },
          }),
        };
      });

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.status).toBe('paid');

      const updated = await Order.findById(webhookOrder._id);
      expect(updated.isPaid).toBe(true);
      expect(updated.paymentStatus).toBe('paid');
      expect(updated.status).toBe('processing');
    });

    it('should be idempotent: subsequent duplicate webhook calls should not re-process or fail', async () => {
      webhookOrder.isPaid = true;
      webhookOrder.paymentStatus = 'paid';
      await webhookOrder.save();

      const payload = {
        event: 'payment.success',
        status: 'success',
        merchant_reference: 'NS_WEBHOOK_MERCHANT_REF_789',
        chapa_reference: 'chapa_wh_ref_999',
        amount: 180.0,
      };

      const { signature, rawBody } = generateSignature(payload);

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.alreadyProcessed).toBe(true);
    });

    it('should release reserved stock and cancel order on payment.cancelled webhook', async () => {
      const payload = {
        event: 'payment.cancelled',
        status: 'cancelled',
        merchant_reference: 'NS_WEBHOOK_MERCHANT_REF_789',
        chapa_reference: 'chapa_wh_ref_999',
      };

      const { signature, rawBody } = generateSignature(payload);

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      const cancelledOrder = await Order.findById(webhookOrder._id);
      expect(cancelledOrder.status).toBe('cancelled');
      expect(cancelledOrder.paymentStatus).toBe('cancelled');
      expect(cancelledOrder.isStockReserved).toBe(false);

      // Reserved stock (2) should be restored back to variant (8 + 2 = 10)
      const restoredVariant = await ProductVariant.findById(testVariant._id);
      expect(restoredVariant.stock).toBe(10);
    });

    it('should not allow a cancellation or failure event to overwrite an already paid order', async () => {
      webhookOrder.isPaid = true;
      webhookOrder.paymentStatus = 'paid';
      await webhookOrder.save();

      const payload = {
        event: 'payment.failed',
        status: 'failed',
        merchant_reference: 'NS_WEBHOOK_MERCHANT_REF_789',
      };

      const { signature, rawBody } = generateSignature(payload);

      const res = await request(app)
        .post('/api/v1/orders/webhook/chapa')
        .set('x-chapa-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.alreadyProcessed || res.body.ignored).toBeTruthy();

      const orderCheck = await Order.findById(webhookOrder._id);
      expect(orderCheck.isPaid).toBe(true);
      expect(orderCheck.paymentStatus).toBe('paid');
    });
  });
});
