import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import User from "../src/models/userModel.js";
import { emailQueue } from "../src/queues/emailQueue.js";

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "testsecret", {
    expiresIn: "15m",
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
    {
      expiresIn: "7d",
    },
  );
};

describe("Auth Controller Integration Tests", () => {
  beforeAll(() => {
    // Explicitly override the queue method with a Jest mock function
    emailQueue.add = jest.fn().mockResolvedValue(true);
  });

  beforeEach(async () => {
    // Reset mock call history before each test
    emailQueue.add.mockClear();
  });

  /* ==========================================================================
     1. POST /api/v1/auth/register
     ========================================================================== */
  describe("POST /api/v1/auth/register", () => {
    it("should register a new user, dispatch verification email, and set refresh cookie", async () => {
      const payload = {
        name: "Alex Developer",
        email: "alex@example.com",
        password: "Password123!",
      };

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.data.email).toBe(payload.email);

      expect(emailQueue.add).toHaveBeenCalledWith(
        "sendVerificationEmail",
        expect.objectContaining({
          email: payload.email,
          subject: "Verify your NovaShop Account",
        }),
      );

      const userInDb = await User.findOne({ email: payload.email });
      expect(userInDb).not.toBeNull();
      expect(userInDb.refreshToken).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should return 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "incomplete@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("is required");
    });

    it("should return 400 if email is already registered", async () => {
      await User.create({
        name: "Existing User",
        email: "existing@example.com",
        password: "Password123!",
      });

      const res = await request(app).post("/api/v1/auth/register").send({
        name: "Duplicate Attempt",
        email: "existing@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("User already exists with this email");
    });

    it("should ignore a client-supplied administrator role", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        name: "Role Escalation Attempt",
        email: "role-attempt@example.com",
        password: "Password123!",
        role: "admin",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe("customer");
      const user = await User.findOne({ email: "role-attempt@example.com" });
      expect(user.role).toBe("customer");
    });
  });

  /* ==========================================================================
     2. POST /api/v1/auth/login
     ========================================================================== */
  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await User.create({
        name: "Registered User",
        email: "user@example.com",
        password: "Password123!",
      });
    });

    it("should authenticate valid credentials and issue tokens", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "user@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.data.email).toBe("user@example.com");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should return 400 if email or password is omitted", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "user@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("is required");
    });

    it("should return 401 for incorrect password", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "user@example.com",
        password: "WrongPassword!",
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("POST /api/v1/auth/admin/login", () => {
    it("should issue tokens for an administrator with valid credentials", async () => {
      await User.create({
        name: "Admin User",
        email: "admin-login@example.com",
        password: "Password123!",
        role: "admin",
      });

      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "admin-login@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.data.role).toBe("admin");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should reject invalid administrator credentials", async () => {
      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "missing-admin@example.com",
        password: "WrongPassword!",
      });

      expect(res.status).toBe(401);
    });

    it("should reject a customer even when the password is correct", async () => {
      await User.create({
        name: "Customer User",
        email: "customer-login@example.com",
        password: "Password123!",
        role: "customer",
      });

      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "customer-login@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(403);
    });
  });

  /* ==========================================================================
     3. GET /api/v1/auth/me
     ========================================================================== */
  describe("GET /api/v1/auth/me", () => {
    it("should return current user profile when valid bearer token is provided", async () => {
      const user = await User.create({
        name: "Profile User",
        email: "profile@example.com",
        password: "Password123!",
      });
      const token = generateAccessToken(user._id);

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(user._id.toString());
      expect(res.body.data.refreshToken).toBeUndefined();
      expect(res.body.data.tokenVersion).toBeUndefined();
    });

    it("should return 401 when no token is supplied", async () => {
      const res = await request(app).get("/api/v1/auth/me");

      expect(res.status).toBe(401);
    });

    it('should reject an expired access token', async () => {
      const user = await User.create({
        name: 'Expired Token User',
        email: 'expired-token@example.com',
        password: 'Password123!',
      });
      const expiredToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'testsecret', { expiresIn: -1 });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });

  /* ==========================================================================
     4. POST /api/v1/auth/refresh-token
     ========================================================================== */
  describe("POST /api/v1/auth/refresh-token", () => {
    it("should generate a new access token when given a valid refresh cookie", async () => {
      const user = await User.create({
        name: "Refresh User",
        email: "refresh@example.com",
        password: "Password123!",
      });
      const refreshToken = generateRefreshToken(user._id);
      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .post("/api/v1/auth/refresh-token")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    it("should return 401 if refresh cookie is missing", async () => {
      const res = await request(app).post("/api/v1/auth/refresh-token");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(
        "Refresh token missing. Please log in again.",
      );
    });

    it("should return 401 if refresh token is corrupted or invalid", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh-token")
        .set("Cookie", ["refreshToken=invalidtoken123"]);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Expired or corrupted refresh token.");
    });
  });

  /* ==========================================================================
     5. POST /api/v1/auth/logout
     ========================================================================== */
  describe("POST /api/v1/auth/logout", () => {
    it("should clear stored refreshToken in DB and wipe HTTP cookie", async () => {
      const user = await User.create({
        name: "Logout User",
        email: "logout@example.com",
        password: "Password123!",
      });

      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);
      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Logged out successfully");
      expect(res.headers['set-cookie'][0]).toContain('refreshToken=;');

      const updatedUser = await User.findById(user._id).select('+tokenVersion');
      expect(updatedUser.refreshToken).toBeNull();
      expect(updatedUser.tokenVersion).toBe(1);

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [`refreshToken=${refreshToken}`]);
      expect(refreshRes.status).toBe(401);

      const protectedRes = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(protectedRes.status).toBe(401);
    });
  });

  /* ==========================================================================
     6. POST /api/v1/auth/forgot-password
     ========================================================================== */
  describe("POST /api/v1/auth/forgot-password", () => {
    it("should create password reset token and dispatch email job", async () => {
      const user = await User.create({
        name: "Reset User",
        email: "reset@example.com",
        password: "Password123!",
      });

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: user.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        "If an account exists for this email, a password reset link has been sent.",
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        "sendPasswordResetEmail",
        expect.objectContaining({
          email: user.email,
          subject: "Reset your NovaShop password",
        }),
      );

      const queuedJob = emailQueue.add.mock.calls[0][1];
      expect(queuedJob.message).toContain("Reset Password");
      expect(queuedJob.message).toContain("10 minutes");
      expect(queuedJob.message).toContain("/reset-password?token=");

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.passwordResetToken).toBeDefined();
      expect(updatedUser.passwordResetExpires).toBeDefined();
    });

    it("should return a generic response for an unknown email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        "If an account exists for this email, a password reset link has been sent.",
      );
      expect(emailQueue.add).not.toHaveBeenCalled();
    });
  });

  /* ==========================================================================
     7. PUT /api/v1/auth/reset-password/:token
     ========================================================================== */
  describe("PUT /api/v1/auth/reset-password/:token", () => {
    it("should reset password when provided a valid token", async () => {
      const user = await User.create({
        name: "Token Reset User",
        email: "tokenreset@example.com",
        password: "OldPassword123!",
      });

      const rawResetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .put(`/api/v1/auth/reset-password/${rawResetToken}`)
        .send({ password: "NewSecurePassword123!" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        "Password reset successfully. You can now log in with your new password.",
      );

      const updatedUser = await User.findById(user._id).select("+password");
      expect(updatedUser.passwordResetToken).toBeUndefined();
      expect(updatedUser.passwordResetExpires).toBeUndefined();

      const isMatch = await updatedUser.matchPassword("NewSecurePassword123!");
      expect(isMatch).toBe(true);
      expect(await updatedUser.matchPassword("OldPassword123!")).toBe(false);

      const reusedTokenResponse = await request(app)
        .put(`/api/v1/auth/reset-password/${rawResetToken}`)
        .send({ password: "AnotherSecurePassword123!" });

      expect(reusedTokenResponse.status).toBe(400);
      expect(reusedTokenResponse.body.message).toBe("Token is invalid or has expired");
    });

    it("should return 400 for an invalid or expired reset token", async () => {
      const user = await User.create({
        name: "Expired Reset User",
        email: "expired-reset@example.com",
        password: "OldPassword123!",
      });
      const expiredToken = user.createPasswordResetToken();
      user.passwordResetExpires = new Date(Date.now() - 1000);
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .put(`/api/v1/auth/reset-password/${expiredToken}`)
        .send({ password: "NewPassword123!" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Token is invalid or has expired");

      const persistedUser = await User.findById(user._id).select("+password");
      expect(await persistedUser.matchPassword("OldPassword123!")).toBe(true);
    });
  });

  /* ==========================================================================
     8. GET /api/v1/auth/verify-email/:token
     ========================================================================== */
  describe("GET /api/v1/auth/verify-email/:token", () => {
    it("should mark user as verified when given valid verification token", async () => {
      const user = await User.create({
        name: "Verify User",
        email: "verify@example.com",
        password: "Password123!",
        isVerified: false,
      });

      const rawVerificationToken = user.createEmailVerificationToken();
      await user.save({ validateBeforeSave: false });

      const res = await request(app).get(
        `/api/v1/auth/verify-email/${rawVerificationToken}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        "Email verified successfully! You now have full account access.",
      );

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.emailVerificationToken).toBeUndefined();
    });

    it("should return 400 if verification token is invalid or expired", async () => {
      const res = await request(app).get(
        "/api/v1/auth/verify-email/expiredorinvalidtoken",
      );

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Verification token is invalid or has expired",
      );
    });
  });
});
