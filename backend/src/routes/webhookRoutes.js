import express from 'express';
import { handleInboundEmailWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Inbound email webhook endpoint (accepts SendGrid, Postmark, Mailgun, or simulator JSON)
router.post('/inbound-email', handleInboundEmailWebhook);

export default router;
