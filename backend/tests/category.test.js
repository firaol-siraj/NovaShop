import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Category from '../src/models/categoryModel.js';
import Product from '../src/models/productModel.js';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../src/utils/clearCache.js', () => ({
  clearCachePattern: jest.fn().mockResolvedValue(true),
}));

const generateToken = (id, role = 'customer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });
};

describe('Category Controller Integration Tests', () => {
  let adminToken;
  let customerToken;
  let adminId;
  let customerId;

  beforeEach(async () => {
    try {
      const redisModule = await import('../src/config/redis.js');
      await redisModule.default.flushall();
    } catch (e) {}
    await Category.deleteMany({});
    await User.deleteMany({});

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
    });
    adminId = adminUser._id;
    adminToken = generateToken(adminId, 'admin');

    const customerUser = await User.create({
      name: 'John Customer',
      email: 'john@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    customerId = customerUser._id;
    customerToken = generateToken(customerId, 'customer');
  });

  describe('GET /api/v1/categories', () => {
    it('should return empty list when no categories exist', async () => {
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of created categories', async () => {
      await Category.create({ name: 'Hoodies', slug: 'hoodies', description: 'Cozy hoodies' });
      const res = await request(app).get('/api/v1/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Hoodies');
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should return category by ID', async () => {
      const cat = await Category.create({ name: 'Jackets', slug: 'jackets' });
      const res = await request(app).get(`/api/v1/categories/${cat._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Jackets');
    });

    it('should return category by slug', async () => {
      await Category.create({ name: 'T-Shirts', slug: 't-shirts' });
      const res = await request(app).get('/api/v1/categories/t-shirts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('T-Shirts');
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = '66ce78a19b2e3f412c12a8bc';
      const res = await request(app).get(`/api/v1/categories/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Category not found');
    });
  });

  describe('POST /api/v1/categories', () => {
    it('should allow admin to create a category', async () => {
      const payload = { name: 'Jeans', description: 'Denim pants' };
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Jeans');
      expect(res.body.data.slug).toBe('jeans');
    });

    it('should reject creation by non-admin customer (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Accessories' });

      expect(res.status).toBe(403);
    });

    it('should reject duplicate category name or slug (400 Bad Request)', async () => {
      await Category.create({ name: 'Dresses', slug: 'dresses' });

      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Dresses' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('PUT /api/v1/categories/:id', () => {
    it('should allow admin to update a category', async () => {
      const cat = await Category.create({ name: 'Sneakers', slug: 'sneakers' });

      const res = await request(app)
        .put(`/api/v1/categories/${cat._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Shoes', description: 'Footwear collection' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Shoes');
      expect(res.body.data.slug).toBe('shoes');
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete an unreferenced category', async () => {
      const cat = await Category.create({ name: 'Belts', slug: 'belts' });

      const res = await request(app)
        .delete(`/api/v1/categories/${cat._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Category removed successfully');

      const found = await Category.findById(cat._id);
      expect(found).toBeNull();
    });

    it('should prevent deletion of category referenced by products', async () => {
      const cat = await Category.create({ name: 'Shirts', slug: 'shirts' });
      await Product.create({
        user: adminId,
        name: 'Linen Shirt',
        slug: 'linen-shirt',
        price: 50,
        description: 'Breezy shirt',
        image: '/uploads/shirt.jpg',
        category: cat._id,
      });

      const res = await request(app)
        .delete(`/api/v1/categories/${cat._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('referenced by 1 product');
    });
  });
});
