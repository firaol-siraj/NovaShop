import express from 'express';
import {
  subscribeNewsletter,
  confirmNewsletter,
  unsubscribeNewsletter,
} from '../controllers/homeController.js';

const router = express.Router();

// Newsletter subscription API endpoints
router.post('/subscribe', subscribeNewsletter);
router.get('/confirm', confirmNewsletter);
router.get('/unsubscribe', unsubscribeNewsletter);
router.post('/unsubscribe', unsubscribeNewsletter);

export default router;
