import Wishlist from '../models/wishlistModel.js';
import Product from '../models/productModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const MAX_WISHLIST_ITEMS = 200;

const PRODUCT_SELECT =
  'name slug brand image images price countInStock status category gender material fit careInstructions description rating numReviews reviews';

// Only active, existing products are shown; non-active or deleted products
// stay in storage but are hidden from the response.
const buildWishlistResponse = async (wishlist) => {
  const productIds = wishlist.items.map((item) => item.product);

  const products = await Product.find({
    _id: { $in: productIds },
    status: 'active',
  })
    .select(PRODUCT_SELECT)
    .populate('category', 'name slug description image')
    .populate('variants')
    .lean({ virtuals: true });

  // Preserve the user's insertion order.
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const items = wishlist.items
    .map((item) => byId.get(String(item.product)))
    .filter(Boolean);

  return { items, count: items.length };
};

// @desc    Get authenticated user's wishlist
// @route   GET /api/v1/wishlist
// @access  Private
export const getWishlist = asyncHandler(async (req, res, next) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
  }

  res.status(200).json({
    success: true,
    data: await buildWishlistResponse(wishlist),
  });
});

// @desc    Add a product to the wishlist (idempotent)
// @route   POST /api/v1/wishlist/items
// @access  Private
export const addWishlistItem = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }
  if (product.status !== 'active') {
    return next(new ApiError(400, 'This product is not available'));
  }

  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = new Wishlist({ user: req.user._id, items: [] });
  }

  const exists = wishlist.items.some(
    (item) => item.product.toString() === productId
  );

  if (!exists) {
    if (wishlist.items.length >= MAX_WISHLIST_ITEMS) {
      return next(
        new ApiError(400, `Your wishlist is limited to ${MAX_WISHLIST_ITEMS} items`)
      );
    }
    wishlist.items.push({ product: productId });
    await wishlist.save();
  }

  res.status(200).json({
    success: true,
    message: exists ? 'Product already in wishlist' : 'Product added to wishlist',
    data: await buildWishlistResponse(wishlist),
  });
});

// @desc    Merge guest wishlist products (login flow, idempotent)
// @route   POST /api/v1/wishlist/merge
// @access  Private
export const mergeWishlist = asyncHandler(async (req, res, next) => {
  const { productIds = [] } = req.body;

  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = new Wishlist({ user: req.user._id, items: [] });
  }

  // Ignore invalid ids, non-existent products, and non-active products.
  const validProducts = await Product.find({
    _id: { $in: productIds },
    status: 'active',
  }).select('_id');
  const validIds = new Set(validProducts.map((product) => String(product._id)));

  const ignored = productIds.filter((id) => !validIds.has(id));

  for (const productId of validIds) {
    const exists = wishlist.items.some(
      (item) => String(item.product) === productId
    );
    if (exists) continue;
    if (wishlist.items.length >= MAX_WISHLIST_ITEMS) break;
    wishlist.items.push({ product: productId });
  }

  await wishlist.save();

  res.status(200).json({
    success: true,
    message: 'Wishlist merged',
    data: {
      ...(await buildWishlistResponse(wishlist)),
      ignored,
    },
  });
});

// @desc    Remove a product from the wishlist (owner only)
// @route   DELETE /api/v1/wishlist/items/:productId
// @access  Private
export const removeWishlistItem = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;

  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    return next(new ApiError(404, 'Wishlist not found'));
  }

  const item = wishlist.items.find(
    (entry) => entry.product.toString() === productId
  );
  if (!item) {
    return next(new ApiError(404, 'Product not found in wishlist'));
  }

  wishlist.items = wishlist.items.filter(
    (entry) => entry.product.toString() !== productId
  );
  await wishlist.save();

  res.status(200).json({
    success: true,
    message: 'Product removed from wishlist',
    data: await buildWishlistResponse(wishlist),
  });
});

// @desc    Clear the wishlist (owner only)
// @route   DELETE /api/v1/wishlist
// @access  Private
export const clearWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });

  if (wishlist) {
    wishlist.items = [];
    await wishlist.save();
  }

  res.status(200).json({
    success: true,
    message: 'Wishlist cleared',
    data: { items: [], count: 0 },
  });
});
