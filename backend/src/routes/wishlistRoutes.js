import express from 'express';
import {
  getWishlist,
  addWishlistItem,
  mergeWishlist,
  removeWishlistItem,
  clearWishlist,
} from '../controllers/wishlistController.js';
import { protect } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import {
  addWishlistItemSchema,
  mergeWishlistSchema,
  productIdParamSchema,
} from '../validators/wishlistValidator.js';

const router = express.Router();

// All wishlist routes require authentication. Note: these routes are
// user-specific and must never be served through the shared Redis cache.
router.use(protect);

router
  .route('/')
  /**
   * @openapi
   * /wishlist:
   *   get:
   *     summary: Get current user's wishlist (active products only)
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Wishlist retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  .get(getWishlist)
  /**
   * @openapi
   * /wishlist:
   *   delete:
   *     summary: Clear the user's wishlist
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Wishlist cleared
   *       401:
   *         description: Unauthorized
   */
  .delete(clearWishlist);

router
  .route('/items')
  /**
   * @openapi
   * /wishlist/items:
   *   post:
   *     summary: Add a product to the wishlist (idempotent)
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [productId]
   *             properties:
   *               productId:
   *                 type: string
   *                 example: 66ce78a19b2e3f412c12a8bc
   *     responses:
   *       200:
   *         description: Product added (or already present)
   *       400:
   *         description: Product not available or wishlist full
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Product not found
   */
  .post(validate(addWishlistItemSchema), addWishlistItem);

router
  .route('/merge')
  /**
   * @openapi
   * /wishlist/merge:
   *   post:
   *     summary: Merge guest wishlist product ids (login flow, idempotent)
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [productIds]
   *             properties:
   *               productIds:
   *                 type: array
   *                 maxItems: 200
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Wishlist merged; invalid ids ignored
   *       401:
   *         description: Unauthorized
   */
  .post(validate(mergeWishlistSchema), mergeWishlist);

router
  .route('/items/:productId')
  /**
   * @openapi
   * /wishlist/items/{productId}:
   *   delete:
   *     summary: Remove a product from the wishlist
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Product removed
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Product not in wishlist
   */
  .delete(validate(productIdParamSchema, 'params'), removeWishlistItem);

export default router;
