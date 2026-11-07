import User from "../models/userModel.js";
import AdminNotification from "../models/adminNotificationModel.js";
import AuditLog from "../models/auditLogModel.js";
import { ROLE_PERMISSIONS } from '../middlewares/permissionMiddleware.js';
import AdminInvite from '../models/adminInviteModel.js';
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/generateToken.js";
import { emailQueue, queueOrSendEmail } from "../queues/emailQueue.js"; // 1. Import emailQueue and resilient dispatcher
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  sendEmail,
  getVerificationEmail,
  getWelcomeEmail,
  getPasswordResetEmail,
} from "../services/emailService.js";
import logger from "../utils/logger.js";

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

  const clientBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationUrl = `${clientBase}/verify-email?token=${verificationToken}`;

  const verificationEmail = getVerificationEmail({ user, verificationUrl });

  // 1. Dispatch Verification Email
  try {
    await queueOrSendEmail('sendVerificationEmail', {
      email: user.email,
      to: user.email,
      subject: verificationEmail.subject,
      message: verificationEmail.text,
      text: verificationEmail.text,
      html: verificationEmail.html,
      userId: user._id.toString(),
    });
  } catch (mailErr) {
    logger.error(
      `Error dispatching customer verification email: ${mailErr.message}`
    );
  }

  // 2. Dispatch Welcome Email
  try {
    const welcome = getWelcomeEmail({ user, storefrontUrl: clientBase });
    await sendEmail({
      to: user.email,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
      userId: user._id,
      type: 'welcome',
      statusCategory: 'security',
    });
  } catch (welcomeErr) {
    logger.error(`Error sending welcome email: ${welcomeErr.message}`);
  }

  // Record admin notification for new customer
  await AdminNotification.create({
    type: 'new_customer',
    title: `New Customer Registered: ${user.name}`,
    message: `${user.name} (${user.email}) registered an account.`,
    entityType: 'customer',
    entityId: user._id.toString(),
    link: `/admin/customers/${user._id}`,
    data: { customerId: user._id, email: user.email, name: user.name },
  }).catch(() => {});

  const accessToken = generateAccessToken(user._id, user.tokenVersion, 'customer');
  const refreshToken = generateRefreshToken(user._id, '7d', 'customer');

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Send refresh token as an HTTP-only cookie with customer-specific name
  sendRefreshTokenCookie(res, refreshToken, 7 * 24 * 60 * 60 * 1000, 'customer');

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

  const user = await User.findOne({ email }).select("+password +tokenVersion +adminTokenVersion");

  if (!user || !(await user.matchPassword(password))) {
    return next(new ApiError(401, "Invalid email or password"));
  }

  if (adminOnly && user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access is required'));
  }

  // Reactivate soft-deactivated customer account upon logging in with valid credentials
  if (!adminOnly && (user.status === 'deactivated' || user.isActive === false)) {
    user.status = 'active';
    user.isActive = true;
    user.deactivatedAt = null;
    await user.save({ validateBeforeSave: false });

    // Send security notification about account reactivation
    sendEmail({
      to: user.email,
      subject: 'NovaShop: Security Notice - Your Account Has Been Reactivated',
      text: `Hello ${user.name},\n\nYour NovaShop account has been reactivated successfully.\n\nIf you did not perform this login, please change your password immediately.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1B1816;">
          <h2>Your NovaShop account has been reactivated</h2>
          <p>Hello ${user.name},</p>
          <p>We detected a valid sign-in for your previously deactivated account. Your account status has been restored to <strong>Active</strong>.</p>
          <p>If you did not authorize this action, please reset your password immediately or contact our concierge.</p>
        </div>
      `,
      type: 'account_reactivated',
      statusCategory: 'security',
      userId: user._id,
    }).catch(() => {});
  }

  if (adminOnly) {
    user.lastLoginAt = new Date();
    if (!user.adminRole) {
      user.adminRole = 'owner';
    }
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    let browser = 'Browser';
    if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';
    else if (/Edg/i.test(userAgent)) browser = 'Edge';

    let os = 'Unknown OS';
    if (/Windows/i.test(userAgent)) os = 'Windows';
    else if (/Mac/i.test(userAgent)) os = 'macOS';
    else if (/Linux/i.test(userAgent)) os = 'Linux';
    else if (/Android/i.test(userAgent)) os = 'Android';
    else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    user.lastLoginDevice = `${browser} · ${os}`;
    user.lastLoginIp = clientIp;

    if (!Array.isArray(user.sessions)) user.sessions = [];
    user.sessions.unshift({
      device: `${browser} on ${os}`,
      browser,
      os,
      ip: clientIp,
      location: 'Addis Ababa, ET',
      lastActive: new Date(),
      createdAt: new Date(),
    });
    if (user.sessions.length > 10) {
      user.sessions = user.sessions.slice(0, 10);
    }
  }

  const targetRole = adminOnly ? 'admin' : 'customer';
  const tokenVer = targetRole === 'admin'
    ? (user.adminTokenVersion !== undefined && user.adminTokenVersion !== null
        ? user.adminTokenVersion
        : (user.tokenVersion ?? 0))
    : (user.tokenVersion ?? 0);
  const accessToken = generateAccessToken(user._id, tokenVer, targetRole);
  const refreshToken = generateRefreshToken(user._id, rememberMe === true ? '30d' : '7d', targetRole);

  if (targetRole === 'admin') {
    user.adminRefreshToken = refreshToken;
  } else {
    user.refreshToken = refreshToken;
  }
  await user.save({ validateBeforeSave: false });

  const refreshCookieMaxAge = rememberMe === true
    ? 30 * 24 * 60 * 60 * 1000
    : rememberMe === false
      ? null
      : 7 * 24 * 60 * 60 * 1000;
  sendRefreshTokenCookie(res, refreshToken, refreshCookieMaxAge, targetRole);

  res.status(200).json({
    success: true,
    accessToken,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminRole: user.adminRole || (user.role === 'admin' ? 'owner' : undefined),
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
  delete user.adminTokenVersion;
  delete user.refreshToken;
  delete user.adminRefreshToken;

  if (user.role === 'admin') {
    user.adminRole = user.adminRole || 'owner';
    user.permissions = ROLE_PERMISSIONS[user.adminRole] || {};
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Accept admin team invite and set password
// @route   POST /api/v1/auth/admin/accept-invite
export const acceptAdminInvite = asyncHandler(async (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return next(new ApiError(400, 'Invite token and password are required'));
  }

  if (String(password).length < 6) {
    return next(new ApiError(400, 'Password must be at least 6 characters'));
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const invite = await AdminInvite.findOne({
    token: hashedToken,
    status: 'pending',
    expiresAt: { $gt: Date.now() },
  });

  if (!invite) {
    return next(new ApiError(400, 'Invitation token is invalid or has expired'));
  }

  let user = await User.findOne({ email: invite.email });
  if (user) {
    user.role = 'admin';
    user.adminRole = invite.role;
    user.password = password;
    user.status = 'active';
    user.isActive = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.adminTokenVersion = (user.adminTokenVersion || user.tokenVersion || 0) + 1;
    user.refreshToken = null;
    user.adminRefreshToken = null;
    await user.save();
  } else {
    user = await User.create({
      name: invite.name,
      email: invite.email,
      password,
      role: 'admin',
      adminRole: invite.role,
      status: 'active',
      isActive: true,
      isVerified: true,
    });
  }

  invite.status = 'accepted';
  await invite.save();

  res.status(200).json({
    success: true,
    message: 'Invitation accepted successfully. You may now log in to the administrative portal.',
  });
});

// @desc    Get new customer access token using refresh token
// @route   POST /api/v1/auth/refresh-token
export const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.nova_customer_session || req.cookies.refreshToken;

  if (!refreshToken) {
    return next(
      new ApiError(401, "Refresh token missing. Please log in again.")
    );
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.role && decoded.role !== 'customer') {
      return next(new ApiError(401, "Invalid refresh token for customer session."));
    }

    const user = await User.findById(decoded.id).select('+tokenVersion');
    if (!user || user.refreshToken !== refreshToken) {
      return next(new ApiError(401, "Invalid or revoked refresh token."));
    }

    if (user.status === 'deactivated' || user.isActive === false) {
      return next(new ApiError(401, "Account is deactivated."));
    }

    const newAccessToken = generateAccessToken(user._id, user.tokenVersion, 'customer');

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return next(new ApiError(401, "Expired or corrupted refresh token."));
  }
});

