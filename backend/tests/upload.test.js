import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PassThrough } from 'node:stream';

// Mock Cloudinary SDK to prevent real network requests during integration test runs
await jest.unstable_mockModule("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn((options, callback) => {
        const stream = new PassThrough();
        stream.on('finish', () => {
          setImmediate(() => callback(null, {
            secure_url:
              "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.png",
            public_id: "novashop/products/sample",
            bytes: 68,
          }));
        });
        return stream;
      }),
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
}));

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/userModel.js');
const { default: Product } = await import('../src/models/productModel.js');
const { default: Category } = await import('../src/models/categoryModel.js');
const { v2: mockCloudinary } = await import('cloudinary');
const { default: upload } = await import('../src/middlewares/uploadMiddleware.js');

const mockUploadStream = (options, callback) => {
  const stream = new PassThrough();
  stream.on('finish', () => {
    setImmediate(() => callback(null, {
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.png',
      public_id: 'novashop/products/sample',
      bytes: 68,
    }));
  });
  return stream;
};

const generateAccessToken = (id, role = "admin") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || "testsecret", {
    expiresIn: "15m",
  });
};

// 1x1 transparent PNG buffer for testing image uploads
const dummyImageBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("Upload Routes Integration Tests (POST /api/v1/upload)", () => {
  let adminUser;
  let regularUser;
  let adminToken;
  let regularUserToken;

  beforeEach(async () => {
    mockCloudinary.uploader.upload_stream.mockImplementation(mockUploadStream);
    mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    await User.deleteMany({});

    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: "Password123!",
      role: "admin",
    });

    regularUser = await User.create({
      name: "Standard User",
      email: "user@example.com",
      password: "Password123!",
      role: "customer",
    });

    adminToken = generateAccessToken(adminUser._id, "admin");
    regularUserToken = generateAccessToken(regularUser._id, "customer");
  });

  /* ==========================================================================
     1. Success Scenarios
     ========================================================================== */
  it("should allow an admin to upload an image and return Cloudinary path", async () => {
    const res = await request(app)
      .post("/api/v1/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", dummyImageBuffer, "test-image.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Image uploaded successfully to Cloudinary");
    expect(res.body.image).toBeDefined();
    expect(res.body.image).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(res.body.publicId).toMatch(/^novashop\/products\//);
    expect(res.body.bytes).toBeGreaterThan(0);
    expect(res.body.bytes).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  /* ==========================================================================
     2. Validation Scenarios
     ========================================================================== */
  it("should return 400 if no image file is attached in the request", async () => {
    const res = await request(app)
      .post("/api/v1/upload")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("No image file provided");
  });

  it('should reject unsupported media types before contacting Cloudinary', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only JPG, PNG, and WebP images are allowed');
  });

  it('should report missing Cloudinary configuration without attempting an upload', async () => {
    delete process.env.CLOUDINARY_API_SECRET;

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', dummyImageBuffer, 'test-image.png');

    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Image uploads are not configured');
  });

  it('should configure a five megabyte per-image size limit', () => {
    expect(upload.limits.fileSize).toBe(5 * 1024 * 1024);
  });

  /* ==========================================================================
     3. Authorization & Authentication Scenarios
     ========================================================================== */
  it("should return 403 (Forbidden) if a non-admin user attempts to upload", async () => {
    const res = await request(app)
      .post("/api/v1/upload")
      .set("Authorization", `Bearer ${regularUserToken}`)
      .attach("image", dummyImageBuffer, "test-image.png");

    expect(res.status).toBe(403);
  });

  it('should trust the stored role instead of an admin role claim in the access token', async () => {
    const forgedRoleToken = generateAccessToken(regularUser._id, 'admin');
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${forgedRoleToken}`)
      .attach('image', dummyImageBuffer, 'test-image.png');

    expect(res.status).toBe(403);
  });

  it("should return 401 (Unauthorized) if no authorization header is provided", async () => {
    const res = await request(app)
      .post("/api/v1/upload")
      .attach("image", dummyImageBuffer, "test-image.png");

    expect(res.status).toBe(401);
  });

  it('should reject invalid Cloudinary public IDs for deletion', async () => {
    const res = await request(app)
      .delete('/api/v1/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicId: 'other-folder/image' });

    expect(res.status).toBe(400);

    const traversalRes = await request(app)
      .delete('/api/v1/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicId: 'novashop/products/../../other-folder/image' });

    expect(traversalRes.status).toBe(400);
  });

  it('should delete an unreferenced product image', async () => {
    const publicId = 'novashop/products/orphaned-test-image';
    const res = await request(app)
      .delete('/api/v1/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Product image deleted successfully');
  });

  it('should not delete a product image that is still referenced', async () => {
    const category = await Category.create({ name: 'Test Apparel', slug: 'test-apparel' });
    const publicId = 'novashop/products/referenced-test-image';
    await Product.create({
      name: 'Test Apparel Item',
      slug: 'test-apparel-item',
      price: 20,
      description: 'Test product for image reference protection',
      image: 'https://res.cloudinary.com/test-cloud/image/upload/test.jpg',
      images: ['https://res.cloudinary.com/test-cloud/image/upload/test.jpg'],
      imagePublicIds: [publicId],
      category: category._id,
      user: adminUser._id,
    });

    const res = await request(app)
      .delete('/api/v1/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicId });

    expect(res.status).toBe(409);
    expect(mockCloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});