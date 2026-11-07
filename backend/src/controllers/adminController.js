import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import Category from '../models/categoryModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import Address from '../models/addressModel.js';
import EmailLog from '../models/emailLogModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import InventoryMovement from '../models/inventoryMovementModel.js';
import Setting from '../models/settingModel.js';
import Payment from '../models/paymentModel.js';
import ReturnRequest from '../models/returnRequestModel.js';
import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import AuditLog from '../models/auditLogModel.js';
import crypto from 'crypto';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { clearCachePattern } from '../utils/clearCache.js';
import { sanitizePhoneNumber } from '../utils/phone.js';
import { generateTicketNumber } from '../services/supportService.js';
import {
  getGlobalLowStockThreshold,
  withTransaction,
  recordMovement,
  checkAndTriggerLowStockAlert,
  syncProductStock,
  adjustVariantStock,
} from '../services/inventoryService.js';
import { sendEmail } from '../services/emailService.js';
import logger from '../utils/logger.js';
import { getProductStockStatus } from '../utils/stockUtils.js';

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

// =========================================================================
// 1. PRODUCTS CONTROLLER
// =========================================================================

/**
 * GET /api/v1/admin/products
 * Server-side pagination, debounced search, filters, sorting, and stats.
 */
export const getAdminProductsList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { search, category, status, stockState, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const matchFilter = {};

  const targetProductId = req.query.product || req.query.productId;
  if (targetProductId && mongoose.Types.ObjectId.isValid(targetProductId)) {
    matchFilter._id = new mongoose.Types.ObjectId(targetProductId);
  }

  if (status && status !== 'all') {
    matchFilter.status = status;
  }

  if (category && category !== 'All categories' && category !== 'all') {
    if (mongoose.Types.ObjectId.isValid(category)) {
      matchFilter.category = new mongoose.Types.ObjectId(category);
    } else {
      const catDoc = await Category.findOne({
        $or: [{ slug: category.toLowerCase() }, { name: new RegExp(`^${category}$`, 'i') }],
      });
      if (catDoc) {
        matchFilter.category = catDoc._id;
      }
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    // Also find variants matching SKU
    const matchingVariants = await ProductVariant.find({ sku: searchRegex }).distinct('product');
    matchFilter.$or = [
      { name: searchRegex },
      { slug: searchRegex },
      { brand: searchRegex },
      { _id: { $in: matchingVariants } },
    ];
  }

  const globalThreshold = await getGlobalLowStockThreshold();

  if (stockState && stockState !== 'all') {
    if (stockState === 'out_of_stock') {
      matchFilter.countInStock = { $lte: 0 };
    } else if (stockState === 'low_stock') {
      matchFilter.countInStock = { $gt: 0, $lte: globalThreshold };
    } else if (stockState === 'in_stock') {
      matchFilter.countInStock = { $gt: globalThreshold };
    }
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortStage = {};
  if (sortBy === 'price') sortStage.price = sortDirection;
  else if (sortBy === 'name') sortStage.name = sortDirection;
  else if (sortBy === 'countInStock') sortStage.countInStock = sortDirection;
  else sortStage.createdAt = sortDirection;

  const [products, totalCount, totalProducts, activeProducts, lowStockProducts, outOfStockProducts] =
    await Promise.all([
      Product.find(matchFilter)
        .populate('category', 'name slug')
        .populate('variants')
        .sort(sortStage)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(matchFilter),
      Product.countDocuments(),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ countInStock: { $gt: 0, $lte: globalThreshold } }),
      Product.countDocuments({ countInStock: { $lte: 0 } }),
    ]);

  // Aggregate paid sales per product for the returned slice
  const productIds = products.map((p) => p._id);
  const salesAgg = await Order.aggregate([
    { $match: { isPaid: true, 'orderItems.product': { $in: productIds } } },
    { $unwind: '$orderItems' },
    { $match: { 'orderItems.product': { $in: productIds } } },
    {
      $group: {
        _id: '$orderItems.product',
        unitsSold: { $sum: '$orderItems.qty' },
      },
    },
  ]);

  const salesMap = new Map(salesAgg.map((s) => [s._id.toString(), s.unitsSold]));

  const enrichedProducts = products.map((prod) => {
    const variants = Array.isArray(prod.variants) ? prod.variants : [];
    const unitsSold = salesMap.get(prod._id.toString()) || 0;
    const colors = [
      ...new Set(variants.map((v) => (typeof v.color === 'object' ? v.color?.hex : v.color)).filter(Boolean)),
    ];
    const stockStatus = getProductStockStatus(variants, { globalThreshold, productStock: prod.countInStock });
    return {
      ...prod,
      stockStatus,
      unitsSold,
      colors: colors.length ? colors : ['#B8AA98'],
      variantCount: variants.length,
    };
  });

  res.status(200).json({
    success: true,
    data: enrichedProducts,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
    stats: {
      totalProducts,
      activeProducts,
      lowStockProducts,
      outOfStockProducts,
      globalThreshold,
    },
  });
});

/**
 * POST /api/v1/admin/products
 * Transactional product creation with variants matrix and initial InventoryMovement.
 */
export const createAdminProduct = asyncHandler(async (req, res, next) => {
  const {
    name,
    slug,
    description,
    category,
    brand = 'NovaShop',
    price,
    status = 'active',
    image,
    images = [],
    imagePublicIds = [],
    variants = [],
  } = req.body;

  let finalSlug = slug ? slugify(slug) : slugify(name);
  let slugConflict = await Product.findOne({ slug: finalSlug });
  if (slugConflict) {
    finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
  }

  const primaryImage = image || images[0] || '';

  const result = await withTransaction(async (session) => {
    const totalStock = variants.reduce((sum, v) => sum + (Math.max(0, parseInt(v.stock, 10)) || 0), 0);

    const [createdProduct] = await Product.create(
      [
        {
          user: req.user._id,
          name: name.trim(),
          slug: finalSlug,
          description: description.trim(),
          category,
          brand: brand.trim(),
          price: Number(price),
          status,
          image: primaryImage,
          images: images.length ? images : [primaryImage],
          imagePublicIds,
          countInStock: totalStock,
        },
      ],
      { session }
    );

    const createdVariants = [];
    for (const v of variants) {
      const vStock = Math.max(0, parseInt(v.stock, 10) || 0);
      const vPrice = v.price != null && Number(v.price) >= 0 ? Number(v.price) : Number(price);
      const colorObj =
        typeof v.color === 'string'
          ? { name: v.color.trim(), hex: '#000000' }
          : { name: v.color?.name?.trim() || 'Default', hex: v.color?.hex?.trim() || '#000000' };

      const [createdVariant] = await ProductVariant.create(
        [
          {
            product: createdProduct._id,
            sku: v.sku.trim().toUpperCase(),
            size: v.size.trim().toUpperCase(),
            color: colorObj,
            price: vPrice,
            stock: vStock,
            reserved: 0,
            lowStockThreshold: v.lowStockThreshold != null ? Number(v.lowStockThreshold) : null,
            image: v.image || primaryImage,
          },
        ],
        { session }
      );

      // Write 'initial' inventory movement
      if (vStock > 0) {
        await recordMovement({
          variantId: createdVariant._id,
          productId: createdProduct._id,
          type: 'initial',
          quantityChange: vStock,
          stockBefore: 0,
          stockAfter: vStock,
          reason: 'Initial stock recorded upon product creation',
          adminId: req.user._id,
          session,
        });
      }

      await checkAndTriggerLowStockAlert(createdVariant, session);
      createdVariants.push(createdVariant);
    }

    return { product: createdProduct, variants: createdVariants };
  });

  await clearCachePattern('products');

  const populated = await Product.findById(result.product._id)
    .populate('category', 'name slug')
    .populate('variants');

  res.status(201).json({
    success: true,
    message: 'Product and variants created successfully',
    data: populated,
  });
});

/**
 * GET /api/v1/admin/products/:id
 * Real product detail with variants stock breakdown and paid sales count.
 */
