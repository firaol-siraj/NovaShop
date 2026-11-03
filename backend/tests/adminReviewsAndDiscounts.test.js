import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Order from '../src/models/orderModel.js';
import Review from '../src/models/reviewModel.js';
import Discount from '../src/models/discountModel.js';
import DiscountRedemption from '../src/models/discountRedemptionModel.js';
import Category from '../src/models/categoryModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { emailQueue } from '../src/queues/emailQueue.js';

describe('Admin Reviews & Discounts Complete Suite', () => {
  let adminUser, adminToken;
  let customerUser, customerToken;
  let otherCustomerUser, otherCustomerToken;
  let testCategory, testProduct, testVariant;
  let testOrder;

  beforeAll(() => {
    if (emailQueue) {
      emailQueue.add = () => Promise.resolve(true);
    }
  });

  beforeEach(async () => {
    // 1. Create Admin
    adminUser = await User.create({
      name: 'Admin Moderator',
      email: 'testadmin_rev@novashop.com',
      password: 'Password123!',
      role: 'admin',
      isVerified: true,
      status: 'active',
      tokenVersion: 0,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    // 2. Create Customers
    customerUser = await User.create({
      name: 'Sarah Customer',
      email: 'customer_rev@novashop.com',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
      status: 'active',
      tokenVersion: 0,
    });
    customerToken = generateAccessToken(customerUser._id, 0, 'customer');

    otherCustomerUser = await User.create({
      name: 'John Customer',
      email: 'other_rev@novashop.com',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
      status: 'active',
      tokenVersion: 0,
    });
    otherCustomerToken = generateAccessToken(otherCustomerUser._id, 0, 'customer');

    // 3. Create Category & Product
    testCategory = await Category.create({
      name: 'Outerwear Test',
      slug: 'outerwear-test',
      description: 'Test category description',
    });

    testProduct = await Product.create({
      user: adminUser._id,
      name: 'Cashmere Trench',
      slug: 'cashmere-trench-test',
      description: 'Luxurious cashmere trench coat',
      category: testCategory._id,
      image: 'https://example.com/trench.jpg',
      images: ['https://example.com/trench.jpg'],
      basePrice: 500,
      price: 500,
      status: 'active',
      countInStock: 50,
      rating: 0,
      numReviews: 0,
    });

    testVariant = await ProductVariant.create({
      product: testProduct._id,
      sku: 'TRENCH-BLK-M',
      size: 'M',
      color: { name: 'Black', hex: '#000000' },
      stock: 50,
      reserved: 0,
    });

    // 4. Create a paid order for customerUser
    testOrder = await Order.create({
      user: customerUser._id,
      orderNumber: 99101,
      customerEmail: customerUser.email,
      orderItems: [
        {
          product: testProduct._id,
          variant: testVariant._id,
          name: testProduct.name,
          image: 'https://example.com/trench.jpg',
          qty: 1,
          price: 500,
        },
      ],
      shippingAddress: {
        address: '123 Atelier Way',
        city: 'New York',
        postalCode: '10001',
        country: 'US',
      },
      paymentMethod: 'Chapa',
      currency: 'USD',
      itemsPrice: 500,
      taxPrice: 0,
      shippingPrice: 0,
      totalPrice: 500,
      isPaid: true,
      paidAt: new Date(),
      status: 'delivered',
    });
  });

  // =========================================================================
  // PART A: REVIEWS API (Customer + Admin)
  // =========================================================================
  describe('Customer Reviews & Moderation Workflow', () => {
    it('rejects review submission for customer who has NOT bought the product', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({
          product: testProduct._id.toString(),
          rating: 5,
          title: 'I never bought this',
          body: 'Writing a fake review without buying.',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/verified paid orders/i);
    });

    it('allows verified purchaser to submit a review and sets status to pending', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          product: testProduct._id.toString(),
          rating: 5,
          title: 'Exquisite tailoring and fabric',
          body: 'This coat exceeded all expectations. Beautiful stitching and soft fabric.',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.review.status).toBe('pending');
      expect(res.body.data.review.verifiedPurchase).toBe(true);
      expect(res.body.data.review.rating).toBe(5);
    });

    it('enforces one review per user per product per order', async () => {
      await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Initial review',
        body: 'First review submitted for this order.',
        status: 'pending',
      });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          product: testProduct._id.toString(),
          rating: 4,
          title: 'Duplicate review',
          body: 'Attempting to review twice for the same purchase.',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already submitted a review/i);
    });

    it('does NOT expose pending reviews in the public product reviews endpoint', async () => {
      await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Pending review',
        body: 'Pending review body text.',
        status: 'pending',
      });

      const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.reviews).toHaveLength(0);
    });

    it('returns review in admin reviews list with pending status and correct counts', async () => {
      const rev = await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Pending admin review',
        body: 'Review text for admin review list check.',
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/admin/reviews?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      const found = res.body.data.reviews.find((r) => r.id === rev._id.toString());
      expect(found).toBeDefined();
      expect(found.customer).toBe('Sarah Customer');
      expect(found.product).toBe('Cashmere Trench');
    });

    it('approves a review and automatically updates product aggregate rating', async () => {
      const rev = await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Great piece',
        body: 'Warm and lightweight cashmere fabric.',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/reviews/${rev._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.data.review.status).toBe('approved');

      // Verify product rating updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.rating).toBe(5);
      expect(updatedProduct.numReviews).toBe(1);
    });

    it('serves approved review in the public product reviews endpoint', async () => {
      await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Approved review',
        body: 'Approved review body text.',
        status: 'approved',
      });

      const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.averageRating).toBe(5);
      expect(res.body.data.ratingBreakdown[5]).toBe(1);
    });

    it('allows admin to reply to a review and stores adminReply', async () => {
      const rev = await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Review to reply to',
        body: 'Review text expecting concierge reply.',
        status: 'approved',
      });

      const res = await request(app)
        .post(`/api/v1/admin/reviews/${rev._id}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Thank you Sarah! We are thrilled you love the cashmere coat.' });

      expect(res.status).toBe(200);
      expect(res.body.data.adminReply.text).toContain('Thank you Sarah!');
    });

    it('toggles featured star status for review', async () => {
      const rev = await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Review to star',
        body: 'Review text for star test.',
        status: 'approved',
        featured: false,
      });

      const res = await request(app)
        .patch(`/api/v1/admin/reviews/${rev._id}/star`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.starred).toBe(true);
    });

    it('returns real admin review stats with deltas', async () => {
      await Review.create({
        product: testProduct._id,
        user: customerUser._id,
        order: testOrder._id,
        rating: 5,
        title: 'Stats test review',
        body: 'Review for testing admin review stats.',
        status: 'approved',
      });

      const res = await request(app)
        .get('/api/v1/admin/reviews/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats.totalReviews).toBeGreaterThanOrEqual(1);
      expect(res.body.data.stats.averageRating).toBe('5.0');
      expect(res.body.data.counts.approved).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // PART B: DISCOUNTS API (Validation, Redemptions & Admin)
  // =========================================================================
  describe('Discounts & Checkout Redemptions Workflow', () => {
    it('creates a percentage discount via admin API', async () => {
      const res = await request(app)
        .post('/api/v1/admin/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Autumn Special 20%',
          code: 'AUTUMN20',
          type: 'percentage',
          value: 20,
          appliesTo: 'all_products',
          minimumSpend: 100,
          usageLimit: 10,
          perCustomerLimit: 2,
          startsAt: new Date(Date.now() - 60000).toISOString(),
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.discount.code).toBe('AUTUMN20');
      expect(res.body.data.discount.value).toBe(20);
    });

    it('rejects duplicate discount codes', async () => {
      await Discount.create({
        name: 'Existing Autumn',
        code: 'AUTUMN20',
        type: 'percentage',
        value: 20,
        startsAt: new Date(),
        status: 'active',
      });

      const res = await request(app)
        .post('/api/v1/admin/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Autumn',
          code: 'AUTUMN20',
          type: 'percentage',
          value: 15,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('validates discount code successfully when minimum spend is met', async () => {
      await Discount.create({
        name: 'Autumn 20',
        code: 'AUTUMN20',
        type: 'percentage',
        value: 20,
        minimumSpend: 100,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .send({
          code: 'AUTUMN20',
          subtotal: 500,
          shippingPrice: 15,
          items: [{ product: testProduct._id.toString(), price: 500, qty: 1 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discountAmount).toBe(100); // 20% of 500 = 100
    });

    it('rejects discount code when minimum spend is NOT met', async () => {
      await Discount.create({
        name: 'Autumn 20',
        code: 'AUTUMN20',
        type: 'percentage',
        value: 20,
        minimumSpend: 100,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .send({
          code: 'AUTUMN20',
          subtotal: 50,
          items: [{ product: testProduct._id.toString(), price: 50, qty: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/minimum spend of \$100/i);
    });

    it('applies discount on order creation and discounts total price correctly', async () => {
      await Discount.create({
        name: 'Autumn 20',
        code: 'AUTUMN20',
        type: 'percentage',
        value: 20,
        minimumSpend: 100,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              name: testProduct.name,
              image: 'https://example.com/trench.jpg',
              qty: 1,
              price: 500,
            },
          ],
          shippingAddress: {
            address: '456 Fashion Blvd',
            city: 'New York',
            postalCode: '10002',
            country: 'US',
            phone: '+1 212 555 0199',
          },
          paymentMethod: 'Cash',
          discountCode: 'AUTUMN20',
        });

      expect(res.status).toBe(201);
      const createdOrder = res.body.data || res.body.order;
      expect(createdOrder.discountCode).toBe('AUTUMN20');
      expect(createdOrder.discountAmount).toBe(100);
      expect(createdOrder.subtotalPrice).toBe(500);
      expect(createdOrder.totalPrice).toBe(400); // 500 - 100 = 400
    });

    it('duplicates a discount with unique -COPY code', async () => {
      const disc = await Discount.create({
        name: 'Original Promo',
        code: 'AUTUMN20',
        type: 'percentage',
        value: 20,
        startsAt: new Date(),
        status: 'active',
      });

      const res = await request(app)
        .post(`/api/v1/admin/discounts/${disc._id}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.discount.code).toBe('AUTUMN20-COPY');
      expect(res.body.data.discount.usedCount).toBe(0);
      expect(res.body.data.discount.status).toBe('draft');
    });

    it('ends an active discount immediately', async () => {
      const disc = await Discount.create({
        name: 'Promo to end',
        code: 'AUTUMN20',
        type: 'percentage',
        value: 20,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/discounts/${disc._id}/end`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.discount.status).toBe('disabled');

      // Now validating should fail
      const validateRes = await request(app)
        .post('/api/v1/discounts/validate')
        .send({
          code: 'AUTUMN20',
          subtotal: 500,
        });

      expect(validateRes.status).toBe(400);
      expect(validateRes.body.message).toMatch(/disabled/i);
    });

    it('returns real admin discount stats with "-" when previous period is zero', async () => {
      await Discount.create({
        name: 'Active promo for stats',
        code: 'ACTIVE1',
        type: 'percentage',
        value: 10,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const res = await request(app)
        .get('/api/v1/admin/discounts/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats).toHaveProperty('activeCount');
      expect(res.body.data.stats).toHaveProperty('totalRedemptions');
      expect(res.body.data.stats).toHaveProperty('discountedRevenue');
      expect(res.body.data.stats.redemptionsTrend).toBe('-');
      expect(res.body.data.stats.discountedRevenueTrend).toBe('-');
    });

    it('enforces first-order-only rule: rejects WELCOME10 for customer with existing paid order with exact message', async () => {
      await Discount.create({
        name: 'Welcome 10%',
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        firstOrderOnly: true,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      // customerUser already has testOrder (isPaid: true) in beforeEach
      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          code: 'WELCOME10',
          subtotal: 300,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Discount code 'WELCOME10' is valid for first-time orders only.");
    });

    it('enforces first-order-only rule: accepts customer whose only orders are PENDING or FAILED', async () => {
      await Discount.create({
        name: 'Welcome 10%',
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        firstOrderOnly: true,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const pendingUser = await User.create({
        name: 'Pending Customer',
        email: 'pending_cust@novashop.com',
        password: 'Password123!',
        role: 'customer',
      });
      const pendingToken = generateAccessToken(pendingUser._id, 0, 'customer');

      // Create an unpaid pending order and a failed order for this user
      await Order.create({
        user: pendingUser._id,
        orderNumber: '99301',
        customerEmail: pendingUser.email,
        orderItems: testOrder.orderItems,
        shippingAddress: testOrder.shippingAddress,
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 200,
        totalPrice: 200,
        isPaid: false,
        paymentStatus: 'pending',
        status: 'pending',
      });

      await Order.create({
        user: pendingUser._id,
        orderNumber: '99302',
        customerEmail: pendingUser.email,
        orderItems: testOrder.orderItems,
        shippingAddress: testOrder.shippingAddress,
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 150,
        totalPrice: 150,
        isPaid: false,
        paymentStatus: 'failed',
        status: 'cancelled',
      });

      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({
          code: 'WELCOME10',
          subtotal: 200,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discountAmount).toBe(20);
    });

    it('accepts brand-new customer: discounts total and Chapa amount proportionally on order creation', async () => {
      await Discount.create({
        name: 'Welcome 10%',
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        firstOrderOnly: true,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const newUser = await User.create({
        name: 'Brand New Customer',
        email: 'brand_new@novashop.com',
        password: 'Password123!',
        role: 'customer',
      });
      const newToken = generateAccessToken(newUser._id, 0, 'customer');

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              qty: 1,
            },
          ],
          shippingAddress: testOrder.shippingAddress,
          paymentMethod: 'Chapa',
          discountCode: 'WELCOME10',
        });

      expect(res.status).toBe(201);
      const createdOrder = res.body.data || res.body.order;
      expect(createdOrder.discountCode).toBe('WELCOME10');
      // Subtotal 500, 10% discount = 50, Total = 450
      expect(createdOrder.discountAmount).toBe(50);
      expect(createdOrder.totalPrice).toBe(450);
      // Chapa amount totalPriceETB = 450 * 120 = 54000
      expect(createdOrder.totalPriceETB).toBe(450 * (createdOrder.usdToEtbRate || 120));
    });

    it('rejects guest checkout using the email of an existing paying customer', async () => {
      await Discount.create({
        name: 'Welcome 10%',
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        firstOrderOnly: true,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      // customerUser has testOrder (isPaid: true)
      const res = await request(app)
        .post('/api/v1/discounts/validate')
        .send({
          code: 'WELCOME10',
          subtotal: 300,
          customerEmail: customerUser.email,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Discount code 'WELCOME10' is valid for first-time orders only.");
    });

    it('saves and loads firstOrderOnly correctly through create, get, and edit in admin API', async () => {
      // 1. Create with firstOrderOnly: true
      const createRes = await request(app)
        .post('/api/v1/admin/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'First Order VIP',
          code: 'FIRSTVIP20',
          type: 'percentage',
          value: 20,
          firstOrderOnly: true,
          method: 'code',
          appliesTo: 'all_products',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.discount.firstOrderOnly).toBe(true);
      const discountId = createRes.body.data.discount._id;

      // 2. Fetch single discount by ID
      const getRes = await request(app)
        .get(`/api/v1/admin/discounts/${discountId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.discount.firstOrderOnly).toBe(true);

      // 3. Update discount firstOrderOnly to false
      const updateRes = await request(app)
        .put(`/api/v1/admin/discounts/${discountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstOrderOnly: false,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.discount.firstOrderOnly).toBe(false);

      // 4. Verify in database
      const reloaded = await Discount.findById(discountId);
      expect(reloaded.firstOrderOnly).toBe(false);
    });

    it('enforces atomic usage limit on two concurrent checkouts with 1 use remaining (only 1 succeeds)', async () => {
      const disc = await Discount.create({
        name: 'Limited 1 Use Code',
        code: 'ONETIMEONLY',
        type: 'fixed_amount',
        value: 50,
        usageLimit: 1,
        usedCount: 0,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      // Create two distinct orders applying this code
      const orderA = await Order.create({
        user: customerUser._id,
        orderNumber: '99201',
        customerEmail: customerUser.email,
        orderItems: testOrder.orderItems,
        shippingAddress: testOrder.shippingAddress,
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 500,
        discountCode: 'ONETIMEONLY',
        discountId: disc._id,
        discountAmount: 50,
        totalPrice: 450,
        isPaid: false,
        status: 'pending',
      });

      const orderB = await Order.create({
        user: otherCustomerUser._id,
        orderNumber: '99202',
        customerEmail: otherCustomerUser.email,
        orderItems: testOrder.orderItems,
        shippingAddress: testOrder.shippingAddress,
        paymentMethod: 'Chapa',
        currency: 'USD',
        itemsPrice: 500,
        discountCode: 'ONETIMEONLY',
        discountId: disc._id,
        discountAmount: 50,
        totalPrice: 450,
        isPaid: false,
        status: 'pending',
      });

      const { markOrderPaid } = await import('../src/controllers/orderController.js');

      // Execute both checkouts simultaneously
      const results = await Promise.allSettled([
        markOrderPaid(orderA, { chapaReference: 'TX_CONCURRENT_1' }),
        markOrderPaid(orderB, { chapaReference: 'TX_CONCURRENT_2' }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed, the other rejected by atomic condition
      const redemptions = await DiscountRedemption.find({ discount: disc._id });
      const refreshedDisc = await Discount.findById(disc._id);

      expect(redemptions).toHaveLength(1);
      expect(refreshedDisc.usedCount).toBe(1);
    });

    it('automatically applies active automatic discounts when no promo code is supplied', async () => {
      await Discount.create({
        name: 'Storewide Flash Sale',
        code: 'AUTOSAVE15',
        method: 'automatic',
        type: 'percentage',
        value: 15,
        minimumSpend: 200,
        startsAt: new Date(Date.now() - 60000),
        status: 'active',
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              product: testProduct._id.toString(),
              variant: testVariant._id.toString(),
              name: testProduct.name,
              image: 'https://example.com/trench.jpg',
              qty: 1,
              price: 500,
            },
          ],
          shippingAddress: {
            address: '789 Luxury Way',
            city: 'New York',
            postalCode: '10003',
            country: 'US',
            phone: '+1 212 555 0199',
          },
          paymentMethod: 'Cash',
          // No discountCode supplied!
        });

      expect(res.status).toBe(201);
      const createdOrder = res.body.data || res.body.order;
      expect(createdOrder.discountCode).toBe('AUTOSAVE15');
      expect(createdOrder.discountAmount).toBe(75); // 15% of 500 = 75
      expect(createdOrder.totalPrice).toBe(425);
    });
  });
});
