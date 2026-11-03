import express from 'express';
import { protectOptional } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import { validateDiscountSchema } from '../validators/discountValidator.js';
import { validateDiscountEndpoint } from '../controllers/discountController.js';

const router = express.Router();

// Public / Customer endpoint to validate a discount code for current cart
router.post('/validate', protectOptional, validate(validateDiscountSchema, 'body'), validateDiscountEndpoint);

export default router;
