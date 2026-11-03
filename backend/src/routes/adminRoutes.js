import express from 'express';
import { protectAdmin } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/permissionMiddleware.js';
import {
  getAdminSettingsHandler,
  updateAdminSettingsHandler,
} from '../controllers/settingsController.js';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
} from '../controllers/adminNotificationController.js';
import adminTeamRoutes from './adminTeamRoutes.js';
import validate from '../middlewares/validateMiddleware.js';
import {
  summaryQuerySchema,
  revenueQuerySchema,
  topProductsQuerySchema,
  inventoryAlertsQuerySchema,
  fulfillmentQueueQuerySchema,
  dispatchOrdersSchema,
  adminOrdersQuerySchema,
  searchQuerySchema,
  exportReportSchema,
  adminProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  bulkProductStatusSchema,
  adminCategoriesQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  adminCustomersQuerySchema,
  updateCustomerStatusSchema,
  updateCustomerProfileSchema,
  createCustomerSchema,
  sendCustomerEmailSchema,
  adminInventoryQuerySchema,
  adjustStockSchema,
  bulkRestockSchema,
  inventorySettingsSchema,
  variantThresholdSchema,
  adminNotificationsQuerySchema,
  updateAdminMeSchema,
  updateAdminPasswordSchema,
} from '../validators/adminValidator.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import {
  getAdminMe,
  updateAdminMe,
  updateAdminPassword,
  uploadAdminAvatar,
  deleteAdminAvatar,
  getAdminSessions,
  revokeAdminSession,
  getAdminActivity,
  uploadAvatarMiddleware,
} from '../controllers/adminProfileController.js';
import {
  getDashboardSummary,
  getRevenueVelocity,
  getTopProducts,
  getInventoryAlerts,
  getFulfillmentQueue,
  dispatchOrders,
  getAdminOrdersList,
  getAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  globalAdminSearch,
  exportReport,
} from '../controllers/adminDashboardController.js';
import {
  getAdminProductsList,
  createAdminProduct,
  getAdminProductById,
  updateAdminProduct,
  deleteAdminProduct,
  updateProductStatus,
  bulkUpdateProductStatus,
  duplicateAdminProduct,
  getAdminCategoriesList,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  reorderAdminCategories,
  getAdminCustomersList,
  getAdminCustomerById,
  createAdminCustomer,
  updateAdminCustomer,
  updateCustomerStatus,
  resendCustomerInvite,
  resendCustomerVerificationEmail,
  sendCustomerAdminEmail,
  retryCustomerAdminEmail,
  deleteAdminCustomer,
  getAdminInventoryList,
  adjustStockAction,
  bulkRestockAction,
  getVariantMovementsList,
  updateVariantThresholdAction,
  exportInventoryCsv,
  getInventorySettings,
  updateInventorySettings,
  getAdminNotificationsPaginated,
  deleteAdminNotification,
} from '../controllers/adminController.js';
import { deleteUser } from '../controllers/userController.js';
import {
  adminReviewsQuerySchema,
  updateReviewStatusSchema,
  reviewReplySchema,
  bulkReviewsSchema,
} from '../validators/reviewValidator.js';
import {
  adminDiscountsQuerySchema,
  createDiscountSchema,
  updateDiscountSchema,
  bulkDiscountsSchema,
} from '../validators/discountValidator.js';
import {
  getAdminReviewsList,
  getAdminReviewStats,
  updateReviewStatus,
  replyToReview,
  deleteReviewReply,
  toggleStarReview,
  deleteReview,
  bulkUpdateReviews,
  exportReviewsCsv,
} from '../controllers/reviewController.js';
import {
  getAdminDiscountsList,
  getAdminDiscountStats,
  createAdminDiscount,
  getAdminDiscountById,
  getDiscountRedemptionsList,
  updateAdminDiscount,
  duplicateAdminDiscount,
  endAdminDiscount,
  deleteAdminDiscount,
  bulkUpdateDiscounts,
  exportDiscountsCsv,
} from '../controllers/discountController.js';
import adminAnalyticsRoutes from './adminAnalyticsRoutes.js';
import adminMediaRoutes from './adminMediaRoutes.js';
import adminHeroSlideRoutes from './adminHeroSlideRoutes.js';
import adminHomepageRoutes from './adminHomepageRoutes.js';

const router = express.Router();