export const getAdminProductById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const product = await Product.findOne(isObjectId ? { _id: id } : { slug: id })
    .populate('category', 'name slug description')
    .populate('variants')
    .lean();

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Aggregate paid sales history for this product
  const salesAgg = await Order.aggregate([
    { $match: { isPaid: true, 'orderItems.product': product._id } },
    { $unwind: '$orderItems' },
    { $match: { 'orderItems.product': product._id } },
    {
      $group: {
        _id: null,
        unitsSold: { $sum: '$orderItems.qty' },
        totalRevenue: { $sum: { $multiply: ['$orderItems.qty', '$orderItems.price'] } },
        orderCount: { $addToSet: '$_id' },
      },
    },
  ]);

  const salesStats = salesAgg[0] || { unitsSold: 0, totalRevenue: 0, orderCount: [] };

  // Fetch 10 recent orders for this product
  const recentOrders = await Order.find({ 'orderItems.product': product._id })
    .select('orderNumber createdAt status paymentStatus totalPrice isPaid user customerEmail')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const globalThreshold = await getGlobalLowStockThreshold();

  const enrichedVariants = (product.variants || []).map((v) => {
    const available = Math.max(0, (v.stock || 0) - (v.reserved || 0));
    const threshold = v.lowStockThreshold != null ? v.lowStockThreshold : globalThreshold;
    let status = 'in stock';
    if (available === 0) status = 'out of stock';
    else if (available <= Math.ceil(threshold / 2)) status = 'critical';
    else if (available <= threshold) status = 'low stock';

    return {
      ...v,
      available,
      effectiveThreshold: threshold,
      stockStatus: status,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      ...product,
      variants: enrichedVariants,
      metrics: {
        unitsSold: salesStats.unitsSold,
        totalRevenue: salesStats.totalRevenue,
        ordersCount: salesStats.orderCount.length,
      },
      recentOrders,
    },
  });
});

/**
 * PUT /api/v1/admin/products/:id
 * Updates product details and variants matrix, recording audit movements for stock changes.
 */
export const updateAdminProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const product = await Product.findOne(isObjectId ? { _id: id } : { slug: id });
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  const {
    name,
    slug,
    description,
    category,
    brand,
    price,
    status,
    image,
    images,
    imagePublicIds,
    variants,
  } = req.body;

  if (name) product.name = name.trim();
  if (slug && slug.trim() && slug !== product.slug) {
    const existingSlug = await Product.findOne({ slug: slugify(slug), _id: { $ne: product._id } });
    if (existingSlug) {
      return next(new ApiError(409, 'A product with this slug already exists'));
    }
    product.slug = slugify(slug);
  }
  if (description) product.description = description.trim();
  if (category) product.category = category;
  if (brand) product.brand = brand.trim();
  if (price !== undefined) product.price = Number(price);
  if (status) product.status = status;
  if (image) product.image = image;
  if (images) product.images = images;
  if (imagePublicIds) product.imagePublicIds = imagePublicIds;

  await withTransaction(async (session) => {
    if (Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        const vStock = Math.max(0, parseInt(v.stock, 10) || 0);
        const vPrice = v.price != null && Number(v.price) >= 0 ? Number(v.price) : product.price;
        const colorObj =
          typeof v.color === 'string'
            ? { name: v.color.trim(), hex: '#000000' }
            : { name: v.color?.name?.trim() || 'Default', hex: v.color?.hex?.trim() || '#000000' };

        let variantDoc = null;
        if (v._id && mongoose.Types.ObjectId.isValid(v._id)) {
          variantDoc = await ProductVariant.findById(v._id, null, { session });
        } else if (v.id && mongoose.Types.ObjectId.isValid(v.id)) {
          variantDoc = await ProductVariant.findById(v.id, null, { session });
        } else if (v.sku) {
          variantDoc = await ProductVariant.findOne({ sku: v.sku.trim().toUpperCase() }, null, { session });
        }

        if (variantDoc) {
          const stockBefore = variantDoc.stock;
          const stockAfter = vStock;
          const delta = stockAfter - stockBefore;

          variantDoc.sku = v.sku ? v.sku.trim().toUpperCase() : variantDoc.sku;
          variantDoc.size = v.size ? v.size.trim().toUpperCase() : variantDoc.size;
          variantDoc.color = colorObj;
          variantDoc.price = vPrice;
          variantDoc.stock = stockAfter;
          if (v.lowStockThreshold !== undefined) {
            variantDoc.lowStockThreshold = v.lowStockThreshold != null ? Number(v.lowStockThreshold) : null;
          }
          await variantDoc.save({ session });

          if (delta !== 0) {
            await recordMovement({
              variantId: variantDoc._id,
              productId: product._id,
              type: delta > 0 ? 'restock' : 'adjustment',
              quantityChange: delta,
              stockBefore,
              stockAfter,
              reason: 'Product variant updated by admin in catalog editor',
              adminId: req.user._id,
              session,
            });
          }

          await checkAndTriggerLowStockAlert(variantDoc, session);
        } else {
          // New variant added during product edit
          const [newVariant] = await ProductVariant.create(
            [
              {
                product: product._id,
                sku: v.sku.trim().toUpperCase(),
                size: v.size.trim().toUpperCase(),
                color: colorObj,
                price: vPrice,
                stock: vStock,
                reserved: 0,
                lowStockThreshold: v.lowStockThreshold != null ? Number(v.lowStockThreshold) : null,
                image: v.image || product.image,
              },
            ],
            { session }
          );

          if (vStock > 0) {
            await recordMovement({
              variantId: newVariant._id,
              productId: product._id,
              type: 'initial',
              quantityChange: vStock,
              stockBefore: 0,
              stockAfter: vStock,
              reason: 'New variant added during catalog edit',
              adminId: req.user._id,
              session,
            });
          }

          await checkAndTriggerLowStockAlert(newVariant, session);
        }
      }
    }

    await product.save({ session });
    await syncProductStock(product._id, session);
  });

  await clearCachePattern('products');

  const updatedProduct = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('variants');

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: updatedProduct,
  });
});

/**
 * DELETE /api/v1/admin/products/:id
 * If product has orders, archives it (soft-delete). If no orders, hard deletes.
 */
export const deleteAdminProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const product = await Product.findOne(isObjectId ? { _id: id } : { slug: id });
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check if product is referenced in existing orders
  const ordersCount = await Order.countDocuments({ 'orderItems.product': product._id });

  if (ordersCount > 0) {
    // Preserve order history and snapshots: soft delete / archive
    product.status = 'archived';
    await product.save();
    await clearCachePattern('products');

    return res.status(200).json({
      success: true,
      message: `Product is referenced in ${ordersCount} order(s). It has been archived instead of permanently deleted to preserve customer records.`,
      archived: true,
    });
  }

  // Clean hard delete
  await withTransaction(async (session) => {
    await ProductVariant.deleteMany({ product: product._id }, { session });
    await InventoryMovement.deleteMany({ product: product._id }, { session });
    await Product.deleteOne({ _id: product._id }, { session });
  });

  await clearCachePattern('products');

  res.status(200).json({
    success: true,
    message: 'Product and variants deleted permanently',
    archived: false,
  });
});

/**
 * PATCH /api/v1/admin/products/:id/status
 */
export const updateProductStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const product = await Product.findById(id);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  product.status = status;
  await product.save();
  await clearCachePattern('products');

  res.status(200).json({
    success: true,
    message: `Product status updated to ${status}`,
    data: product,
  });
});

/**
 * POST /api/v1/admin/products/bulk-status
 */
export const bulkUpdateProductStatus = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;

  await Product.updateMany({ _id: { $in: ids } }, { $set: { status } });
  await clearCachePattern('products');

  res.status(200).json({
    success: true,
    message: `Updated status to ${status} for ${ids.length} product(s)`,
  });
});

/**
 * POST /api/v1/admin/products/:id/duplicate
 */
export const duplicateAdminProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const product = await Product.findById(id).populate('variants');
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  const timestamp = Date.now().toString().slice(-4);
  const newSlug = `${product.slug}-copy-${timestamp}`;
  const newName = `${product.name} (Copy)`;

  const result = await withTransaction(async (session) => {
    const [duplicatedProduct] = await Product.create(
      [
        {
          user: req.user._id,
          name: newName,
          slug: newSlug,
          description: product.description,
          category: product.category,
          brand: product.brand,
          price: product.price,
          status: 'draft',
          image: product.image,
          images: product.images,
          imagePublicIds: product.imagePublicIds,
          countInStock: product.countInStock,
        },
      ],
      { session }
    );

    for (const v of product.variants || []) {
      const copySku = `${v.sku}-CP${timestamp}`;
      const [copiedVariant] = await ProductVariant.create(
        [
          {
            product: duplicatedProduct._id,
            sku: copySku,
            size: v.size,
            color: v.color,
            price: v.price,
            stock: v.stock,
            reserved: 0,
            lowStockThreshold: v.lowStockThreshold,
            image: v.image,
          },
        ],
        { session }
      );

      if (v.stock > 0) {
        await recordMovement({
          variantId: copiedVariant._id,
          productId: duplicatedProduct._id,
          type: 'initial',
          quantityChange: v.stock,
          stockBefore: 0,
          stockAfter: v.stock,
          reason: `Initial stock from product duplication of #${product._id}`,
          adminId: req.user._id,
          session,
        });
      }
    }

    return duplicatedProduct;
  });

  await clearCachePattern('products');

  const populated = await Product.findById(result._id).populate('category').populate('variants');

  res.status(201).json({
    success: true,
    message: 'Product duplicated successfully',
    data: populated,
  });
});