// @desc    Get new admin access token using admin refresh token
// @route   POST /api/v1/auth/admin/refresh-token
export const refreshAdminAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.nova_admin_session;

  if (!refreshToken) {
    return next(
      new ApiError(401, "Admin refresh token missing. Please log in again.")
    );
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.role && decoded.role !== 'admin') {
      return next(new ApiError(401, "Invalid refresh token for admin session."));
    }

    const user = await User.findById(decoded.id).select('+tokenVersion +adminTokenVersion');
    const isTokenValid = Boolean(user && user.adminRefreshToken && user.adminRefreshToken === refreshToken);

    if (!user || user.role !== 'admin' || !isTokenValid) {
      return next(new ApiError(401, "Invalid or revoked admin refresh token."));
    }

    if (user.status === 'deactivated' || user.isActive === false) {
      return next(new ApiError(401, "Admin account is deactivated."));
    }

    const tokenVer = (user.adminTokenVersion !== undefined && user.adminTokenVersion !== null)
      ? user.adminTokenVersion
      : (user.tokenVersion ?? 0);
    const newAccessToken = generateAccessToken(user._id, tokenVer, 'admin');

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return next(new ApiError(401, "Expired or corrupted admin refresh token."));
  }
});

// @desc    Logout customer & clear customer refresh token
// @route   POST /api/v1/auth/logout
export const logout = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.nova_customer_session || req.cookies.refreshToken;

  if (refreshToken) {
    const user = await User.findOne({ refreshToken }).select('+tokenVersion');
    if (user) {
      user.refreshToken = null;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ validateBeforeSave: false });
    }
  }

  clearRefreshTokenCookie(res, 'customer');

  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// @desc    Logout admin & clear admin refresh token
