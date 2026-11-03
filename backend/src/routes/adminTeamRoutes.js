import express from 'express';
import { protectAdmin } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/permissionMiddleware.js';
import {
  getTeamMembers,
  inviteTeamMember,
  resendInvite,
  revokeInvite,
  updateMemberRole,
  updateMemberStatus,
  deleteMember,
  getRolePermissionsMatrix,
} from '../controllers/adminTeamController.js';

const router = express.Router();

router.use(protectAdmin);

router.get('/members', requirePermission('settings', 'read'), getTeamMembers);
router.post('/invite', requirePermission('settings', 'team'), inviteTeamMember);
router.post('/invites/:id/resend', requirePermission('settings', 'team'), resendInvite);
router.delete('/invites/:id', requirePermission('settings', 'team'), revokeInvite);
router.patch('/members/:id/role', requirePermission('settings', 'team'), updateMemberRole);
router.patch('/members/:id/status', requirePermission('settings', 'team'), updateMemberStatus);
router.delete('/members/:id', requirePermission('settings', 'team'), deleteMember);
router.get('/permissions', getRolePermissionsMatrix);

export default router;
