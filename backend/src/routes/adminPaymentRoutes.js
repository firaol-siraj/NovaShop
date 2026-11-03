import express from 'express';
import {
  getAdminPaymentStats,
  getAdminPaymentDetail,
  getAdminTransactions,
  getAdminPayouts,
  getAdminPayoutDetail,
  recordAdminPayout,
  getAdminPaymentMethods,
  reverifyPaymentTransaction,
  resendPaymentReceipt,
  exportTransactionsCsv,
  getPaymentSettings,
  updatePaymentSettings,
} from '../controllers/adminPaymentController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', getAdminTransactions);
router.get('/stats', getAdminPaymentStats);
router.get('/transactions', getAdminTransactions);
router.get('/payouts', getAdminPayouts);
router.post('/payouts', recordAdminPayout);
router.get('/payouts/:id', getAdminPayoutDetail);
router.get('/methods', getAdminPaymentMethods);
router.post('/reverify', reverifyPaymentTransaction);
router.post('/resend-receipt', resendPaymentReceipt);
router.get('/export', exportTransactionsCsv);
router.route('/settings')
  .get(getPaymentSettings)
  .put(updatePaymentSettings);

router.get('/:id', getAdminPaymentDetail);
router.post('/:id/verify', reverifyPaymentTransaction);
router.post('/:id/resend-receipt', resendPaymentReceipt);

export default router;