// Enforce admin-only access on all endpoints: JWT with role=admin, rejects customer tokens
router.use(protectAdmin);

// ==========================================
// ADMIN PROFILE & SESSIONS
// ==========================================
router.get('/me', getAdminMe);
router.patch('/me', validate(updateAdminMeSchema, 'body'), updateAdminMe);
router.patch('/me/password', authLimiter, validate(updateAdminPasswordSchema, 'body'), updateAdminPassword);
router.post('/me/avatar', uploadAvatarMiddleware, uploadAdminAvatar);
router.delete('/me/avatar', deleteAdminAvatar);
router.get('/me/sessions', getAdminSessions);
router.delete('/me/sessions/:id', revokeAdminSession);
router.get('/me/activity', getAdminActivity);

// ==========================================
// CONTENT & MEDIA ENDPOINTS
// ==========================================
router.use('/media', adminMediaRoutes);
router.use('/hero-slides', adminHeroSlideRoutes);
router.use('/homepage', adminHomepageRoutes);

// ==========================================
// ANALYTICS ENDPOINTS
// ==========================================
router.use('/analytics', adminAnalyticsRoutes);

// ==========================================
// DASHBOARD ENDPOINTS
// ==========================================
router.get('/dashboard/summary', validate(summaryQuerySchema, 'query'), getDashboardSummary);
router.get('/dashboard/revenue', validate(revenueQuerySchema, 'query'), getRevenueVelocity);
router.get('/dashboard/top-products', validate(topProductsQuerySchema, 'query'), getTopProducts);
router.get('/dashboard/inventory-alerts', validate(inventoryAlertsQuerySchema, 'query'), getInventoryAlerts);
router.get('/dashboard/fulfillment-queue', validate(fulfillmentQueueQuerySchema, 'query'), getFulfillmentQueue);
router.post('/orders/dispatch', validate(dispatchOrdersSchema, 'body'), dispatchOrders);
router.post('/dashboard/dispatch-all', validate(dispatchOrdersSchema, 'body'), dispatchOrders);
router.get('/orders', validate(adminOrdersQuerySchema, 'query'), getAdminOrdersList);

// ==========================================
// NOTIFICATIONS
// ==========================================
router.get('/notifications', getAdminNotifications);
router.get('/notifications/all', validate(adminNotificationsQuerySchema, 'query'), getAdminNotificationsPaginated);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationRead);
router.delete('/notifications/:id', deleteAdminNotification);

// ==========================================
// GLOBAL SEARCH & REPORTS
// ==========================================
router.get('/search', validate(searchQuerySchema, 'query'), globalAdminSearch);
router.get('/reports/export', validate(exportReportSchema, 'query'), exportReport);

// ==========================================
// PRODUCTS ENDPOINTS
// ==========================================
router.get('/products', validate(adminProductsQuerySchema, 'query'), getAdminProductsList);
router.post('/products', validate(createProductSchema, 'body'), createAdminProduct);
router.post('/products/bulk-status', validate(bulkProductStatusSchema, 'body'), bulkUpdateProductStatus);
router.post('/products/:id/duplicate', duplicateAdminProduct);
router.patch('/products/:id/status', updateProductStatus);
router.get('/products/:id', getAdminProductById);
router.put('/products/:id', validate(updateProductSchema, 'body'), updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);

// ==========================================
// CATEGORIES ENDPOINTS
// ==========================================
router.get('/categories', validate(adminCategoriesQuerySchema, 'query'), getAdminCategoriesList);
router.post('/categories', validate(createCategorySchema, 'body'), createAdminCategory);
router.patch('/categories/reorder', validate(reorderCategoriesSchema, 'body'), reorderAdminCategories);
router.put('/categories/:id', validate(updateCategorySchema, 'body'), updateAdminCategory);
router.delete('/categories/:id', deleteAdminCategory);

