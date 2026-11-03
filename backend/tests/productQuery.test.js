import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import Order from '../src/models/orderModel.js';
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

jest.mock('../src/utils/clearCache.js', () => ({
  clearCachePattern: jest.fn().mockResolvedValue(true),
}));

describe('Product Query, Sorting, Pagination, and Filters Integration Tests', () => {
  let adminId;
  let parentCat;
  let childCat;

  beforeAll(async () => {
    await Product.ensureIndexes();
  });

  beforeEach(async () => {
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@novashop.com',
      password: 'Password123!',
      role: 'admin',
    });
    adminId = admin._id;

    parentCat = await Category.create({
      name: 'Apparel',
      slug: 'apparel',
    });

    childCat = await Category.create({
      name: 'Hoodies & Sweatshirts',
      slug: 'hoodies-sweatshirts',
      parent: parentCat._id,
    });

    parentCat.children = [childCat._id];
    await parentCat.save();
  });

  describe('Deterministic Sorting & Tie-Breaker', () => {
    it('sorts by low-high and high-low with _id tie-breaker', async () => {
      await Product.create([
        {
          name: 'Item A',
          slug: 'item-a',
          price: 50,
          description: 'Desc A',
          image: '/uploads/a.jpg',
          category: childCat._id,
          user: adminId,
          countInStock: 5,
        },
        {
          name: 'Item B',
          slug: 'item-b',
          price: 150,
          description: 'Desc B',
          image: '/uploads/b.jpg',
          category: childCat._id,
          user: adminId,
          countInStock: 5,
        },
        {
          name: 'Item C',
          slug: 'item-c',
          price: 50, // identical price as Item A to test tie-breaker
          description: 'Desc C',
          image: '/uploads/c.jpg',
          category: childCat._id,
          user: adminId,
          countInStock: 5,
        },
      ]);

      const lowHighRes = await request(app).get('/api/v1/products?sort=low-high');
      expect(lowHighRes.status).toBe(200);
      expect(lowHighRes.body.data).toHaveLength(3);
      expect(lowHighRes.body.data[0].price).toBe(50);
      expect(lowHighRes.body.data[1].price).toBe(50);
      expect(lowHighRes.body.data[2].price).toBe(150);

      const highLowRes = await request(app).get('/api/v1/products?sort=high-low');
      expect(highLowRes.status).toBe(200);
      expect(highLowRes.body.data[0].price).toBe(150);
      expect(highLowRes.body.data[1].price).toBe(50);
      expect(highLowRes.body.data[2].price).toBe(50);
    });

    it('sorts by bestselling using Order quantities', async () => {
      const p1 = await Product.create({
        name: 'Top Seller',
        slug: 'top-seller',
        price: 80,
        description: 'Best',
        image: '/uploads/top.jpg',
        category: childCat._id,
        user: adminId,
        countInStock: 20,
      });

      const p2 = await Product.create({
        name: 'Low Seller',
        slug: 'low-seller',
        price: 70,
        description: 'Low',
        image: '/uploads/low.jpg',
        category: childCat._id,
        user: adminId,
        countInStock: 20,
      });

      // Create orders for p1 (qty 10) and p2 (qty 2)
      await Order.create({
        user: adminId,
        orderItems: [
          { name: p1.name, qty: 10, image: p1.image, price: p1.price, product: p1._id },
          { name: p2.name, qty: 2, image: p2.image, price: p2.price, product: p2._id },
        ],
        shippingAddress: { address: '123 St', city: 'City', postalCode: '1000', country: 'US' },
        totalPrice: 940,
        isPaid: true,
      });

      const res = await request(app).get('/api/v1/products?sort=bestselling');
      expect(res.status).toBe(200);
      expect(res.body.data[0].slug).toBe('top-seller');
      expect(res.body.data[1].slug).toBe('low-seller');
    });
  });

  describe('Pagination Boundaries & Metadata', () => {
    beforeEach(async () => {
      const items = [];
      for (let i = 1; i <= 5; i++) {
        items.push({
          name: `Product ${i}`,
          slug: `product-${i}`,
          price: 10 * i,
          description: `Description ${i}`,
          image: `/uploads/${i}.jpg`,
          category: childCat._id,
          user: adminId,
          countInStock: 5,
        });
      }
      await Product.create(items);
    });

    it('returns pageSize, pages, and hasNext accurately', async () => {
      const page1 = await request(app).get('/api/v1/products?pageNumber=1&pageSize=2');
      expect(page1.status).toBe(200);
      expect(page1.body.pageSize).toBe(2);
      expect(page1.body.page).toBe(1);
      expect(page1.body.pages).toBe(3);
      expect(page1.body.totalProducts).toBe(5);
      expect(page1.body.hasNext).toBe(true);
      expect(page1.body.data).toHaveLength(2);

      const page3 = await request(app).get('/api/v1/products?pageNumber=3&pageSize=2');
      expect(page3.status).toBe(200);
      expect(page3.body.page).toBe(3);
      expect(page3.body.hasNext).toBe(false);
      expect(page3.body.data).toHaveLength(1);

      // Page beyond last returns empty data without crashing
      const pageBeyond = await request(app).get('/api/v1/products?pageNumber=4&pageSize=2');
      expect(pageBeyond.status).toBe(200);
      expect(pageBeyond.body.data).toHaveLength(0);
      expect(pageBeyond.body.totalProducts).toBe(5);
      expect(pageBeyond.body.hasNext).toBe(false);
    });

    it('ensures no duplicate products between pages', async () => {
      const page1 = await request(app).get('/api/v1/products?pageNumber=1&pageSize=2');
      const page2 = await request(app).get('/api/v1/products?pageNumber=2&pageSize=2');

      const ids1 = page1.body.data.map((p) => p._id);
      const ids2 = page2.body.data.map((p) => p._id);
      const overlap = ids1.filter((id) => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Filtering: Price, Size, Color, InStock, Category, Keyword', () => {
    it('filters by parent category including child category products', async () => {
      await Product.create({
        name: 'Sweatshirt',
        slug: 'sweatshirt',
        price: 60,
        description: 'Cotton',
        image: '/uploads/s.jpg',
        category: childCat._id,
        user: adminId,
        countInStock: 2,
      });

      const res = await request(app).get(`/api/v1/products?category=${parentCat.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].slug).toBe('sweatshirt');
    });

    it('filters by minPrice and maxPrice', async () => {
      await Product.create([
        {
          name: 'Cheap',
          slug: 'cheap',
          price: 25,
          description: 'Cheap item',
          image: '/uploads/c.jpg',
          category: childCat._id,
          user: adminId,
        },
        {
          name: 'Mid',
          slug: 'mid',
          price: 150,
          description: 'Mid item',
          image: '/uploads/m.jpg',
          category: childCat._id,
          user: adminId,
        },
        {
          name: 'Expensive',
          slug: 'expensive',
          price: 450,
          description: 'Expensive item',
          image: '/uploads/e.jpg',
          category: childCat._id,
          user: adminId,
        },
      ]);

      const res = await request(app).get('/api/v1/products?minPrice=100&maxPrice=200');
      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].slug).toBe('mid');
    });

    it('filters by size and color variant attributes', async () => {
      const prod = await Product.create({
        name: 'Color Size Product',
        slug: 'color-size-prod',
        price: 100,
        description: 'Variants test',
        image: '/uploads/cs.jpg',
        category: childCat._id,
        user: adminId,
      });

      await ProductVariant.create([
        {
          product: prod._id,
          sku: 'CSP-CAM-M',
          size: 'M',
          color: { name: 'Camel', hex: '#C19A6B' },
          stock: 10,
        },
        {
          product: prod._id,
          sku: 'CSP-BLK-XL',
          size: 'XL',
          color: { name: 'Black', hex: '#000000' },
          stock: 5,
        },
      ]);

      const matchRes = await request(app).get('/api/v1/products?size=M&color=Camel');
      expect(matchRes.status).toBe(200);
      expect(matchRes.body.totalProducts).toBe(1);

      const mismatchRes = await request(app).get('/api/v1/products?size=S&color=Camel');
      expect(mismatchRes.status).toBe(200);
      expect(mismatchRes.body.totalProducts).toBe(0);
    });

    it('filters by inStock correctly', async () => {
      await Product.create([
        {
          name: 'In Stock Product',
          slug: 'in-stock-prod',
          price: 40,
          description: 'Available',
          image: '/uploads/instock.jpg',
          category: childCat._id,
          user: adminId,
          countInStock: 10,
        },
        {
          name: 'Out of Stock Product',
          slug: 'out-of-stock-prod',
          price: 40,
          description: 'Sold out',
          image: '/uploads/outstock.jpg',
          category: childCat._id,
          user: adminId,
          countInStock: 0,
        },
      ]);

      const res = await request(app).get('/api/v1/products?inStock=true');
      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].slug).toBe('in-stock-prod');
    });

    it('handles keywords with regex special characters like C++ without crashing', async () => {
      await Product.create({
        name: 'C++ Developer Hoodie (Special Edition)',
        slug: 'cpp-hoodie',
        price: 90,
        description: 'For software engineers',
        image: '/uploads/cpp.jpg',
        category: childCat._id,
        user: adminId,
      });

      const res = await request(app).get('/api/v1/products?keyword=C++');
      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].slug).toBe('cpp-hoodie');
    });

    it('tolerates empty-string parameters and category="all" without 400 errors', async () => {
      await Product.create({
        name: 'Empty Param Test Product',
        slug: 'empty-param-product',
        price: 75,
        description: 'Testing empty query string params',
        image: '/uploads/empty.jpg',
        category: childCat._id,
        user: adminId,
        countInStock: 5,
      });

      const res = await request(app).get(
        '/api/v1/products?minPrice=&maxPrice=&category=all&sort=&pageNumber=&pageSize=&inStock='
      );
      expect(res.status).toBe(200);
      expect(res.body.totalProducts).toBe(1);
      expect(res.body.data[0].slug).toBe('empty-param-product');
    });

    it('returns all products for all 5 valid sort values without dropping items', async () => {
      await Product.create([
        {
          name: 'Sort Item 1',
          slug: 'sort-item-1',
          price: 30,
          description: 'Sort test 1',
          image: '/uploads/s1.jpg',
          category: childCat._id,
          user: adminId,
        },
        {
          name: 'Sort Item 2',
          slug: 'sort-item-2',
          price: 60,
          description: 'Sort test 2',
          image: '/uploads/s2.jpg',
          category: childCat._id,
          user: adminId,
        },
      ]);

      const sortValues = ['recommended', 'newest', 'low-high', 'high-low', 'bestselling'];
      for (const sortVal of sortValues) {
        const res = await request(app).get(`/api/v1/products?sort=${sortVal}`);
        expect(res.status).toBe(200);
        expect(res.body.totalProducts).toBe(2);
      }
    });
  });

  describe('GET /api/v1/products/filters', () => {
    it('returns facets for categories, priceRange, sizes, and colors', async () => {
      const p = await Product.create({
        name: 'Faceted Hoodie',
        slug: 'faceted-hoodie',
        price: 120,
        description: 'Testing facet counts',
        image: '/uploads/facet.jpg',
        category: childCat._id,
        user: adminId,
        countInStock: 5,
      });

      await ProductVariant.create([
        {
          product: p._id,
          sku: 'FAC-ESP-L',
          size: 'L',
          color: { name: 'Espresso', hex: '#362B28' },
          stock: 4,
        },
        {
          product: p._id,
          sku: 'FAC-CAM-S',
          size: 'S',
          color: { name: 'Camel', hex: '#C19A6B' },
          stock: 3,
        },
      ]);

      const res = await request(app).get('/api/v1/products/filters');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { data } = res.body;
      expect(data).toHaveProperty('priceRange');
      expect(data.priceRange.min).toBe(120);
      expect(data.priceRange.max).toBe(120);

      expect(data).toHaveProperty('sizes');
      expect(data.sizes.map((s) => s.value)).toContain('L');
      expect(data.sizes.map((s) => s.value)).toContain('S');

      expect(data).toHaveProperty('colors');
      const colorNames = data.colors.map((c) => c.name);
      expect(colorNames).toContain('Espresso');
      expect(colorNames).toContain('Camel');

      expect(data).toHaveProperty('categories');
      const parentFacet = data.categories.find((c) => c.slug === 'apparel');
      expect(parentFacet.count).toBe(1); // includes child category's product
    });
  });
});
