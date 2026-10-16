import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Category from '../src/models/categoryModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Cart from '../src/models/cartModel.js';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../src/utils/clearCache.js', () => ({
  clearCachePattern: jest.fn().mockResolvedValue(true),
}));

const generateToken = (id, role = 'customer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });
};

describe('Persistent Cart API Integration Tests', () => {
  let user1, user2;
  let token1, token2;
  let category, product, variant1, variant2;

  beforeEach(async () => {
    user1 = await User.create({
      name: 'Alice User',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    token1 = generateToken(user1._id, 'customer');

    user2 = await User.create({
      name: 'Bob User',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    token2 = generateToken(user2._id, 'customer');

    category = await Category.create({ name: 'Hoodies', slug: 'hoodies' });
    product = await Product.create({
      user: user1._id,
      name: 'Nova Fleece Hoodie',
      slug: 'nova-fleece-hoodie',
      price: 80,
      description: 'Cozy fleece hoodie',
      image: '/uploads/hoodie.jpg',
      category: category._id,
    });

    variant1 = await ProductVariant.create({
      product: product._id,
      sku: 'HOOD-BLK-M',
      size: 'M',
      color: { name: 'Black', hex: '#000000' },
      stock: 10,
      price: 80,
    });

    variant2 = await ProductVariant.create({
      product: product._id,
      sku: 'HOOD-BLK-L',
      size: 'L',
      color: { name: 'Black', hex: '#000000' },
      stock: 2,
      price: 85,
    });
  });

  describe('GET /api/v1/cart', () => {
    it('should return empty cart for newly registered user', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.itemCount).toBe(0);
      expect(res.body.data.subtotal).toBe(0);
    });

    it('should reject unauthenticated request (401)', async () => {
      const res = await request(app).get('/api/v1/cart');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/cart/items', () => {
    it('should add item to cart and calculate correct server-side prices', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.items[0].price).toBe(80);
      expect(res.body.data.subtotal).toBe(160);
      expect(res.body.data.itemCount).toBe(2);
    });

    it('should increment quantity when adding the exact same variant again', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 2,
        });

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(5);
      expect(res.body.data.itemCount).toBe(5);
      expect(res.body.data.subtotal).toBe(400);
    });

    it('should reject request when quantity exceeds available stock', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant2._id.toString(),
          quantity: 5, // stock is only 2
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 2');
    });

    it('should reject mismatch between product and variant', async () => {
      const fakeProduct = await Product.create({
        user: user1._id,
        name: 'Other Jacket',
        slug: 'other-jacket',
        price: 100,
        description: 'Jacket',
        image: '/img.jpg',
        category: category._id,
      });

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: fakeProduct._id.toString(),
          variantId: variant1._id.toString(), // belongs to product, not fakeProduct
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not belong');
    });
  });

  describe('PATCH /api/v1/cart/items/:itemId', () => {
    it('should update item quantity', async () => {
      const addRes = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 1,
        });

      const itemId = addRes.body.data.items[0]._id;

      const res = await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ quantity: 4 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(4);
      expect(res.body.data.subtotal).toBe(320);
    });
  });

  describe('DELETE /api/v1/cart/items/:itemId', () => {
    it('should remove item from user cart', async () => {
      const addRes = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 1,
        });

      const itemId = addRes.body.data.items[0]._id;

      const res = await request(app)
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.subtotal).toBe(0);
    });
  });

  describe('DELETE /api/v1/cart', () => {
    it('should clear all cart items', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 2,
        });

      const res = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.subtotal).toBe(0);
    });
  });

  describe('User Isolation Security', () => {
    it('should prevent User2 from modifying User1 cart items', async () => {
      const addRes = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variant1._id.toString(),
          quantity: 1,
        });

      const itemId = addRes.body.data.items[0]._id;

      const res = await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token2}`) // User2 trying to modify User1 item
        .send({ quantity: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart not found');
    });
  });
});
