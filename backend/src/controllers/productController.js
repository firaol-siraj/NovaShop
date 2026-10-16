import Product from "../models/productModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Category from "../models/categoryModel.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { clearCachePattern } from "../utils/clearCache.js";
import { deleteProductImages } from "../services/productImageService.js";

// Helper to slugify string
const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");

// Helper to generate SKU
const generateSku = (productSlug, colorName, size) => {
  const cleanSlug = (productSlug || "PROD").slice(0, 5).toUpperCase();
  const cleanColor = (colorName || "CLR").slice(0, 3).toUpperCase();
  const cleanSize = (size || "OS").toUpperCase();
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `NOV-${cleanSlug}-${cleanColor}-${cleanSize}-${randomSuffix}`;
};

const publicProductCriteria = () => ({
  status: "active",
  user: { $type: "objectId" },
  name: { $type: "string", $ne: "" },
  slug: { $type: "string", $ne: "" },
  category: { $type: "objectId" },
  description: { $type: "string", $ne: "" },
  price: { $type: "number", $gte: 0 },
  image: {
    $type: "string",
    $regex: /^(?:https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?|\/(?!\/)\S+)$/i,
  },
});

// @desc    Fetch products with multi-attribute fashion filtering, search & pagination
// @route   GET /api/v1/products
// @access  Public
export const getProducts = asyncHandler(async (req, res, next) => {
  const pageSize = Number(req.query.pageSize) || 8;
  const page = Number(req.query.pageNumber) || 1;

  const query = publicProductCriteria();

  // 1. Keyword search
  if (req.query.keyword) {
    query.$text = { $search: req.query.keyword };
  }

  // 2. Category filter (ID or Slug or Name)
  const categoryParam = req.query.category || req.query.categoryId;
  if (categoryParam) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(categoryParam);
    if (isObjectId) {
      query.category = categoryParam;
    } else {
      const categoryDoc = await Category.findOne({
        $or: [
          { slug: categoryParam.toLowerCase() },
          { name: new RegExp(`^${categoryParam}$`, "i") },
        ],
      });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      } else {
        // Category not found; return empty result set cleanly
        return res.status(200).json({
          success: true,
          page,
          pages: 0,
          totalProducts: 0,
          data: [],
        });
      }
    }
  }

  // 3. Gender filter
  if (req.query.gender) {
    query.gender = req.query.gender.toLowerCase();
  }

  // 4. Price range filter
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    if (req.query.minPrice !== undefined) {
      query.price.$gte = Number(req.query.minPrice);
    }
    if (req.query.maxPrice !== undefined) {
      query.price.$lte = Number(req.query.maxPrice);
    }
  }

  // 5. Size / Color variant filtering
  if (req.query.size || req.query.color) {
    const variantQuery = {};
    if (req.query.size) {
      variantQuery.size = req.query.size.toUpperCase();
    }
    if (req.query.color) {
      variantQuery["color.name"] = new RegExp(`^${req.query.color}$`, "i");
    }

    const matchingVariants =
      await ProductVariant.find(variantQuery).select("product");
    const productIds = matchingVariants.map((v) => v.product);
    query._id = { $in: productIds };
  }

  const projection = req.query.keyword ? { score: { $meta: "textScore" } } : {};
  const sortOptions = req.query.keyword
    ? { score: { $meta: "textScore" } }
    : { createdAt: -1 };

  const count = await Product.countDocuments(query);
  const products = await Product.find(query, projection)
    .populate("category", "name slug description image")
    .populate("variants")
    .sort(sortOptions)
    .skip(pageSize * (page - 1))
    .limit(pageSize);

  res.status(200).json({
    success: true,
    page,
    pages: Math.ceil(count / pageSize),
    totalProducts: count,
    data: products,
  });
});

// @desc    Fetch ALL products (including drafts and archived) for the admin dashboard
// @route   GET /api/v1/products/admin/all
// @access  Private/Admin
export const getAdminProducts = asyncHandler(async (req, res, next) => {
  const pageSize = Math.min(Number(req.query.pageSize) || 100, 200);
  const page = Number(req.query.pageNumber) || 1;

  const query = {};
  if (["draft", "active", "archived"].includes(req.query.status)) {
    query.status = req.query.status;
  }

  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .populate("category", "name slug")
    .populate("variants")
    .sort({ createdAt: -1 })
    .skip(pageSize * (page - 1))
    .limit(pageSize);

  res.status(200).json({
    success: true,
    page,
    pages: Math.ceil(count / pageSize),
    totalProducts: count,
    data: products,
  });
});

// @desc    Fetch single product by ID or Slug
// @route   GET /api/v1/products/:id
// @access  Public
export const getProductById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  const query = {
    ...publicProductCriteria(),
    ...(isObjectId ? { _id: id } : { slug: id.toLowerCase() }),
  };

  const product = await Product.findOne(query)
    .populate("category", "name slug description image")
    .populate("variants");

  if (!product) {
    return next(new ApiError(404, "Product not found"));
  }

  res.status(200).json({ success: true, data: product });
});

