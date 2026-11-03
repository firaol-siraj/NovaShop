import express from 'express';
import {
  getAdminHomepage,
  updateAdminHomepageDraft,
  publishAdminHomepage,
  discardAdminHomepage,
  getAdminSubscribers,
} from '../controllers/adminHomepageController.js';

const router = express.Router();

router.get('/subscribers', getAdminSubscribers);
router.route('/')
  .get(getAdminHomepage)
  .put(updateAdminHomepageDraft);
router.put('/draft', updateAdminHomepageDraft);
router.post('/publish', publishAdminHomepage);
router.post('/discard', discardAdminHomepage);

export default router;
