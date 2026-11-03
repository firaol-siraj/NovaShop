import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import HomeContent from '../src/models/homeContentModel.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

const generateToken = (id, role = 'customer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });
};

describe('Home Hero Controller Integration Tests', () => {
  let adminToken;
  let customerToken;
  let adminId;
  let customerId;

  beforeEach(async () => {
    await HomeContent.deleteMany({});
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
      name: 'Regular Customer',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    customerId = customerUser._id;
    customerToken = generateToken(customerId, 'customer');
  });

  describe('GET /api/v1/home/hero', () => {
    it('should return 200 with data: null when no hero document exists without creating any DB record', async () => {
      const countBefore = await HomeContent.countDocuments();
      expect(countBefore).toBe(0);

      const res = await request(app).get('/api/v1/home/hero');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();

      const countAfter = await HomeContent.countDocuments();
      expect(countAfter).toBe(0);
    });

    it('should return hero data when active document exists', async () => {
      await HomeContent.create({
        eyebrow: 'Special Offer',
        title: 'Autumn Collection',
        subtitle: 'Warm styles',
        imageUrl: 'https://images.unsplash.com/photo-1',
        primaryCta: { label: 'Shop Now', link: '/shop' },
        isActive: true,
      });

      const res = await request(app).get('/api/v1/home/hero');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('Autumn Collection');
    });
  });

  describe('PUT /api/v1/home/hero', () => {
    it('should return 401 Unauthorized if no token is provided', async () => {
      const res = await request(app)
        .put('/api/v1/home/hero')
        .send({
          title: 'Unauthorized update attempt',
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden when requested by a non-admin customer', async () => {
      const res = await request(app)
        .put('/api/v1/home/hero')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Customer update attempt',
        });

      expect(res.status).toBe(403);
    });

    it('should allow admin to create and update hero banner', async () => {
      const createRes = await request(app)
        .put('/api/v1/home/hero')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          eyebrow: 'THE SEASON EDIT',
          title: 'Layers for the Season.',
          subtitle: 'Outerwear and essentials.',
          imageUrl: 'https://images.unsplash.com/photo-1234',
          primaryCta: { label: 'SHOP THE EDIT', link: '/shop' },
          secondaryCta: { label: 'VIEW OUTERWEAR', link: '/shop?category=outerwear' },
          isActive: true,
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.title).toBe('Layers for the Season.');

      const count = await HomeContent.countDocuments();
      expect(count).toBe(1);

      // Updating again updates the single document
      const updateRes = await request(app)
        .put('/api/v1/home/hero')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Season Edit',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Season Edit');

      const countAfter = await HomeContent.countDocuments();
      expect(countAfter).toBe(1);
    });

    it('should reject unsafe link protocol like javascript:', async () => {
      const res = await request(app)
        .put('/api/v1/home/hero')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Unsafe Link Test',
          primaryCta: { label: 'Exploit', link: 'javascript:alert(1)' },
        });

      expect(res.status).toBe(400);
    });
  });
});
