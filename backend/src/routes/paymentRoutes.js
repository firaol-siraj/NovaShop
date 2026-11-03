import express from 'express';
import { getMyPayments } from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/my').get(getMyPayments);

export default router;
