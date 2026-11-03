import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Category from '../src/models/categoryModel.js';
import Order from '../src/models/orderModel.js';
import Address from '../src/models/addressModel.js';
import InventoryMovement from '../src/models/inventoryMovementModel.js';
import AdminNotification from '../src/models/adminNotificationModel.js';
import Setting from '../src/models/settingModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';

describe('Admin Full Suite - Products, Categories, Customers, Inventory & Notifications', () => {
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let sampleCategory;

  beforeEach(async () => {
    // 1. Setup Admin User
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin-suite@novashop.com',
      password: 'Password123!',
      role: 'admin',
      isVerified: true,
      status: 'active',
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    // 2. Setup Customer User
    customerUser = await User.create({
      name: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '+251911223344',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
      status: 'active',
      tokenVersion: 0,
    });
    customerToken = generateAccessToken(customerUser._id, 0, 'customer');

    // 3. Setup Category
    sampleCategory = await Category.create({
      name: 'Outerwear',
      slug: 'outerwear',
      description: 'Luxury coats and jackets',
      status: 'active',
      sortOrder: 1,
    });
  });

  // =========================================================================
  // 1. PRODUCTS
  // =========================================================================
  describe('Admin Products API', () => {
    it('creates a product with variant matrix and writes initial InventoryMovement records', async () => {
      const payload = {
        name: 'Milano Trench Coat',
        description: 'Classic double-breasted trench coat crafted in water-repellent gabardine.',
        category: sampleCategory._id.toString(),
        brand: 'NovaShop',
        price: 890,
        status: 'active',
        images: ['https://example.com/trench.jpg'],
        variants: [
          {
            sku: 'MTC-BEI-S',
            size: 'S',
            color: { name: 'Beige', hex: '#D2B48C' },
            stock: 12,
            price: 890,
          },
          {
            sku: 'MTC-BEI-M',
            size: 'M',
            color: { name: 'Beige', hex: '#D2B48C' },
            stock: 20,
            price: 890,
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Milano Trench Coat');
      expect(res.body.data.countInStock).toBe(32);
      expect(res.body.data.variants).toHaveLength(2);

      // Verify InventoryMovements were recorded
      const movements = await InventoryMovement.find({ product: res.body.data._id });
      expect(movements).toHaveLength(2);
      expect(movements.every((m) => m.type === 'initial')).toBe(true);
      expect(movements[0].quantityChange).toBeGreaterThan(0);
      expect(movements[0].stockBefore).toBe(0);
      expect(movements[0].stockAfter).toBe(movements[0].quantityChange);
    });

    it('rejects product creation without required per-variant stock', async () => {
      const payload = {
        name: 'Invalid Coat',
        description: 'Missing variant stock',
        category: sampleCategory._id.toString(),
        price: 100,
        images: ['https://example.com/coat.jpg'],
        variants: [
          {
            sku: 'INV-1',
            size: 'S',
            color: 'Black',
            stock: -5, // Invalid negative stock
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(400);

      expect(res.body.message || res.body.error).toBeDefined();
    });

    it('updates product and records adjustment movement on stock change', async () => {
      const prod = await Product.create({
        user: adminUser._id,
        name: 'Wool Peacoat',
        slug: 'wool-peacoat',
        description: 'Navy wool peacoat',
        category: sampleCategory._id,
        price: 750,
        image: 'https://example.com/peacoat.jpg',
        images: ['https://example.com/peacoat.jpg'],
        countInStock: 10,
        status: 'active',
      });

      const variant = await ProductVariant.create({
        product: prod._id,
        sku: 'WPC-NAV-M',
        size: 'M',
        color: { name: 'Navy', hex: '#000080' },
        price: 750,
        stock: 10,
      });

      const updatePayload = {
        name: 'Wool Peacoat (Updated)',
        variants: [
          {
            _id: variant._id.toString(),
            sku: 'WPC-NAV-M',
            size: 'M',
            color: { name: 'Navy', hex: '#000080' },
            stock: 25, // +15 units
            price: 750,
          },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/admin/products/${prod._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.countInStock).toBe(25);

      const movements = await InventoryMovement.find({ variant: variant._id });
      expect(movements.length).toBeGreaterThan(0);
      const lastMovement = movements[movements.length - 1];
      expect(lastMovement.type).toBe('restock');
      expect(lastMovement.quantityChange).toBe(15);
      expect(lastMovement.stockBefore).toBe(10);
      expect(lastMovement.stockAfter).toBe(25);
    });

    it('archives product instead of permanently deleting if orders exist', async () => {
      const prod = await Product.create({
        user: adminUser._id,
        name: 'Archived Silk Shirt',
        slug: 'archived-silk-shirt',
        description: 'Fine silk shirt',
        category: sampleCategory._id,
        price: 320,
        image: 'https://example.com/shirt.jpg',
        images: ['https://example.com/shirt.jpg'],
        countInStock: 5,
        status: 'active',
      });

      const variant = await ProductVariant.create({
        product: prod._id,
        sku: 'ASS-WHT-S',
        size: 'S',
        color: { name: 'White', hex: '#FFFFFF' },
        stock: 5,
      });

      // Create an order referencing this product
      await Order.create({
        orderNumber: 'NS-ORDER-ARCHIVE',
        user: customerUser._id,
        customerEmail: customerUser.email,
        orderItems: [
          {
            product: prod._id,
            variant: variant._id,
            name: prod.name,
            qty: 1,
            price: 320,
            image: prod.image,
            sku: variant.sku,
            size: variant.size,
            color: 'White',
          },
        ],
        shippingAddress: {
          recipientName: 'Jane Doe',
          phone: '+251911223344',
          address: 'Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        totalPrice: 320,
        itemsPrice: 320,
        status: 'delivered',
        isPaid: true,
      });

      const res = await request(app)
        .delete(`/api/v1/admin/products/${prod._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.archived).toBe(true);

      const refreshed = await Product.findById(prod._id);
      expect(refreshed.status).toBe('archived');
    });

    it('duplicates a product with new slug and variant copies', async () => {
      const prod = await Product.create({
        user: adminUser._id,
        name: 'Original Blazer',
        slug: 'original-blazer',
        description: 'Tailored blazer',
        category: sampleCategory._id,
        price: 550,
        image: 'https://example.com/blazer.jpg',
        images: ['https://example.com/blazer.jpg'],
        countInStock: 8,
        status: 'active',
      });

      await ProductVariant.create({
        product: prod._id,
        sku: 'OB-BLK-40',
        size: '40',
        color: { name: 'Black', hex: '#000000' },
        stock: 8,
      });

      const res = await request(app)
        .post(`/api/v1/admin/products/${prod._id}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Original Blazer (Copy)');
      expect(res.body.data.slug).toContain('original-blazer-copy-');
      expect(res.body.data.variants[0].sku).toContain('OB-BLK-40-CP');
    });
  });

  // =========================================================================
  // 2. CATEGORIES
  // =========================================================================
  describe('Admin Categories API', () => {
    it('returns categories with aggregated product count', async () => {
      await Product.create({
        user: adminUser._id,
        name: 'Coat Alpha',
        slug: 'coat-alpha',
        description: 'Alpha coat',
        category: sampleCategory._id,
        price: 400,
        image: 'https://example.com/alpha.jpg',
        images: ['https://example.com/alpha.jpg'],
        countInStock: 5,
        status: 'active',
      });

      const res = await request(app)
        .get('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const found = res.body.data.find((c) => c._id === sampleCategory._id.toString());
      expect(found).toBeDefined();
      expect(found.products).toBe(1);
    });

    it('blocks category deletion if products are currently assigned to it', async () => {
      await Product.create({
        user: adminUser._id,
        name: 'Coat Beta',
        slug: 'coat-beta',
        description: 'Beta coat',
        category: sampleCategory._id,
        price: 450,
        image: 'https://example.com/beta.jpg',
        images: ['https://example.com/beta.jpg'],
        countInStock: 2,
        status: 'active',
      });

      const res = await request(app)
        .delete(`/api/v1/admin/categories/${sampleCategory._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toContain('Cannot delete category');
    });

    it('creates and reorders categories', async () => {
      const cat2 = await Category.create({
        name: 'Footwear',
        slug: 'footwear',
        sortOrder: 2,
      });

      const reorderPayload = {
        order: [
          { id: sampleCategory._id.toString(), sortOrder: 10 },
          { id: cat2._id.toString(), sortOrder: 5 },
        ],
      };

      const res = await request(app)
        .patch('/api/v1/admin/categories/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reorderPayload)
        .expect(200);

      expect(res.body.success).toBe(true);

      const updated1 = await Category.findById(sampleCategory._id);
      expect(updated1.sortOrder).toBe(10);
      const updated2 = await Category.findById(cat2._id);
      expect(updated2.sortOrder).toBe(5);
    });
  });

  // =========================================================================
  // 3. CUSTOMERS
  // =========================================================================
  describe('Admin Customers API', () => {
    it('returns customer list with paid spend metrics and strictly excludes admins', async () => {
      // Create paid order for customerUser
      await Order.create({
        orderNumber: 'NS-CUS-1001',
        user: customerUser._id,
        customerEmail: customerUser.email,
        orderItems: [
          {
            product: new mongoose.Types.ObjectId(),
            name: 'Leather Jacket',
            qty: 1,
            price: 1200,
            image: 'https://example.com/jacket.jpg',
            sku: 'LJ-01',
            size: 'L',
            color: 'Black',
          },
        ],
        shippingAddress: {
          recipientName: 'Jane Doe',
          phone: '+251911223344',
          address: 'Bole Road',
          city: 'Addis Ababa',
          postalCode: '1000',
          country: 'Ethiopia',
        },
        paymentMethod: 'Chapa',
        totalPrice: 1200,
        itemsPrice: 1200,
        status: 'delivered',
        isPaid: true,
      });

      const res = await request(app)
        .get('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Admin should not appear in customer list
      expect(res.body.data.some((c) => c.email === adminUser.email)).toBe(false);

      const foundCustomer = res.body.data.find((c) => c.email === customerUser.email);
      expect(foundCustomer).toBeDefined();
      expect(foundCustomer.ordersCount).toBe(1);
      expect(foundCustomer.totalSpent).toBe(1200);
    });

    it('retrieves detailed customer profile with saved addresses and order history', async () => {
      await Address.create({
        user: customerUser._id,
        label: 'Home',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+251911223344',
        street: 'Main Street 42',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        isDefault: true,
      });

      const res = await request(app)
        .get(`/api/v1/admin/customers/${customerUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(customerUser.email);
      expect(res.body.data.addresses).toHaveLength(1);
      expect(res.body.data.addresses[0].street).toBe('Main Street 42');
      expect(res.body.data.password).toBeUndefined();
    });

    it('deactivates and reactivates a customer, invalidating active sessions', async () => {
      const deactivateRes = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'deactivated', reason: 'Suspected fraudulent card use' })
        .expect(200);

      expect(deactivateRes.body.data.status).toBe('deactivated');
      expect(deactivateRes.body.data.isActive).toBe(false);

      const refreshed = await User.findById(customerUser._id).select('+tokenVersion');
      expect(refreshed.tokenVersion).toBe(1); // tokenVersion bumped, revoking active JWTs

      // Reactivate
      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(reactivateRes.body.data.status).toBe('active');
      expect(reactivateRes.body.data.isActive).toBe(true);
    });
  });

  // =========================================================================
  // 4. INVENTORY & LOW-STOCK ENGINE
  // =========================================================================
  describe('Admin Inventory API & Low-Stock Engine', () => {
    let testProduct;
    let testVariant;

    beforeEach(async () => {
      testProduct = await Product.create({
        user: adminUser._id,
        name: 'Cashmere Beanie',
        slug: 'cashmere-beanie',
        description: 'Soft cashmere knit beanie',
        category: sampleCategory._id,
        price: 150,
        image: 'https://example.com/beanie.jpg',
        images: ['https://example.com/beanie.jpg'],
        countInStock: 20,
        status: 'active',
      });

      testVariant = await ProductVariant.create({
        product: testProduct._id,
        sku: 'CB-GRY-OS',
        size: 'OS',
        color: { name: 'Grey', hex: '#808080' },
        price: 150,
        stock: 20,
        reserved: 0,
      });
    });

    it('returns inventory table with onHand, reserved, available, and correct status', async () => {
      testVariant.reserved = 3;
      await testVariant.save();

      const res = await request(app)
        .get('/api/v1/admin/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const found = res.body.data.find((v) => v.sku === 'CB-GRY-OS');
      expect(found).toBeDefined();
      expect(found.stock).toBe(20);
      expect(found.reserved).toBe(3);
      expect(found.available).toBe(17);
      expect(found.status).toBe('In stock');
    });

    it('adjusts stock with required reason and records InventoryMovement', async () => {
      const adjustPayload = {
        variantId: testVariant._id.toString(),
        mode: 'delta',
        value: -15, // Reduce stock from 20 to 5
        reason: 'Damaged packaging during warehouse handling',
      };

      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adjustPayload)
        .expect(200);

      expect(res.body.success).toBe(true);

      const refreshedVariant = await ProductVariant.findById(testVariant._id);
      expect(refreshedVariant.stock).toBe(5);

      const movement = await InventoryMovement.findOne({ variant: testVariant._id, type: 'adjustment' });
      expect(movement).toBeDefined();
      expect(movement.quantityChange).toBe(-15);
      expect(movement.stockBefore).toBe(20);
      expect(movement.stockAfter).toBe(5);
      expect(movement.reason).toContain('Damaged packaging');

      // Check low stock alert deduplication: since stock is now 5 (<= default threshold 5), an alert must be created
      const notif = await AdminNotification.findOne({ type: 'low_stock', entityId: testVariant._id.toString() });
      expect(notif).toBeDefined();
      expect(refreshedVariant.isLowStockAlerted).toBe(true);
    });

    it('rejects stock adjustment resulting in negative stock', async () => {
      const adjustPayload = {
        variantId: testVariant._id.toString(),
        mode: 'delta',
        value: -50, // 20 - 50 = -30 (illegal)
        reason: 'Large inventory audit correction',
      };

      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adjustPayload)
        .expect(400);

      expect(res.body.message).toContain('Stock cannot be negative');
    });

    it('supports bulk restock preview and application', async () => {
      const restockRows = [
        {
          sku: 'CB-GRY-OS',
          quantity: 30,
          reason: 'Supplier shipment PO-9912',
        },
      ];

      // 1. Preview mode (dry-run)
      const previewRes = await request(app)
        .post('/api/v1/admin/inventory/bulk-restock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ preview: true, rows: restockRows })
        .expect(200);

      expect(previewRes.body.preview).toBe(true);
      expect(previewRes.body.validRows).toBe(1);
      expect(previewRes.body.rows[0].stockAfter).toBe(50);

      // Verify stock was not changed during preview
      const unchanged = await ProductVariant.findById(testVariant._id);
      expect(unchanged.stock).toBe(20);

      // 2. Apply restock
      const applyRes = await request(app)
        .post('/api/v1/admin/inventory/bulk-restock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ preview: false, rows: restockRows })
        .expect(200);

      expect(applyRes.body.success).toBe(true);
      expect(applyRes.body.appliedCount).toBe(1);

      const applied = await ProductVariant.findById(testVariant._id);
      expect(applied.stock).toBe(50);

      const movement = await InventoryMovement.findOne({ variant: testVariant._id, type: 'restock' });
      expect(movement).toBeDefined();
      expect(movement.quantityChange).toBe(30);
    });

    it('updates and reads the global lowStockThreshold setting', async () => {
      const updateRes = await request(app)
        .patch('/api/v1/admin/settings/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lowStockThreshold: 8 })
        .expect(200);

      expect(updateRes.body.data.lowStockThreshold).toBe(8);

      const getRes = await request(app)
        .get('/api/v1/admin/settings/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getRes.body.data.lowStockThreshold).toBe(8);
    });
  });

  // =========================================================================
  // 5. NOTIFICATIONS
  // =========================================================================
  describe('Admin Notifications API', () => {
    it('paginates notifications and deletes a notification', async () => {
      const notif = await AdminNotification.create({
        type: 'new_order',
        title: 'New Paid Order #NS-99999',
        message: 'Order received from customer',
        entityType: 'order',
        entityId: 'NS-99999',
        link: '/admin/orders/NS-99999',
        isRead: false,
      });

      const listRes = await request(app)
        .get('/api/v1/admin/notifications/all?page=1&limit=10&unreadOnly=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(listRes.body.success).toBe(true);
      expect(listRes.body.unreadCount).toBeGreaterThan(0);
      expect(listRes.body.data.some((n) => n._id === notif._id.toString())).toBe(true);

      // Delete notification
      const delRes = await request(app)
        .delete(`/api/v1/admin/notifications/${notif._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(delRes.body.success).toBe(true);

      const check = await AdminNotification.findById(notif._id);
      expect(check).toBeNull();
    });
  });
});
