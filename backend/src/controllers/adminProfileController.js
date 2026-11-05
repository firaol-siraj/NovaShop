import multer from 'multer';
import sharp from 'sharp';
import User from '../models/userModel.js';
import AuditLog from '../models/auditLogModel.js';
import Setting from '../models/settingModel.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateAccessToken } from '../utils/generateToken.js';
import { ROLE_PERMISSIONS } from '../middlewares/permissionMiddleware.js';
import { uploadMediaBuffer } from '../services/storageService.js';
import sendEmail from '../utils/sendEmail.js';

// Multer memory storage for avatar uploads
const avatarStorage = multer.memoryStorage();
export const uploadAvatarMiddleware = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.mimetype.toLowerCase())) {
      return cb(new ApiError(400, 'Invalid file format. Only JPG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  },
}).single('avatar');

function getRoleLabel(role) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrator';
    case 'manager':
      return 'Store Manager';
    case 'support':
      return 'Support Agent';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Administrator';
  }
}

function maskIp(ip) {
  if (!ip || typeof ip !== 'string') return '127.0.***.***';
  if (ip === '::1' || ip === '127.0.0.1') return '127.0.***.***';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return ip.slice(0, 7) + ':****';
}

/**
 * GET /api/admin/me
 * Returns the currently authenticated admin's detailed profile
 */
export const getAdminMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user || user.role !== 'admin') {
    return next(new ApiError(404, 'Admin profile not found'));
  }

  const adminRole = user.adminRole || 'owner';
  const permissions = ROLE_PERMISSIONS[adminRole] || {};
  const settingsDoc = await Setting.getSingleton().catch(() => null);

  const safeProfile = {
    _id: user._id,
    name: user.name,
    firstName: user.firstName || user.name.split(' ')[0] || '',
    lastName: user.lastName || user.name.split(' ').slice(1).join(' ') || '',
    displayName: user.displayName || user.name,
    email: user.email,
    phone: user.phone || '',
    avatar: user.avatar || '',
    jobTitle: user.jobTitle || 'Store Administrator',
    bio: user.bio || '',
    role: user.role,
    adminRole,
    roleLabel: getRoleLabel(adminRole),
    permissions,
    status: user.status || (user.isActive ? 'active' : 'deactivated'),
    memberSince: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    lastLoginDevice: user.lastLoginDevice || 'Desktop Chrome · Linux',
    lastLoginIp: maskIp(user.lastLoginIp || req.ip),
    settings: {
      language: user.settings?.language || settingsDoc?.locale?.language || 'English (US)',
      timezone: user.settings?.timezone || settingsDoc?.locale?.timezone || 'Africa/Addis_Ababa',
      currency: user.settings?.currency || settingsDoc?.storeDetails?.currency || 'USD ($)',
    },
  };

  res.status(200).json({
    success: true,
    data: safeProfile,
  });
});

/**
 * PATCH /api/admin/me
 * Updates personal details with audit logging. Role and permissions cannot be edited.
 */
