import crypto from 'crypto';
import User from '../models/userModel.js';
import AdminInvite from '../models/adminInviteModel.js';
import AuditLog from '../models/auditLogModel.js';
import sendEmail from '../utils/sendEmail.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ADMIN_ROLES, ROLE_PERMISSIONS } from '../middlewares/permissionMiddleware.js';

export const getTeamMembers = asyncHandler(async (req, res) => {
  const adminUsers = await User.find({ role: 'admin' })
    .select('name firstName lastName email phone adminRole status lastLoginAt createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const pendingInvites = await AdminInvite.find({ status: 'pending' })
    .select('name email role status expiresAt createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const roleDisplayNames = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Store Manager',
    support: 'Support Agent',
    viewer: 'Content Editor',
  };

  const members = [
    ...adminUsers.map((u) => {
      const displayName = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || (u.email ? u.email.split('@')[0] : 'Admin');
      const parts = displayName.trim().split(/\s+/).filter(Boolean);
      const initials = (parts[0]?.[0] || 'A') + (parts[1]?.[0] || '');
      return {
        id: String(u._id),
        name: displayName,
        initials: initials.toUpperCase(),
        email: u.email || '',
        role: roleDisplayNames[u.adminRole] || 'Admin',
        rawRole: u.adminRole || 'admin',
        lastActive: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Active now',
        status: u.status === 'active' || !u.status ? 'Active' : 'Deactivated',
        isYou: String(u._id) === String(req.user._id),
        type: 'user',
      };
    }),
    ...pendingInvites.map((inv) => {
      const displayName = inv.name || (inv.email ? inv.email.split('@')[0] : 'Invited Member');
      const parts = displayName.trim().split(/\s+/).filter(Boolean);
      const initials = (parts[0]?.[0] || 'I') + (parts[1]?.[0] || '');
      return {
        id: String(inv._id),
        name: displayName,
        initials: initials.toUpperCase(),
        email: inv.email || '',
        role: roleDisplayNames[inv.role] || 'Support Agent',
        rawRole: inv.role,
        lastActive: '—',
        status: 'Invited',
        isYou: false,
        type: 'invite',
        expiresAt: inv.expiresAt,
      };
    }),
  ];

  res.status(200).json({
    success: true,
    data: members,
    members,
    memberCount: members.length,
    roleCount: 5,
  });
});

export const inviteTeamMember = asyncHandler(async (req, res, next) => {
  const { name, email, role } = req.body;
  const actorRole = req.user.adminRole || 'owner';

  if (!name || !email || !role) {
    return next(new ApiError(400, 'Name, email, and role are required'));
  }

  // Canonicalize role key
  const normalizedRole = String(role).toLowerCase().includes('manager')
    ? 'manager'
    : String(role).toLowerCase().includes('support')
    ? 'support'
    : String(role).toLowerCase().includes('content') || String(role).toLowerCase().includes('viewer')
    ? 'viewer'
    : String(role).toLowerCase().includes('owner')
    ? 'owner'
    : 'admin';

  if (actorRole !== ADMIN_ROLES.OWNER && normalizedRole === ADMIN_ROLES.OWNER) {
    return next(new ApiError(403, 'Only owners can grant the Owner role'));
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser && existingUser.role === 'admin') {
    return next(new ApiError(400, 'An administrative account with this email address already exists'));
  }

  let invite = await AdminInvite.findOne({ email: email.toLowerCase() });
  if (invite && invite.status === 'pending') {
    return next(new ApiError(400, 'An active invitation is already pending for this email address'));
  }

  invite = new AdminInvite({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    role: normalizedRole,
    invitedBy: req.user._id,
  });

  const rawToken = invite.generateToken();
  await invite.save();

  const clientBase = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteUrl = `${clientBase}/admin/accept-invite?token=${rawToken}`;

  await sendEmail({
    to: invite.email,
    subject: "You've been invited to join the NovaShop Admin Team",
    html: `
      <h2>NovaShop Administrative Team Invitation</h2>
      <p>Hello ${invite.name},</p>
      <p>You have been invited to join the NovaShop administrative operations team as a <strong>${invite.role}</strong>.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#1B1816;color:#FFF;text-decoration:none;border-radius:6px;font-weight:600;">Accept Invitation & Set Password</a></p>
      <p style="color:#777;font-size:12px;margin-top:20px;">This single-use invitation link expires in 48 hours.</p>
    `,
  }).catch((err) => console.warn(`[Invite] Notification email note: ${err.message}`));

  await AuditLog.create({
    action: 'member_invite',
    section: 'team',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: invite.email,
    metadata: { role: invite.role },
    ipAddress: req.ip || '',
  });

  res.status(201).json({
    success: true,
    message: `Invitation successfully dispatched to ${invite.email}`,
    data: {
      inviteId: invite._id,
      email: invite.email,
      role: invite.role,
      inviteToken: rawToken,
    },
  });
});

export const resendInvite = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const invite = await AdminInvite.findById(id);

  if (!invite || invite.status !== 'pending') {
    return next(new ApiError(404, 'Active invitation not found'));
  }

  const rawToken = invite.generateToken();
  await invite.save();

  const clientBase = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteUrl = `${clientBase}/admin/accept-invite?token=${rawToken}`;

  await sendEmail({
    to: invite.email,
    subject: "Reminder: NovaShop Admin Team Invitation",
    html: `
      <h2>NovaShop Administrative Team Invitation</h2>
      <p>Hello ${invite.name},</p>
      <p>This is a reminder to accept your invitation to join the NovaShop operations team as <strong>${invite.role}</strong>.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#1B1816;color:#FFF;text-decoration:none;border-radius:6px;font-weight:600;">Accept Invitation & Set Password</a></p>
      <p style="color:#777;font-size:12px;margin-top:20px;">This invitation link expires in 48 hours.</p>
    `,
  });

  res.status(200).json({ success: true, message: `Invitation resent to ${invite.email}` });
});