// =========================================================================
// 2. CATEGORIES CONTROLLER
// =========================================================================

/**
 * GET /api/v1/admin/categories
 * Returns categories list with aggregated real product counts.
 */
export const getAdminCategoriesList = asyncHandler(async (req, res) => {
  const { search, status } = req.query;

  const match = {};
  if (status && status !== 'all') {
    match.status = status;
  }
  if (search && search.trim()) {
    match.$or = [
      { name: new RegExp(search.trim(), 'i') },
      { slug: new RegExp(search.trim(), 'i') },
      { description: new RegExp(search.trim(), 'i') },
    ];
  }

  const categories = await Category.find(match)
    .populate('parent', 'name slug')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  // Aggregate product count for each category
  const productCountAgg = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(productCountAgg.map((item) => [String(item._id), item.count]));

  const enriched = categories.map((cat) => ({
    ...cat,
    id: cat._id.toString(),
    products: countMap.get(cat._id.toString()) || 0,
  }));

  res.status(200).json({
    success: true,
    data: enriched,
    count: enriched.length,
  });
});

/**
 * POST /api/v1/admin/categories
 */
export const createAdminCategory = asyncHandler(async (req, res, next) => {
  const { name, slug, description = '', image = '', parent = null, status = 'active', sortOrder = 0 } = req.body;

  const generatedSlug = slug ? slugify(slug) : slugify(name);
  const conflict = await Category.findOne({ slug: generatedSlug });
  if (conflict) {
    return next(new ApiError(409, 'A category with this slug already exists'));
  }

  const category = await Category.create({
    name: name.trim(),
    slug: generatedSlug,
    description: description.trim(),
    image: image.trim(),
    parent: parent || null,
    status,
    sortOrder: Number(sortOrder) || 0,
  });

  await clearCachePattern('categories');

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: category,
  });
});

/**
 * PUT /api/v1/admin/categories/:id
 */
export const updateAdminCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, slug, description, image, parent, status, sortOrder } = req.body;

  const category = await Category.findById(id);
  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  if (name) category.name = name.trim();
  if (slug && slug.trim() && slug !== category.slug) {
    const conflict = await Category.findOne({ slug: slugify(slug), _id: { $ne: id } });
    if (conflict) {
      return next(new ApiError(409, 'A category with this slug already exists'));
    }
    category.slug = slugify(slug);
  }
  if (description !== undefined) category.description = description.trim();
  if (image !== undefined) category.image = image.trim();
  if (parent !== undefined) category.parent = parent || null;
  if (status) category.status = status;
  if (sortOrder !== undefined) category.sortOrder = Number(sortOrder);

  await category.save();
  await clearCachePattern('categories');

  res.status(200).json({
    success: true,
    message: 'Category updated successfully',
    data: category,
  });
});

/**
 * DELETE /api/v1/admin/categories/:id
 * Blocks deletion if products are assigned to this category.
 */
export const deleteAdminCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  // Count products assigned to this category
  const productCount = await Product.countDocuments({ category: id });
  if (productCount > 0) {
    return next(
      new ApiError(
        400,
        `Cannot delete category "${category.name}" because ${productCount} product(s) are currently assigned to it. Please reassign or delete these products first.`
      )
    );
  }

  // Check child subcategories
  const childCount = await Category.countDocuments({ parent: id });
  if (childCount > 0) {
    // Un-parent children
    await Category.updateMany({ parent: id }, { $set: { parent: null } });
  }

  await Category.deleteOne({ _id: id });
  await clearCachePattern('categories');

  res.status(200).json({
    success: true,
    message: 'Category deleted successfully',
  });
});

/**
 * PATCH /api/v1/admin/categories/reorder
 */
export const reorderAdminCategories = asyncHandler(async (req, res) => {
  const { order } = req.body;

  const bulkOps = order.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { sortOrder: item.sortOrder } },
    },
  }));

  if (bulkOps.length > 0) {
    await Category.bulkWrite(bulkOps);
    await clearCachePattern('categories');
  }

  res.status(200).json({
    success: true,
    message: 'Categories reordered successfully',
  });
});

// =========================================================================
// 3. CUSTOMERS CONTROLLER
// =========================================================================

/**
 * Shared customer stats calculation function.
 * Total customers = all non-admin customer accounts (including invited, unverified, active, inactive, blocked, and anonymized).
 * Active = status 'active' and not blocked/deactivated.
 * Inactive = status 'inactive', 'invited', or 'unverified'.
 * Blocked = status 'blocked' or 'deactivated'.
 * Repeat customers = customers with 2+ PAID orders divided by customers with 1+ PAID orders ("-" when none).
 * Delta compares to previous equal period ("-" when previous is zero).
 */
export async function calculateCustomerStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalCustomersCount,
    activeCustomersCount,
    inactiveCustomersCount,
    blockedCustomersCount,
    newThisMonthCount,
    newLastMonthCount,
    repeatCustomersAgg,
    customersWithOrdersAgg,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'customer', status: 'active' }),
    User.countDocuments({ role: 'customer', status: { $in: ['inactive', 'invited', 'unverified'] } }),
    User.countDocuments({ role: 'customer', status: { $in: ['blocked', 'deactivated'] } }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gte: 2 } } },
      { $count: 'repeatCount' },
    ]),
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gte: 1 } } },
      { $count: 'withOrdersCount' },
    ]),
  ]);

  const repeatCustomers = repeatCustomersAgg[0]?.repeatCount || 0;
  const customersWithOrders = customersWithOrdersAgg[0]?.withOrdersCount || 0;

  const repeatRate = customersWithOrders > 0
    ? `${Math.round((repeatCustomers / customersWithOrders) * 100)}%`
    : '-';

  const percentChange = newLastMonthCount === 0
    ? '-'
    : `${newThisMonthCount >= newLastMonthCount ? '+' : ''}${Math.round(((newThisMonthCount - newLastMonthCount) / newLastMonthCount) * 100)}%`;

  return {
    totalCustomers: totalCustomersCount,
    activeCustomers: activeCustomersCount,
    inactiveCustomers: inactiveCustomersCount,
    blockedCustomers: blockedCustomersCount,
    newThisMonth: newThisMonthCount,
    newLastMonth: newLastMonthCount,
    repeatCustomers,
    customersWithOrders,
    repeatRate,
    percentChange,
    tabCounts: {
      all: totalCustomersCount,
      active: activeCustomersCount,
      inactive: inactiveCustomersCount,
      blocked: blockedCustomersCount,
    },
  };
}

/**
 * GET /api/v1/admin/customers
 * Real customer list excluding admin accounts, with paid spend and order metrics.
 */
