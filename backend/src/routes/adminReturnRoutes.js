import express from 'express';
import {
  getAdminReturnStats,
  getAdminReturns,
  getAdminReturnById,
  approveReturn,
  rejectReturn,
  receiveReturn,
  processRefund,
  addAdminNote,
  bulkUpdateReturnStatus,
  exportReturnsCsv,
} from '../controllers/adminReturnController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/permissionMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', requirePermission('returns', 'read'), getAdminReturnStats);
router.get('/', requirePermission('returns', 'read'), getAdminReturns);
router.get('/export', requirePermission('returns', 'read'), exportReturnsCsv);
router.post('/bulk-status', requirePermission('returns', 'write'), bulkUpdateReturnStatus);
router.get('/:id', requirePermission('returns', 'read'), getAdminReturnById);
router.post('/:id/approve', requirePermission('returns', 'write'), approveReturn);
router.post('/:id/reject', requirePermission('returns', 'write'), rejectReturn);
router.post('/:id/receive', requirePermission('returns', 'write'), receiveReturn);
router.post('/:id/refund', requirePermission('returns', 'write'), processRefund);
router.post('/:id/notes', requirePermission('returns', 'write'), addAdminNote);

export default router;
