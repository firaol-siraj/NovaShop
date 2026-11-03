import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import Wishlist from '../models/wishlistModel.js';
import Address from '../models/addressModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendEmail } from '../services/emailService.js';
import { sanitizePhoneNumber } from '../utils/phone.js';
import { generateAccessToken, clearRefreshTokenCookie } from '../utils/generateToken.js';
import { releaseStockForOrder } from './orderController.js';

// ==========================================
// CUSTOMER-FACING PROFILE & ACCOUNT HANDLERS
// ==========================================

// @desc    Get current user profile
// @route   GET /api/v1/users/me
// @access  Private
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('-password');
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }
  res.status(200).json({ success: true, data: user });
});

// @desc    Update current user profile (first name, last name, phone, avatar)
// @route   PATCH /api/v1/users/me
// @access  Private
export const updateProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  const { firstName, lastName, name, phone, avatar, dateOfBirth } = req.body;

  if (firstName !== undefined) user.firstName = String(firstName).trim();
  if (lastName !== undefined) user.lastName = String(lastName).trim();
  if (name !== undefined) user.name = String(name).trim();
  if (phone !== undefined) user.phone = sanitizePhoneNumber(String(phone).trim());
  if (avatar !== undefined) user.avatar = String(avatar).trim();
  if (dateOfBirth !== undefined) user.dateOfBirth = String(dateOfBirth).trim();

  // If firstName or lastName changed, sync name
  if (firstName !== undefined || lastName !== undefined) {
    user.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name;
  }

  const updatedUser = await user.save();
  const safeUser = updatedUser.toObject();
  delete safeUser.password;
  delete safeUser.tokenVersion;

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: safeUser,
  });
});

