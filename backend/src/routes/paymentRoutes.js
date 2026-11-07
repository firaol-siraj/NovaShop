import express from 'express';
import { getMyPayments } from '../controllers/paymentController.js';
import { handleChapaWebhook } from '../controllers/orderController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public payment gateway webhooks (e.g., Chapa)
// Authenticated via HMAC signature headers (x-chapa-signature), NOT JWT Bearer tokens
router.post('/chapa/webhook', handleChapaWebhook);
router.post('/webhook/chapa', handleChapaWebhook);
router.post('/webhook', handleChapaWebhook);

// Protected routes (require customer or admin JWT)
router.use(protect);

router.route('/my').get(getMyPayments);

export default router;
