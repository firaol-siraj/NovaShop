import express from 'express';
import { protectAdmin } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import {
  analyticsQuerySchema,
  productAnalyticsQuerySchema,
  exportAnalyticsQuerySchema,
} from '../validators/adminAnalyticsValidator.js';
import {
  getAnalyticsOverview,
  getSalesAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  exportAnalyticsReport,
} from '../controllers/adminAnalyticsController.js';

const router = express.Router();

// Enforce admin-only access on all endpoints: JWT with role=admin, rejects customer tokens
router.use(protectAdmin);

router.get('/overview', validate(analyticsQuerySchema, 'query'), getAnalyticsOverview);
router.get('/sales', validate(analyticsQuerySchema, 'query'), getSalesAnalytics);
router.get('/products', validate(productAnalyticsQuerySchema, 'query'), getProductAnalytics);
router.get('/customers', validate(analyticsQuerySchema, 'query'), getCustomerAnalytics);
router.get('/export', validate(exportAnalyticsQuerySchema, 'query'), exportAnalyticsReport);

export default router;
