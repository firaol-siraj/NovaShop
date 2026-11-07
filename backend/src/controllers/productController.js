import Product from "../models/productModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Category from "../models/categoryModel.js";
import Order from "../models/orderModel.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { clearCachePattern } from "../utils/clearCache.js";
import { deleteProductImages } from "../services/productImageService.js";

// Helper to escape user input before constructing RegExp
const escapeRegex = (str) =>
  String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  const pageSize = Number(req.query.pageSize) || 12;
  const page = Number(req.query.pageNumber) || 1;

  const query = publicProductCriteria();
  const andClauses = [];

  // 1. Keyword search (regex safe against injection or crash)
  const rawKeyword = req.query.keyword || req.query.q || req.query.search;
  if (rawKeyword) {
    const cleanKeyword = String(rawKeyword).trim();
    if (cleanKeyword) {
      const keywordRegex = new RegExp(escapeRegex(cleanKeyword), "i");
      andClauses.push({
        $or: [
          { name: keywordRegex },
          { brand: keywordRegex },
          { description: keywordRegex },
        ],
      });
    }
  }

  // 1b. Collection filter (slug or predefined aliases)
  const collectionParam = (req.query.collection || "").trim().toLowerCase();
  if (collectionParam) {
    if (collectionParam === "new-arrivals") {
      if (!req.query.sort) req.query.sort = "newest";
    } else if (collectionParam === "best-sellers" || collectionParam === "bestsellers") {
      if (!req.query.sort) req.query.sort = "best-selling";
    } else {
      const collCategory = await Category.findOne({
        $or: [
          { slug: collectionParam },
          { name: new RegExp(`^${escapeRegex(collectionParam)}$`, "i") },
        ],
      });
      if (collCategory) {
        const childCats = await Category.find({ parent: collCategory._id }).select("_id");
        const catIds = [collCategory._id, ...childCats.map((c) => c._id)];
        query.category = { $in: catIds };
      }
    }
  }

  // 2. Category filter (ID or Slug or Name)
  const categoryParam = req.query.category || req.query.categoryId;
  if (categoryParam && categoryParam.trim() && categoryParam.toLowerCase() !== "all") {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(categoryParam);
    if (isObjectId) {
      query.category = categoryParam;
    } else {
      const safeCatParam = escapeRegex(categoryParam);
      const categoryDoc = await Category.findOne({
        $or: [
          { slug: categoryParam.toLowerCase() },
          { name: new RegExp(`^${safeCatParam}$`, "i") },
        ],
      });

      if (["men", "women", "kids"].includes(categoryParam.toLowerCase())) {
        const childCategories = categoryDoc
          ? await Category.find({ parent: categoryDoc._id }).select("_id")
          : [];
        const categoryIds = categoryDoc
          ? [categoryDoc._id, ...childCategories.map((c) => c._id)]
          : [];

        andClauses.push({
          $or: [
            ...(categoryIds.length > 0 ? [{ category: { $in: categoryIds } }] : []),
            { gender: categoryParam.toLowerCase() },
            { gender: "unisex" },
          ],
        });
      } else if (categoryDoc) {
        const childCategories = await Category.find({ parent: categoryDoc._id }).select("_id");
        if (childCategories.length > 0) {
          query.category = { $in: [categoryDoc._id, ...childCategories.map((c) => c._id)] };
        } else {
          query.category = categoryDoc._id;
        }
      } else {
        // Category not found; return empty result set cleanly
        return res.status(200).json({
          success: true,
          page,
          pages: 0,
          pageSize,
          totalProducts: 0,
          hasNext: false,
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
  if (req.query.minPrice !== undefined && req.query.minPrice !== "") {
    const min = Number(req.query.minPrice);
    if (Number.isFinite(min)) {
      query.price = { ...(query.price || {}), $gte: Math.max(0, min) };
    }
  }
  if (req.query.maxPrice !== undefined && req.query.maxPrice !== "") {
    const max = Number(req.query.maxPrice);
    if (Number.isFinite(max)) {
      query.price = { ...(query.price || {}), $lte: max };
    }
  }

  // 5. Size / Color / InStock variant filtering
  const variantQuery = {};
  let hasVariantFilters = false;

  const rawSizeParam = req.query.sizes || req.query.size;
  if (rawSizeParam) {
    const rawSizes = Array.isArray(rawSizeParam)
      ? rawSizeParam
      : String(rawSizeParam).split(",");
    const sizes = rawSizes.map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (sizes.length === 1) {
      variantQuery.size = sizes[0];
      hasVariantFilters = true;
    } else if (sizes.length > 1) {
      variantQuery.size = { $in: sizes };
      hasVariantFilters = true;
    }
  }

  const rawColorParam = req.query.colors || req.query.color;
  if (rawColorParam) {
    const rawColors = Array.isArray(rawColorParam)
      ? rawColorParam
      : String(rawColorParam).split(",");
    const colors = rawColors.map((c) => c.trim()).filter(Boolean);
    if (colors.length === 1) {
      variantQuery["color.name"] = new RegExp(`^${escapeRegex(colors[0])}$`, "i");
      hasVariantFilters = true;
    } else if (colors.length > 1) {
      variantQuery["color.name"] = {
        $in: colors.map((c) => new RegExp(`^${escapeRegex(c)}$`, "i")),
      };
      hasVariantFilters = true;
    }
  }

  // 5b. Rating filter
  if (req.query.rating !== undefined && req.query.rating !== "") {
    const minRating = Number(req.query.rating);
    if (Number.isFinite(minRating) && minRating > 0) {
      query.rating = { ...(query.rating || {}), $gte: minRating };
    }
  }

  const isInStockRequested =
    req.query.inStock === true ||
    req.query.inStock === "true" ||
    req.query.inStock === 1 ||
    req.query.inStock === "1";

  if (hasVariantFilters) {
    if (isInStockRequested) {
      variantQuery.stock = { $gt: 0 };
    }
    const matchingVariants = await ProductVariant.find(variantQuery).select("product");
    const productIds = matchingVariants.map((v) => v.product);
    query._id = { $in: productIds };
  } else if (isInStockRequested) {
    const inStockVariantProductIds = await ProductVariant.find({ stock: { $gt: 0 } }).distinct("product");
    andClauses.push({
      $or: [
        { countInStock: { $gt: 0 } },
        { _id: { $in: inStockVariantProductIds } },
      ],
    });
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  // 6. Sorting with deterministic tie-breaker (_id: -1)
  const sortParam = String(req.query.sort || "recommended").toLowerCase();
  let sortOptions = { createdAt: -1, _id: -1 };
  let isBestselling = false;

  if (sortParam === "low-high" || sortParam === "price-asc" || sortParam === "price-low") {
    sortOptions = { price: 1, _id: -1 };
  } else if (sortParam === "high-low" || sortParam === "price-desc" || sortParam === "price-high") {
    sortOptions = { price: -1, _id: -1 };
  } else if (sortParam === "newest" || sortParam === "date-desc") {
    sortOptions = { createdAt: -1, _id: -1 };
  } else if (sortParam === "top-rated" || sortParam === "rating") {
    sortOptions = { rating: -1, numReviews: -1, _id: -1 };
  } else if (
    sortParam === "best-selling" ||
    sortParam === "bestselling" ||
    sortParam === "popular"
  ) {
    isBestselling = true;
  } else {
    // "recommended" or "featured" or unspecified
    sortOptions = { createdAt: -1, _id: -1 };
  }

  const count = await Product.countDocuments(query);
  const totalPages = Math.ceil(count / pageSize) || 0;

  let products = [];
  if (isBestselling) {
    let bestsellingProductIds = [];
    try {
      const bestsellers = await Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $unwind: "$orderItems" },
        {
          $group: {
            _id: "$orderItems.product",
            totalSold: { $sum: "$orderItems.qty" },
          },
        },
        { $sort: { totalSold: -1 } },
      ]);
      bestsellingProductIds = bestsellers.map((b) => b._id);
    } catch (err) {
      console.error("Order aggregation error for bestselling sort:", err.message);
    }

    if (bestsellingProductIds.length > 0) {
      products = await Product.aggregate([
        { $match: query },
        {
          $addFields: {
            salesRank: {
              $let: {
                vars: {
                  idx: { $indexOfArray: [bestsellingProductIds, "$_id"] },
                },
                in: {
                  $cond: {
                    if: { $eq: ["$$idx", -1] },
                    then: 999999999,
                    else: "$$idx",
                  },
                },
              },
            },
          },
        },
        {
          $sort: {
            salesRank: 1,
            rating: -1,
            numReviews: -1,
            createdAt: -1,
            _id: -1,
          },
        },
        { $skip: pageSize * (page - 1) },
        { $limit: pageSize },
      ]);
      await Product.populate(products, [
        { path: "category", select: "name slug description image" },
        { path: "variants" },
      ]);
    } else {
      products = await Product.find(query)
        .populate("category", "name slug description image")
        .populate("variants")
        .sort({ rating: -1, numReviews: -1, createdAt: -1, _id: -1 })
        .skip(pageSize * (page - 1))
        .limit(pageSize);
    }
  } else {
    products = await Product.find(query)
      .populate("category", "name slug description image")
      .populate("variants")
      .sort(sortOptions)
      .skip(pageSize * (page - 1))
      .limit(pageSize);
  }

  res.status(200).json({
    success: true,
    page,
    pages: totalPages,
    pageSize,
    totalProducts: count,
    hasNext: page < totalPages,
    appliedFilters: {
      category: req.query.category || req.query.categoryId || "all",
      collection: req.query.collection || null,
      keyword: rawKeyword ? String(rawKeyword).trim() : null,
      minPrice: req.query.minPrice !== undefined && req.query.minPrice !== "" ? Number(req.query.minPrice) : null,
      maxPrice: req.query.maxPrice !== undefined && req.query.maxPrice !== "" ? Number(req.query.maxPrice) : null,
      size: rawSizeParam || null,
      color: rawColorParam || null,
      inStock: isInStockRequested,
      sort: sortParam,
    },
    data: products,
  });
});

// @desc    Fetch product filter facets (categories, priceRange, sizes, colors)
// @route   GET /api/v1/products/filters
// @access  Public
export const getProductFilters = asyncHandler(async (req, res, next) => {
  const query = publicProductCriteria();
  const andClauses = [];

  // Keyword filter if provided
  if (req.query.keyword) {
    const cleanKeyword = req.query.keyword.trim();
    if (cleanKeyword) {
      const keywordRegex = new RegExp(escapeRegex(cleanKeyword), "i");
      andClauses.push({
        $or: [
          { name: keywordRegex },
          { brand: keywordRegex },
          { description: keywordRegex },
        ],
      });
    }
  }

  // Category filter if provided
  const categoryParam = req.query.category || req.query.categoryId;
  if (categoryParam && categoryParam.trim() && categoryParam.toLowerCase() !== "all") {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(categoryParam);
    if (isObjectId) {
      query.category = categoryParam;
    } else {
      const safeCatParam = escapeRegex(categoryParam);
      const categoryDoc = await Category.findOne({
        $or: [
          { slug: categoryParam.toLowerCase() },
          { name: new RegExp(`^${safeCatParam}$`, "i") },
        ],
      });
      if (categoryDoc) {
        const childCategories = await Category.find({ parent: categoryDoc._id }).select("_id");
        if (childCategories.length > 0) {
          query.category = { $in: [categoryDoc._id, ...childCategories.map((c) => c._id)] };
        } else {
          query.category = categoryDoc._id;
        }
      }
    }
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  const matchingProducts = await Product.find(query).select("_id price category");
  const matchingProductIds = matchingProducts.map((p) => p._id);

  let minPrice = 0;
  let maxPrice = 0;
  if (matchingProducts.length > 0) {
    const prices = matchingProducts.map((p) => p.price).filter((p) => Number.isFinite(p));
    if (prices.length > 0) {
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
    }
  }

  // Categories facet
  const allCategories = await Category.find({}).populate("children").sort({ name: 1 });
  const productCountPerCategory = {};
  const allActiveProducts = await Product.find(publicProductCriteria()).select("category");
  allActiveProducts.forEach((p) => {
    if (p.category) {
      const catId = p.category.toString();
      productCountPerCategory[catId] = (productCountPerCategory[catId] || 0) + 1;
    }
  });

  const categoryFacets = allCategories.map((cat) => {
    const directCount = productCountPerCategory[cat._id.toString()] || 0;
    const childCategories = allCategories.filter(
      (c) => c.parent && c.parent.toString() === cat._id.toString()
    );
    const childrenCount = childCategories.reduce(
      (sum, child) => sum + (productCountPerCategory[child._id.toString()] || 0),
      0
    );
    return {
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      parent: cat.parent,
      count: directCount + childrenCount,
    };
  });

  // Variant sizes and colors
  let sizes = [];
  let colors = [];
  let inStockCount = 0;

  if (matchingProductIds.length > 0) {
    const [variantStats, inStockMatching] = await Promise.all([
      ProductVariant.aggregate([
        { $match: { product: { $in: matchingProductIds } } },
        {
          $facet: {
            sizes: [
              { $match: { size: { $exists: true, $ne: "" } } },
              { $group: { _id: "$size", products: { $addToSet: "$product" } } },
              { $project: { _id: 0, value: "$_id", count: { $size: "$products" } } },
            ],
            colors: [
              {
                $match: {
                  "color.name": { $exists: true, $ne: "", $not: /^default$/i },
                  "color.hex": { $exists: true, $ne: "" },
                },
              },
              {
                $group: {
                  _id: { $toLower: "$color.name" },
                  name: { $first: "$color.name" },
                  hex: { $first: "$color.hex" },
                  products: { $addToSet: "$product" },
                },
              },
              { $project: { _id: 0, name: 1, hex: 1, count: { $size: "$products" } } },
              { $sort: { count: -1, name: 1 } },
            ],
          },
        },
      ]),
      Product.countDocuments({
        _id: { $in: matchingProductIds },
        countInStock: { $gt: 0 },
      }),
    ]);

    const rawSizes = variantStats[0]?.sizes || [];
    const canonicalOrder = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "ONE_SIZE", "OS"];
    sizes = rawSizes.sort((a, b) => {
      const idxA = canonicalOrder.indexOf(String(a.value).toUpperCase());
      const idxB = canonicalOrder.indexOf(String(b.value).toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      const numA = parseFloat(a.value);
      const numB = parseFloat(b.value);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.value).localeCompare(String(b.value));
    });

    colors = variantStats[0]?.colors || [];
    inStockCount = inStockMatching;
  }

  res.status(200).json({
    success: true,
    data: {
      categories: categoryFacets,
      priceRange: { min: minPrice, max: maxPrice },
      sizes,
      colors,
      inStockCount,
      totalCount: matchingProducts.length,
    },
  });
});

// @desc    Fetch products by an array of IDs (for wishlist hydration)
// @route   POST /api/v1/products/by-ids
// @access  Public
export const getProductsByIds = asyncHandler(async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const validIds = ids.filter((id) => /^[0-9a-fA-F]{24}$/.test(String(id)));
  if (validIds.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const products = await Product.find({
    _id: { $in: validIds },
    status: "active",
  })
    .populate("category", "name slug description image")
    .populate("variants");

  res.status(200).json({
    success: true,
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
  let product = null;

  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    product = await Product.findOne({
      ...publicProductCriteria(),
      _id: id,
    })
      .populate("category", "name slug description image")
      .populate("variants");
  }

  if (!product) {
    product = await Product.findOne({
      ...publicProductCriteria(),
      slug: id.toLowerCase(),
    })
      .populate("category", "name slug description image")
      .populate("variants");
  }

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
    const specifiedStockSum = variants.reduce(
      (acc, v) => acc + (Number.isInteger(Number(v.stock)) && Number(v.stock) > 0 ? Number(v.stock) : 0),
      0
    );
    const hasPerVariantStock = specifiedStockSum > 0;
    const requestedTotalStock = Math.max(0, parseInt(req.body.countInStock, 10) || 0);

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const colorObj =
        typeof v.color === "string"
          ? { name: v.color, hex: "#000000" }
          : v.color;

      const variantSku =
        v.sku || generateSku(productSlug, colorObj.name, v.size);

      let variantStock = Number(v.stock);
      if (!Number.isFinite(variantStock) || variantStock < 0) {
        variantStock = 0;
      }

      // If variants had no positive stock specified, but admin entered a total product stock
      if (!hasPerVariantStock && requestedTotalStock > 0) {
        const baseShare = Math.floor(requestedTotalStock / variants.length);
        const remainder = requestedTotalStock % variants.length;
        variantStock = baseShare + (i < remainder ? 1 : 0);
      }

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
      req.body.countInStock != null ? Math.max(0, parseInt(req.body.countInStock, 10) || 0) : 10;
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

  if (variants && Array.isArray(variants) && variants.length > 0) {
    let totalStock = 0;
    for (const v of variants) {
      const colorObj =
        typeof v.color === "string"
          ? { name: v.color, hex: "#000000" }
          : v.color;
      const variantStock = Math.max(0, parseInt(v.stock, 10) || 0);
      totalStock += variantStock;

      const queryCond = v._id
        ? { _id: v._id, product: product._id }
        : v.sku
          ? { product: product._id, sku: v.sku }
          : { product: product._id, size: v.size?.toUpperCase() || 'M', 'color.name': colorObj.name };

      await ProductVariant.findOneAndUpdate(
        queryCond,
        {
          size: v.size ? v.size.toUpperCase() : undefined,
          color: colorObj,
          price: Number(v.price) > 0 ? Number(v.price) : null,
          stock: variantStock,
          image: v.image || product.image,
        },
        { upsert: true, returnDocument: 'after' },
      );
    }
    product.countInStock = totalStock;
  } else if (req.body.countInStock !== undefined) {
    const newStock = Math.max(0, parseInt(req.body.countInStock, 10) || 0);
    const existingVariants = await ProductVariant.find({ product: product._id });
    if (existingVariants.length === 1) {
      existingVariants[0].stock = newStock;
      await existingVariants[0].save();
      product.countInStock = newStock;
    } else if (existingVariants.length > 1) {
      const allZero = existingVariants.every((v) => v.stock === 0);
      if (allZero && newStock > 0) {
        const baseShare = Math.floor(newStock / existingVariants.length);
        const remainder = newStock % existingVariants.length;
        for (let i = 0; i < existingVariants.length; i++) {
          existingVariants[i].stock = baseShare + (i < remainder ? 1 : 0);
          await existingVariants[i].save();
        }
      }
      product.countInStock = existingVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    } else {
      product.countInStock = newStock;
    }
  }

  // Ensure product.countInStock is authoritative from variants
  const finalVariants = await ProductVariant.find({ product: product._id });
  if (finalVariants.length > 0) {
    product.countInStock = finalVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
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
