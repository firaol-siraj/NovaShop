import express from 'express';
import {
  addOrderItems,
  getOrderById,
  getMyOrders,
  updateOrderToPaid,
  getOrders,
  updateOrderToDelivered,
} from '../controllers/orderController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validateMiddleware.js';
import { idParamSchema } from '../validators/commonValidator.js';
import { createOrderSchema } from '../validators/orderValidator.js';

const router = express.Router();

router
  .route('/')
  /**
   * @openapi
   * /orders:
   *   post:
   *     summary: Create a new order
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice]
   *             properties:
   *               orderItems:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [name, qty, price, product]
   *                   properties:
   *                     name:
   *                       type: string
   *                       example: Wireless Headphones
   *                     qty:
   *                       type: integer
   *                       example: 2
   *                     image:
   *                       type: string
   *                       example: /uploads/sample.jpg
   *                     price:
   *                       type: number
   *                       example: 99.99
   *                     product:
   *                       type: string
   *                       example: 66ce78a19b2e3f412c12a8bc
   *               shippingAddress:
   *                 type: object
   *                 required: [address, city, postalCode, country]
   *                 properties:
   *                   address:
   *                     type: string
   *                     example: 123 Main St
   *                   city:
   *                     type: string
   *                     example: Adama
   *                   postalCode:
   *                     type: string
   *                     example: 1000
   *                   country:
   *                     type: string
   *                     example: Ethiopia
   *               paymentMethod:
   *                 type: string
   *                 example: PayPal
   *               itemsPrice:
   *                 type: number
   *                 example: 199.98
   *               taxPrice:
   *                 type: number
   *                 example: 29.99
   *               shippingPrice:
   *                 type: number
   *                 example: 10.00
   *               totalPrice:
   *                 type: number
   *                 example: 239.97
   *     responses:
   *       201:
   *         description: Order created successfully & confirmation email queued
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                       example: 66cf1a2b8f9e01d23c45678a
   *                     user:
   *                       type: string
   *                       example: 66ce78a19b2e3f412c12a8bc
   *                     orderItems:
   *                       type: array
   *                       items:
   *                         type: object
   *                     shippingAddress:
   *                       type: object
   *                     paymentMethod:
   *                       type: string
   *                       example: PayPal
   *                     totalPrice:
   *                       type: number
   *                       example: 239.97
   *                     isPaid:
   *                       type: boolean
   *                       example: false
   *                     isDelivered:
   *                       type: boolean
   *                       example: false
   *       400:
   *         description: No order items provided or invalid payload
   *       401:
   *         description: Unauthorized (Missing or invalid token)
   */
  .post(protect, validate(createOrderSchema, "body"), addOrderItems)
  /**
   * @openapi
   * /orders:
   *   get:
   *     summary: Get all orders (Admin only)
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of all customer orders fetched successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 count:
   *                   type: integer
   *                   example: 12
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       user:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           name:
   *                             type: string
   *                       totalPrice:
   *                         type: number
   *                       isPaid:
   *                         type: boolean
   *                       isDelivered:
   *                         type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (Requires Admin privileges)
   */
  .get(protect, restrictTo('admin'), getOrders);
/**
 * @openapi
 * /orders/myorders:
 *   get:
 *     summary: Get orders of the logged-in user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged-in user order history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       totalPrice:
 *                         type: number
 *                       isPaid:
 *                         type: boolean
 *                       isDelivered:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.route('/myorders').get(protect, getMyOrders);
/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB Order ID
 *     responses:
 *       200:
 *         description: Order details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                     orderItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                     shippingAddress:
 *                       type: object
 *                     totalPrice:
 *                       type: number
 *                     isPaid:
 *                       type: boolean
 *                     isDelivered:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this order (neither owner nor admin)
 *       404:
 *         description: Order not found
 */
router.route('/:id').get(protect, validate(idParamSchema, "params"), getOrderById);
/**
 * @openapi
 * /orders/{id}/pay:
 *   put:
 *     summary: Update order status to Paid
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: PAYPAL_PAYMENT_ID_12345
 *               status:
 *                 type: string
 *                 example: COMPLETED
 *               update_time:
 *                 type: string
 *                 example: 2026-08-26T23:00:00Z
 *               payer:
 *                 type: object
 *                 properties:
 *                   email_address:
 *                     type: string
 *                     example: customer@example.com
 *     responses:
 *       200:
 *         description: Order marked as paid and payment receipt email queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     isPaid:
 *                       type: boolean
 *                       example: true
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                     paymentResult:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 */
router.route('/:id/pay').put(protect, validate(idParamSchema, "params"), updateOrderToPaid);
/**
 * @openapi
 * /orders/{id}/deliver:
 *   put:
 *     summary: Update order status to Delivered (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB Order ID
 *     responses:
 *       200:
 *         description: Order marked as delivered and notification email queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     isDelivered:
 *                       type: boolean
 *                       example: true
 *                     deliveredAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires Admin privileges)
 *       404:
 *         description: Order not found
 */
router
  .route('/:id/deliver')
  .put(protect, restrictTo('admin'), validate(idParamSchema, "params"), validate(createOrderSchema, "body"), updateOrderToDelivered);

export default router;