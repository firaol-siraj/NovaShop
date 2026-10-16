import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import Order from "../src/models/orderModel.js";
import User from "../src/models/userModel.js";
import Product from "../src/models/productModel.js";
import Category from "../src/models/categoryModel.js";
import { emailQueue } from "../src/queues/emailQueue.js";

const generateAccessToken = (id, role = "user") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || "testsecret", {
    expiresIn: "15m",
  });
};

describe("Order Controller Integration Tests", () => {
  let regularUser;
  let adminUser;
  let regularUserToken;
  let adminToken;
  let testProduct;
  let mockOrderPayload;

  beforeAll(() => {
    emailQueue.add = jest.fn().mockResolvedValue(true);
  });

  beforeEach(async () => {
    emailQueue.add.mockClear();
    await Order.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});

    regularUser = await User.create({
      name: "Standard Customer",
      email: "user@example.com",
      password: "Password123!",
      role: "customer",
    });

    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: "Password123!",
      role: "admin",
    });

    regularUserToken = generateAccessToken(regularUser._id, "user");
    adminToken = generateAccessToken(adminUser._id, "admin");

    const category = await Category.create({ name: 'Accessories', slug: 'accessories' });
    testProduct = await Product.create({
      user: adminUser._id,
      name: "Wireless Mouse",
      slug: "wireless-mouse",
      price: 25.0,
      countInStock: 50,
      description: "High precision wireless mouse",
      image: "https://example.com/images/wireless-mouse.jpg",
      category: category._id,
    });

    mockOrderPayload = {
      orderItems: [
        {
          name: "Wireless Mouse",
          qty: 2,
          price: 25.0,
          image: "https://example.com/images/wireless-mouse.jpg",
          product: testProduct._id.toString(),
        },
      ],
      shippingAddress: {
        address: "127 Tech Lane",
        city: "Adama",
        postalCode: "1000",
        country: "Ethiopia",
      },
      paymentMethod: "PayPal",
      itemsPrice: 50.0,
      taxPrice: 7.5,
      shippingPrice: 5.0,
      totalPrice: 62.5,
    };
  });

  describe("POST /api/v1/orders", () => {
    it("should create a new order and queue a confirmation email", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(mockOrderPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.totalPrice).toBe(mockOrderPayload.totalPrice);
      expect(res.body.data.user.toString()).toBe(regularUser._id.toString());

      expect(emailQueue.add).toHaveBeenCalledWith(
        "sendOrderConfirmationEmail",
        expect.objectContaining({
          email: regularUser.email,
          subject: expect.stringContaining(res.body.data._id),
        }),
      );

      const createdOrder = await Order.findById(res.body.data._id);
      expect(createdOrder).not.toBeNull();
    });

    it("should return 400 if orderItems is empty or missing", async () => {
      const invalidPayload = { ...mockOrderPayload, orderItems: [] };

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Order cart cannot be empty");
      expect(emailQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/orders/:id", () => {
    it("should allow the order owner to view their order", async () => {
      const order = await Order.create({
        ...mockOrderPayload,
        user: regularUser._id,
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(order._id.toString());
      expect(res.body.data.user.email).toBe(regularUser.email);
    });

    it("should allow an admin to view any user's order", async () => {
      const order = await Order.create({
        ...mockOrderPayload,
        user: regularUser._id,
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(order._id.toString());
    });

    it("should return 403 if a user attempts to view another user's order", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other@example.com",
        password: "Password123!",
      });
      const order = await Order.create({
        ...mockOrderPayload,
        user: otherUser._id,
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Not authorized to view this order");
    });

    it("should return 404 for a non-existent order ID", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/v1/orders/${fakeId}`)
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Order not found");
    });
  });

  describe("GET /api/v1/orders/myorders", () => {
    it("should return all orders belonging to the logged-in user", async () => {
      await Order.create({ ...mockOrderPayload, user: regularUser._id });
      await Order.create({ ...mockOrderPayload, user: regularUser._id });
      await Order.create({ ...mockOrderPayload, user: adminUser._id });

      const res = await request(app)
        .get("/api/v1/orders/myorders")
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe("PUT /api/v1/orders/:id/pay", () => {
    it("should mark order as paid and dispatch payment receipt email", async () => {
      const order = await Order.create({
        ...mockOrderPayload,
        user: regularUser._id,
      });

      const paymentResultPayload = {
        id: "PAYPAL_TRANSACTION_123",
        status: "COMPLETED",
        update_time: new Date().toISOString(),
        payer: { email_address: regularUser.email },
      };

      const res = await request(app)
        .put(`/api/v1/orders/${order._id}/pay`)
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(paymentResultPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaid).toBe(true);
      expect(res.body.data.paidAt).toBeDefined();
      expect(res.body.data.paymentResult.id).toBe("PAYPAL_TRANSACTION_123");

      expect(emailQueue.add).toHaveBeenCalledWith(
        "sendPaymentReceiptEmail",
        expect.objectContaining({
          email: regularUser.email,
          subject: expect.stringContaining(order._id.toString()),
        }),
      );
    });
  });

  describe("GET /api/v1/orders", () => {
    it("should allow admin to retrieve all orders across all users", async () => {
      await Order.create({ ...mockOrderPayload, user: regularUser._id });
      await Order.create({ ...mockOrderPayload, user: adminUser._id });

      const res = await request(app)
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe("PUT /api/v1/orders/:id/deliver", () => {
    it("should update order status to delivered and queue status notification email", async () => {
      const order = await Order.create({
        ...mockOrderPayload,
        user: regularUser._id,
      });

      const res = await request(app)
        .put(`/api/v1/orders/${order._id}/deliver`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDelivered).toBe(true);
      expect(res.body.data.deliveredAt).toBeDefined();

      expect(emailQueue.add).toHaveBeenCalledWith(
        "sendOrderStatusEmail",
        expect.objectContaining({
          email: regularUser.email,
          subject: expect.stringContaining("Has Been Delivered! 📦"),
        }),
      );
    });
  });
});