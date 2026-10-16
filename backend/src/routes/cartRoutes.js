import express from 'express';
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  mergeCart,
} from '../controllers/cartController.js';
import { protect } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
  mergeCartSchema,
  cartItemIdParamSchema,
} from '../validators/cartValidator.js';

const router = express.Router();

// All cart routes require authentication
router.use(protect);

router
  .route('/')
  /**
   * @openapi
   * /cart:
   *   get:
   *     summary: Get current authenticated user's persistent cart
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user cart retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  .get(getCart)
  /**
   * @openapi
   * /cart:
   *   delete:
   *     summary: Clear all items from user's cart
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Cart cleared successfully
   *       401:
   *         description: Unauthorized
   */
  .delete(clearCart);

router
  .route('/items')
  /**
   * @openapi
   * /cart/items:
   *   post:
   *     summary: Add an item (product variant) to cart
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [productId, variantId]
   *             properties:
   *               productId:
   *                 type: string
   *                 example: 66ce78a19b2e3f412c12a8bc
   *               variantId:
   *                 type: string
   *                 example: 66ce78a19b2e3f412c12a8bd
   *               quantity:
   *                 type: integer
   *                 example: 1
   *     responses:
   *       200:
   *         description: Item added to cart successfully
   *       400:
   *         description: Insufficient stock or invalid IDs
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Product or variant not found
   */
  .post(validate(addCartItemSchema), addCartItem);

router
  .route('/merge')
  /**
   * @openapi
   * /cart/merge:
   *   post:
   *     summary: Merge guest cart lines into the server cart (login flow)
   *     description: Invalid or unavailable lines are skipped; quantities are clamped to available stock and never summed, so calling twice is safe.
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [items]
   *             properties:
   *               items:
   *                 type: array
   *                 maxItems: 50
   *                 items:
   *                   type: object
   *                   required: [productId, variantId, quantity]
   *                   properties:
   *                     productId:
   *                       type: string
   *                     variantId:
   *                       type: string
   *                     quantity:
   *                       type: integer
   *                       example: 1
   *     responses:
   *       200:
   *         description: Cart merged, with skipped and adjusted line reports
   *       401:
   *         description: Unauthorized
   */
  .post(validate(mergeCartSchema), mergeCart);

router
  .route('/items/:itemId')
  /**
   * @openapi
   * /cart/items/{itemId}:
   *   patch:
   *     summary: Update quantity of a cart item
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [quantity]
   *             properties:
   *               quantity:
   *                 type: integer
   *                 example: 2
   *     responses:
   *       200:
   *         description: Cart item quantity updated
   *       400:
   *         description: Insufficient stock or invalid quantity
   *       404:
   *         description: Cart item not found
   */
  .patch(validate(cartItemIdParamSchema, "params"), validate(updateCartItemSchema), updateCartItem)
  /**
   * @openapi
   * /cart/items/{itemId}:
   *   delete:
   *     summary: Remove an item from cart
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Item removed from cart
   *       404:
   *         description: Cart item not found
   */
  .delete(validate(cartItemIdParamSchema, "params"), removeCartItem);

export default router;