export const updateAdminMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user || user.role !== 'admin') {
    return next(new ApiError(404, 'Admin user not found'));
  }

  const {
    firstName,
    lastName,
    displayName,
    phone,
    jobTitle,
    bio,
    language,
    timezone,
    email,
    currentPassword,
  } = req.body;

  const changes = [];

  const recordChange = (field, oldVal, newVal) => {
    if (newVal !== undefined && newVal !== null && String(oldVal || '') !== String(newVal || '')) {
      changes.push({ field, oldValue: oldVal || '', newValue: newVal });
    }
  };

  // 1. Email update requires re-entering current password
  if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
    const newEmail = email.toLowerCase().trim();
    if (!currentPassword) {
      return next(new ApiError(400, 'Current password is required to change your email address.'));
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new ApiError(401, 'Current password verification failed.'));
    }

    const existingUser = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
    if (existingUser) {
      return next(new ApiError(400, 'Email address is already in use by another account.'));
    }

    recordChange('email', user.email, newEmail);
    const oldEmail = user.email;
    user.email = newEmail;

    // Send security notification to old email and confirmation to new email
    sendEmail({
      to: oldEmail,
      subject: '[NovaShop Security] Admin email address changed',
      text: `Your administrator email address has been updated to ${newEmail}. If you did not make this change, please contact support immediately.`,
    }).catch(() => {});

    sendEmail({
      to: newEmail,
      subject: '[NovaShop Security] Admin email address verified',
      text: `Your administrator email address has been successfully changed to ${newEmail}.`,
    }).catch(() => {});
  }

  if (firstName !== undefined) {
    recordChange('firstName', user.firstName, firstName.trim());
    user.firstName = firstName.trim();
  }

  if (lastName !== undefined) {
    recordChange('lastName', user.lastName, lastName.trim());
    user.lastName = lastName.trim();
  }

  if (firstName !== undefined || lastName !== undefined) {
    const combined = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (combined) {
      recordChange('name', user.name, combined);
      user.name = combined;
    }
  }

  if (displayName !== undefined) {
    recordChange('displayName', user.displayName, displayName.trim());
    user.displayName = displayName.trim();
  }

  if (phone !== undefined) {
    recordChange('phone', user.phone, phone.trim());
    user.phone = phone.trim();
  }

  if (jobTitle !== undefined) {
    recordChange('jobTitle', user.jobTitle, jobTitle.trim());
    user.jobTitle = jobTitle.trim();
  }

  if (bio !== undefined) {
    recordChange('bio', user.bio, bio.trim());
    user.bio = bio.trim();
  }

  if (!user.settings) user.settings = {};

  if (language !== undefined) {
    recordChange('settings.language', user.settings.language, language);
    user.settings.language = language;
  }

  if (timezone !== undefined) {
    recordChange('settings.timezone', user.settings.timezone, timezone);
    user.settings.timezone = timezone;
  }

  await user.save({ validateBeforeSave: false });

  // Record Audit Log if changes occurred
  if (changes.length > 0) {
    await AuditLog.create({
      action: 'admin_profile_updated',
      section: 'profile',
      performedBy: user._id,
      performerEmail: user.email,
      targetEntityId: user._id.toString(),
      changes,
      ipAddress: req.ip || '',
    }).catch(() => {});
  }

  const adminRole = user.adminRole || 'owner';
  const permissions = ROLE_PERMISSIONS[adminRole] || {};

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName || user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      jobTitle: user.jobTitle,
      bio: user.bio,
      role: user.role,
      adminRole,
      roleLabel: getRoleLabel(adminRole),
      permissions,
      settings: user.settings,
    },
  });
});

/**
 * PATCH /api/admin/me/password
 * Changes password, increments tokenVersion to revoke other sessions, sends security email
 */
export const updateAdminPassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ApiError(400, 'Current password and new password are required.'));
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return next(new ApiError(400, 'New password and confirmation do not match.'));
  }

  if (String(newPassword).length < 6) {
    return next(new ApiError(400, 'New password must be at least 6 characters in length.'));
  }

  const user = await User.findById(req.user._id).select('+password +tokenVersion +adminTokenVersion');
  if (!user) {
    return next(new ApiError(404, 'Admin user not found.'));
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new ApiError(401, 'Current password does not match records.'));
  }

  if (await user.matchPassword(newPassword)) {
    return next(new ApiError(400, 'New password must be different from your current password.'));
  }

  // Update password and increment token versions to invalidate all existing sessions
  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.adminTokenVersion = (user.adminTokenVersion || user.tokenVersion || 0) + 1;
  user.adminRefreshToken = null;
  user.refreshToken = null;
  await user.save();

  // Issue new access token for the active session
  const newAccessToken = generateAccessToken(user._id, user.adminTokenVersion, 'admin');

  // Record audit log
  await AuditLog.create({
    action: 'admin_password_changed',
    section: 'security',
    performedBy: user._id,
    performerEmail: user.email,
    targetEntityId: user._id.toString(),
    changes: [{ field: 'password', oldValue: '********', newValue: '********' }],
    ipAddress: req.ip || '',
  }).catch(() => {});

  // Send security notification email
  sendEmail({
    to: user.email,
    subject: '[NovaShop Security Alert] Your password has been changed',
    text: `Hello ${user.name},\n\nThis confirms that the password for your NovaShop administrator account (${user.email}) was recently updated.\n\nAll other active sessions have been automatically signed out.\n\nIf you did not perform this change, please contact technical support immediately.`,
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Password updated successfully. Other active sessions have been revoked.',
    accessToken: newAccessToken,
  });
});

/**
 * POST /api/admin/me/avatar
 * Validates, crops/resizes, and stores admin avatar
 */
