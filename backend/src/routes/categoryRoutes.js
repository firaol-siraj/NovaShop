import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import { createCategorySchema, updateCategorySchema } from '../validators/categoryValidator.js';

const router = express.Router();

router
  .route('/')
  /**
   * @openapi
   * /categories:
   *   get:
   *     summary: Fetch all categories
   *     tags: [Categories]
   *     responses:
   *       200:
   *         description: List of categories retrieved successfully
   */
  .get(getCategories)
  /**
   * @openapi
   * /categories:
   *   post:
   *     summary: Create a new category (Admin only)
   *     tags: [Categories]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *                 example: Hoodies
   *               slug:
   *                 type: string
   *                 example: hoodies
   *               description:
   *                 type: string
   *                 example: Comfortable heavyweight streetwear hoodies.
   *               image:
   *                 type: string
   *                 example: https://images.unsplash.com/photo-1556905055-8f358a7a47b2
   *     responses:
   *       201:
   *         description: Category created successfully
   *       400:
   *         description: Duplicate category name or slug
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   */
  .post(protect, restrictTo('admin'), validate(createCategorySchema), createCategory);

router
  .route('/:id')
  /**
   * @openapi
   * /categories/{id}:
   *   get:
   *     summary: Fetch category by ID or Slug
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Category retrieved successfully
   *       404:
   *         description: Category not found
   */
  .get(getCategoryById)
  /**
   * @openapi
   * /categories/{id}:
   *   put:
   *     summary: Update category (Admin only)
   *     tags: [Categories]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Category updated successfully
   *       404:
   *         description: Category not found
   */
  .put(protect, restrictTo('admin'), validate(updateCategorySchema), updateCategory)
  /**
   * @openapi
   * /categories/{id}:
   *   delete:
   *     summary: Delete category (Admin only)
   *     tags: [Categories]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Category deleted successfully
   *       400:
   *         description: Category is referenced by products
   *       404:
   *         description: Category not found
   */
  .delete(protect, restrictTo('admin'), deleteCategory);

export default router;
