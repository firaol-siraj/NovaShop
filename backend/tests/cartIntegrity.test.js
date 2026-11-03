import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
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

const generateToken = (id, role = 'customer') =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });

describe('Cart Integrity Tests', () => {
  let user1, user2;
  let token1, token2;
  let category;
  let product;
  let variantInherit; // price null -> inherits product price
  let variantExpensive; // price 85

  beforeEach(async () => {
    user1 = await User.create({
      name: 'Alice User',
      email: 'alice-cart@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    token1 = generateToken(user1._id, 'customer');

    user2 = await User.create({
      name: 'Bob User',
      email: 'bob-cart@example.com',
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

    variantInherit = await ProductVariant.create({
      product: product._id,
      sku: 'HOOD-BLK-M',
      size: 'M',
      color: { name: 'Black', hex: '#000000' },
      stock: 50,
      price: null,
    });

    variantExpensive = await ProductVariant.create({
      product: product._id,
      sku: 'HOOD-BLK-L',
      size: 'L',
      color: { name: 'Black', hex: '#000000' },
      stock: 2,
      price: 85,
    });
  });

  describe('POST /api/v1/cart/items — integrity checks', () => {
    it('rejects an inactive (draft) product with 400', async () => {
      product.status = 'draft';
      await product.save();

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not available');
    });

    it('rejects a missing variant with 404', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: new mongoose.Types.ObjectId().toString(),
          quantity: 1,
        });

      expect(res.status).toBe(404);
    });

    it('rejects a variant that belongs to another product with 400', async () => {
      const otherProduct = await Product.create({
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
          productId: otherProduct._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not belong');
    });

    it('rejects an out-of-stock variant with 409', async () => {
      variantExpensive.stock = 0;
      await variantExpensive.save();

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 1,
        });

      expect(res.status).toBe(409);
    });

    it('rejects quantity above 10 with 400 (validator cap)', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 11,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('10');
    });

    it('rejects an existing line whose total would exceed min(stock, 10)', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 10,
        });

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 10');
    });

    it('rejects quantity above stock (stock 2 < max 10)', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 3,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 2');
    });

    it('computes the price on the server even if the client sends a fake price', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 1,
          price: 0.01,
          name: 'Fake Name',
          image: 'fake.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].price).toBe(85);
      expect(res.body.data.items[0].name).toBe('Nova Fleece Hoodie');
      expect(res.body.data.subtotal).toBe(85);
    });

    it('inherits the product price when variant price is null', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].price).toBe(80);
      expect(res.body.data.subtotal).toBe(160);
    });

    it('inherits the product price when variant price is 0', async () => {
      variantExpensive.price = 0;
      await variantExpensive.save();

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].price).toBe(80);
    });

    it('defaults quantity to 1 when omitted', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(1);
    });
  });

  describe('PATCH /api/v1/cart/items/:itemId — quantity caps', () => {
    const addAndGetItemId = async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });
      return res.body.data.items[0]._id;
    };

    it('rejects an update beyond min(stock, 10)', async () => {
      const itemId = await addAndGetItemId();

      const res = await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ quantity: 11 });

      expect(res.status).toBe(400);
    });

    it('rejects an update beyond stock when stock < 10', async () => {
      const addRes = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 1,
        });
      const itemId = addRes.body.data.items[0]._id;

      const res = await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ quantity: 3 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only 2');
    });

    it('accepts an update to exactly min(stock, 10)', async () => {
      const itemId = await addAndGetItemId();

      const res = await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(10);
    });

    it('rejects an invalid itemId param with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/cart/items/not-an-id')
        .set('Authorization', `Bearer ${token1}`)
        .send({ quantity: 1 });

      expect(res.status).toBe(400);
    });
  });


  describe('GET /api/v1/cart — pruning and issues', () => {
    it('prunes lines whose product was deleted', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      await Product.deleteOne({ _id: product._id });

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);

      // The prune is persisted, not just filtered from the response.
      const stored = await Cart.findOne({ user: user1._id });
      expect(stored.items.length).toBe(0);
    });

    it('prunes lines whose variant was deleted', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      await ProductVariant.deleteOne({ _id: variantInherit._id });

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);

      const stored = await Cart.findOne({ user: user1._id });
      expect(stored.items.length).toBe(0);
    });

    it('flags out_of_stock and excludes it from the subtotal', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 2,
        });

      // Stock drops to zero underneath the cart.
      variantInherit.stock = 0;
      await variantInherit.save();

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasIssues).toBe(true);
      const flagged = res.body.data.items.find(
        (item) => item.variantId === variantInherit._id.toString()
      );
      expect(flagged.issue).toBe('out_of_stock');
      // Only the healthy line (85 x 2) counts toward the subtotal.
      expect(res.body.data.subtotal).toBe(170);
    });

    it('flags an inactive product as unavailable', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      product.status = 'archived';
      await product.save();

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.body.data.hasIssues).toBe(true);
      expect(res.body.data.items[0].issue).toBe('unavailable');
      expect(res.body.data.subtotal).toBe(0);
    });
  });


  describe('POST /api/v1/cart/merge', () => {
    it('skips unavailable lines, clamps the rest, and is idempotent', async () => {
      // Seed the server cart with 1x variantInherit.
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });

      const draftProduct = await Product.create({
        user: user1._id,
        name: 'Draft Item',
        slug: 'draft-item',
        price: 50,
        description: 'Draft',
        image: '/img.jpg',
        category: category._id,
        status: 'draft',
      });

      const guestItems = [
        // Healthy: guest has 4, server has 1 -> max(1, 4) = 4.
        {
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 4,
        },
        // Exceeds stock 2 -> clamped to 2, reported adjusted.
        {
          productId: product._id.toString(),
          variantId: variantExpensive._id.toString(),
          quantity: 5,
        },
        // Draft product -> skipped.
        {
          productId: draftProduct._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        },
        // Unknown product -> skipped.
        {
          productId: new mongoose.Types.ObjectId().toString(),
          variantId: new mongoose.Types.ObjectId().toString(),
          quantity: 1,
        },
      ];

      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({ items: guestItems });

      expect(res.status).toBe(200);
      expect(res.body.data.skipped.length).toBe(2);
      expect(res.body.data.adjusted.length).toBe(1);
      expect(res.body.data.adjusted[0]).toMatchObject({
        variantId: variantExpensive._id.toString(),
        from: 5,
        to: 2,
      });

      const findLine = (variantId) =>
        res.body.data.items.find((item) => item.variantId === variantId);
      expect(findLine(variantInherit._id.toString()).quantity).toBe(4);
      expect(findLine(variantExpensive._id.toString()).quantity).toBe(2);

      // Calling merge a second time must not change quantities (max, not sum).
      const second = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({ items: guestItems });

      expect(second.status).toBe(200);
      const secondFindLine = (variantId) =>
        second.body.data.items.find((item) => item.variantId === variantId);
      expect(secondFindLine(variantInherit._id.toString()).quantity).toBe(4);
      expect(secondFindLine(variantExpensive._id.toString()).quantity).toBe(2);
      expect(second.body.data.items.length).toBe(2);
    });

    it('merges into an empty cart for a brand-new user', async () => {
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          items: [
            {
              productId: product._id.toString(),
              variantId: variantInherit._id.toString(),
              quantity: 3,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('rejects more than 50 merged lines with 400', async () => {
      const items = Array.from({ length: 51 }, () => ({
        productId: product._id.toString(),
        variantId: variantInherit._id.toString(),
        quantity: 1,
      }));

      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${token1}`)
        .send({ items });

      expect(res.status).toBe(400);
    });
  });


  describe('Ownership and authentication', () => {
    it('rejects unauthenticated cart requests with 401', async () => {
      expect((await request(app).get('/api/v1/cart')).status).toBe(401);
      expect(
        (
          await request(app)
            .post('/api/v1/cart/items')
            .send({ productId: 'x', variantId: 'y' })
        ).status
      ).toBe(401);
      expect(
        (await request(app).post('/api/v1/cart/merge').send({ items: [] }))
          .status
      ).toBe(401);
    });

    it("prevents user2 from modifying user1's cart lines", async () => {
      const addRes = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 1,
        });
      const user1ItemId = addRes.body.data.items[0]._id;

      // user2 has no cart -> PATCH/DELETE on user1's line id must not touch it.
      const patchRes = await request(app)
        .patch(`/api/v1/cart/items/${user1ItemId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ quantity: 5 });
      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/cart/items/${user1ItemId}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(deleteRes.status).toBe(404);

      // user1's line is untouched.
      const user1Cart = await Cart.findOne({ user: user1._id });
      expect(user1Cart.items.length).toBe(1);
      expect(user1Cart.items[0].quantity).toBe(1);
    });

    it('user2 sees only their own (empty) cart', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          productId: product._id.toString(),
          variantId: variantInherit._id.toString(),
          quantity: 2,
        });

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });
  });

  describe('GET /api/v1/products/:id — id or slug (F6)', () => {
    it('returns 200 for a valid slug', async () => {
      const res = await request(app).get('/api/v1/products/nova-fleece-hoodie');
      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe('nova-fleece-hoodie');
    });

    it('returns 200 for a valid ObjectId', async () => {
      const res = await request(app).get(
        `/api/v1/products/${product._id.toString()}`
      );
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(product._id.toString());
    });

    it('returns 400 for an invalid identifier', async () => {
      const res = await request(app).get('/api/v1/products/not%20a%20slug!');
      expect(res.status).toBe(400);
    });

    it('does not return draft products publicly', async () => {
      product.status = 'draft';
      await product.save();

      const res = await request(app).get('/api/v1/products/nova-fleece-hoodie');
      expect(res.status).toBe(404);
    });
  });
});

