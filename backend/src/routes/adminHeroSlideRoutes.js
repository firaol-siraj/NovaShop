import express from 'express';
import {
  getAdminHeroSlidesList,
  getAdminHeroSlideStats,
  createHeroSlide,
  getHeroSlideById,
  updateHeroSlide,
  duplicateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
  bulkHeroSlideActions,
  getPreviewToken,
} from '../controllers/adminHeroSlideController.js';

const router = express.Router();

router.get('/stats', getAdminHeroSlideStats);
router.get('/preview-token', getPreviewToken);
router.route('/reorder')
  .put(reorderHeroSlides)
  .patch(reorderHeroSlides);
router.post('/bulk', bulkHeroSlideActions);

router.route('/')
  .get(getAdminHeroSlidesList)
  .post(createHeroSlide);

router.route('/:id')
  .get(getHeroSlideById)
  .put(updateHeroSlide)
  .delete(deleteHeroSlide);

router.post('/:id/duplicate', duplicateHeroSlide);

export default router;
