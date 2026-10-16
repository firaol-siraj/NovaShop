import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply protect & restrictTo('admin') to all routes in this router
router.use(protect, restrictTo('admin'));

/**
   * @openapi
   * /users:
   *   get:
   *     summary: Get all users (Admin only)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of all users fetched successfully (excluding passwords)
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
   *                   example: 5
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                         example: 66ce78a19b2e3f412c12a8bc
   *                       name:
   *                         type: string
   *                         example: John Doe
   *                       email:
   *                         type: string
   *                         example: john@example.com
   *                       role:
   *                         type: string
   *                         example: user
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *       401:
   *         description: Unauthorized (Missing or invalid token)
   *       403:
   *         description: Forbidden (Requires Admin privileges)
   */
router.route('/').get(getUsers);

router
  .route('/:id')
  /**
   * @openapi
   * /users/{id}:
   *   get:
   *     summary: Get user details by ID (Admin only)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB User ID
   *     responses:
   *       200:
   *         description: User profile fetched successfully
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
   *                       example: 66ce78a19b2e3f412c12a8bc
   *                     name:
   *                       type: string
   *                       example: Jane Doe
   *                     email:
   *                       type: string
   *                       example: jane@example.com
   *                     role:
   *                       type: string
   *                       example: admin
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (Requires Admin privileges)
   *       404:
   *         description: User not found
   */
  .get(getUserById)
  /**
   * @openapi
   * /users/{id}:
   *   put:
   *     summary: Update user details or role (Admin only)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: Jane Smith
   *               email:
   *                 type: string
   *                 example: janesmith@example.com
   *               role:
   *                 type: string
   *                 enum: [user, admin]
   *                 example: admin
   *     responses:
   *       200:
   *         description: User profile updated successfully
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
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                     role:
   *                       type: string
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (Requires Admin privileges)
   *       404:
   *         description: User not found
   */
  .put(updateUser)
  /**
   * @openapi
   * /users/{id}:
   *   delete:
   *     summary: Delete a user account (Admin only)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MongoDB User ID
   *     responses:
   *       200:
   *         description: User deleted successfully
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
   *                   example: User deleted successfully
   *       400:
   *         description: Bad Request (Cannot delete logged-in admin's own account)
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (Requires Admin privileges)
   *       404:
   *         description: User not found
   */
  .delete(deleteUser);

export default router;