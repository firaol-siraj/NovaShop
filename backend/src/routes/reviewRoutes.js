import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import { createReviewSchema } from '../validators/reviewValidator.js';
import {
  createReview,
  checkUserReviewEligibility,
} from '../controllers/reviewController.js';

const router = express.Router();

router.post('/', protect, validate(createReviewSchema, 'body'), createReview);
router.get('/check-eligibility/:productId', protect, checkUserReviewEligibility);

export default router;