// @route   POST /api/v1/auth/admin/logout
export const adminLogout = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.nova_admin_session;

  if (refreshToken) {
    const user = await User.findOne({ adminRefreshToken: refreshToken }).select('+adminTokenVersion');
    if (user) {
      user.adminRefreshToken = null;
      user.adminTokenVersion = (user.adminTokenVersion !== undefined && user.adminTokenVersion !== null
        ? user.adminTokenVersion
        : 0) + 1;
      await user.save({ validateBeforeSave: false });
    }
  }

  clearRefreshTokenCookie(res, 'admin');

  res.status(200).json({ success: true, message: "Admin logged out successfully" });
});

// @desc    Request Password Reset Email (Customer)
// @route   POST /api/v1/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(200).json({
      success: true,
      message: 'If an account exists for this email, a password reset link has been sent.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  /** @type {import('../models/userModel.js').default & mongoose.Document} */
  const user = await User.findOne({ email: cleanEmail });

  if (user && user.status !== 'deactivated' && user.isActive !== false) {
    // 60-minute token expiry for password reset
    const resetToken = user.createPasswordResetToken(60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const clientBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientBase}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const resetEmail = getPasswordResetEmail({ user, resetUrl });

    try {
      await queueOrSendEmail('sendPasswordResetEmail', {
        email: user.email,
        to: user.email,
        subject: resetEmail.subject,
        message: resetEmail.text,
        text: resetEmail.text,
        html: resetEmail.html,
        userId: user._id.toString(),
      });
      logger.info(`[ForgotPassword] Password reset email successfully dispatched for ${user.email}`);
    } catch (queueErr) {
      logger.error(
        `[ForgotPassword] Error dispatching password reset email for ${user.email}: ${queueErr.message}`
      );
    }
  }

  // Constant-time style neutral anti-enumeration response
  res.status(200).json({
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  });
});

// @desc    Validate Password Reset Token without consuming it
// @route   GET /api/v1/auth/reset-password/validate
export const validateResetToken = asyncHandler(async (req, res, next) => {
  const token = req.query.token || req.params.token;
  if (!token) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: 'Password reset token is required.',
    });
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(String(token).trim())
    .digest('hex');

  const user = await User.findOne({
    $or: [
      { passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } },
      { inviteToken: token, inviteExpires: { $gt: Date.now() } },
      { inviteToken: hashedToken, inviteExpires: { $gt: Date.now() } },
    ],
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: 'Password reset link is invalid or has expired.',
    });
  }

  res.status(200).json({
    success: true,
    valid: true,
    email: user.email,
    message: 'Token is valid.',
  });
});

