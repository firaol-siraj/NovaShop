import express from 'express';
import { registerUser, loginUser, loginAdmin, getMe, refreshAccessToken, logout, forgotPassword, resetPassword, verifyEmail } from '../controllers/authController.js';
import validate from '../middlewares/validateMiddleware.js';
import { registerSchema, loginSchema, forgotPasswordSchema,resetPasswordSchema } from '../validators/authValidator.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Firaol Siraj
 *               email:
 *                 type: string
 *                 example: firaol@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *               role:
 *                 type: string
 *                 enum: [customer, admin]
 *                 example: customer
 *     responses:
 *       201:
 *         description: User registered successfully & verification email queued. Returns JWT access token and sets HTTP-only refresh cookie.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=eyJhbGciOi...; Path=/; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 66ce78a19b2e3f412c12a8bc
 *                     name:
 *                       type: string
 *                       example: Firaol Siraj
 *                     email:
 *                       type: string
 *                       example: firaol@example.com
 *                     role:
 *                       type: string
 *                       example: customer
 *       400:
 *         description: Missing required fields or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User already exists with this email
 */
router.post('/register', validate(registerSchema, "body"), registerUser);
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate user & generate tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: firaol@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Authentication successful. Returns JWT access token and sets HTTP-only refresh cookie.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=eyJhbGciOi...; Path=/; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 66ce78a19b2e3f412c12a8bc
 *                     name:
 *                       type: string
 *                       example: Firaol Siraj
 *                     email:
 *                       type: string
 *                       example: firaol@example.com
 *                     role:
 *                       type: string
 *                       example: customer
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid email or password credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid email or password
 */
router.post('/login', validate(loginSchema, "body"), loginUser);
router.post('/admin/login', validate(loginSchema, "body"), loginAdmin);
/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get currently logged-in user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 66ce78a19b2e3f412c12a8bc
 *                     name:
 *                       type: string
 *                       example: Firaol Siraj
 *                     email:
 *                       type: string
 *                       example: firaol@example.com
 *                     role:
 *                       type: string
 *                       example: customer
 *                     isVerified:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Unauthorized (Missing or invalid Bearer token)
 */
router.get('/me', protect, getMe);
/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     summary: Issue a new access token using HTTP-only refresh cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *       401:
 *         description: Refresh token missing, expired, or revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Refresh token missing. Please log in again.
 */
router.post('/refresh-token', refreshAccessToken);
/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout user, clear DB refresh token, and erase cookie
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
router.post('/logout', logout);

// Password recovery and verification routes
/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset token via email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: firaol@example.com
 *     responses:
 *       200:
 *         description: Password reset email enqueued via BullMQ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password reset link sent to your email address
 *       404:
 *         description: No user registered with provided email address
 */
router.post('/forgot-password', validate(forgotPasswordSchema, "body"), forgotPassword);
/**
 * @openapi
 * /auth/reset-password/{token}:
 *   put:
 *     summary: Reset password using hashed URL token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The plain reset token received via email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 example: NewSecurePassword123!
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password reset successfully. You can now log in with your new password.
 *       400:
 *         description: Token is invalid or has expired
 */
router.put('/reset-password/:token', validate(resetPasswordSchema, "body"), resetPassword);
/**
 * @openapi
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verify account email address via token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The plain email verification token from URL
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email verified successfully! You now have full account access.
 *       400:
 *         description: Verification token is invalid or has expired
 */
router.get('/verify-email/:token', verifyEmail);

export default router;