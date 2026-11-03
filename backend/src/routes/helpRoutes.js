import express from 'express';
import { getFaqs, getPublicSettings } from '../controllers/helpController.js';

const router = express.Router();

router.get('/faqs', getFaqs);
router.get('/settings', getPublicSettings);

export default router;
