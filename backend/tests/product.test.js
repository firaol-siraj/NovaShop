import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

jest.mock('../src/utils/clearCache.js', () => ({
  clearCachePattern: jest.fn().mockResolvedValue(true),
}));

const generateToken = (id, role = 'customer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h',
  });
};

describe('Fashion Product Controller Integration Tests', () => {
  let adminToken;
  let customerToken;
  let adminId;
  let customerId;
  let category;

  beforeAll(async () => {
    await Product.ensureIndexes();
  });

  beforeEach(async () => {
    try {
      const redisModule = await import('../src/config/redis.js');
      await redisModule.default.flushall();
    } catch (e) {}
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
    });
    adminId = adminUser._id;
    adminToken = generateToken(adminId, 'admin');

    const standardCustomer = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    customerId = standardCustomer._id;
    customerToken = generateToken(customerId, 'customer');

    category = await Category.create({ name: 'Hoodies', slug: 'hoodies' });
  });

  describe('GET /api/v1/products', () => {
    it('should return paginated products with default page parameters', async () => {
      const product = await Product.create({
        name: 'Oversized Streetwear Hoodie',
        slug: 'oversized-streetwear-hoodie',
        price: 89.99,
        description: 'Heavyweight cotton hoodie',
        image: '/uploads/hoodie.jpg',
        brand: 'NovaShop',
        category: category._id,
        user: adminId,
      });

      const res = await request(app).get('/api/v1/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.page).toBe(1);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].name).toBe('Oversized Streetwear Hoodie');
    });

    it('should list only schema-valid active products and report accurate pagination totals', async () => {
      const catalogImageUrl = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=85';
      const activeProducts = await Product.create([
        {
          name: 'Active Product One',
          slug: 'active-product-one',
          price: 20,
          description: 'A valid active product',
          image: catalogImageUrl,
          images: [catalogImageUrl],
          category: category._id,
          user: adminId,
          countInStock: 0,
        },
        {
          name: 'Active Product Two',
          slug: 'active-product-two',
          price: 30,
          description: 'Another valid active product',
          image: catalogImageUrl,
          category: category._id,
          user: adminId,
        },
      ]);

      const draftProduct = await Product.create({
        name: 'Draft Product',
        slug: 'draft-product',
        price: 25,
        description: 'A product awaiting publication',
        image: catalogImageUrl,
        category: category._id,
        user: adminId,
        status: 'draft',
      });

      const malformedProduct = await Product.collection.insertOne({
        name: 'Malformed Legacy Product',
        status: 'active',
        price: 15,
        description: 'A record written outside schema validation',
        image: 'http://',
        category: 'smartphone',
        user: adminId,
      });

      const firstPage = await request(app).get('/api/v1/products?pageNumber=1&pageSize=1');
      const secondPage = await request(app).get('/api/v1/products?pageNumber=2&pageSize=1');

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.totalProducts).toBe(2);
      expect(firstPage.body.pages).toBe(2);
      expect(firstPage.body.data).toHaveLength(1);
      expect(firstPage.body.data[0].category.name).toBe('Hoodies');
      expect(firstPage.body.data[0].image).toBe(catalogImageUrl);
      expect(firstPage.body.data[0].images).toBeInstanceOf(Array);
      expect(secondPage.body.page).toBe(2);
      expect(secondPage.body.totalProducts).toBe(2);
      expect(secondPage.body.data).toHaveLength(1);
      expect(new Set([
        firstPage.body.data[0]._id,
        secondPage.body.data[0]._id,
      ])).toEqual(new Set(activeProducts.map((product) => product.id)));

      const activeDetail = await request(app).get(`/api/v1/products/${activeProducts[0].id}`);
      const draftDetail = await request(app).get(`/api/v1/products/${draftProduct.id}`);
      const malformedDetail = await request(app).get(`/api/v1/products/${malformedProduct.insertedId}`);
      expect(activeDetail.status).toBe(200);
      expect(activeDetail.body.data.category.name).toBe('Hoodies');
      expect(activeDetail.body.data.images).toEqual([catalogImageUrl]);
      expect(draftDetail.status).toBe(404);
      expect(malformedDetail.status).toBe(404);
    });

    it('should filter products by fashion category slug', async () => {
      const cat2 = await Category.create({ name: 'Jeans', slug: 'jeans' });

      await Product.create({
        name: 'Oversized Hoodie',
        slug: 'oversized-hoodie',
        price: 80,
        description: 'Hoodie',
        image: '/img.jpg',
        category: category._id,
        user: adminId,
      });

      await Product.create({
        name: 'Denim Pants',
        slug: 'denim-pants',
        price: 100,
        description: 'Jeans',
        image: '/img2.jpg',
        category: cat2._id,
        user: adminId,
      });

      const res = await request(app).get('/api/v1/products?category=hoodies');

      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].name).toBe('Oversized Hoodie');
    });

    it('should filter products by gender', async () => {
      await Product.create({
        name: 'Women Knit Dress',
        slug: 'women-knit-dress',
        gender: 'women',
        price: 75,
        description: 'Knit dress',
        image: '/dress.jpg',
        category: category._id,
        user: adminId,
      });

      await Product.create({
        name: 'Men Graphic Tee',
        slug: 'men-graphic-tee',
        gender: 'men',
        price: 35,
        description: 'Graphic tee',
        image: '/tee.jpg',
        category: category._id,
        user: adminId,
      });

      const res = await request(app).get('/api/v1/products?gender=women');

      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].name).toBe('Women Knit Dress');
    });

    it('should filter products by variant size and color', async () => {
      const prod = await Product.create({
        name: 'Classic Sweatshirt',
        slug: 'classic-sweatshirt',
        price: 60,
        description: 'Sweatshirt',
        image: '/sweatshirt.jpg',
        category: category._id,
        user: adminId,
      });

      await ProductVariant.create({
        product: prod._id,
        sku: 'SWEAT-CRM-L',
        size: 'L',
        color: { name: 'Cream', hex: '#F5F5DC' },
        stock: 5,
      });

      const res = await request(app).get('/api/v1/products?size=L&color=Cream');

      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].name).toBe('Classic Sweatshirt');
    });
  });

  describe('POST /api/v1/products', () => {
    it('should create product and variants when requested by admin', async () => {
      const jacketsCategory = await Category.create({ name: 'Jackets', slug: 'jackets' });
      const payload = {
        name: 'Vintage Denim Jacket',
        price: 120.0,
        description: 'Washed vintage denim jacket.',
        image: '/uploads/jacket.jpg',
        imagePublicIds: ['novashop/products/jacket-test'],
        category: jacketsCategory._id.toString(),
        gender: 'unisex',
        variants: [
          { size: 'M', color: { name: 'Blue', hex: '#0000FF' }, stock: 8 },
          { size: 'L', color: { name: 'Blue', hex: '#0000FF' }, stock: 12 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.countInStock).toBe(20);
      expect(res.body.data.variants.length).toBe(2);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.brand).toBe('NovaShop');
      expect(res.body.data.category.name).toBe('Jackets');
      expect(res.body.data.image).toBe(payload.image);
      expect(res.body.data.images).toEqual([payload.image]);
      expect(res.body.data.imagePublicIds).toEqual(payload.imagePublicIds);

      const listing = await request(app).get('/api/v1/products');
      expect(listing.body.totalProducts).toBe(1);
      expect(listing.body.data[0].slug).toBe('vintage-denim-jacket');
    });

    it('should reject an incomplete product before writing it', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Product',
          price: 20,
          description: 'Missing required image',
          category: 'Hoodies',
        });

      expect(res.status).toBe(400);
      expect(await Product.countDocuments({})).toBe(0);
    });

    it('should reject product image values that are not URLs or app-rooted paths', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Product With Invalid Image',
          price: 20,
          description: 'Image value is plain text',
          image: 'http://',
          category: 'Hoodies',
        });

      expect(res.status).toBe(400);
      expect(await Product.countDocuments({})).toBe(0);
    });

    it('should return 403 Forbidden for non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Forbidden Tee',
          price: 20,
          description: 'Test',
          image: '/img.jpg',
          category: 'T-Shirts',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    it('should delete product and its variants', async () => {
      const prod = await Product.create({
        name: 'Shorts',
        slug: 'shorts',
        price: 40,
        description: 'Summer shorts',
        image: '/shorts.jpg',
        category: category._id,
        user: adminId,
      });

      await ProductVariant.create({
        product: prod._id,
        sku: 'SHORT-BLK-S',
        size: 'S',
        color: { name: 'Black' },
        stock: 5,
      });

      const res = await request(app)
        .delete(`/api/v1/products/${prod._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Product removed successfully');

      const foundVariants = await ProductVariant.find({ product: prod._id });
      expect(foundVariants).toEqual([]);
    });
  });
});