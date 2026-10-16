import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

const generateToken = (id, role = 'customer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });
};

describe('User Controller Integration Tests', () => {
  let adminToken;
  let customerToken;
  let adminId;
  let customerId;

  beforeEach(async () => {
    const adminUser = await User.create({
      name: 'System Admin',
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

  /* ==========================================================================
     1. GET /api/v1/users (Get all users - Admin only)
     ========================================================================== */
  describe('GET /api/v1/users', () => {
    it('should fetch all users excluding passwords when requested by admin', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].password).toBeUndefined();
    });

    it('should return 403 Forbidden when requested by a customer', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 Unauthorized if no token is provided', async () => {
      const res = await request(app).get('/api/v1/users');

      expect(res.status).toBe(401);
    });
  });

  /* ==========================================================================
     2. GET /api/v1/users/:id (Get user by ID - Admin only)
     ========================================================================== */
  describe('GET /api/v1/users/:id', () => {
    it('should fetch target user details excluding password by valid ID', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(customerId.toString());
      expect(res.body.data.name).toBe('John Customer');
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 404 error if user ID does not exist', async () => {
      const nonExistentId = '66ce78a19b2e3f412c12a8bc';
      const res = await request(app)
        .get(`/api/v1/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });

    it('should return 403 Forbidden when customer attempts retrieval', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${customerId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  /* ==========================================================================
     3. PUT /api/v1/users/:id (Update user / promote role - Admin only)
     ========================================================================== */
  describe('PUT /api/v1/users/:id', () => {
    it('should update user fields and promote customer to admin', async () => {
      const updatePayload = {
        name: 'John Promoted',
        email: 'john.promoted@example.com',
        role: 'admin',
      };

      const res = await request(app)
        .put(`/api/v1/users/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('John Promoted');
      expect(res.body.data.email).toBe('john.promoted@example.com');
      expect(res.body.data.role).toBe('admin');

      const updatedUserInDb = await User.findById(customerId);
      expect(updatedUserInDb.role).toBe('admin');
    });

    it('should return 404 error when updating non-existent user ID', async () => {
      const nonExistentId = '66ce78a19b2e3f412c12a8bc';
      const res = await request(app)
        .put(`/api/v1/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });

    it('should return 403 Forbidden when customer attempts update', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${customerId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hacker Name' });

      expect(res.status).toBe(403);
    });
  });

  /* ==========================================================================
     4. DELETE /api/v1/users/:id (Delete user - Admin only)
     ========================================================================== */
  describe('DELETE /api/v1/users/:id', () => {
    it('should delete a customer account when requested by admin', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User deleted successfully');

      const deletedUser = await User.findById(customerId);
      expect(deletedUser).toBeNull();
    });

    it('should return 400 Bad Request when admin attempts self-deletion', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You cannot delete your own admin account');

      const adminUserStillExists = await User.findById(adminId);
      expect(adminUserStillExists).not.toBeNull();
    });

    it('should return 404 error when deleting a non-existent user', async () => {
      const nonExistentId = '66ce78a19b2e3f412c12a8bc';
      const res = await request(app)
        .delete(`/api/v1/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });

    it('should return 403 Forbidden when customer attempts deletion', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});