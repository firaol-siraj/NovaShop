import express from 'express';
import multer from 'multer';
import upload from '../middlewares/uploadMiddleware.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import { deleteProductImage } from '../services/productImageService.js';
import ApiError from '../utils/ApiError.js';

const router = express.Router();

const requireCloudinaryConfiguration = (req, res, next) => {
  if (!isCloudinaryConfigured()) {
    return next(new ApiError(503, 'Image uploads are not configured'));
  }
  next();
};

const parseProductImage = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 5 MB or smaller'
        : 'Invalid image upload request';
      return next(new ApiError(statusCode, message));
    }
    next(error);
  });
};

// Only authenticated admins should be allowed to upload product images
/**
 * @openapi
 * /upload:
 *   post:
 *     summary: Upload a product image to Cloudinary (Admin only)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload (JPEG, PNG, WebP)
 *     responses:
 *       200:
 *         description: Image uploaded successfully to Cloudinary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Image uploaded successfully to Cloudinary
 *                 image:
 *                   type: string
 *                   example: https://res.cloudinary.com/demo/image/upload/v1700000000/sample.jpg
 *                 publicId:
 *                   type: string
 *                   example: novashop/products/sample
 *                 bytes:
 *                   type: integer
 *                   example: 245760
 *       400:
 *         description: Bad Request (No file provided or unsupported file format)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: No image file provided
 *       401:
 *         description: Unauthorized (Missing or invalid token)
 *       403:
 *         description: Forbidden (Requires Admin privileges)
 *       413:
 *         description: Image exceeds the 5 MB upload limit
 */
router.post(
  '/',
  protect,
  restrictTo('admin'),
  requireCloudinaryConfiguration,
  parseProductImage,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    if (!req.file.path || !req.file.filename) {
      return res.status(502).json({ success: false, message: 'Cloudinary upload returned incomplete image data' });
    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully to Cloudinary',
      image: req.file.path,
      publicId: req.file.filename,
      bytes: req.file.size,
    });
  }
);

/**
 * @openapi
 * /upload:
 *   delete:
 *     summary: Delete an unreferenced product image (Admin only)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicId]
 *             properties:
 *               publicId:
 *                 type: string
 *                 example: novashop/products/sample
 *     responses:
 *       200:
 *         description: Unreferenced product image deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 *       409:
 *         description: Image is still referenced by a product
 */
router.delete('/', protect, restrictTo('admin'), requireCloudinaryConfiguration, async (req, res, next) => {
  try {
    await deleteProductImage(req.body?.publicId);
    res.status(200).json({ success: true, message: 'Product image deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;