// @desc    Create a product with variants
// @route   POST /api/v1/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res, next) => {
  const {
    name,
    slug,
    price,
    basePrice,
    description,
    image,
    images,
    imagePublicIds = [],
    brand,
    category,
    gender,
    material,
    careInstructions,
    fit,
    status,
    variants = [],
  } = req.body;

  const isCategoryId = /^[0-9a-fA-F]{24}$/.test(category);
  const categoryDoc = isCategoryId
    ? await Category.findById(category)
    : await Category.findOne({
        $or: [{ slug: category.toLowerCase() }, { name: category }],
      });
  if (!categoryDoc) {
    return next(new ApiError(400, "Selected category does not exist"));
  }
  const categoryId = categoryDoc._id;

  const productSlug = slug ? slugify(slug) : slugify(name);
  const existingProduct = await Product.findOne({ slug: productSlug });
  if (existingProduct) {
    return next(new ApiError(400, "Product with this slug already exists"));
  }

  const productPrice = price !== undefined ? price : basePrice || 0;
  const imageList = images && images.length > 0 ? images : [image];

  const product = await Product.create({
    user: req.user._id,
    name,
    slug: productSlug,
    price: productPrice,
    countInStock: Number(req.body.countInStock) || 0,
    description,
    image,
    images: imageList,
    imagePublicIds,
    brand: brand || "NovaShop",
    category: categoryId,
    gender: gender || "unisex",
    material: material || "100% Cotton",
    careInstructions: careInstructions || "Machine wash cold",
    fit: fit || "Regular",
    status: status || "active",
  });

  // Create variants if supplied
  let createdVariants = [];
  let totalStock = 0;

  if (variants && variants.length > 0) {
    for (const v of variants) {
      const colorObj =
        typeof v.color === "string"
          ? { name: v.color, hex: "#000000" }
          : v.color;

      const variantSku =
        v.sku || generateSku(productSlug, colorObj.name, v.size);
      const variantStock = Number(v.stock) || 0;
      totalStock += variantStock;

      const newVariant = await ProductVariant.create({
        product: product._id,
        sku: variantSku,
        size: v.size.toUpperCase(),
        color: colorObj,
        price: Number(v.price) > 0 ? Number(v.price) : null,
        stock: variantStock,
        image: v.image || image,
      });

      createdVariants.push(newVariant);
    }
  } else {
    // Create a default variant if none supplied to keep catalog functional
    const defaultSku = generateSku(productSlug, "Black", "M");
    const defaultStock =
      req.body.countInStock != null ? Number(req.body.countInStock) : 10;
    totalStock = defaultStock;

    const defaultVariant = await ProductVariant.create({
      product: product._id,
      sku: defaultSku,
      size: "M",
      color: { name: "Black", hex: "#000000" },
      stock: defaultStock,
      image,
    });
    createdVariants.push(defaultVariant);
  }

  product.countInStock = totalStock;
  await product.save();

  await clearCachePattern("products");

  const populatedProduct = await Product.findById(product._id)
    .populate("category", "name slug description image")
    .populate("variants");

  res.status(201).json({ success: true, data: populatedProduct });
});

// @desc    Update a product & variants
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, "Product not found"));
  }

  const { variants, category, imagePublicIds, ...updateFields } = req.body;
  const previousImagePublicIds = product.imagePublicIds || [];
  if (imagePublicIds) {
    product.imagePublicIds = imagePublicIds;
  }

  if (category) {
    const isCategoryId = /^[0-9a-fA-F]{24}$/.test(category);
    const categoryDoc = isCategoryId
      ? await Category.findById(category)
      : await Category.findOne({
          $or: [{ slug: category.toLowerCase() }, { name: category }],
        });
    if (!categoryDoc) {
      return next(new ApiError(400, "Selected category does not exist"));
    }
    updateFields.category = categoryDoc._id;
  }

  Object.assign(product, updateFields);

  if (variants && Array.isArray(variants)) {
    let totalStock = 0;
    for (const v of variants) {
      const colorObj =
        typeof v.color === "string"
          ? { name: v.color, hex: "#000000" }
          : v.color;
      const variantStock = Number(v.stock) || 0;
      totalStock += variantStock;

      if (v.sku) {
        await ProductVariant.findOneAndUpdate(
          { product: product._id, sku: v.sku },
          {
            size: v.size.toUpperCase(),
            color: colorObj,
            price: Number(v.price) > 0 ? Number(v.price) : null,
            stock: variantStock,
            image: v.image || product.image,
          },
          { upsert: true, new: true },
        );
      }
    }
    product.countInStock = totalStock;
  }

  await product.save();
  await clearCachePattern("products");

  const removedImagePublicIds = previousImagePublicIds.filter(
    (publicId) => !product.imagePublicIds.includes(publicId),
  );
  if (removedImagePublicIds.length) {
    await deleteProductImages(removedImagePublicIds).catch((error) => {
      console.error("Unable to clean replaced product images:", error.message);
    });
  }

  const updatedProduct = await Product.findById(product._id)
    .populate("category", "name slug description image")
    .populate("variants");

  res.status(200).json({ success: true, data: updatedProduct });
});

// @desc    Delete a product & its variants
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, "Product not found"));
  }

  const imagePublicIds = product.imagePublicIds || [];
  await ProductVariant.deleteMany({ product: product._id });
  await product.deleteOne();

  if (imagePublicIds.length) {
    await deleteProductImages(imagePublicIds).catch((error) => {
      console.error("Unable to clean deleted product images:", error.message);
    });
  }

  await clearCachePattern("products");
  res
    .status(200)
    .json({ success: true, message: "Product removed successfully" });
});

// @desc    Create new review
// @route   POST /api/v1/products/:id/reviews
// @access  Private
export const createProductReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, "Product not found"));
  }

  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString(),
  );

  if (alreadyReviewed) {
    return next(new ApiError(400, "Product already reviewed by this user"));
  }

  const review = {
    name: req.user.name,
    rating: Number(rating),
    comment,
    user: req.user._id,
  };

  product.reviews.push(review);
  product.numReviews = product.reviews.length;
  product.rating =
    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length;

  await product.save();
  await clearCachePattern("products");

  res.status(201).json({ success: true, message: "Review added successfully" });
});