export const getAdminCustomersList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { search, status, hasOrders, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const customerMatch = { role: 'customer' };

  const targetCustomerId = req.query.customer || req.query.customerId;
  if (targetCustomerId && mongoose.Types.ObjectId.isValid(targetCustomerId)) {
    customerMatch._id = new mongoose.Types.ObjectId(targetCustomerId);
  }

  if (status && status !== 'all') {
    if (status === 'inactive') {
      customerMatch.status = { $in: ['inactive', 'invited', 'unverified'] };
    } else if (status === 'blocked') {
      customerMatch.status = { $in: ['blocked', 'deactivated'] };
    } else {
      customerMatch.status = status;
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    customerMatch.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
  }

  // Aggregate customer metrics from Order model
  const pipeline = [
    { $match: customerMatch },
    {
      $lookup: {
        from: 'orders',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$user', '$$userId'] }, { $eq: ['$isPaid', true] }] } } },
          { $project: { totalPrice: 1, refundedAmountUSD: 1, createdAt: 1 } },
        ],
        as: 'paidOrders',
      },
    },
    {
      $addFields: {
        ordersCount: { $size: '$paidOrders' },
        totalSpent: {
          $sum: {
            $map: {
              input: '$paidOrders',
              as: 'o',
              in: { $max: [0, { $subtract: ['$$o.totalPrice', { $ifNull: ['$$o.refundedAmountUSD', 0] }] }] },
            },
          },
        },
        lastOrderDate: { $max: '$paidOrders.createdAt' },
      },
    },
  ];

  if (hasOrders === 'yes') {
    pipeline.push({ $match: { ordersCount: { $gt: 0 } } });
  } else if (hasOrders === 'no') {
    pipeline.push({ $match: { ordersCount: 0 } });
  }

  // Count total matches before pagination
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await User.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Sorting
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortStage = {};
  if (sortBy === 'name') sortStage.name = sortDirection;
  else if (sortBy === 'spent') sortStage.totalSpent = sortDirection;
  else if (sortBy === 'ordersCount') sortStage.ordersCount = sortDirection;
  else if (sortBy === 'lastOrderDate') sortStage.lastOrderDate = sortDirection;
  else sortStage.createdAt = sortDirection;

  pipeline.push({ $sort: sortStage });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });
  pipeline.push({
    $project: {
      password: 0,
      refreshToken: 0,
      adminRefreshToken: 0,
      emailVerificationToken: 0,
      passwordResetToken: 0,
      tokenVersion: 0,
      adminTokenVersion: 0,
      paidOrders: 0,
    },
  });

  const [customers, unifiedStats] = await Promise.all([
    User.aggregate(pipeline),
    calculateCustomerStats(),
  ]);

  // Populate Location column from customer default address, falling back to latest order shipping address (City, Country), or ""
  const customerIds = customers.map((c) => c._id);
  const [allAddresses, latestOrders] = await Promise.all([
    Address.find({ user: { $in: customerIds } }).sort({ isDefault: -1, createdAt: -1 }).lean(),
    Order.find({ user: { $in: customerIds } }).sort({ createdAt: -1 }).select('user shippingAddress orderNumber createdAt').lean(),
  ]);

  const addressByUser = new Map();
  for (const addr of allAddresses) {
    const uid = addr.user?.toString();
    if (uid && (!addressByUser.has(uid) || addr.isDefault)) {
      addressByUser.set(uid, addr);
    }
  }

  const latestOrderByUser = new Map();
  for (const ord of latestOrders) {
    const uid = ord.user?.toString();
    if (uid && !latestOrderByUser.has(uid)) {
      latestOrderByUser.set(uid, ord);
    }
  }

  const enrichedCustomers = customers.map((c) => {
    const uid = c._id.toString();
    const addr = addressByUser.get(uid);
    const ord = latestOrderByUser.get(uid);

    let city = '';
    let country = '';

    if (addr && addr.city) {
      city = addr.city;
      country = addr.country || 'Ethiopia';
    } else if (ord?.shippingAddress?.city) {
      city = ord.shippingAddress.city;
      country = ord.shippingAddress.country || 'Ethiopia';
    }

    return {
      ...c,
      city: city || '',
      country: country || '',
      lastOrderNumber: ord?.orderNumber ? `#${ord.orderNumber}` : undefined,
    };
  });

  res.status(200).json({
    success: true,
    data: enrichedCustomers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats: unifiedStats,
    meta: {
      ...unifiedStats,
      totalCustomers: unifiedStats.totalCustomers,
      newThisMonth: unifiedStats.newThisMonth,
    },
  });
});

/**
 * GET /api/v1/admin/customers/:id
 * Full customer profile, saved addresses, real order history, and email logs.
 */
export const getAdminCustomerById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const customer = await User.findOne({ _id: id, role: 'customer' })
    .select('-password -refreshToken -adminRefreshToken -emailVerificationToken -passwordResetToken -tokenVersion -adminTokenVersion')
    .lean();

  if (!customer) {
    return next(new ApiError(404, 'Customer account not found'));
  }

  const [addresses, orders, emailLogs] = await Promise.all([
    Address.find({ user: customer._id }).sort({ isDefault: -1, createdAt: -1 }).lean(),
    Order.find({ user: customer._id })
      .select('orderNumber status paymentStatus totalPrice itemsPrice isPaid createdAt orderItems')
      .sort({ createdAt: -1 })
      .lean(),
    EmailLog.find({
      $or: [{ userId: customer._id }, { to: customer.email }],
    })
      .select('subject type status error createdAt messageId preview adminName adminUserId')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  const paidOrders = orders.filter((o) => o.isPaid || o.paymentStatus === 'paid');
  const totalSpent = Number(
    paidOrders
      .reduce((sum, o) => {
        const net = Math.max(0, (Number(o.totalPrice) || 0) - (Number(o.refundedAmountUSD) || 0));
        return sum + net;
      }, 0)
      .toFixed(2)
  );
  const aov = paidOrders.length > 0 ? Number((totalSpent / paidOrders.length).toFixed(2)) : 0;

  res.status(200).json({
    success: true,
    data: {
      ...customer,
      addresses,
      orders,
      emailLogs,
      metrics: {
        totalOrders: orders.length,
        paidOrdersCount: paidOrders.length,
        totalSpent,
        aov,
        lastOrderDate: orders[0]?.createdAt || null,
      },
    },
  });
});

/**
 * PATCH /api/v1/admin/customers/:id/status
 * Deactivates or reactivates customer, revokes sessions, and sends notification.
 */
export const updateCustomerStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status, reason = '' } = req.body;

  const customer = await User.findOne({ _id: id, role: 'customer' }).select('+tokenVersion +adminTokenVersion');
  if (!customer) {
    return next(new ApiError(404, 'Customer not found'));
  }

  const previousStatus = customer.status;
  const isSuspending = status === 'deactivated' || status === 'blocked';
  customer.status = status;
  customer.isActive = !isSuspending;
  customer.deactivatedAt = isSuspending ? new Date() : null;

  if (isSuspending) {
    // Revoke all active customer and admin JWT tokens and sessions immediately
    customer.tokenVersion = (customer.tokenVersion || 0) + 1;
    customer.adminTokenVersion = (customer.adminTokenVersion || customer.tokenVersion || 0) + 1;
    customer.refreshToken = null;
    customer.adminRefreshToken = null;
  }

  await customer.save();

  // Audit log
  await AuditLog.create({
    action: status === 'blocked' ? 'customer_blocked' : (status === 'deactivated' ? 'customer_deactivated' : 'customer_reactivated'),
    section: 'customers',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: customer._id.toString(),
    changes: [
      { field: 'status', oldValue: previousStatus, newValue: status },
      { field: 'reason', oldValue: null, newValue: reason },
    ],
    metadata: {
      customerEmail: customer.email,
      reason,
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  // Send security email
  try {
    const isBlocked = status === 'blocked';
    const emailSubject = isBlocked
      ? 'NovaShop Security Notice: Your account has been suspended by administration'
      : isSuspending
      ? 'NovaShop Account Notice: Your account has been deactivated'
      : 'NovaShop Account Notice: Your account has been reactivated';

    const emailContent = isBlocked
      ? `Hello ${customer.name},\n\nYour NovaShop account has been suspended by security administration.${
          reason ? ` Reason: ${reason}` : ''
        }\n\nIf you believe this action was taken in error, please contact support.`
      : isSuspending
      ? `Hello ${customer.name},\n\nYour NovaShop account has been deactivated.${
          reason ? ` Reason: ${reason}` : ''
        }\n\nPlease contact support if you need assistance.`
      : `Hello ${customer.name},\n\nGood news! Your NovaShop account has been reactivated. You may now sign in and continue shopping.\n\nWelcome back!`;

    await sendEmail({
      to: customer.email,
      subject: emailSubject,
      text: emailContent,
      type: isSuspending ? 'security_notice' : 'account_reactivated',
      userId: customer._id,
      statusCategory: 'security',
    });
  } catch (err) {
    logger.error(`Failed to send status email to ${customer.email}: ${err.message}`);
  }

  res.status(200).json({
    success: true,
    message: `Customer account ${status === 'active' ? 'reactivated' : (status === 'blocked' ? 'blocked' : 'deactivated')} successfully`,
    data: {
      id: customer._id,
      status: customer.status,
      isActive: customer.isActive,
    },
  });
});

/**
 * POST /api/v1/admin/customers/:id/resend-verification
 */
export const resendCustomerVerificationEmail = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const customer = await User.findOne({ _id: id, role: 'customer' }).select('+tokenVersion +adminTokenVersion');
  if (!customer) {
    return next(new ApiError(404, 'Customer not found'));
  }

  if (customer.isVerified) {
    return res.status(200).json({
      success: true,
      message: 'Customer email is already verified',
    });
  }

  const verificationToken = customer.createEmailVerificationToken();
  await customer.save({ validateBeforeSave: false });

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: customer.email,
      subject: 'Verify your NovaShop account',
      text: `Hello ${customer.name},\n\nPlease verify your email by clicking: ${verifyUrl}\n\nLink expires in 24 hours.`,
      type: 'verification',
      userId: customer._id,
    });
  } catch (err) {
    logger.error(`Failed to dispatch verification email to ${customer.email}: ${err.message}`);
  }

  res.status(200).json({
    success: true,
    message: `Verification email dispatched to ${customer.email}`,
  });
});

/**
 * POST /api/v1/admin/customers
 * Admin-only customer creation. Creates account in "invited" state, sends single-use expiring invite link.
 */
