import express from "express";
import {
  getProducts,
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
} from "../controllers/productController.js";
import { protect, restrictTo } from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import { idParamSchema, productIdOrSlugParamSchema } from "../validators/commonValidator.js";
import {
  createProductSchema,
  updateProductSchema,
  createReviewSchema,
  getProductsQuerySchema,
} from "../validators/productValidator.js";
import { cacheMiddleware } from "../middlewares/cacheMiddleware.js";

const router = express.Router();

router
  .route("/")
  /**
   * @openapi
   * /products:
   *   get:
   *     summary: Fetch all products with multi-attribute fashion search, filtering & pagination
   *     tags: [Products]
   *     parameters:
   *       - in: query
   *         name: keyword
   *         schema:
   *           type: string
   *         description: Text search in product name, brand, or description
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Category slug, ID, or name
   *       - in: query
   *         name: gender
   *         schema:
   *           type: string
   *           enum: [men, women, kids, unisex]
   *         description: Target gender/audience
   *       - in: query
   *         name: size
   *         schema:
   *           type: string
   *           enum: [XS, S, M, L, XL, XXL, ONE_SIZE]
   *         description: Product variant size
   *       - in: query
   *         name: color
   *         schema:
   *           type: string
   *         description: Product variant color name (e.g., Black, Cream)
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *       - in: query
   *         name: pageNumber
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 8
   *     responses:
   *       200:
   *         description: Paginated list of products fetched successfully
   */
  .get(validate(getProductsQuerySchema, "query"), cacheMiddleware("products"), getProducts)
  /**
   * @openapi
   * /products:
   *   post:
   *     summary: Create a fashion product with variants (Admin only)
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, price, description, image, category]
   *             properties:
   *               name:
   *                 type: string
   *                 example: Nova Oversized Hoodie
   *               price:
   *                 type: number
   *                 example: 89.99
   *               description:
   *                 type: string
   *                 example: Heavyweight organic cotton oversized fleece hoodie.
   *               image:
   *                 type: string
   *                 example: https://images.unsplash.com/photo-1556905055-8f358a7a47b2
   *               category:
   *                 type: string
   *                 example: Hoodies
   *               gender:
   *                 type: string
   *                 example: unisex
   *               brand:
   *                 type: string
   *                 example: NovaShop
   *               variants:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     size:
   *                       type: string
   *                       example: M
   *                     color:
   *                       type: object
   *                       properties:
   *                         name:
   *                           type: string
   *                           example: Black
   *                         hex:
   *                           type: string
   *                           example: "#000000"
   *                     stock:
   *                       type: integer
   *                       example: 10
   *     responses:
   *       201:
   *         description: Product and variants created successfully
   */
  .post(protect, restrictTo("admin"), validate(createProductSchema, "body"), createProduct);

/**
 * @openapi
 * /products/admin/all:
 *   get:
 *     summary: Fetch ALL products, including drafts and archived (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, archived]
 *       - in: query
 *         name: pageNumber
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Paginated list of all products for the admin dashboard
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 */
router.get("/admin/all", protect, restrictTo("admin"), getAdminProducts);

router
  .route("/:id/reviews")
  /**
   * @openapi
   * /products/{id}/reviews:
   *   post:
   *     summary: Create a product review
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [rating, comment]
   *             properties:
   *               rating:
   *                 type: number
   *               comment:
   *                 type: string
   *     responses:
   *       201:
   *         description: Review added successfully
   */
  .post(
    protect,
    validate(idParamSchema, "params"),
    validate(createReviewSchema, "body"),
    createProductReview
  );

router
  .route("/:id")
  /**
   * @openapi
   * /products/{id}:
   *   get:
   *     summary: Fetch single product by ID or Slug
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Product details retrieved successfully
   */
  .get(validate(productIdOrSlugParamSchema, "params"), cacheMiddleware("products"), getProductById)
  /**
   * @openapi
   * /products/{id}:
   *   put:
   *     summary: Update product details & variants (Admin only)
   *     tags: [Products]
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
   *         description: Product updated successfully
   */
  .put(
    protect,
    restrictTo("admin"),
    validate(idParamSchema, "params"),
    validate(updateProductSchema, "body"),
    updateProduct
  )
  /**
   * @openapi
   * /products/{id}:
   *   delete:
   *     summary: Delete a product and its variants (Admin only)
   *     tags: [Products]
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
   *         description: Product removed successfully
   */
  .delete(protect, restrictTo("admin"), validate(idParamSchema, "params"), deleteProduct);

export default router;