// @desc    Reset Password using Token (Customer)
// @route   POST /api/v1/auth/reset-password or PUT /api/v1/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res, next) => {
  const token = req.body.token || req.params.token || req.query.token;
  const password = req.body.password;

  if (!token) {
    return next(new ApiError(400, 'Password reset token is required'));
  }
  if (!password || password.length < 8) {
    return next(new ApiError(400, 'Password must be at least 8 characters long'));
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(String(token).trim())
    .digest('hex');

  const user = await User.findOne({
    $or: [
      { passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } },
      { inviteToken: token, inviteExpires: { $gt: Date.now() } },
      { inviteToken: hashedToken, inviteExpires: { $gt: Date.now() } },
    ],
  }).select('+tokenVersion +sessions');

  if (!user) {
    return next(new ApiError(400, 'Token is invalid or has expired'));
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.inviteToken = undefined;
  user.inviteExpires = undefined;
  user.isVerified = true;
  user.isInvited = false;
  if (user.status === 'invited' || user.status === 'inactive') {
    user.status = 'active';
  }
  user.isActive = true;

  // Revoke all existing sessions and refresh tokens on password change
  user.refreshToken = null;
  user.adminRefreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.adminTokenVersion = (user.adminTokenVersion || user.tokenVersion || 0) + 1;
  user.sessions = [];
  await user.save();

  clearRefreshTokenCookie(res, 'all');

  // Send security notification email
  try {
    await sendEmail({
      to: user.email,
      subject: 'Security Notice: Your NovaShop Password Was Changed',
      text: `Hello ${user.name},\n\nYour NovaShop account password was successfully updated. If you did not make this change, please contact our support team immediately.\n\nNovaShop Security Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; color: #1A1A1A; background-color: #FDFBF7; border: 1px solid #E6E2DC;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #1C1917;">Password Changed Successfully</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #44403C; margin: 0 0 16px;">
            Hello ${user.name || 'NovaShop Member'},
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #44403C; margin: 0 0 16px;">
            This email confirms that your NovaShop password has been changed. All existing sessions have been signed out for your protection.
          </p>
          <div style="background-color: #FEE2E2; border: 1px solid #FCA5A5; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
            <p style="font-size: 13px; color: #991B1B; margin: 0; line-height: 1.5;">
              If you did not perform this change, please contact NovaShop Concierge Support immediately.
            </p>
          </div>
          <hr style="border: none; border-top: 1px solid #E6E2DC; margin: 24px 0 16px;" />
          <p style="font-size: 11px; color: #78716C; margin: 0;">NovaShop Security & Identity Protection</p>
        </div>
      `,
      userId: user._id,
      type: 'security_alert',
      statusCategory: 'security',
    });
  } catch (err) {
    logger.error(`Error sending password changed security email: ${err.message}`);
  }

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now log in with your new password.',
  });
});

// @desc    Admin Forgot Password Request
// @route   POST /api/v1/auth/admin/forgot-password
export const adminForgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(200).json({
      success: true,
      message: 'If an admin account exists for this email, password reset instructions have been sent.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const adminRoles = ['admin', 'staff', 'manager', 'owner', 'superadmin'];
  const user = await User.findOne({
    email: cleanEmail,
    role: { $in: adminRoles },
  }).select('+adminResetOtp +adminResetOtpExpires');

  if (user) {
    // 15-minute expiry for admin resets
    const resetToken = user.createPasswordResetToken(15 * 60 * 1000);
    // 6-digit OTP code second factor
    const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');
    user.adminResetOtp = hashedOtp;
    user.adminResetOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Write to AuditLog
    try {
      await AuditLog.create({
        action: 'ADMIN_PASSWORD_RESET_REQUESTED',
        section: 'auth',
        performedBy: user._id,
        performerEmail: user.email,
        ipAddress: req.ip || '',
        metadata: {
          role: user.role,
          requestedAt: new Date(),
        },
      });
    } catch (auditErr) {
      logger.error(`Failed to write admin password reset audit log: ${auditErr.message}`);
    }

    // Create AdminNotification for owners
    try {
      await AdminNotification.create({
        type: 'system',
        title: 'Admin Password Reset Requested',
        message: `A password reset was requested for admin account: ${user.email} from IP ${req.ip || 'unknown'}.`,
        entityType: 'system',
      });
    } catch (notifErr) {
      logger.error(`Failed to create admin password reset notification: ${notifErr.message}`);
    }

    const clientBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientBase}/admin/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'NovaShop Admin Password Reset & Verification Code',
        text: `NovaShop Admin Password Reset\n\nA password reset was requested for your admin account.\n\nYour 6-digit verification code is: ${rawOtp}\n\nReset Link (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this reset, alert the system administrator immediately.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; color: #1A1A1A; background-color: #FDFBF7; border: 1px solid #E6E2DC;">
            <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #78716C; display: block; margin-bottom: 12px;">NOVASHOP ADMINISTRATION</span>
            <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #1C1917;">Admin Password Reset</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #44403C; margin: 0 0 20px;">
              A password reset request was initiated for your administrator account (<strong>${user.email}</strong>).
            </p>
            <div style="background-color: #1C1917; color: #FDFBF7; padding: 18px; text-align: center; margin: 24px 0; border-radius: 4px;">
              <span style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #A8A29E; display: block; margin-bottom: 6px;">VERIFICATION CODE (OTP)</span>
              <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em;">${rawOtp}</span>
            </div>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${resetUrl}" style="background-color: #78716C; color: #FDFBF7; text-decoration: none; padding: 12px 24px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; display: inline-block;">
                Proceed to Reset Password
              </a>
            </div>
            <p style="font-size: 12px; color: #78716C; line-height: 1.6; margin: 20px 0 0;">
              This link and verification code expire in <strong>15 minutes</strong>. If you did not initiate this request, notify an owner immediately.
            </p>
          </div>
        `,
        userId: user._id,
        type: 'password_reset',
        statusCategory: 'security',
      });
    } catch (mailErr) {
      logger.error(`Error sending admin reset email: ${mailErr.message}`);
    }
  }

  res.status(200).json({
    success: true,
    message: 'If an admin account exists for this email, password reset instructions have been sent.',
  });
});