export const uploadAdminAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return next(new ApiError(400, 'Please select an image file to upload as your avatar.'));
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ApiError(404, 'Admin user not found.'));
  }

  try {
    // Process image buffer: crop to 400x400 square and convert to webp for optimum speed
    const croppedBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    const uploadResult = await uploadMediaBuffer({
      buffer: croppedBuffer,
      originalName: `avatar_${user._id}.webp`,
      folder: 'novashop/avatars',
    });

    const avatarUrl = uploadResult.url;
    const oldAvatar = user.avatar;
    user.avatar = avatarUrl;
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({
      action: 'admin_avatar_updated',
      section: 'profile',
      performedBy: user._id,
      performerEmail: user.email,
      targetEntityId: user._id.toString(),
      changes: [{ field: 'avatar', oldValue: oldAvatar || '', newValue: avatarUrl }],
      ipAddress: req.ip || '',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully.',
      avatarUrl,
    });
  } catch (err) {
    return next(new ApiError(err.statusCode || 500, err.message || 'Failed to process avatar image.'));
  }
});

/**
 * DELETE /api/admin/me/avatar
 * Removes avatar and reverts to initials fallback
 */
export const deleteAdminAvatar = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new ApiError(404, 'Admin user not found.'));

  const oldAvatar = user.avatar;
  user.avatar = '';
  await user.save({ validateBeforeSave: false });

  await AuditLog.create({
    action: 'admin_avatar_removed',
    section: 'profile',
    performedBy: user._id,
    performerEmail: user.email,
    targetEntityId: user._id.toString(),
    changes: [{ field: 'avatar', oldValue: oldAvatar || '', newValue: '' }],
    ipAddress: req.ip || '',
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Avatar removed successfully.',
  });
});

/**
 * GET /api/admin/me/sessions
 * Returns list of active sessions with current session indicator and masked IP
 */
export const getAdminSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

  let rawSessions = user?.sessions || [];
  if (rawSessions.length === 0) {
    rawSessions = [
      {
        _id: user._id,
        device: user.lastLoginDevice || 'Desktop Chrome · Linux',
        browser: 'Chrome',
        os: 'Linux',
        ip: clientIp,
        location: 'Addis Ababa, ET',
        lastActive: user.lastLoginAt || new Date(),
        createdAt: user.createdAt,
      },
    ];
  }

  const sessions = rawSessions.map((s, idx) => ({
    id: s._id || `sess_${idx}`,
    device: s.device || 'Desktop Browser',
    browser: s.browser || 'Chrome',
    os: s.os || 'Linux',
    ip: maskIp(s.ip || clientIp),
    location: s.location || 'Addis Ababa, ET',
    lastActive: s.lastActive || s.createdAt || new Date(),
    isCurrent: idx === 0,
  }));

  res.status(200).json({
    success: true,
    data: sessions,
  });
});

/**
 * DELETE /api/admin/me/sessions/:id
 * Revokes a session or all other sessions
 */
export const revokeAdminSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(req.user._id).select('+tokenVersion +adminTokenVersion');
  if (!user) return next(new ApiError(404, 'Admin user not found.'));

  if (id === 'other') {
    if (Array.isArray(user.sessions) && user.sessions.length > 0) {
      user.sessions = user.sessions.slice(0, 1);
    }
    user.adminTokenVersion = (user.adminTokenVersion || user.tokenVersion || 0) + 1;
    await user.save({ validateBeforeSave: false });

    // Issue refreshed token for current session
    const newAccessToken = generateAccessToken(user._id, user.adminTokenVersion, 'admin');

    await AuditLog.create({
      action: 'admin_sessions_revoked_others',
      section: 'security',
      performedBy: user._id,
      performerEmail: user.email,
      targetEntityId: user._id.toString(),
      changes: [{ field: 'sessions', oldValue: 'multiple', newValue: 'current_only' }],
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'All other sessions have been signed out.',
      accessToken: newAccessToken,
    });
  }

  // Revoke specific session
  if (Array.isArray(user.sessions)) {
    user.sessions = user.sessions.filter((s) => s._id?.toString() !== id && s.id !== id);
    await user.save({ validateBeforeSave: false });
  }

  await AuditLog.create({
    action: 'admin_session_revoked',
    section: 'security',
    performedBy: user._id,
    performerEmail: user.email,
    targetEntityId: id,
    changes: [{ field: 'session', oldValue: id, newValue: 'revoked' }],
    ipAddress: req.ip || '',
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Session revoked successfully.',
  });
});

/**
 * GET /api/admin/me/activity
 * Paginated read-only list of actions performed by this admin
 */
export const getAdminActivity = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const filter = { performedBy: req.user._id };

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  const formattedLogs = logs.map((log) => ({
    _id: log._id,
    action: log.action,
    section: log.section || 'system',
    changes: log.changes || [],
    ipAddress: maskIp(log.ipAddress),
    createdAt: log.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: {
      logs: formattedLogs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    },
  });
});
