import express from 'express';
import {
  getPublicSettingsHandler,
  getCountriesHandler,
  getAdminSettingsHandler,
  updateAdminSettingsHandler,
} from '../controllers/settingsController.js';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
} from '../controllers/adminNotificationController.js';
import { protectAdmin } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/permissionMiddleware.js';
import adminTeamRoutes from './adminTeamRoutes.js';

const router = express.Router();

// ==========================================
// PUBLIC SETTINGS ENDPOINTS
// ==========================================
router.get('/public', getPublicSettingsHandler);
router.get('/countries', getCountriesHandler);

// ==========================================
// ADMIN SETTINGS ENDPOINTS
// ==========================================
router.get(
  '/admin',
  protectAdmin,
  requirePermission('settings', 'read'),
  getAdminSettingsHandler
);

router.patch(
  '/admin/:section',
  protectAdmin,
  requirePermission('settings', 'write'),
  updateAdminSettingsHandler
);

// Admin Team & Permissions sub-routes
router.use('/admin/team', adminTeamRoutes);

// Admin Notification Preferences sub-routes
router.get(
  '/admin/notifications/preferences',
  protectAdmin,
  getNotificationPreferences
);

router.patch(
  '/admin/notifications/preferences',
  protectAdmin,
  updateNotificationPreferences
);

router.post(
  '/admin/notifications/test-email',
  protectAdmin,
  requirePermission('settings', 'write'),
  sendTestNotification
);

export default router;
