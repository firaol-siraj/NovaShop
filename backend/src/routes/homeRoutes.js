import express from 'express';
import {
  getHeroBanner,
  updateHeroBanner,
  getPublicHomepageLayout,
  getPublicHeroSlides,
  trackHeroSlideEvent,
  subscribeNewsletter,
  confirmNewsletter,
  unsubscribeNewsletter,
} from '../controllers/homeController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import { heroBannerSchema } from '../validators/homeValidator.js';
import { cacheMiddleware } from '../middlewares/cacheMiddleware.js';

const router = express.Router();

// Public homepage resolved layout
router.get(['/layout', '/'], cacheMiddleware('home', 60), getPublicHomepageLayout);

// Public hero slides carousel
router.get('/hero-slides', cacheMiddleware('home', 60), getPublicHeroSlides);

// Legacy campaign banner
router
  .route('/hero')
  .get(cacheMiddleware('home', 300), getHeroBanner)
  .put(protect, restrictTo('admin'), validate(heroBannerSchema, 'body'), updateHeroBanner);

// Telemetry
router.post('/track/hero', trackHeroSlideEvent);

// Newsletter subscription
router.post('/subscribe', subscribeNewsletter);
router.get('/confirm', confirmNewsletter);
router.get('/newsletter/confirm', confirmNewsletter);
router.get('/unsubscribe', unsubscribeNewsletter);

export default router;
