import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Category from '../src/models/categoryModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Wishlist from '../src/models/wishlistModel.js';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../src/utils/clearCache.js', () => ({
  clearCachePattern: jest.fn().mockResolvedValue(true),
}));

const generateToken = (id, role = 'customer') =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });

describe('Wishlist Integration Tests', () => {
  let user1, user2;
  let token1, token2;
  let category;
  let product; // active
  let draftProduct;

  const createProduct = (overrides = {}) =>
    Product.create({
      user: user1._id,
      description: 'A fine garment',
      image: '/uploads/item.jpg',
      category: category._id,
      ...overrides,
    });

  beforeEach(async () => {
    user1 = await User.create({
      name: 'Alice Wishlist',
      email: 'alice-wish@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    token1 = generateToken(user1._id, 'customer');

    user2 = await User.create({
      name: 'Bob Wishlist',
      email: 'bob-wish@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    token2 = generateToken(user2._id, 'customer');

    category = await Category.create({ name: 'Knitwear', slug: 'knitwear' });

    product = await createProduct({
      name: 'Ribbed Sweater',
      slug: 'ribbed-sweater',
      price: 120,
    });
    await ProductVariant.create({
      product: product._id,
      sku: 'RIBB-IVR-S',
      size: 'S',
      color: { name: 'Ivory', hex: '#FFF8E7' },
      stock: 8,
      price: null,
    });

    draftProduct = await createProduct({
      name: 'Unreleased Piece',
      slug: 'unreleased-piece',
      price: 999,
      status: 'draft',
    });
  });

  describe('POST /api/v1/wishlist/items', () => {
    it('adds a product and returns it populated', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.items[0].slug).toBe('ribbed-sweater');
      // Variants are populated for rendering (add-to-bag needs them).
      expect(Array.isArray(res.body.data.items[0].variants)).toBe(true);
      expect(res.body.data.items[0].variants.length).toBe(1);
    });

    it('is idempotent — adding twice keeps a single entry', async () => {
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      const res = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);

      const stored = await Wishlist.findOne({ user: user1._id });
      expect(stored.items.length).toBe(1);
    });

    it('rejects a draft product with 400', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: draftProduct._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not available');
    });

    it('rejects an unknown product with 404', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(404);
    });

    it('enforces the 200-item cap', async () => {
      // Build a wishlist at the cap directly via the model.
      const manyProducts = [];
      for (let i = 0; i < 200; i += 1) {
        manyProducts.push(new mongoose.Types.ObjectId());
      }
      await Wishlist.create({
        user: user1._id,
        items: manyProducts.map((id) => ({ product: id, addedAt: new Date() })),
      });

      const res = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('200');
    });
  });

  describe('GET /api/v1/wishlist — visibility', () => {
    it('hides products that became non-active without deleting them', async () => {
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      product.status = 'archived';
      await product.save();

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
      expect(res.body.data.items).toEqual([]);

      // Still stored — hidden, not deleted.
      const stored = await Wishlist.findOne({ user: user1._id });
      expect(stored.items.length).toBe(1);
    });

    it('returns an empty wishlist for a user without one', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });
  });

  describe('POST /api/v1/wishlist/merge', () => {
    it('merges valid ids, ignores invalid and non-active ones, and is idempotent', async () => {
      const secondProduct = await createProduct({
        name: 'Linen Shirt',
        slug: 'linen-shirt',
        price: 70,
      });

      const payload = {
        productIds: [
          product._id.toString(),
          secondProduct._id.toString(),
          draftProduct._id.toString(), // ignored: draft
          new mongoose.Types.ObjectId().toString(), // ignored: unknown
          'not-an-objectid', // ignored: invalid (validator strips? no — 400)
        ],
      };

      // The schema requires 24-hex ids, so a malformed id must 400.
      const badRes = await request(app)
        .post('/api/v1/wishlist/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productIds: ['not-an-objectid'] });
      expect(badRes.status).toBe(400);

      // Valid merge: unknown + draft ids are ignored without failing.
      const res = await request(app)
        .post('/api/v1/wishlist/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productIds: [
            product._id.toString(),
            secondProduct._id.toString(),
            draftProduct._id.toString(),
            new mongoose.Types.ObjectId().toString(),
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.ignored.length).toBe(2);

      // Merging the same ids again does not duplicate anything.
      const second = await request(app)
        .post('/api/v1/wishlist/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productIds: [product._id.toString(), secondProduct._id.toString()],
        });

      expect(second.status).toBe(200);
      expect(second.body.data.count).toBe(2);

      const stored = await Wishlist.findOne({ user: user1._id });
      expect(stored.items.length).toBe(2);
    });

    it('rejects more than 200 ids with 400', async () => {
      const productIds = Array.from({ length: 201 }, () =>
        new mongoose.Types.ObjectId().toString()
      );

      const res = await request(app)
        .post('/api/v1/wishlist/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productIds });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/wishlist…', () => {
    it('removes a single product from the wishlist', async () => {
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      const res = await request(app)
        .delete(`/api/v1/wishlist/items/${product._id.toString()}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });

    it('returns 404 when removing a product that is not in the wishlist', async () => {
      const res = await request(app)
        .delete(`/api/v1/wishlist/items/${product._id.toString()}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(404);
    });

    it('clears the whole wishlist', async () => {
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      const res = await request(app)
        .delete('/api/v1/wishlist')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);

      const stored = await Wishlist.findOne({ user: user1._id });
      expect(stored.items.length).toBe(0);
    });
  });

  describe('Ownership and authentication', () => {
    it('rejects unauthenticated wishlist requests with 401', async () => {
      expect((await request(app).get('/api/v1/wishlist')).status).toBe(401);
      expect(
        (await request(app).post('/api/v1/wishlist/items').send({})).status
      ).toBe(401);
      expect(
        (await request(app).post('/api/v1/wishlist/merge').send({})).status
      ).toBe(401);
      expect((await request(app).delete('/api/v1/wishlist')).status).toBe(401);
    });

    it("user2 cannot remove user1's wishlist product", async () => {
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      const res = await request(app)
        .delete(`/api/v1/wishlist/items/${product._id.toString()}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);

      // user1's wishlist is untouched.
      const user1Wishlist = await Wishlist.findOne({ user: user1._id });
      expect(user1Wishlist.items.length).toBe(1);
    });

    it('user2 sees only their own wishlist', async () => {
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ productId: product._id.toString() });

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });
  });
});