// @desc    Validate Admin Password Reset Token
// @route   GET /api/v1/auth/admin/reset-password/validate
export const validateAdminResetToken = asyncHandler(async (req, res, next) => {
  const token = req.query.token || req.params.token;
  if (!token) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: 'Admin reset token is required.',
    });
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(String(token).trim())
    .digest('hex');

  const adminRoles = ['admin', 'staff', 'manager', 'owner', 'superadmin'];
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    role: { $in: adminRoles },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: 'Admin reset link is invalid or has expired (15-minute limit).',
    });
  }

  res.status(200).json({
    success: true,
    valid: true,
    email: user.email,
    message: 'Admin reset token is valid.',
  });
});

// @desc    Reset Admin Password using Token and OTP
// @route   POST /api/v1/auth/admin/reset-password
export const adminResetPassword = asyncHandler(async (req, res, next) => {
  const { token, password, otp } = req.body || {};

  if (!token) {
    return next(new ApiError(400, 'Admin reset token is required'));
  }
  if (!password || password.length < 12) {
    return next(new ApiError(400, 'Admin password must be at least 12 characters long'));
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return next(new ApiError(400, 'Admin password must contain uppercase, lowercase, and numbers'));
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(String(token).trim())
    .digest('hex');

  const adminRoles = ['admin', 'staff', 'manager', 'owner', 'superadmin'];
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    role: { $in: adminRoles },
  }).select('+adminResetOtp +adminResetOtpExpires +tokenVersion +adminTokenVersion');

  if (!user) {
    return next(new ApiError(400, 'Admin reset link is invalid or has expired (15-minute limit).'));
  }

  // Verify OTP if present
  if (user.adminResetOtp) {
    if (!otp) {
      return next(new ApiError(400, '6-digit verification code (OTP) is required.'));
    }
    const hashedOtp = crypto
      .createHash('sha256')
      .update(String(otp).trim())
      .digest('hex');

    if (hashedOtp !== user.adminResetOtp || (user.adminResetOtpExpires && user.adminResetOtpExpires < Date.now())) {
      return next(new ApiError(400, 'Verification code is invalid or has expired.'));
    }
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.adminResetOtp = undefined;
  user.adminResetOtpExpires = undefined;

  // Revoke sessions
  user.refreshToken = null;
  user.adminRefreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.adminTokenVersion = (user.adminTokenVersion || user.tokenVersion || 0) + 1;
  await user.save();

  // Clear session cookies
  clearRefreshTokenCookie(res, 'all');

  // Log in AuditLog
  try {
    await AuditLog.create({
      action: 'ADMIN_PASSWORD_RESET_COMPLETED',
      section: 'auth',
      performedBy: user._id,
      performerEmail: user.email,
      ipAddress: req.ip || '',
      metadata: { role: user.role },
    });
  } catch (auditErr) {
    logger.error(`Failed to create audit log for completed admin reset: ${auditErr.message}`);
  }

  // Create AdminNotification
  try {
    await AdminNotification.create({
      type: 'system',
      title: 'Admin Password Successfully Reset',
      message: `Password was changed for admin account ${user.email} from IP ${req.ip || 'unknown'}.`,
      entityType: 'system',
    });
  } catch (notifErr) {
    logger.error(`Failed to create notification for admin password reset: ${notifErr.message}`);
  }

  res.status(200).json({
    success: true,
    message: 'Admin password reset successfully. You can now log in with your new credentials.',
  });
});

// @desc    Verify Email Address
// @route   GET /api/v1/auth/verify-email/:token or /api/v1/auth/verify-email?token=...
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const token = req.params.token || req.query.token;

  if (!token) {
    return next(new ApiError(400, 'Verification token is required'));
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
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
    data: {
      _id: user._id,
      email: user.email,
      isVerified: true,
    },
  });
});