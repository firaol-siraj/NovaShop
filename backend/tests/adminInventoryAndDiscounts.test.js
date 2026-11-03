import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Category from '../src/models/categoryModel.js';
import Discount from '../src/models/discountModel.js';
import DiscountRedemption from '../src/models/discountRedemptionModel.js';
import InventoryMovement from '../src/models/inventoryMovementModel.js';
import Order from '../src/models/orderModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';

describe('Admin Inventory & Discounts Suite', () => {
  let adminToken;
  let adminUser;
  let testCategory;
  let testProduct;
  let testVariant;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Inventory Admin',
      email: `inventory_admin_${Date.now()}@novashop.com`,
      password: 'Password123!',
      role: 'admin',
      isEmailVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    testCategory = await Category.create({
      name: `Category ${Date.now()}`,
      slug: `category-${Date.now()}`,
    });

    testProduct = await Product.create({
      user: adminUser._id,
      name: `Silk Evening Gown ${Date.now()}`,
      slug: `silk-evening-gown-${Date.now()}`,
      description: 'Elegant silk evening gown with subtle embroidery',
      price: 320,
      countInStock: 25,
      category: testCategory._id,
      image: '/images/gown.jpg',
      images: ['/images/gown.jpg'],
    });

    testVariant = await ProductVariant.create({
      product: testProduct._id,
      sku: `GOWN-${Date.now().toString().slice(-6)}`,
      size: 'M',
      color: { name: 'Emerald', hex: '#004D40' },
      stock: 12,
      price: 320,
      lowStockThreshold: 5,
    });
  });

  describe('Part 1: Inventory Management & Adjustments', () => {
    it('successfully adjusts stock using delta mode in transaction and records movement history', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: testVariant._id.toString(),
          mode: 'delta',
          value: 5,
          reason: 'Received shipment PO-9921',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.variant.stock).toBe(17); // 12 + 5 = 17

      // Verify movement was written to DB
      const movement = await InventoryMovement.findOne({ variant: testVariant._id });
      expect(movement).toBeDefined();
      expect(movement.stockBefore).toBe(12);
      expect(movement.stockAfter).toBe(17);
      expect(movement.quantityChange).toBe(5);
      expect(movement.reason).toBe('Received shipment PO-9921');
      expect(movement.admin.toString()).toBe(adminUser._id.toString());
    });

    it('rejects stock adjustment resulting in negative inventory', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: testVariant._id.toString(),
          mode: 'delta',
          value: -20, // 12 - 20 = -8 -> illegal!
          reason: 'Damaged shipment',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/negative/i);
    });

    it('rejects stock adjustment when required reason is missing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: testVariant._id.toString(),
          mode: 'delta',
          value: 2,
          reason: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/reason.*required/i);
    });

    it('updates variant low-stock threshold / reorder level', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/inventory/variants/${testVariant._id}/threshold`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lowStockThreshold: 8,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lowStockThreshold).toBe(8);

      const updatedVariant = await ProductVariant.findById(testVariant._id);
      expect(updatedVariant.lowStockThreshold).toBe(8);
    });

    it('lists movement history for both catalog-wide and per-variant requests', async () => {
      // Create movement
      await InventoryMovement.create({
        product: testProduct._id,
        variant: testVariant._id,
        stockBefore: 12,
        stockAfter: 15,
        quantityChange: 3,
        type: 'restock',
        reason: 'Restock test',
        admin: adminUser._id,
      });

      // 1. Variant specific
      const variantRes = await request(app)
        .get(`/api/v1/admin/inventory/movements/${testVariant._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(variantRes.status).toBe(200);
      expect(variantRes.body.success).toBe(true);
      expect(variantRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(variantRes.body.data[0].reason).toBe('Restock test');

      // 2. Catalog-wide
      const allRes = await request(app)
        .get('/api/v1/admin/inventory/movements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(allRes.status).toBe(200);
      expect(allRes.body.success).toBe(true);
      expect(allRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Part 2: Discounts Management & Redemptions', () => {
    let testDiscount;

    beforeEach(async () => {
      testDiscount = await Discount.create({
        name: 'Fall VIP 20%',
        code: `FALLVIP${Date.now().toString().slice(-4)}`,
        method: 'code',
        type: 'percentage',
        value: 20,
        appliesTo: 'all_products',
        minimumSpend: 50,
        usageLimit: 100,
        usedCount: 2,
        status: 'active',
        startsAt: new Date(Date.now() - 3600000),
      });
    });

    it('returns discount redemptions drawer data with customer, order number and amount saved', async () => {
      const order = await Order.create({
        user: adminUser._id,
        orderItems: [
          {
            name: testProduct.name,
            qty: 1,
            image: '/img.jpg',
            price: 320,
            product: testProduct._id,
          },
        ],
        shippingAddress: {
          address: 'Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        discountCode: testDiscount.code,
        discountId: testDiscount._id,
        discountAmount: 64,
        isPaid: true,
        paidAt: new Date(),
        status: 'processing',
        paymentStatus: 'paid',
        itemsPrice: 320,
        totalPrice: 256,
      });

      await DiscountRedemption.create({
        discount: testDiscount._id,
        code: testDiscount.code,
        order: order._id,
        user: adminUser._id,
        customerEmail: adminUser.email,
        amountDiscounted: 64,
        orderTotal: 256,
        createdAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/admin/discounts/${testDiscount._id}/redemptions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.discount.code).toBe(testDiscount.code);
      expect(res.body.data.redemptions.length).toBe(1);
      expect(res.body.data.redemptions[0].customerEmail).toBe(adminUser.email);
      expect(res.body.data.redemptions[0].amountSaved).toBe(64);
    });

    it('duplicates a discount with a unique -COPY code and draft status', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/discounts/${testDiscount._id}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.discount.code).toBe(`${testDiscount.code}-COPY`);
      expect(res.body.data.discount.status).toBe('draft');
      expect(res.body.data.discount.usedCount).toBe(0);
    });

    it('toggles/ends an active discount immediately', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/discounts/${testDiscount._id}/end`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.discount.status).toBe('disabled');
      expect(res.body.data.discount.endsAt).toBeDefined();
    });

    it('soft deletes a discount', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/discounts/${testDiscount._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const deleted = await Discount.findById(testDiscount._id);
      expect(deleted.isDeleted).toBe(true);
    });

    it('ensures KPI redemptions count matches real usage across discounts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/discounts/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.stats.totalRedemptions).toBeGreaterThanOrEqual(testDiscount.usedCount);
    });
  });
});