// @desc    Update current user password (requires current password)
// @route   PATCH /api/v1/users/me/password
// @access  Private (Customer & Admin)
export const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ApiError(400, 'Please provide both current password and new password'));
  }

  if (
    newPassword.length < 8 ||
    !/[A-Z]/.test(newPassword) ||
    !/[a-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    return next(
      new ApiError(
        400,
        'New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number'
      )
    );
  }

  if (currentPassword === newPassword) {
    return next(new ApiError(400, 'New password must be different from your current password'));
  }

  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new ApiError(400, 'Current password does not match'));
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Send security email notice
  await sendEmail({
    to: user.email,
    subject: 'NovaShop: Security Notice - Your Password Was Changed',
    text: `Hello ${user.name},\n\nThis is a security confirmation that the password for your NovaShop account was changed on ${new Date().toUTCString()}.\n\nIf you made this change, no further action is needed.\n\nIf you did not authorize this change, please contact our concierge or reset your password immediately.`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #1B1816; max-width: 580px;">
        <h2 style="font-family: Georgia, serif; color: #1B1816;">Password Changed Successfully</h2>
        <p>Hello ${user.name},</p>
        <p>This is a security confirmation that your NovaShop password was updated on <strong>${new Date().toUTCString()}</strong>.</p>
        <p style="background: #F8F4EE; padding: 14px; border-radius: 8px; font-size: 13px; color: #6E6962;">
          If you did not perform this change, please reset your password immediately and contact support.
        </p>
      </div>
    `,
    type: 'security_notice',
    userId: user._id,
  }).catch(() => {});

  const newAccessToken = generateAccessToken(user._id, user.tokenVersion, user.role);

  res.status(200).json({
    success: true,
    message: 'Password updated successfully',
    accessToken: newAccessToken,
  });
});

// @desc    Get user dashboard overview (orders, spent, wishlist count, default address)
// @route   GET /api/v1/users/me/overview
// @access  Private
export const getOverview = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const [totalOrders, ordersInProgress, paidOrders, wishlist, defaultAddress, recentOrders] =
    await Promise.all([
      Order.countDocuments({ user: userId }),
      Order.countDocuments({
        user: userId,
        status: { $in: ['pending', 'pending_payment', 'processing', 'confirmed', 'shipped', 'placed'] },
      }),
      Order.find({
        user: userId,
        $or: [{ isPaid: true }, { paymentStatus: 'paid' }],
      }).select('totalPrice'),
      Wishlist.findOne({ user: userId }).select('items'),
      Address.findOne({ user: userId, isDefault: true }) || Address.findOne({ user: userId }),
      Order.find({ user: userId })
        .populate('orderItems.product', 'name slug images')
        .sort({ createdAt: -1 })
        .limit(3),
    ]);

  const totalSpent = paidOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
  const wishlistCount = wishlist?.items?.length || 0;

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: req.user._id,
        name: req.user.name,
        firstName: req.user.firstName || req.user.name?.split(' ')[0] || '',
        lastName: req.user.lastName || req.user.name?.split(' ').slice(1).join(' ') || '',
        email: req.user.email,
        phone: req.user.phone || '',
        avatar: req.user.avatar || '',
        memberSince: req.user.createdAt,
      },
      stats: {
        totalOrders,
        ordersInProgress,
        totalSpent: Number(totalSpent.toFixed(2)),
        wishlistCount,
      },
      defaultAddress: defaultAddress || null,
      recentOrders: recentOrders || [],
    },
  });
});

// @desc    Get user settings & notification preferences
// @route   GET /api/v1/users/me/settings
// @access  Private
export const getSettings = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('settings email name');
  const defaultSettings = {
    language: 'English (US)',
    currency: 'USD ($)',
    notifications: {
      orderUpdates: true,
      deliveryUpdates: true,
      promotionalEmails: false,
    },
  };

  res.status(200).json({
    success: true,
    data: {
      ...defaultSettings,
      ...(user?.settings?.toObject ? user.settings.toObject() : user?.settings || {}),
    },
  });
});

// @desc    Update user settings & notification preferences
// @route   PATCH /api/v1/users/me/settings
// @access  Private
export const updateSettings = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  const { language, currency, notifications } = req.body;
  if (!user.settings) {
    user.settings = {};
  }

  if (language !== undefined) user.settings.language = language;
  if (currency !== undefined) user.settings.currency = currency;
  if (notifications && typeof notifications === 'object') {
    user.settings.notifications = {
      ...(user.settings.notifications?.toObject ? user.settings.notifications.toObject() : user.settings.notifications || {}),
      ...notifications,
    };
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: user.settings,
  });
});

// @desc    Soft-deactivate current customer account
// @route   DELETE /api/v1/users/me
// @access  Private (Customer only)
export const deleteMyAccount = asyncHandler(async (req, res, next) => {
  if (req.user.role === 'admin') {
    return next(new ApiError(403, 'Admin accounts cannot be deactivated from the customer settings page'));
  }

  const { password } = req.body;
  if (!password) {
    return next(new ApiError(400, 'Password is required to confirm account deactivation'));
  }

  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ApiError(400, 'Incorrect password. Account deactivation cancelled.'));
  }

  // Check for paid orders currently in progress
  const inProgressOrders = await Order.countDocuments({
    user: user._id,
    status: { $in: ['processing', 'shipped', 'out_for_delivery'] },
  });

  if (inProgressOrders > 0) {
    return next(
      new ApiError(
        400,
        `Cannot deactivate account: You have ${inProgressOrders} active order(s) currently being processed or delivered. Please wait for delivery or contact concierge.`
      )
    );
  }

  // Automatically cancel any open unpaid orders and return stock
  const openPendingOrders = await Order.find({
    user: user._id,
    status: { $in: ['pending', 'pending_payment'] },
  });

  for (const pendingOrder of openPendingOrders) {
    pendingOrder.status = 'cancelled';
    pendingOrder.paymentStatus = 'cancelled';
    await releaseStockForOrder(pendingOrder);
    await pendingOrder.save();
  }

  user.status = 'deactivated';
  user.isActive = false;
  user.deactivatedAt = new Date();
  user.refreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save({ validateBeforeSave: false });

  clearRefreshTokenCookie(res, 'customer');

  // Send deactivation notification email
  await sendEmail({
    to: user.email,
    subject: 'NovaShop: Security Notice - Your Account Has Been Deactivated',
    text: `Hello ${user.name},\n\nYour NovaShop account has been deactivated as requested.\n\nYou have been signed out. Your order history is safely kept for our records.\n\nYou can reactivate your account at any time simply by signing in with your email and password.\n\nWarm regards,\nNovaShop Atelier`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #1B1816; max-width: 580px;">
        <h2 style="font-family: Georgia, serif; color: #1B1816;">Account Deactivated</h2>
        <p>Hello ${user.name},</p>
        <p>Your NovaShop customer account has been soft-deactivated as requested on ${new Date().toUTCString()}.</p>
        <p>You have been signed out on all devices. Your past order records and transaction receipts remain preserved in our records.</p>
        <div style="background: #F8F4EE; padding: 14px; border-radius: 8px; font-size: 13px; color: #6E6962; margin: 18px 0;">
          <strong>How to reactivate:</strong> You can reactivate your account anytime by logging in with your registered email and password.
        </div>
      </div>
    `,
    type: 'security_notice',
    userId: user._id,
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Your account has been deactivated. You can reactivate anytime by logging in.',
  });
});

