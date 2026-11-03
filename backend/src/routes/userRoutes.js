import express from 'express';
import {
  getMe,
  updateProfile,
  updatePassword,
  getOverview,
  getSettings,
  updateSettings,
  deleteMyAccount,
  unsubscribePromotional,
  sendAdminTestEmail,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect, protectCustomer, protectAdmin } from '../middlewares/authMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.get('/unsubscribe', unsubscribePromotional);

// ==========================================
// CUSTOMER-FACING ROUTES (Customer Token Required)
// ==========================================
router.route('/me').get(protectCustomer, getMe).patch(protectCustomer, updateProfile).delete(protectCustomer, deleteMyAccount);
router.route('/me/password').patch(protect, authLimiter, updatePassword);
router.route('/me/overview').get(protectCustomer, getOverview);
router.route('/me/settings').get(protectCustomer, getSettings).patch(protectCustomer, updateSettings);

// Admin email testing endpoint
router.route('/admin/test-email').post(protectAdmin, sendAdminTestEmail);

// ==========================================
// ADMIN USER MANAGEMENT ROUTES (Admin Role Required)
// ==========================================
router.route('/').get(protectAdmin, getUsers);

router
  .route('/:id')
  .get(protectAdmin, getUserById)
  .put(protectAdmin, updateUser)
  .delete(protectAdmin, deleteUser);

export default router;