export const createAdminCustomer = asyncHandler(async (req, res, next) => {
  const {
    firstName,
    lastName,
    name: providedName,
    email,
    phone,
    country,
    street,
    street2,
    city,
    state,
    postalCode,
    internalNotes = '',
    marketingConsent = false,
    status = 'active',
  } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  // Case-insensitive duplicate check
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new ApiError(400, 'A customer or account with this email address already exists.'));
  }

  const fullName = (providedName || `${firstName || ''} ${lastName || ''}`).trim();
  const sanitizedPhone = phone ? sanitizePhoneNumber(phone) : '';

  // Generate random crypto temporary password & invite token
  const tempPassword = crypto.randomBytes(32).toString('hex');
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const hashedResetToken = crypto.createHash('sha256').update(inviteToken).digest('hex');

  const newUser = await User.create({
    name: fullName,
    firstName: firstName || '',
    lastName: lastName || '',
    email: normalizedEmail,
    phone: sanitizedPhone,
    password: tempPassword,
    role: 'customer',
    status: status === 'active' ? 'invited' : status,
    isActive: true,
    isVerified: false,
    isInvited: true,
    inviteToken,
    inviteExpires,
    passwordResetToken: hashedResetToken,
    passwordResetExpires: inviteExpires,
    internalNotes,
    marketingConsent: Boolean(marketingConsent),
  });

  // Create default address if provided
  if (street || city) {
    try {
      await Address.create({
        user: newUser._id,
        label: 'Default',
        firstName: firstName || fullName.split(' ')[0] || 'Customer',
        lastName: lastName || fullName.split(' ').slice(1).join(' ') || 'Account',
        phone: sanitizedPhone || '+251911000000',
        street: street || 'Central Street',
        street2: street2 || '',
        city: city || 'Addis Ababa',
        state: state || 'Addis Ababa',
        postalCode: postalCode || '1000',
        country: country || 'Ethiopia',
        isDefault: true,
      });
    } catch (addrErr) {
      logger.warn(`Could not save initial address for ${normalizedEmail}: ${addrErr.message}`);
    }
  }

  // Send invitation email with signed, expiring, single-use link
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/reset-password?token=${inviteToken}&email=${encodeURIComponent(normalizedEmail)}&invite=true`;

  const inviteHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #231E1B; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <div style="border-bottom: 2px solid #231E1B; padding-bottom: 12px; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0; color: #231E1B;">Welcome to NovaShop</h2>
        <span style="font-size: 12px; color: #7A726C; text-transform: uppercase; letter-spacing: 0.1em;">Account Invitation</span>
      </div>
      <p style="font-size: 15px; margin-bottom: 16px;">Hello ${fullName},</p>
      <p style="font-size: 15px; margin-bottom: 16px;">An account has been created for you on NovaShop. Click the link below to set your password and access your customer dashboard, orders, and curated collections:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${inviteLink}" style="display: inline-block; padding: 13px 28px; background-color: #1B1816; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.05em;">Set Your Password &amp; Activate Account</a>
      </div>
      <p style="font-size: 13px; color: #7A726C; margin-top: 24px;">This invitation link will expire in 7 days and can only be used once. If you did not expect this invitation, you can safely ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: 'NovaShop: Welcome! Set your account password',
      html: inviteHtml,
      text: `Hello ${fullName},\n\nAn account has been created for you on NovaShop.\nPlease set your password here:\n${inviteLink}\n\nThis link expires in 7 days.`,
      type: 'customer_invite',
      userId: newUser._id,
      statusCategory: 'security',
    });
  } catch (emailErr) {
    logger.error(`Failed to send invite email to ${normalizedEmail}: ${emailErr.message}`);
  }

  // Central audit log
  await AuditLog.create({
    action: 'customer_created',
    section: 'customers',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: newUser._id.toString(),
    metadata: {
      customerEmail: normalizedEmail,
      customerName: fullName,
      status: newUser.status,
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  const userSafe = newUser.toObject();
  delete userSafe.password;
  delete userSafe.inviteToken;
  delete userSafe.inviteExpires;
  delete userSafe.passwordResetToken;
  delete userSafe.passwordResetExpires;
  delete userSafe.refreshToken;
  delete userSafe.adminRefreshToken;

  res.status(201).json({
    success: true,
    message: 'Customer account created and invitation email dispatched.',
    data: userSafe,
  });
});

/**
 * PATCH /api/v1/admin/customers/:id
 * Prefilled edit customer endpoint with audit log.
 */
export const updateAdminCustomer = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    name: providedName,
    phone,
    country,
    street,
    street2,
    city,
    state,
    postalCode,
    internalNotes,
    marketingConsent,
    status,
  } = req.body;

  const customer = await User.findOne({ _id: id, role: 'customer' }).select('+tokenVersion +adminTokenVersion');
  if (!customer) {
    return next(new ApiError(404, 'Customer not found'));
  }

  const oldValues = {
    name: customer.name,
    phone: customer.phone,
    status: customer.status,
  };

  if (firstName !== undefined || lastName !== undefined || providedName !== undefined) {
    if (firstName !== undefined) customer.firstName = firstName;
    if (lastName !== undefined) customer.lastName = lastName;
    customer.name = (providedName || `${customer.firstName || ''} ${customer.lastName || ''}`).trim() || customer.name;
  }

  if (phone !== undefined) {
    customer.phone = phone ? sanitizePhoneNumber(phone) : '';
  }

  if (internalNotes !== undefined) {
    customer.internalNotes = internalNotes;
  }

  if (marketingConsent !== undefined) {
    customer.marketingConsent = Boolean(marketingConsent);
  }

  if (status && ['active', 'deactivated', 'blocked', 'invited', 'inactive'].includes(status)) {
    customer.status = status;
    if (status === 'deactivated' || status === 'blocked') {
      customer.isActive = false;
      customer.tokenVersion = (customer.tokenVersion || 0) + 1;
      customer.adminTokenVersion = (customer.adminTokenVersion || customer.tokenVersion || 0) + 1;
      customer.refreshToken = null;
      customer.adminRefreshToken = null;
    } else if (status === 'active') {
      customer.isActive = true;
    }
  }

  await customer.save();

  // If address info updated
  if (street || city || country) {
    let defaultAddr = await Address.findOne({ user: customer._id, isDefault: true });
    if (!defaultAddr) {
      defaultAddr = await Address.findOne({ user: customer._id });
    }
    if (defaultAddr) {
      if (street) defaultAddr.street = street;
      if (street2 !== undefined) defaultAddr.street2 = street2;
      if (city) defaultAddr.city = city;
      if (state !== undefined) defaultAddr.state = state;
      if (postalCode !== undefined) defaultAddr.postalCode = postalCode;
      if (country) defaultAddr.country = country;
      if (phone) defaultAddr.phone = customer.phone || defaultAddr.phone;
      await defaultAddr.save();
    } else {
      await Address.create({
        user: customer._id,
        label: 'Default',
        firstName: customer.firstName || customer.name.split(' ')[0] || 'Customer',
        lastName: customer.lastName || customer.name.split(' ').slice(1).join(' ') || '',
        phone: customer.phone || '+251911000000',
        street: street || 'Central Street',
        street2: street2 || '',
        city: city || 'Addis Ababa',
        state: state || 'Addis Ababa',
        postalCode: postalCode || '1000',
        country: country || 'Ethiopia',
        isDefault: true,
      });
    }
  }

  // Audit log
  await AuditLog.create({
    action: 'customer_updated',
    section: 'customers',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: customer._id.toString(),
    changes: [
      { field: 'name', oldValue: oldValues.name, newValue: customer.name },
      { field: 'status', oldValue: oldValues.status, newValue: customer.status },
    ],
    metadata: {
      customerEmail: customer.email,
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  const customerSafe = customer.toObject();
  delete customerSafe.password;
  delete customerSafe.inviteToken;
  delete customerSafe.inviteExpires;
  delete customerSafe.refreshToken;
  delete customerSafe.adminRefreshToken;

  res.status(200).json({
    success: true,
    message: 'Customer record updated successfully.',
    data: customerSafe,
  });
});

/**
 * POST /api/v1/admin/customers/:id/resend-invite
 */
/**
 * POST /api/v1/admin/customers/:id/resend-invite
 * Generates a new single-use token, invalidates old token, sends invite email, and records audit log.
 */
export const resendCustomerInvite = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const customer = await User.findOne({ _id: id, role: 'customer' }).select('+tokenVersion +adminTokenVersion');
  if (!customer) {
    return next(new ApiError(404, 'Customer account not found'));
  }

  // Deduplicate rapid double clicks within 10 seconds
  const recentLog = await EmailLog.findOne({
    to: customer.email.toLowerCase().trim(),
    type: 'customer_invite',
    createdAt: { $gte: new Date(Date.now() - 10 * 1000) },
  });
  if (recentLog && recentLog.status === 'sent') {
    return res.status(200).json({
      success: true,
      message: `Invitation email already sent to ${customer.email}.`,
      data: { inviteExpires: customer.inviteExpires },
    });
  }

  // Generate a new cryptographically secure token & invalidate old token
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  customer.inviteToken = inviteToken;
  customer.inviteExpires = inviteExpires;
  customer.status = 'invited';
  await customer.save();

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/reset-password?token=${inviteToken}&email=${encodeURIComponent(customer.email)}&invite=true`;

  const inviteHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #231E1B; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <div style="border-bottom: 2px solid #231E1B; padding-bottom: 12px; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0; color: #231E1B;">NovaShop Account Invitation</h2>
      </div>
      <p style="font-size: 15px; margin-bottom: 16px;">Hello ${customer.name},</p>
      <p style="font-size: 15px; margin-bottom: 16px;">Here is your updated invitation link to activate your NovaShop account and set your password:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${inviteLink}" style="display: inline-block; padding: 13px 28px; background-color: #1B1816; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Activate Account</a>
      </div>
      <p style="font-size: 13px; color: #7A726C;">This link will expire in 7 days.</p>
    </div>
  `;

  const sendResult = await sendEmail({
    to: customer.email,
    subject: 'NovaShop: Account invitation link',
    html: inviteHtml,
    text: `Hello ${customer.name},\n\nPlease activate your NovaShop account and set your password:\n${inviteLink}`,
    type: 'customer_invite',
    userId: customer._id,
    statusCategory: 'security',
    adminUserId: req.user._id,
    adminName: req.user.name || req.user.email,
  });

  // Central audit log
  await AuditLog.create({
    action: 'customer_invite_resent',
    section: 'customers',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: customer._id.toString(),
    metadata: {
      customerEmail: customer.email,
      inviteExpires,
      status: sendResult.success ? 'sent' : 'failed',
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  const customerSafe = customer.toObject();
  delete customerSafe.password;
  delete customerSafe.inviteToken;

  res.status(200).json({
    success: sendResult.success,
    message: sendResult.success
      ? `Invitation email resent to ${customer.email}.`
      : `Failed to dispatch invitation email: ${sendResult.error}`,
    data: {
      inviteExpires,
      customer: customerSafe,
    },
  });
});

/**
 * POST /api/v1/admin/customers/:id/email
 * Sends email directly to customer, prefixing subject with "NovaShop: " and setting Reply-To to support mailbox with [NS-T-xxxx] format.
 */
export const sendCustomerAdminEmail = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { subject, message, template, orderId, idempotencyKey: bodyKey } = req.body;

  const customer = await User.findOne({ _id: id, role: 'customer' }).select('+tokenVersion +adminTokenVersion');
  if (!customer) {
    return next(new ApiError(404, 'Customer not found'));
  }

  // Reject sending emails to blocked or anonymized customers
  if (
    customer.status === 'blocked' ||
    customer.status === 'deactivated' ||
    (customer.email && (customer.email.includes('@novashop.internal') || customer.email.startsWith('deleted_')))
  ) {
    return next(new ApiError(400, 'Cannot send email to blocked or anonymized customer'));
  }

  if (!subject || !subject.trim()) {
    return next(new ApiError(400, 'Email subject is required'));
  }

  // Protection against header injection
  if (/[\r\n]/.test(subject)) {
    return next(new ApiError(400, 'Invalid characters in email subject'));
  }

  if (!message || !message.trim()) {
    return next(new ApiError(400, 'Email message body is required'));
  }

  // Server-side deduplication against double submits
  const idempotencyKey = req.headers['x-idempotency-key'] || bodyKey || null;
  const recentDuplicate = await EmailLog.findOne({
    to: customer.email.toLowerCase().trim(),
    type: 'admin_message',
    createdAt: { $gte: new Date(Date.now() - 12 * 1000) },
    ...(idempotencyKey ? { idempotencyKey } : { preview: message.slice(0, 160) }),
  });
  if (recentDuplicate) {
    logger.info(`[sendCustomerAdminEmail] Deduplicated identical email to ${customer.email}`);
    return res.status(200).json({
      success: recentDuplicate.status === 'sent',
      message: recentDuplicate.status === 'sent' ? `Email successfully sent to ${customer.email}.` : `Email delivery failed: ${recentDuplicate.error}`,
      data: recentDuplicate,
    });
  }

  // Fetch store name and support email from Settings
  let storeName = 'NovaShop';
  let supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@novashop.com';
  try {
    const settings = await Setting.getSettings();
    if (settings?.storeDetails?.storeName) storeName = settings.storeDetails.storeName;
    if (settings?.storeDetails?.supportEmail) supportEmail = settings.storeDetails.supportEmail;
  } catch {}

  // Generate unique ticket number NS-T-xxxx
  const ticketNumber = await generateTicketNumber();

  // Prefix subject with storeName and include ticket reference
  const cleanSubj = subject.trim().replace(/^novashop\s*[-—|:]\s*/i, '');
  const finalSubject = `${storeName}: [${ticketNumber}] ${cleanSubj}`;

  // Sanitize message body: no raw HTML, convert paragraphs, bold, and markdown links
  const safeMessageHtml = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color: #9A6A2D; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n+/g, '</p><p style="margin-bottom: 14px;">')
    .replace(/\n/g, '<br/>');

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #231E1B; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <div style="border-bottom: 2px solid #231E1B; padding-bottom: 12px; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0; color: #231E1B;">${storeName}</h2>
        <span style="font-size: 11px; color: #7A726C; text-transform: uppercase; letter-spacing: 0.1em;">Reference ${ticketNumber}</span>
      </div>
      <p style="font-size: 15px; margin-bottom: 16px;">Hello ${customer.name},</p>
      <div style="font-size: 14px; color: #231E1B; margin-bottom: 24px;">
        <p style="margin-bottom: 14px;">${safeMessageHtml}</p>
      </div>
      <div style="border-top: 1px solid #EFEAE4; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #7A726C;">
        You can reply directly to this email to continue the conversation with our support team.
      </div>
    </div>
  `;

  const sendResult = await sendEmail({
    to: customer.email,
    subject: finalSubject,
    html: emailHtml,
    text: `Hello ${customer.name},\n\n${message.trim()}\n\n---\nReply directly to this email for support (Reference: ${ticketNumber}).`,
    replyTo: supportEmail,
    type: 'admin_message',
    userId: customer._id,
    orderId: orderId || null,
    statusCategory: 'order',
    idempotencyKey,
    adminUserId: req.user._id,
    adminName: req.user.name || req.user.email,
  });

  const deliveryStatus = sendResult.success ? 'sent' : 'failed';
  const deliveryError = sendResult.error || null;

  // Create or match support Conversation so customer replies thread directly into support
  let conversation = await Conversation.findOne({ ticketNumber });
  if (!conversation) {
    conversation = await Conversation.create({
      ticketNumber,
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      subject: cleanSubj,
      status: 'Replied',
      channel: 'email',
      lastMessagePreview: message.slice(0, 160),
      lastMessageAt: new Date(),
      firstResponseAt: new Date(),
      assignedTo: req.user._id,
      assignedToName: req.user.name || 'Support Team',
      tags: ['admin_outreach'],
    });
  }

  await Message.create({
    conversation: conversation._id,
    senderType: 'admin',
    senderUser: req.user._id,
    senderName: req.user.name || `${storeName} Admin`,
    senderEmail: req.user.email,
    body: message,
    channel: 'email',
    ticketNumber,
  }).catch(() => {});

  // Update preview on the single authoritative EmailLog created by sendEmail
  let emailLog = null;
  if (sendResult.logId) {
    emailLog = await EmailLog.findByIdAndUpdate(
      sendResult.logId,
      { preview: message.slice(0, 160) },
      { returnDocument: 'after' }
    );
  } else {
    emailLog = await EmailLog.findOne({
      to: customer.email.toLowerCase().trim(),
      type: 'admin_message',
    }).sort({ createdAt: -1 });
  }

  // Central audit log
  await AuditLog.create({
    action: 'customer_email_sent',
    section: 'customers',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: customer._id.toString(),
    metadata: {
      customerEmail: customer.email,
      ticketNumber,
      subject: finalSubject,
      status: deliveryStatus,
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  res.status(200).json({
    success: deliveryStatus === 'sent',
    message: deliveryStatus === 'sent' ? `Email successfully sent to ${customer.email}.` : `Email delivery failed: ${deliveryError}`,
    data: emailLog,
  });
});

/**
 * POST /api/v1/admin/customers/:id/email/:logId/retry
 */
export const retryCustomerAdminEmail = asyncHandler(async (req, res, next) => {
  const { id, logId } = req.params;
  const log = await EmailLog.findById(logId);
  if (!log) {
    return next(new ApiError(404, 'Email log entry not found'));
  }

  const customer = await User.findById(id);
  if (!customer) {
    return next(new ApiError(404, 'Customer not found'));
  }

  const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@novashop.com';
  try {
    const sendResult = await sendEmail({
      to: customer.email,
      subject: log.subject,
      text: log.preview || log.subject,
      replyTo: supportEmail,
      type: log.type || 'admin_message',
      userId: customer._id,
      statusCategory: 'order',
    });

    log.status = sendResult.success ? 'sent' : 'failed';
    log.error = sendResult.error || null;
    await log.save();

    res.status(200).json({
      success: true,
      message: sendResult.success ? 'Email resent successfully.' : 'Retry attempt failed.',
      data: log,
    });
  } catch (err) {
    log.status = 'failed';
    log.error = err.message;
    await log.save();
    return next(new ApiError(500, `Retry failed: ${err.message}`));
  }
});

/**
 * DELETE /api/v1/admin/customers/:id
 * Safe delete flow: Checks existing orders/activity. If records exist, enforces Anonymize and deactivate.
 */
export const deleteAdminCustomer = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id).select('+tokenVersion +adminTokenVersion');

  if (!user) {
    return next(new ApiError(404, 'Customer not found'));
  }

  if (user._id.toString() === req.user._id.toString()) {
    return next(new ApiError(400, 'You cannot delete your own admin account'));
  }

  // Safe delete check: Check orders, payments, return requests, support conversations
  const [orderCount, paymentCount, returnCount, conversationCount] = await Promise.all([
    Order.countDocuments({ user: user._id }),
    Payment.countDocuments({ user: user._id }),
    ReturnRequest.countDocuments({ user: user._id }),
    Conversation.countDocuments({ customer: user._id }),
  ]);

  const totalActivity = orderCount + paymentCount + returnCount + conversationCount;
  const isAnonymizeRequested = req.query.action === 'anonymize' || req.body?.action === 'anonymize';

  if (totalActivity > 0) {
    if (!isAnonymizeRequested) {
      return res.status(400).json({
        success: false,
        hasActivity: true,
        orderCount,
        paymentCount,
        returnCount,
        conversationCount,
        message: `This customer has ${orderCount} order(s) and active records on file. To preserve accounting history and comply with regulations, please choose "Anonymize and deactivate".`,
      });
    }

    // GDPR-compliant scrub: keep records for accounting, wipe PII
    user.name = 'Deleted Customer';
    user.firstName = 'Deleted';
    user.lastName = 'Customer';
    user.email = `deleted_${user._id}@novashop.com`;
    user.phone = '';
    user.avatar = '';
    user.bio = '';
    user.status = 'deactivated';
    user.isActive = false;
    user.marketingConsent = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.adminTokenVersion = (user.adminTokenVersion || user.tokenVersion || 0) + 1;
    user.refreshToken = null;
    user.adminRefreshToken = null;
    user.internalNotes = `Customer personal data scrubbed and account deactivated on ${new Date().toISOString()} by ${req.user.email}`;
    await user.save({ validateBeforeSave: false });

    // Remove saved addresses
    await Address.deleteMany({ user: user._id });

    await AuditLog.create({
      action: 'customer_anonymized',
      section: 'customers',
      performedBy: req.user._id,
      performerEmail: req.user.email,
      targetEntityId: user._id.toString(),
      metadata: {
        reason: 'GDPR anonymize and deactivate',
        preservedOrders: orderCount,
      },
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Customer account was safely anonymized and deactivated. Order history preserved for accounting.',
      data: { id: user._id, status: 'deactivated', anonymized: true },
    });
  }

  // 0 activity: allow complete hard delete
  await Address.deleteMany({ user: user._id });
  await user.deleteOne();

  await AuditLog.create({
    action: 'customer_deleted',
    section: 'customers',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: id,
    metadata: {
      customerEmail: user.email,
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Customer account permanently deleted.',
  });
});

