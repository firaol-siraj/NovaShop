import express from 'express';
import validate from '../middlewares/validateMiddleware.js';
import { trackEventSchema } from '../validators/trackingValidator.js';
import { trackEvent } from '../controllers/trackingController.js';

const router = express.Router();

// Public, rate-limited endpoint for storefront telemetry
router.post('/', validate(trackEventSchema, 'body'), trackEvent);

export default router;
