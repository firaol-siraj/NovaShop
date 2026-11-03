import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Category from '../src/models/categoryModel.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';
import Discount from '../src/models/discountModel.js';
import DiscountRedemption from '../src/models/discountRedemptionModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { getProductStockStatus, analyzeVariantStock } from '../src/utils/stockUtils.js';

describe('Authoritative Stock Status & Discount Analytics Tests', () => {
  let adminToken;
  let adminUser;
  let testCategory;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Stock Admin',
      email: `stockadmin_${Date.now()}@novashop.com`,
      password: 'Password123!',
      role: 'admin',
      isEmailVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    testCategory = await Category.create({
      name: 'Stock Test Category',
      slug: `stock-test-${Date.now()}`,
    });
  });

  describe('getProductStockStatus unit rules', () => {
    it('returns "Out of stock" when all active variants have available <= 0', () => {
      const variants = [
        { stock: 0, reserved: 0 },
        { stock: 2, reserved: 2 }, // available = 0
        { stock: 0, reserved: 1 }, // available = 0
      ];
      expect(getProductStockStatus(variants, 5)).toBe('Out of stock');
    });

    it('returns "In stock" when one variant is zero and others are amply available (> threshold)', () => {
      const variants = [
        { stock: 0, reserved: 0 }, // 0
        { stock: 20, reserved: 2, lowStockThreshold: 5 }, // 18 available > 5
        { stock: 15, reserved: 0 }, // 15 available > 5
      ];
      expect(getProductStockStatus(variants, 5)).toBe('In stock');
    });

    it('returns "Low stock" when at least one active variant is low (<= threshold) and not all are out', () => {
      const variants = [
        { stock: 3, reserved: 0, lowStockThreshold: 5 }, // 3 <= 5 -> low!
        { stock: 20, reserved: 0 }, // 20 > 5
      ];
      expect(getProductStockStatus(variants, 5)).toBe('Low stock');
    });

    it('ignores archived and inactive variants completely', () => {
      const variants = [
        { stock: 0, reserved: 0, status: 'archived' }, // should be ignored
        { stock: 0, reserved: 0, isArchived: true }, // should be ignored
        { stock: 0, reserved: 0, isActive: false }, // should be ignored
        { stock: 12, reserved: 0, status: 'active' }, // only this counts: 12 > 5
      ];
      expect(getProductStockStatus(variants, 5)).toBe('In stock');

      const allArchived = [
        { stock: 10, reserved: 0, status: 'archived' },
      ];
      // When all are archived, falls back to product's own stock
      expect(getProductStockStatus(allArchived, { globalThreshold: 5, productStock: 0 })).toBe('Out of stock');
    });

    it('returns correct status for products with no variants based on product stock', () => {
      expect(getProductStockStatus([], { globalThreshold: 5, productStock: 0 })).toBe('Out of stock');
      expect(getProductStockStatus([], { globalThreshold: 5, productStock: 3 })).toBe('Low stock');
      expect(getProductStockStatus([], { globalThreshold: 5, productStock: 10 })).toBe('In stock');
    });
  });

  describe('Integration: Paid order with discount in Sales Analytics and Discounts Stats', () => {
    it('accurately aggregates redemptions and discounted revenue from DiscountRedemption for PAID orders', async () => {
      const now = new Date();

      const discount = await Discount.create({
        name: 'VIP Fall Sale',
        code: `VIP${Date.now().toString().slice(-4)}`,
        type: 'percentage',
        value: 15,
        startsAt: new Date(now.getTime() - 100000),
        status: 'active',
      });

      const order = await Order.create({
        user: adminUser._id,
        orderItems: [
          {
            name: 'Luxury Silk Blazer',
            qty: 1,
            image: '/images/blazer.jpg',
            price: 500,
            product: new mongoose.Types.ObjectId(),
          },
        ],
        shippingAddress: {
          address: 'Bole Medhanialem',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        discountCode: discount.code,
        discountId: discount._id,
        discountAmount: 75,
        isPaid: true,
        paidAt: now,
        status: 'processing',
        paymentStatus: 'paid',
        itemsPrice: 500,
        totalPrice: 425,
      });

      // Write redemption as markOrderPaid does
      const redemption = await DiscountRedemption.create({
        discount: discount._id,
        code: discount.code,
        order: order._id,
        user: adminUser._id,
        amountDiscounted: 75,
        orderTotal: 425,
        createdAt: now,
      });

      // 1. Assert on Sales Analytics endpoint
      const salesRes = await request(app)
        .get('/api/admin/analytics/sales')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(salesRes.status).toBe(200);
      expect(salesRes.body.success).toBe(true);

      const promoPerf = salesRes.body.data.discountPerformance.find((p) => p.code === discount.code);
      expect(promoPerf).toBeDefined();
      expect(promoPerf.redemptions).toBe(1);
      expect(promoPerf.revenue).toBe(425);
      expect(salesRes.body.data.totalPromoRevenue).toBeGreaterThanOrEqual(425);

      // 2. Assert on Discounts Page Stats endpoint (shared backend source)
      const discountStatsRes = await request(app)
        .get('/api/v1/admin/discounts/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(discountStatsRes.status).toBe(200);
      expect(discountStatsRes.body.status).toBe('success');
      expect(discountStatsRes.body.data.stats.totalRedemptions).toBeGreaterThanOrEqual(1);
      expect(discountStatsRes.body.data.stats.discountedRevenue).toBeGreaterThanOrEqual(425);

      // Clean up test documents
      await DiscountRedemption.deleteOne({ _id: redemption._id });
      await Order.deleteOne({ _id: order._id });
      await Discount.deleteOne({ _id: discount._id });
    });
  });
});