// =========================================================================
// 4. INVENTORY CONTROLLER & LOW-STOCK ENGINE
// =========================================================================

/**
 * GET /api/v1/admin/inventory
 * Real table of variants with on hand, reserved, available, status, and urgency sorting.
 */
export const getAdminInventoryList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { search, category, stockState, sortBy = 'urgency', sortOrder = 'asc' } = req.query;

  const globalThreshold = await getGlobalLowStockThreshold();

  const variantMatch = {};

  if (category && category !== 'All categories' && category !== 'all') {
    let catId = category;
    if (!mongoose.Types.ObjectId.isValid(category)) {
      const foundCat = await Category.findOne({
        $or: [{ slug: category.toLowerCase() }, { name: new RegExp(`^${category}$`, 'i') }],
      });
      if (foundCat) catId = foundCat._id;
    }
    const matchingProducts = await Product.find({ category: catId }).distinct('_id');
    variantMatch.product = { $in: matchingProducts };
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const matchingProducts = await Product.find({ name: regex }).distinct('_id');
    variantMatch.$or = [{ sku: regex }, { size: regex }, { product: { $in: matchingProducts } }];
  }

  const pipeline = [
    { $match: variantMatch },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDoc',
      },
    },
    { $unwind: '$productDoc' },
    {
      $lookup: {
        from: 'categories',
        localField: 'productDoc.category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    {
      $addFields: {
        reservedQty: { $ifNull: ['$reserved', 0] },
        effectiveThreshold: { $ifNull: ['$lowStockThreshold', globalThreshold] },
      },
    },
    {
      $addFields: {
        available: {
          $max: [0, { $subtract: ['$stock', '$reservedQty'] }],
        },
      },
    },
    {
      $addFields: {
        stockStatus: {
          $cond: [
            { $eq: ['$available', 0] },
            'out_of_stock',
            {
              $cond: [
                { $lte: ['$available', { $ceil: { $divide: ['$effectiveThreshold', 2] } }] },
                'critical',
                {
                  $cond: [{ $lte: ['$available', '$effectiveThreshold'] }, 'low', 'in_stock'],
                },
              ],
            },
          ],
        },
        urgencyScore: {
          $cond: [
            { $eq: ['$available', 0] },
            1,
            {
              $cond: [
                { $lte: ['$available', { $ceil: { $divide: ['$effectiveThreshold', 2] } }] },
                2,
                {
                  $cond: [{ $lte: ['$available', '$effectiveThreshold'] }, 3, 4],
                },
              ],
            },
          ],
        },
      },
    },
  ];

  if (stockState && stockState !== 'all') {
    pipeline.push({ $match: { stockStatus: stockState } });
  }

  // Count total matches
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await ProductVariant.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Sorting
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortStage = {};
  if (sortBy === 'urgency') sortStage.urgencyScore = 1;
  else if (sortBy === 'stock') sortStage.available = sortDirection;
  else if (sortBy === 'sku') sortStage.sku = sortDirection;
  else if (sortBy === 'name') sortStage['productDoc.name'] = sortDirection;
  else sortStage.updatedAt = sortDirection;

  pipeline.push({ $sort: sortStage });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  const rawVariants = await ProductVariant.aggregate(pipeline);

  const formattedVariants = rawVariants.map((item) => {
    const cat = item.categoryDoc[0];
    return {
      _id: item._id,
      id: item._id.toString(),
      sku: item.sku,
      size: item.size,
      color: item.color,
      price: item.price != null ? item.price : item.productDoc.price,
      stock: item.stock,
      reserved: item.reservedQty,
      available: item.available,
      lowStockThreshold: item.lowStockThreshold,
      effectiveThreshold: item.effectiveThreshold,
      status:
        item.stockStatus === 'out_of_stock'
          ? 'Out of stock'
          : item.stockStatus === 'critical'
          ? 'Critical'
          : item.stockStatus === 'low'
          ? 'Low stock'
          : 'In stock',
      updatedAt: item.updatedAt,
      product: {
        _id: item.productDoc._id,
        id: item.productDoc._id.toString(),
        name: item.productDoc.name,
        slug: item.productDoc.slug,
        image: item.productDoc.image || (item.productDoc.images && item.productDoc.images[0]) || '',
        category: cat ? cat.name : 'Uncategorized',
      },
    };
  });

  // Calculate summary stats across whole inventory
  const [totalUnitsAgg, statusAgg] = await Promise.all([
    ProductVariant.aggregate([
      {
        $group: {
          _id: null,
          totalUnits: { $sum: '$stock' },
          totalValue: { $sum: { $multiply: ['$stock', { $ifNull: ['$price', 0] }] } },
        },
      },
    ]),
    ProductVariant.aggregate([
      {
        $addFields: {
          thresh: { $ifNull: ['$lowStockThreshold', globalThreshold] },
          res: { $ifNull: ['$reserved', 0] },
        },
      },
      {
        $addFields: {
          avail: { $max: [0, { $subtract: ['$stock', '$res'] }] },
        },
      },
      {
        $group: {
          _id: null,
          outOfStock: { $sum: { $cond: [{ $eq: ['$avail', 0] }, 1, 0] } },
          critical: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$avail', 0] },
                    { $lte: ['$avail', { $ceil: { $divide: ['$thresh', 2] } }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$avail', { $ceil: { $divide: ['$thresh', 2] } }] },
                    { $lte: ['$avail', '$thresh'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const unitsData = totalUnitsAgg[0] || { totalUnits: 0, totalValue: 0 };
  const statusData = statusAgg[0] || { outOfStock: 0, critical: 0, lowStock: 0 };

  res.status(200).json({
    success: true,
    data: formattedVariants,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats: {
      totalUnits: unitsData.totalUnits,
      totalValue: unitsData.totalValue,
      lowStockCount: statusData.lowStock,
      criticalCount: statusData.critical,
      outOfStockCount: statusData.outOfStock,
      globalThreshold,
    },
  });
});

/**
 * POST /api/v1/admin/inventory/adjust
 * Adjusts stock with required reason in transaction and writes an InventoryMovement.
 */
export const adjustStockAction = asyncHandler(async (req, res, next) => {
  const { variantId, mode = 'delta', value, reason } = req.body;

  try {
    const result = await adjustVariantStock({
      variantId,
      mode,
      value,
      reason,
      adminId: req.user._id,
      type: Number(value) > 0 ? 'restock' : 'adjustment',
    });

    res.status(200).json({
      success: true,
      message: 'Stock updated and movement recorded',
      data: result,
    });
  } catch (err) {
    return next(new ApiError(400, err.message));
  }
});

/**
 * POST /api/v1/admin/inventory/bulk-restock
 * Handles dry-run validation preview and batch transactional restock.
 */
export const bulkRestockAction = asyncHandler(async (req, res, next) => {
  const { preview = false, rows = [] } = req.body;

  const skus = rows.map((r) => r.sku.trim().toUpperCase());
  const variants = await ProductVariant.find({ sku: { $in: skus } }).populate('product', 'name');

  const variantMap = new Map(variants.map((v) => [v.sku, v]));
  const previewResults = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sku = row.sku.trim().toUpperCase();
    const qty = parseInt(row.quantity, 10);
    const variant = variantMap.get(sku);

    if (!variant) {
      errors.push({ row: i + 1, sku, message: `SKU "${sku}" was not found in catalog` });
      continue;
    }
    if (isNaN(qty) || qty <= 0) {
      errors.push({ row: i + 1, sku, message: 'Quantity must be a positive integer' });
      continue;
    }

    previewResults.push({
      variantId: variant._id,
      sku,
      productName: variant.product?.name || 'Product',
      size: variant.size,
      color: variant.color?.name || 'Color',
      stockBefore: variant.stock,
      quantityAdded: qty,
      stockAfter: variant.stock + qty,
      reason: row.reason?.trim() || 'Bulk CSV restock',
    });
  }

  if (preview) {
    return res.status(200).json({
      success: errors.length === 0,
      preview: true,
      totalRows: rows.length,
      validRows: previewResults.length,
      errors,
      rows: previewResults,
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot apply restock due to validation errors',
      errors,
    });
  }

  // Apply batch restock in transaction
  await withTransaction(async (session) => {
    for (const item of previewResults) {
      const variant = await ProductVariant.findById(item.variantId, null, { session });
      if (!variant) continue;

      const stockBefore = variant.stock;
      const stockAfter = stockBefore + item.quantityAdded;
      variant.stock = stockAfter;
      await variant.save({ session });

      await recordMovement({
        variantId: variant._id,
        productId: variant.product,
        type: 'restock',
        quantityChange: item.quantityAdded,
        stockBefore,
        stockAfter,
        reason: item.reason,
        adminId: req.user._id,
        session,
      });

      await checkAndTriggerLowStockAlert(variant, session);
      await syncProductStock(variant.product, session);
    }
  });

  await clearCachePattern('products');

  res.status(200).json({
    success: true,
    message: `Successfully restocked ${previewResults.length} variant(s)`,
    appliedCount: previewResults.length,
  });
});

/**
 * GET /api/v1/admin/inventory/movements/:variantId?
 * Returns movement history for a specific variant or catalog-wide.
 */
export const getVariantMovementsList = asyncHandler(async (req, res, next) => {
  const { variantId } = req.params;
  const filter = variantId && variantId !== 'all' ? { variant: variantId } : {};

  const movements = await InventoryMovement.find(filter)
    .populate('admin', 'name email')
    .populate('order', 'orderNumber status')
    .populate({
      path: 'variant',
      select: 'sku size color product',
      populate: { path: 'product', select: 'name slug image images' },
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.status(200).json({
    success: true,
    data: movements,
  });
});

/**
 * PATCH /api/v1/admin/inventory/variants/:variantId/threshold
 * Sets reorder level / lowStockThreshold on a specific variant.
 */
export const updateVariantThresholdAction = asyncHandler(async (req, res, next) => {
  const { variantId } = req.params;
  const { lowStockThreshold } = req.body;

  if (!mongoose.Types.ObjectId.isValid(variantId)) {
    return next(new ApiError(400, 'Invalid variant ID'));
  }

  const variant = await ProductVariant.findByIdAndUpdate(
    variantId,
    { lowStockThreshold: Number(lowStockThreshold) },
    { returnDocument: 'after', runValidators: true }
  ).populate('product', 'name');

  if (!variant) {
    return next(new ApiError(404, 'Variant not found'));
  }

  res.status(200).json({
    success: true,
    message: `Reorder level updated to ${lowStockThreshold} units.`,
    data: variant,
  });
});

/**
 * GET /api/v1/admin/inventory/export
 * Downloads CSV of current catalog inventory.
 */
export const exportInventoryCsv = asyncHandler(async (req, res) => {
  const globalThreshold = await getGlobalLowStockThreshold();

  const variants = await ProductVariant.find()
    .populate('product', 'name category')
    .sort({ sku: 1 })
    .lean();

  const categoryIds = variants.map((v) => v.product?.category).filter(Boolean);
  const categories = await Category.find({ _id: { $in: categoryIds } }).lean();
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const headers = [
    'SKU',
    'Product Name',
    'Category',
    'Size',
    'Color',
    'On Hand',
    'Reserved',
    'Available',
    'Low Stock Threshold',
    'Status',
    'Last Updated',
  ];

  const rows = [headers];

  variants.forEach((v) => {
    const onHand = v.stock || 0;
    const reserved = v.reserved || 0;
    const available = Math.max(0, onHand - reserved);
    const threshold = v.lowStockThreshold != null ? v.lowStockThreshold : globalThreshold;

    let status = 'In stock';
    if (available === 0) status = 'Out of stock';
    else if (available <= Math.ceil(threshold / 2)) status = 'Critical';
    else if (available <= threshold) status = 'Low stock';

    const catName = v.product?.category ? categoryMap.get(v.product.category.toString()) || 'General' : 'General';
    const color = typeof v.color === 'object' ? v.color?.name || 'N/A' : v.color || 'N/A';

    rows.push([
      v.sku,
      v.product?.name || 'Product',
      catName,
      v.size,
      color,
      onHand,
      reserved,
      available,
      threshold,
      status,
      new Date(v.updatedAt || Date.now()).toISOString().split('T')[0],
    ]);
  });

  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="novashop-inventory.csv"');
  res.status(200).send(csvContent);
});

/**
 * GET /api/v1/admin/settings/inventory
 */
export const getInventorySettings = asyncHandler(async (req, res) => {
  const lowStockThreshold = await getGlobalLowStockThreshold();
  res.status(200).json({
    success: true,
    data: { lowStockThreshold },
  });
});

/**
 * PATCH /api/v1/admin/settings/inventory
 */
export const updateInventorySettings = asyncHandler(async (req, res) => {
  const { lowStockThreshold } = req.body;

  await Setting.setSetting(
    'lowStockThreshold',
    lowStockThreshold,
    'Global threshold below which product variants are flagged as low stock'
  );

  res.status(200).json({
    success: true,
    message: 'Inventory settings updated',
    data: { lowStockThreshold },
  });
});

// =========================================================================
// 5. NOTIFICATIONS CONTROLLER
// =========================================================================

/**
 * GET /api/v1/admin/notifications/all
 * Paginated notifications list with filtering by type and read status.
 */
export const getAdminNotificationsPaginated = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const { type, unreadOnly } = req.query;

  const filter = {};
  if (type && type !== 'all') {
    filter.type = type;
  }
  if (unreadOnly === 'true' || unreadOnly === true) {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    AdminNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminNotification.countDocuments(filter),
    AdminNotification.countDocuments({ isRead: false }),
  ]);

  res.status(200).json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

/**
 * DELETE /api/v1/admin/notifications/:id
 */
export const deleteAdminNotification = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const notif = await AdminNotification.findByIdAndDelete(id);
  if (!notif) {
    return next(new ApiError(404, 'Notification not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Notification deleted',
  });
});
