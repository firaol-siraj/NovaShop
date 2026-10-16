import User from "../models/userModel.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} from "../utils/generateToken.js";
import { emailQueue } from "../queues/emailQueue.js"; // 1. Import emailQueue
import crypto from "crypto";
import jwt from "jsonwebtoken";

// @desc    Register a new user
// @route   POST /api/v1/auth/register
export const registerUser = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return next(new ApiError(400, "Please provide name, email, and password"));
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return next(new ApiError(400, "User already exists with this email"));
  }

  /** @type {import('../models/userModel.js').default & mongoose.Document} */
  const user = await User.create({ name, email, password });

  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  const message = `Welcome to NovaShop! Please verify your email by clicking the link below:\n\n${verificationUrl}\n\nThis link expires in 24 hours.`;

  // 2. Dispatch job to BullMQ queue (~2ms operation)
  await emailQueue.add('sendVerificationEmail', {
    email: user.email,
    subject: 'Verify your NovaShop Account',
    message,
  });

  const accessToken = generateAccessToken(user._id, user.tokenVersion);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Send refresh token as an HTTP-only cookie
  sendRefreshTokenCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    accessToken,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const authenticateUser = async (req, res, next, adminOnly = false) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, "Please provide email and password"));
  }

  const user = await User.findOne({ email }).select("+password +tokenVersion");

  if (!user || !(await user.matchPassword(password))) {
    return next(new ApiError(401, "Invalid email or password"));
  }

  if (adminOnly && user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access is required'));
  }

  const accessToken = generateAccessToken(user._id, user.tokenVersion);
  const refreshToken = generateRefreshToken(user._id, rememberMe === true ? '30d' : '7d');

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const refreshCookieMaxAge = rememberMe === true
    ? 30 * 24 * 60 * 60 * 1000
    : rememberMe === false
      ? null
      : 7 * 24 * 60 * 60 * 1000;
  sendRefreshTokenCookie(res, refreshToken, refreshCookieMaxAge);

  res.status(200).json({
    success: true,
    accessToken,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// @desc    Authenticate user & get token
// @route   POST /api/v1/auth/login
export const loginUser = asyncHandler((req, res, next) => authenticateUser(req, res, next));

// @desc    Authenticate an administrator & get token
// @route   POST /api/v1/auth/admin/login
export const loginAdmin = asyncHandler((req, res, next) => authenticateUser(req, res, next, true));

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res, next) => {
  const user = req.user.toObject();
  delete user.tokenVersion;

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Get new access token using refresh token
// @route   POST /api/v1/auth/refresh
export const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return next(
      new ApiError(401, "Refresh token missing. Please log in again.")
    );
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id).select('+tokenVersion');
    if (!user || user.refreshToken !== refreshToken) {
      return next(new ApiError(401, "Invalid or revoked refresh token."));
    }

    const newAccessToken = generateAccessToken(user._id, user.tokenVersion);

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return next(new ApiError(401, "Expired or corrupted refresh token."));
  }
});

// @desc    Logout user & clear refresh token
// @route   POST /api/v1/auth/logout
export const logout = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    const user = await User.findOne({ refreshToken }).select('+tokenVersion');
    if (user) {
      user.refreshToken = null;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ validateBeforeSave: false });
    }
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// @desc    Request Password Reset Email
// @route   POST /api/v1/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  /** @type {import('../models/userModel.js').default & mongoose.Document} */
  const user = await User.findOne({ email });

  if (user) {
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetPath = user.role === 'admin' ? '/admin/reset-password' : '/reset-password';
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}${resetPath}?token=${encodeURIComponent(resetToken)}`;
    const message = `You are receiving this email because you requested a password reset for your NovaShop account.\n\nReset Password: ${resetUrl}\n\nThis link expires in 10 minutes. If you did not request this change, please ignore this email and your password will remain unchanged.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1b1816;">
        <h2 style="margin-bottom: 18px;">Reset your NovaShop password</h2>
        <p style="line-height: 1.6;">You requested a password reset for your NovaShop account.</p>
        <p style="line-height: 1.6;">Use the secure link below to choose a new password.</p>
        <p style="margin: 24px 0;"><a href="${resetUrl}" style="display: inline-block; background: #1b1816; color: #fdfbf7; padding: 12px 20px; text-decoration: none;">Reset Password</a></p>
        <p style="line-height: 1.6; color: #6e6962;">This link expires in 10 minutes. If you did not request this change, ignore this email.</p>
      </div>`;

    await emailQueue.add('sendPasswordResetEmail', {
      email: user.email,
      subject: 'Reset your NovaShop password',
      message,
      html,
    });
  }

  res.status(200).json({
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  });
});

// @desc    Reset Password using Token
// @route   PUT /api/v1/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, 
  });

  if (!user) {
    return next(new ApiError(400, 'Token is invalid or has expired'));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now log in with your new password.',
  });
});

// @desc    Verify Email Address
// @route   GET /api/v1/auth/verify-email/:token
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationTokenExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError(400, 'Verification token is invalid or has expired'));
  }

  user.isVerified = true; 
  user.emailVerificationToken = undefined;
  user.emailVerificationTokenExpires = undefined;
  await user.save({ validateBeforeSave: false }); 

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! You now have full account access.',
  });
});