// ==========================================
// CUSTOMERS ENDPOINTS
// ==========================================
router.get('/customers', requirePermission('customers', 'read'), validate(adminCustomersQuerySchema, 'query'), getAdminCustomersList);
router.post('/customers', requirePermission('customers', 'create'), validate(createCustomerSchema, 'body'), createAdminCustomer);
router.get('/customers/:id', requirePermission('customers', 'read'), getAdminCustomerById);
router.patch('/customers/:id', requirePermission('customers', 'update'), validate(updateCustomerProfileSchema, 'body'), updateAdminCustomer);
router.patch('/customers/:id/status', requirePermission('customers', 'update'), validate(updateCustomerStatusSchema, 'body'), updateCustomerStatus);
router.post('/customers/:id/resend-invite', requirePermission('customers', 'update'), resendCustomerInvite);
router.post('/customers/:id/resend-verification', requirePermission('customers', 'update'), resendCustomerVerificationEmail);
router.post('/customers/:id/email', requirePermission('customers', 'email'), validate(sendCustomerEmailSchema, 'body'), sendCustomerAdminEmail);
router.post('/customers/:id/email/:logId/retry', requirePermission('customers', 'email'), retryCustomerAdminEmail);
router.delete('/customers/:id', requirePermission('customers', 'delete'), deleteAdminCustomer);

// ==========================================
// INVENTORY & SETTINGS ENDPOINTS
// ==========================================
router.get('/inventory', validate(adminInventoryQuerySchema, 'query'), getAdminInventoryList);
router.post('/inventory/adjust', validate(adjustStockSchema, 'body'), adjustStockAction);
router.post('/inventory/bulk-restock', validate(bulkRestockSchema, 'body'), bulkRestockAction);
router.get('/inventory/movements', getVariantMovementsList);
router.get('/inventory/movements/:variantId', getVariantMovementsList);
router.patch('/inventory/variants/:variantId/threshold', validate(variantThresholdSchema, 'body'), updateVariantThresholdAction);
router.get('/inventory/export', exportInventoryCsv);
router.get('/settings/inventory', getInventorySettings);
router.patch('/settings/inventory', validate(inventorySettingsSchema, 'body'), updateInventorySettings);

// Store-wide Settings & Operations Endpoints
router.get('/settings', requirePermission('settings', 'read'), getAdminSettingsHandler);
router.patch('/settings/:section', requirePermission('settings', 'write'), updateAdminSettingsHandler);
router.use('/settings/team', adminTeamRoutes);
router.get('/settings/notifications/preferences', getNotificationPreferences);
router.patch('/settings/notifications/preferences', updateNotificationPreferences);
router.post('/settings/notifications/test-email', requirePermission('settings', 'write'), sendTestNotification);

// ==========================================
// REVIEWS ENDPOINTS
// ==========================================
router.get('/reviews', requirePermission('reviews', 'read'), validate(adminReviewsQuerySchema, 'query'), getAdminReviewsList);
router.get('/reviews/stats', requirePermission('reviews', 'read'), getAdminReviewStats);
router.get('/reviews/export', requirePermission('reviews', 'read'), exportReviewsCsv);
router.post('/reviews/bulk', requirePermission('reviews', 'write'), validate(bulkReviewsSchema, 'body'), bulkUpdateReviews);
router.patch('/reviews/:id/status', requirePermission('reviews', 'write'), validate(updateReviewStatusSchema, 'body'), updateReviewStatus);
router.post('/reviews/:id/reply', requirePermission('reviews', 'write'), validate(reviewReplySchema, 'body'), replyToReview);
router.delete('/reviews/:id/reply', requirePermission('reviews', 'write'), deleteReviewReply);
router.patch('/reviews/:id/star', requirePermission('reviews', 'write'), toggleStarReview);
router.delete('/reviews/:id', requirePermission('reviews', 'write'), deleteReview);

// ==========================================
// DISCOUNTS ENDPOINTS
// ==========================================
router.get('/discounts', validate(adminDiscountsQuerySchema, 'query'), getAdminDiscountsList);
router.get('/discounts/stats', getAdminDiscountStats);
router.get('/discounts/export', exportDiscountsCsv);
router.post('/discounts', validate(createDiscountSchema, 'body'), createAdminDiscount);
router.post('/discounts/bulk', validate(bulkDiscountsSchema, 'body'), bulkUpdateDiscounts);
router.get('/discounts/:id', getAdminDiscountById);
router.get('/discounts/:id/redemptions', getDiscountRedemptionsList);
router.put('/discounts/:id', validate(updateDiscountSchema, 'body'), updateAdminDiscount);
router.patch('/discounts/:id', validate(updateDiscountSchema, 'body'), updateAdminDiscount);
router.post('/discounts/:id/duplicate', duplicateAdminDiscount);
router.patch('/discounts/:id/end', endAdminDiscount);
router.delete('/discounts/:id', deleteAdminDiscount);

export default router;