export const revokeInvite = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const invite = await AdminInvite.findById(id);

  if (!invite) return next(new ApiError(404, 'Invitation not found'));

  invite.status = 'revoked';
  await invite.save();

  await AuditLog.create({
    action: 'invite_revoked',
    section: 'team',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: invite.email,
    ipAddress: req.ip || '',
  });

  res.status(200).json({ success: true, message: 'Invitation revoked successfully' });
});

export const updateMemberRole = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;
  const actorRole = req.user.adminRole || 'owner';

  if (actorRole !== ADMIN_ROLES.OWNER) {
    return next(new ApiError(403, 'Only owners can modify administrative roles'));
  }

  const normalizedRole = String(role).toLowerCase().includes('manager')
    ? 'manager'
    : String(role).toLowerCase().includes('support')
    ? 'support'
    : String(role).toLowerCase().includes('content') || String(role).toLowerCase().includes('viewer')
    ? 'viewer'
    : String(role).toLowerCase().includes('owner')
    ? 'owner'
    : 'admin';

  const targetUser = await User.findById(id);
  if (!targetUser || targetUser.role !== 'admin') {
    return next(new ApiError(404, 'Administrator account not found'));
  }

  // Prevent demoting the last active owner
  if (targetUser.adminRole === ADMIN_ROLES.OWNER && normalizedRole !== ADMIN_ROLES.OWNER) {
    const ownerCount = await User.countDocuments({
      role: 'admin',
      adminRole: ADMIN_ROLES.OWNER,
      status: 'active',
      isActive: true,
    });
    if (ownerCount <= 1) {
      return next(new ApiError(400, 'Cannot demote the last active store owner'));
    }
  }

  const oldRole = targetUser.adminRole;
  targetUser.adminRole = normalizedRole;
  targetUser.tokenVersion = (targetUser.tokenVersion || 0) + 1; // Invalidate affected user sessions immediately
  await targetUser.save();

  await AuditLog.create({
    action: 'role_change',
    section: 'team',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: String(targetUser._id),
    changes: [{ field: 'adminRole', oldValue: oldRole, newValue: normalizedRole }],
    ipAddress: req.ip || '',
  });

  res.status(200).json({ success: true, message: `Member role updated to ${normalizedRole}` });
});

export const updateMemberStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // 'active' or 'deactivated'
  const actorRole = req.user.adminRole || 'owner';

  if (actorRole !== ADMIN_ROLES.OWNER) {
    return next(new ApiError(403, 'Only owners can modify account status'));
  }

  const targetUser = await User.findById(id);
  if (!targetUser || targetUser.role !== 'admin') {
    return next(new ApiError(404, 'Administrator account not found'));
  }

  if (status === 'deactivated' && targetUser.adminRole === ADMIN_ROLES.OWNER) {
    const ownerCount = await User.countDocuments({
      role: 'admin',
      adminRole: ADMIN_ROLES.OWNER,
      status: 'active',
      isActive: true,
    });
    if (ownerCount <= 1) {
      return next(new ApiError(400, 'Cannot deactivate the last active store owner'));
    }
  }

  const oldStatus = targetUser.status;
  targetUser.status = status;
  targetUser.isActive = status === 'active';
  targetUser.tokenVersion = (targetUser.tokenVersion || 0) + 1; // Invalidate sessions immediately
  await targetUser.save();

  await AuditLog.create({
    action: 'status_change',
    section: 'team',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: String(targetUser._id),
    changes: [{ field: 'status', oldValue: oldStatus, newValue: status }],
    ipAddress: req.ip || '',
  });

  res.status(200).json({ success: true, message: `Member status updated to ${status}` });
});

export const deleteMember = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const actorRole = req.user.adminRole || 'owner';

  if (actorRole !== ADMIN_ROLES.OWNER) {
    return next(new ApiError(403, 'Only owners can remove team members'));
  }

  const targetUser = await User.findById(id);
  if (!targetUser || targetUser.role !== 'admin') {
    return next(new ApiError(404, 'Administrator account not found'));
  }

  if (targetUser.adminRole === ADMIN_ROLES.OWNER) {
    const ownerCount = await User.countDocuments({
      role: 'admin',
      adminRole: ADMIN_ROLES.OWNER,
      status: 'active',
      isActive: true,
    });
    if (ownerCount <= 1) {
      return next(new ApiError(400, 'Cannot remove the last active store owner'));
    }
  }

  targetUser.tokenVersion = (targetUser.tokenVersion || 0) + 1;
  await targetUser.save();
  await User.findByIdAndDelete(id);

  await AuditLog.create({
    action: 'member_removed',
    section: 'team',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: String(targetUser._id),
    ipAddress: req.ip || '',
  });

  res.status(200).json({ success: true, message: 'Member removed successfully' });
});

export const getRolePermissionsMatrix = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      permissions: ROLE_PERMISSIONS,
    },
  });
});
