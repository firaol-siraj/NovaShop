import express from 'express';
import {
  submitReturnRequest,
  getMyReturns,
  getReturnForOrder,
} from '../controllers/returnController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', submitReturnRequest);
router.get('/my', getMyReturns);
router.get('/order/:orderId', getReturnForOrder);

export default router;
