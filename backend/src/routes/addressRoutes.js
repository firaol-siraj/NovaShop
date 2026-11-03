import express from 'express';
import {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/addressController.js';
import { protectCustomer } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protectCustomer);

router.route('/')
  .get(getAddresses)
  .post(createAddress);

router.route('/:id')
  .get(getAddressById)
  .patch(updateAddress)
  .put(updateAddress)
  .delete(deleteAddress);

router.route('/:id/set-default')
  .patch(setDefaultAddress);

export default router;
