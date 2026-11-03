import express from 'express';
import {
  getAdminShippingStats,
  getAdminZones,
  getAdminZoneById,
  createAdminZone,
  updateAdminZone,
  deleteAdminZone,
  getAdminMethods,
  getAdminMethodById,
  createAdminMethod,
  updateAdminMethod,
  deleteAdminMethod,
  getAdminRates,
  createAdminRate,
  updateAdminRate,
  deleteAdminRate,
  getAdminDeliveryTimes,
  updateAdminDeliveryTimes,
  getAdminShippingSettings,
  updateAdminShippingSettings,
} from '../controllers/adminShippingController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', getAdminShippingStats);

router.route('/zones')
  .get(getAdminZones)
  .post(createAdminZone);

router.route('/zones/:id')
  .get(getAdminZoneById)
  .put(updateAdminZone)
  .delete(deleteAdminZone);

router.route('/methods')
  .get(getAdminMethods)
  .post(createAdminMethod);

router.route('/methods/:id')
  .get(getAdminMethodById)
  .put(updateAdminMethod)
  .delete(deleteAdminMethod);

router.route('/rates')
  .get(getAdminRates)
  .post(createAdminRate);

router.route('/rates/:id')
  .put(updateAdminRate)
  .delete(deleteAdminRate);

router.route('/delivery-times')
  .get(getAdminDeliveryTimes);

router.put('/delivery-times/:zoneId', updateAdminDeliveryTimes);

router.route('/settings')
  .get(getAdminShippingSettings)
  .put(updateAdminShippingSettings);

export default router;
