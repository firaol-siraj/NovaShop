import ApiError from '../utils/ApiError.js';
import cloudinary from '../config/cloudinary.js';
import Product from '../models/productModel.js';

const PRODUCT_IMAGE_PUBLIC_ID = /^novashop\/products\/[A-Za-z0-9_.-]+$/;

export const deleteProductImage = async (publicId) => {
  if (typeof publicId !== 'string' || !PRODUCT_IMAGE_PUBLIC_ID.test(publicId)) {
    throw new ApiError(400, 'Invalid product image public ID');
  }

  if (await Product.exists({ imagePublicIds: publicId })) {
    throw new ApiError(409, 'Product image is still in use');
  }

  const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
  if (!['ok', 'not found'].includes(result.result)) {
    throw new ApiError(502, 'Cloudinary could not delete the product image');
  }

  return result.result;
};

export const deleteProductImages = async (publicIds = []) => {
  const uniqueIds = [...new Set(publicIds.filter(Boolean))];
  const results = await Promise.allSettled(uniqueIds.map(deleteProductImage));
  const failures = results.filter((result) => result.status === 'rejected');

  if (failures.length) {
    throw failures[0].reason;
  }
};