// @desc    Unsubscribe from promotional emails
// @route   GET /api/v1/users/unsubscribe
// @access  Public
export const unsubscribePromotional = asyncHandler(async (req, res, next) => {
  const { email } = req.query;
  if (!email) {
    return next(new ApiError(400, 'Email address is required to unsubscribe'));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (user) {
    if (!user.settings) user.settings = {};
    if (!user.settings.notifications) user.settings.notifications = {};
    user.settings.notifications.promotionalEmails = false;
    await user.save();
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Unsubscribed — NovaShop</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F9F5F0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #FFFFFF; border: 1px solid rgba(27,24,22,0.1); border-radius: 16px; padding: 36px 32px; max-width: 440px; text-align: center; box-shadow: 0 12px 28px rgba(27,24,22,0.06); }
          h1 { font-family: Georgia, serif; font-size: 26px; color: #1B1816; margin: 0 0 12px; }
          p { font-size: 14px; color: #6E6962; line-height: 1.6; margin: 0 0 24px; }
          a { display: inline-block; background: #1B1816; color: #FDFBF7; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Unsubscribed</h1>
          <p>You have successfully unsubscribed from NovaShop promotional emails (${email}). You will still receive essential order and delivery updates.</p>
          <a href="/">Return to Store</a>
        </div>
      </body>
    </html>
  `);
});

// @desc    Admin test email sender
// @route   POST /api/v1/users/admin/test-email
// @access  Private/Admin
export const sendAdminTestEmail = asyncHandler(async (req, res, next) => {
  const targetEmail = (req.body.email || req.user.email || '').trim();
  if (!targetEmail) {
    return next(new ApiError(400, 'Target email address is required'));
  }

  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const html = `
    <h2>NovaShop SMTP Test Delivery</h2>
    <p>This is a test notification verifying that transactional email delivery is functioning properly from NovaShop.</p>
    <p>Host: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT} | Sender: ${process.env.EMAIL_FROM || 'noreply@novashop.com'}</p>
    <p><a href="${frontendUrl}">Visit Storefront</a></p>
  `;

  const result = await sendEmail({
    to: targetEmail,
    subject: `NovaShop SMTP Test Email (${new Date().toLocaleTimeString()})`,
    html,
    text: `NovaShop SMTP Test Delivery. If you received this, transactional emails are working properly!`,
    type: 'admin_test',
  });

  if (!result.success) {
    return next(new ApiError(500, `SMTP Test failed: ${result.error}`));
  }

  res.status(200).json({
    success: true,
    message: `Test email successfully dispatched to ${targetEmail}`,
    messageId: result.messageId,
  });
});

// ==========================================
// ADMIN USER MANAGEMENT HANDLERS
// ==========================================

// @desc    Get all users (Admin only)
// @route   GET /api/v1/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find({}).select('-password');
  res.status(200).json({ success: true, count: users.length, data: users });
});

// @desc    Get user by ID (Admin only)
// @route   GET /api/v1/users/:id
// @access  Private/Admin
export const getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  res.status(200).json({ success: true, data: user });
});

// @desc    Update user (e.g., promote to admin)
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
export const updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.role = req.body.role || user.role;

  const updatedUser = await user.save();

  res.status(200).json({
    success: true,
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    },
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  // Prevent admin from deleting their own account
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ApiError(400, 'You cannot delete your own admin account'));
  }

  await user.deleteOne();
  res.status(200).json({ success: true, message: 'User deleted successfully' });
});
