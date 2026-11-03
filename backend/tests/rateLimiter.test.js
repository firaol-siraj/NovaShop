import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { apiLimiter, authLimiter } from '../src/middlewares/rateLimiter.js';

describe('Rate Limiter Behavior Verification', () => {
  let app;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Temporarily set NODE_ENV to production so rate limiters are active
    process.env.NODE_ENV = 'production';

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    // Mount apiLimiter on /api
    app.use('/api', apiLimiter);

    // Mock endpoints
    app.get('/api/v1/auth/me', (req, res) => res.json({ success: true, user: 'test' }));
    app.post('/api/v1/auth/refresh-token', (req, res) => res.json({ success: true, token: 'new' }));
    app.post('/api/v1/auth/login', authLimiter, (req, res) => {
      if (req.body.password === 'correct') {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ success: false, message: 'Invalid password' });
    });
    app.post('/api/v1/orders/webhook/chapa', (req, res) => res.json({ success: true }));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should NEVER rate-limit /auth/me or /auth/refresh-token across repeated page reloads', async () => {
    // Simulate 35 rapid page reloads (70 requests)
    for (let i = 0; i < 35; i++) {
      const meRes = await request(app).get('/api/v1/auth/me');
      expect(meRes.status).toBe(200);

      const refreshRes = await request(app).post('/api/v1/auth/refresh-token');
      expect(refreshRes.status).toBe(200);
    }
  });

  it('should not penalize successful logins under authLimiter', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@test.com', password: 'correct' });
      expect(res.status).toBe(200);
    }
  });

  it('should allow payment webhooks without hitting apiLimiter', async () => {
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/v1/orders/webhook/chapa').send({});
      expect(res.status).toBe(200);
    }
  });
});
