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

  /* ==========================================================================
     9. Advanced Role Isolation, Refresh, Logout & Production Cookie Tests
     ========================================================================== */
  describe("Role-Separated Session, Refresh, and Production Cookie Integration Tests", () => {
    describe("POST /api/v1/auth/admin/refresh-token", () => {
      it("should generate a new admin access token when given a valid admin refresh cookie", async () => {
        const admin = await User.create({
          name: "Admin Refresh User",
          email: "admin-refresh@example.com",
          password: "Password123!",
          role: "admin",
        });
        const refreshToken = jwt.sign(
          { id: admin._id, role: "admin" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        admin.adminRefreshToken = refreshToken;
        await admin.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", [`nova_admin_session=${refreshToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();

        const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET || "testsecret");
        expect(decoded.role).toBe("admin");
      });

      it("should return 401 if admin refresh cookie is missing", async () => {
        const res = await request(app).post("/api/v1/auth/admin/refresh-token");

        expect(res.status).toBe(401);
        expect(res.body.message).toContain("Admin refresh token missing");
      });

      it("should reject a customer attempting to use admin refresh endpoint", async () => {
        const customer = await User.create({
          name: "Customer Impersonator",
          email: "cust-impersonator@example.com",
          password: "Password123!",
          role: "customer",
        });
        const refreshToken = jwt.sign(
          { id: customer._id, role: "customer" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        customer.refreshToken = refreshToken;
        await customer.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", [`nova_admin_session=${refreshToken}`]);

        expect(res.status).toBe(401);
      });

      it("should return 401 if admin refresh token is corrupted or invalid", async () => {
        const res = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", ["nova_admin_session=invalidtoken123"]);

        expect(res.status).toBe(401);
      });

      it("should reject admin refresh if admin account is deactivated", async () => {
        const admin = await User.create({
          name: "Deactivated Admin",
          email: "deactivated-admin@example.com",
          password: "Password123!",
          role: "admin",
          status: "deactivated",
          isActive: false,
        });
        const refreshToken = jwt.sign(
          { id: admin._id, role: "admin" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        admin.adminRefreshToken = refreshToken;
        await admin.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", [`nova_admin_session=${refreshToken}`]);

        expect(res.status).toBe(401);
      });
    });

    describe("POST /api/v1/auth/refresh-token (Customer)", () => {
      it("should return 401 for an expired customer refresh token", async () => {
        const customer = await User.create({
          name: "Expired Customer",
          email: "expired-cust@example.com",
          password: "Password123!",
        });
        const expiredToken = jwt.sign(
          { id: customer._id, role: "customer" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: -10 }
        );

        const res = await request(app)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", [`nova_customer_session=${expiredToken}`]);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Expired or corrupted refresh token.");
      });

      it("should return 401 for a revoked refresh token not matching DB", async () => {
        const customer = await User.create({
          name: "Revoked Customer",
          email: "revoked-cust@example.com",
          password: "Password123!",
        });
        const validToken = jwt.sign(
          { id: customer._id, role: "customer" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        customer.refreshToken = "different_token_in_db";
        await customer.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", [`nova_customer_session=${validToken}`]);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Invalid or revoked refresh token.");
      });

      it("should reject customer refresh if account is deactivated", async () => {
        const customer = await User.create({
          name: "Deactivated Customer",
          email: "deactivated-cust@example.com",
          password: "Password123!",
          status: "deactivated",
          isActive: false,
        });
        const refreshToken = jwt.sign(
          { id: customer._id, role: "customer" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        customer.refreshToken = refreshToken;
        await customer.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", [`nova_customer_session=${refreshToken}`]);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Account is deactivated.");
      });

      it("should reject customer refresh if token role is admin", async () => {
        const admin = await User.create({
          name: "Admin User X",
          email: "admin-x@example.com",
          password: "Password123!",
          role: "admin",
        });
        const adminRefreshToken = jwt.sign(
          { id: admin._id, role: "admin" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        admin.adminRefreshToken = adminRefreshToken;
        await admin.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", [`nova_customer_session=${adminRefreshToken}`]);

        expect(res.status).toBe(401);
      });
    });

    describe("POST /api/v1/auth/admin/logout", () => {
      it("should clear stored adminRefreshToken in DB and clear admin session cookie", async () => {
        const admin = await User.create({
          name: "Admin Logout User",
          email: "admin-logout@example.com",
          password: "Password123!",
          role: "admin",
        });
        const adminToken = jwt.sign(
          { id: admin._id, role: "admin" },
          process.env.JWT_REFRESH_SECRET || "testrefreshsecret",
          { expiresIn: "7d" }
        );
        admin.adminRefreshToken = adminToken;
        await admin.save({ validateBeforeSave: false });

        const res = await request(app)
          .post("/api/v1/auth/admin/logout")
          .set("Cookie", [`nova_admin_session=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Admin logged out successfully");

        const updatedAdmin = await User.findById(admin._id);
        expect(updatedAdmin.adminRefreshToken).toBeNull();

        // Ensure refresh after admin logout is rejected
        const refreshRes = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", [`nova_admin_session=${adminToken}`]);
        expect(refreshRes.status).toBe(401);
      });
    });

    describe("Simultaneous Customer & Admin Sessions on Single Account", () => {
      it("should preserve admin refresh session when the admin logs in as customer", async () => {
        const user = await User.create({
          name: "Dual Role User",
          email: "dual@example.com",
          password: "Password123!",
          role: "admin",
        });

        // 1. Log in as admin
        const adminLoginRes = await request(app).post("/api/v1/auth/admin/login").send({
          email: "dual@example.com",
          password: "Password123!",
        });
        expect(adminLoginRes.status).toBe(200);
        const adminCookies = adminLoginRes.headers["set-cookie"];
        const adminCookie = adminCookies.find((c) => c.startsWith("nova_admin_session="));
        expect(adminCookie).toBeDefined();

        // 2. Log in as customer
        const customerLoginRes = await request(app).post("/api/v1/auth/login").send({
          email: "dual@example.com",
          password: "Password123!",
        });
        expect(customerLoginRes.status).toBe(200);
        const customerCookies = customerLoginRes.headers["set-cookie"];
        const customerCookie = customerCookies.find((c) => c.startsWith("nova_customer_session="));
        expect(customerCookie).toBeDefined();

        // 3. Verify admin refresh still succeeds using the admin cookie
        const adminRefreshRes = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", [adminCookie.split(";")[0]]);
        expect(adminRefreshRes.status).toBe(200);
        expect(adminRefreshRes.body.accessToken).toBeDefined();

        // 4. Verify customer refresh still succeeds using customer cookie
        const customerRefreshRes = await request(app)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", [customerCookie.split(";")[0]]);
        expect(customerRefreshRes.status).toBe(200);
        expect(customerRefreshRes.body.accessToken).toBeDefined();
      });

      it("should ensure admin login never sets or overwrites customer refreshToken in database", async () => {
        const admin = await User.create({
          name: "Fresh Admin User",
          email: "fresh-admin@example.com",
          password: "Password123!",
          role: "admin",
        });

        const res = await request(app).post("/api/v1/auth/admin/login").send({
          email: "fresh-admin@example.com",
          password: "Password123!",
        });
        expect(res.status).toBe(200);

        const freshDbAdmin = await User.findById(admin._id);
        expect(freshDbAdmin.adminRefreshToken).toBeTruthy();
        expect(freshDbAdmin.refreshToken).toBeNull();
      });

      it("should not invalidate active admin access token or refresh session when customer logs out", async () => {
        await User.create({
          name: "Dual Session User 1",
          email: "dual-session1@example.com",
          password: "Password123!",
          role: "admin",
        });

        // Log in as admin
        const adminLogin = await request(app).post("/api/v1/auth/admin/login").send({
          email: "dual-session1@example.com",
          password: "Password123!",
        });
        const adminAccessToken = adminLogin.body.accessToken;
        const adminCookie = adminLogin.headers["set-cookie"].find((c) => c.startsWith("nova_admin_session="));

        // Log in as customer
        const customerLogin = await request(app).post("/api/v1/auth/login").send({
          email: "dual-session1@example.com",
          password: "Password123!",
        });
        const customerCookie = customerLogin.headers["set-cookie"].find((c) => c.startsWith("nova_customer_session="));

        // Customer logs out
        const logoutRes = await request(app)
          .post("/api/v1/auth/logout")
          .set("Cookie", [customerCookie.split(";")[0]]);
        expect(logoutRes.status).toBe(200);

        // Admin access token MUST STILL BE VALID on admin routes
        const adminAccessRes = await request(app)
          .get("/api/v1/users")
          .set("Authorization", `Bearer ${adminAccessToken}`);
        expect(adminAccessRes.status).toBe(200);

        // Admin refresh session MUST STILL BE VALID
        const adminRefreshRes = await request(app)
          .post("/api/v1/auth/admin/refresh-token")
          .set("Cookie", [adminCookie.split(";")[0]]);
        expect(adminRefreshRes.status).toBe(200);
      });

      it("should not invalidate active customer access token or refresh session when admin logs out", async () => {
        await User.create({
          name: "Dual Session User 2",
          email: "dual-session2@example.com",
          password: "Password123!",
          role: "admin",
        });

        // Log in as customer
        const customerLogin = await request(app).post("/api/v1/auth/login").send({
          email: "dual-session2@example.com",
          password: "Password123!",
        });
        const customerAccessToken = customerLogin.body.accessToken;
        const customerCookie = customerLogin.headers["set-cookie"].find((c) => c.startsWith("nova_customer_session="));

        // Log in as admin
        const adminLogin = await request(app).post("/api/v1/auth/admin/login").send({
          email: "dual-session2@example.com",
          password: "Password123!",
        });
        const adminCookie = adminLogin.headers["set-cookie"].find((c) => c.startsWith("nova_admin_session="));

        // Admin logs out
        const adminLogoutRes = await request(app)
          .post("/api/v1/auth/admin/logout")
          .set("Cookie", [adminCookie.split(";")[0]]);
        expect(adminLogoutRes.status).toBe(200);

        // Customer access token MUST STILL BE VALID on customer routes
        const customerAccessRes = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${customerAccessToken}`);
        expect(customerAccessRes.status).toBe(200);

        // Customer refresh session MUST STILL BE VALID
        const customerRefreshRes = await request(app)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", [customerCookie.split(";")[0]]);
        expect(customerRefreshRes.status).toBe(200);
      });
    });

    describe("Cookie Security Attributes & CORS Protection", () => {
      it("should set HttpOnly, SameSite=Strict, and Path=/ on authentication cookies", async () => {
        await User.create({
          name: "Cookie Check User",
          email: "cookie-check@example.com",
          password: "Password123!",
        });

        const res = await request(app).post("/api/v1/auth/login").send({
          email: "cookie-check@example.com",
          password: "Password123!",
        });

        expect(res.status).toBe(200);
        const setCookieHeaders = res.headers["set-cookie"];
        expect(setCookieHeaders).toBeDefined();

        const cookieString = setCookieHeaders.join("; ");
        expect(cookieString.toLowerCase()).toContain("httponly");
        expect(cookieString.toLowerCase()).toContain("samesite=strict");
        expect(cookieString.toLowerCase()).toContain("path=/");
      });

      it("should enable credentials and reflect allowed origin for CORS", async () => {
        const res = await request(app)
          .get("/api/v1/products")
          .set("Origin", "http://localhost:5173");

        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
      });

      it("should block requests with untrusted origins via CORS", async () => {
        const res = await request(app)
          .get("/api/v1/products")
          .set("Origin", "http://malicious-site.com");

        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      });
    });

    describe("Role-Based Access Control (RBAC) Enforcement", () => {
      it("should deny customer access token to admin routes (403)", async () => {
        const customer = await User.create({
          name: "Store Customer",
          email: "store-customer@example.com",
          password: "Password123!",
          role: "customer",
        });
        const customerToken = jwt.sign(
          { id: customer._id, tokenVersion: customer.tokenVersion, role: "customer" },
          process.env.JWT_SECRET || "testsecret",
          { expiresIn: "15m" }
        );

        const res = await request(app)
          .get("/api/v1/users")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain("Administrator access is required");
      });

      it("should deny admin access token to customer-only storefront routes (403)", async () => {
        const admin = await User.create({
          name: "Store Admin",
          email: "store-admin@example.com",
          password: "Password123!",
          role: "admin",
        });
        const adminToken = jwt.sign(
          { id: admin._id, tokenVersion: admin.tokenVersion, role: "admin" },
          process.env.JWT_SECRET || "testsecret",
          { expiresIn: "15m" }
        );

        const res = await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain("Admin tokens cannot be used on customer storefront endpoints");
      });

      it("should allow valid admin access token to admin routes", async () => {
        const admin = await User.create({
          name: "Verified Admin",
          email: "verified-admin@example.com",
          password: "Password123!",
          role: "admin",
        });
        const adminToken = jwt.sign(
          { id: admin._id, tokenVersion: admin.tokenVersion, role: "admin" },
          process.env.JWT_SECRET || "testsecret",
          { expiresIn: "15m" }
        );

        const res = await request(app)
          .get("/api/v1/users")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });
  });
});
