import express from 'express';
import { getShippingQuote } from '../controllers/shippingController.js';

const router = express.Router();

router.post('/quote', getShippingQuote);

export default router;
