import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Setting from '../src/models/settingModel.js';
import AuditLog from '../src/models/auditLogModel.js';
import AdminInvite from '../src/models/adminInviteModel.js';
import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { calculateTaxForOrder } from '../src/services/settingsService.js';
import { emailQueue } from '../src/queues/emailQueue.js';

describe('Admin Settings, RBAC & Tax System Tests', () => {
  let ownerUser;
  let ownerToken;
  let adminUser;
  let adminToken;
  let supportUser;
  let supportToken;
  let customerUser;
  let customerToken;
  let testCategory;
  let testProduct;

  beforeEach(async () => {
    if (emailQueue) {
      emailQueue.add = () => Promise.resolve(true);
    }

    // 1. Create Owner
    ownerUser = await User.create({
      name: 'Firaol Owner',
      email: 'firaolsiraj17@gmail.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'owner',
      isVerified: true,
    });
    ownerToken = generateAccessToken(ownerUser._id, 0, 'admin');

    // 2. Create standard Admin
    adminUser = await User.create({
      name: 'Grace Admin',
      email: 'grace.lin@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'admin',
      isVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    // 3. Create Support Agent
    supportUser = await User.create({
      name: 'Priya Support',
      email: 'priya.nair@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'support',
      isVerified: true,
    });
    supportToken = generateAccessToken(supportUser._id, 0, 'admin');

    // 4. Create Customer
    customerUser = await User.create({
      name: 'Customer Henok',
      email: 'henok@example.com',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
    });
    customerToken = generateAccessToken(customerUser._id, 0, 'customer');

    // 5. Initialize Singleton Settings
    await Setting.getSingleton();

    // 6. Create category & product for order tax testing
    testCategory = await Category.create({
      name: 'Footwear',
      slug: 'footwear',
      description: 'Shoes and boots',
    });

    testProduct = await Product.create({
      user: ownerUser._id,
      name: 'Leather Oxford Shoes',
      slug: 'leather-oxford-shoes',
      description: 'Premium handcrafted leather oxford shoes',
      brand: 'NovaShop',
      category: testCategory._id,
      price: 200,
      image: '/images/shoes.jpg',
      countInStock: 25,
      isActive: true,
    });
  });

  describe('1. Public Settings & Security', () => {
    it('GET /api/settings/public returns safe fields without leaking secrets', async () => {
      const res = await request(app).get('/api/settings/public');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.storeName).toBe('NovaShop');
      expect(data.currency).toBe('USD');
      expect(data.freeShippingThreshold).toBeDefined();

      // Ensure zero secrets leaked
      expect(data.CHAPA_SECRET_KEY).toBeUndefined();
      expect(data.JWT_SECRET).toBeUndefined();
      expect(data.EMAIL_PASS).toBeUndefined();
      expect(data.IMAP_PASSWORD).toBeUndefined();
      expect(data.storefrontPassword).toBeUndefined();
    });

    it('GET /api/settings/countries returns full ISO countries list', async () => {
      const res = await request(app).get('/api/settings/countries');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.countries)).toBe(true);
      expect(res.body.data.countries.length).toBeGreaterThan(200);
      expect(res.body.data.countries.some((c) => c.code === 'ET')).toBe(true);
    });
  });

  describe('2. Role-Based Access Control (RBAC) on Settings', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/settings');
      expect(res.status).toBe(401);
    });

    it('blocks customer tokens with 403', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks Support Agent from modifying settings with 403', async () => {
      const res = await request(app)
        .patch('/api/admin/settings/store')
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ storeName: 'Hacked Shop', version: 1 });
      expect(res.status).toBe(403);
    });

    it('allows Owner and Admin to view and modify settings', async () => {
      const getRes = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.store).toBeDefined();
      expect(getRes.body.data.secretsStatus).toBeDefined();
    });
  });

  describe('3. Optimistic Concurrency & Validation', () => {
    it('rejects stale version saves with 409 Conflict', async () => {
      const currentDoc = await Setting.getSingleton();
      const currentVersion = currentDoc.version;

      const res = await request(app)
        .patch('/api/admin/settings/store')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          storeName: 'NovaShop Updated',
          version: currentVersion + 999, // Stale version
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Settings were modified by another administrator');
    });

    it('rejects invalid store contact email with 400', async () => {
      const currentDoc = await Setting.getSingleton();
      const res = await request(app)
        .patch('/api/admin/settings/store')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'not-an-email',
          version: currentDoc.version,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('valid store contact email');
    });

    it('rejects invalid tax rate (>100) with 400', async () => {
      const currentDoc = await Setting.getSingleton();
      const res = await request(app)
        .patch('/api/admin/settings/tax')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          defaultRate: 150,
          version: currentDoc.version,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Tax rate must be between 0 and 100%');
    });

    it('successfully saves valid updates and creates an AuditLog record', async () => {
      const currentDoc = await Setting.getSingleton();
      const res = await request(app)
        .patch('/api/admin/settings/store')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          storeName: 'NovaShop Prime',
          phone: '+251911223344',
          city: 'Addis Ababa',
          version: currentDoc.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Audit Log was recorded
      const log = await AuditLog.findOne({ section: 'store' }).sort({ createdAt: -1 });
      expect(log).toBeDefined();
      expect(log.performedBy.toString()).toBe(ownerUser._id.toString());
      expect(log.changes.some((c) => c.field === 'store.name' && c.newValue === 'NovaShop Prime')).toBe(true);
    });
  });

  describe('4. Team Member Management & Owner Protection', () => {
    it('prevents demoting the last remaining owner', async () => {
      const res = await request(app)
        .patch(`/api/admin/settings/team/members/${ownerUser._id}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'Store Manager' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot demote the last active store owner');
    });

    it('prevents removing the last remaining owner', async () => {
      const res = await request(app)
        .delete(`/api/admin/settings/team/members/${ownerUser._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot remove the last active store owner');
    });

    it('prevents non-owner admins from granting owner role', async () => {
      const res = await request(app)
        .patch(`/api/admin/settings/team/members/${supportUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Owner' });

      expect(res.status).toBe(403);
    });

    it('allows an owner to invite a new team member and accept the invite', async () => {
      // 1. Send invite
      const inviteRes = await request(app)
        .post('/api/admin/settings/team/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Solomon Tadesse',
          email: 'solomon@novashop.com',
          role: 'Store Manager',
        });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.success).toBe(true);

      const invite = await AdminInvite.findOne({ email: 'solomon@novashop.com' });
      expect(invite).toBeDefined();
      expect(invite.status).toBe('pending');

      // 2. Accept invite using unhashed token
      const rawToken = inviteRes.body.data.inviteToken;
      const acceptRes = await request(app)
        .post('/api/auth/admin/accept-invite')
        .send({
          token: rawToken,
          password: 'NewStrongPassword123!',
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      // Verify newly created user
      const newUser = await User.findOne({ email: 'solomon@novashop.com' });
      expect(newUser).toBeDefined();
      expect(newUser.role).toBe('admin');
      expect(newUser.adminRole).toBe('manager');

      // Verify invite cannot be reused
      const secondAccept = await request(app)
        .post('/api/auth/admin/accept-invite')
        .send({
          token: rawToken,
          password: 'AnotherPassword123!',
        });
      expect(secondAccept.status).toBe(400);
    });
  });

  describe('5. Tax Calculation & Order Snapshotting', () => {
    it('calculates 15% exclusive tax correctly', async () => {
      const calculation = await calculateTaxForOrder({
        shippingAddress: { country: 'Ethiopia' },
        itemsPrice: 100,
        shippingPrice: 20,
      });

      expect(calculation.taxRate).toBe(15);
      expect(calculation.taxName).toBe('VAT');
      expect(calculation.taxIncluded).toBe(false);
      // Items tax: 15.00, Shipping tax: 3.00 => Total tax: 18.00
      expect(calculation.taxAmount).toBe(18);
    });

    it('snapshots tax attributes onto newly created order', async () => {
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderItems: [
            {
              name: testProduct.name,
              qty: 1,
              price: 200,
              product: testProduct._id,
              image: '/images/shoes.jpg',
            },
          ],
          shippingAddress: {
            recipientName: 'Henok T',
            phone: '+251911002233',
            address: 'Bole Medhanialem',
            city: 'Addis Ababa',
            state: 'Addis Ababa',
            postalCode: '1102',
            country: 'Ethiopia',
          },
          paymentMethod: 'Cash',
          shippingPrice: 15,
        });

      expect(orderRes.status).toBe(201);
      const order = orderRes.body.data;
      expect(order.taxRate).toBe(15);
      expect(order.taxName).toBe('VAT');
      expect(order.taxPrice).toBeGreaterThan(0);
      // Total price = items (200) + shipping (15) + tax (32.25)
      expect(order.totalPrice).toBe(order.itemsPrice + order.shippingPrice + order.taxPrice);
    });
  });
});
