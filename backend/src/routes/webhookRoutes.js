import express from 'express';
import { handleInboundEmailWebhook } from '../controllers/webhookController.js';
import { handleChapaWebhook } from '../controllers/orderController.js';

const router = express.Router();

// Inbound email webhook endpoint (accepts SendGrid, Postmark, Mailgun, or simulator JSON)
router.post('/inbound-email', handleInboundEmailWebhook);

// Payment gateway webhook endpoints mounted under /api/v1/webhooks
router.post('/chapa', handleChapaWebhook);
router.post('/chapa/webhook', handleChapaWebhook);

export default router;
