import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getUnitPrice, MAX_QTY_PER_LINE } from '../utils/pricing.js';

const PRODUCT_SELECT = 'name slug brand image price status';
const VARIANT_SELECT = 'sku size color stock price image';

const loadPopulatedCart = (cartId) =>
  Cart.findById(cartId)
    .populate({ path: 'items.product', select: PRODUCT_SELECT })
    .populate({ path: 'items.variant', select: VARIANT_SELECT });

// Removes cart lines whose product or variant was deleted, persisting the result.
const pruneInvalidLines = async (cart) => {
  const originalLength = cart.items.length;
  cart.items = cart.items.filter((item) => item.product && item.variant);
  if (cart.items.length !== originalLength) {
    await cart.save();
  }
  return cart;
};

/**
 * Builds the client-facing cart payload. Prices are ALWAYS computed on the
 * server via getUnitPrice; nothing from the client is trusted.
 */
export const buildCartResponse = (cart) => {
  if (!cart) {
    return { items: [], subtotal: 0, itemCount: 0, hasIssues: false };
  }

  let subtotal = 0;
  let itemCount = 0;
  let hasIssues = false;

  const items = cart.items
    .filter((item) => item.product && item.variant)
    .map((item) => {
      const product = item.product;
      const variant = item.variant;
      const price = getUnitPrice(product, variant);
      const stock = Number(variant.stock) || 0;
      const maxQuantity = Math.min(stock, MAX_QTY_PER_LINE);

      let issue = null;
      if (product.status !== 'active') {
        issue = 'unavailable';
      } else if (stock <= 0) {
        issue = 'out_of_stock';
      } else if (item.quantity > stock) {
        issue = 'quantity_exceeds_stock';
      }

      if (issue) {
        hasIssues = true;
      } else {
        subtotal += price * item.quantity;
        itemCount += item.quantity;
      }

      return {
        _id: item._id,
        productId: product._id,
        variantId: variant._id,
        slug: product.slug,
        name: product.name,
        image: variant.image || product.image,
        color: typeof variant.color === 'string' ? variant.color : variant.color?.name,
        size: variant.size,
        sku: variant.sku,
        price,
        quantity: item.quantity,
        stock,
        available: product.status === 'active' && stock > 0,
        maxQuantity,
        issue,
      };
    });

  return {
    items,
    subtotal: Number(subtotal.toFixed(2)),
    itemCount,
    hasIssues,
  };
};

// @desc    Get authenticated user's cart (pruning deleted lines)
// @route   GET /api/v1/cart
// @access  Private
export const getCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  } else {
    // Populate first so the prune can detect deleted products/variants.
    cart = await loadPopulatedCart(cart._id);
    await pruneInvalidLines(cart);
    cart = await loadPopulatedCart(cart._id);
  }

  res.status(200).json({
    success: true,
    data: buildCartResponse(cart),
  });
});

// @desc    Add item to user's cart
// @route   POST /api/v1/cart/items
// @access  Private
export const addCartItem = asyncHandler(async (req, res, next) => {
  const { productId, variantId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }
  if (product.status !== 'active') {
    return next(new ApiError(400, 'This product is not available'));
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    return next(new ApiError(404, 'Product variant not found'));
  }
  if (variant.product.toString() !== product._id.toString()) {
    return next(new ApiError(400, 'Selected variant does not belong to this product'));
  }

  const stock = Number(variant.stock) || 0;
  if (stock <= 0) {
    return next(new ApiError(409, 'This item is out of stock'));
  }

  const maxAllowed = Math.min(stock, MAX_QTY_PER_LINE);

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  const existingItem = cart.items.find(
    (item) =>
      item.product.toString() === productId &&
      item.variant.toString() === variantId,
  );

  const newQuantity = (existingItem?.quantity || 0) + quantity;
  if (newQuantity > maxAllowed) {
    return next(
      new ApiError(
        400,
        existingItem
          ? `This line already has ${existingItem.quantity} in your bag. You can have at most ${maxAllowed} of this item.`
          : `Only ${maxAllowed} of this item can be added to your bag.`
      )
    );
  }

  if (existingItem) {
    existingItem.quantity = newQuantity;
  } else {
    cart.items.push({ product: productId, variant: variantId, quantity });
  }

  await cart.save();

  const updatedCart = await loadPopulatedCart(cart._id);

  res.status(200).json({
    success: true,
    message: 'Item added to cart',
    data: buildCartResponse(updatedCart),
  });
});

// @desc    Update quantity of a cart line (absolute value)
// @route   PATCH /api/v1/cart/items/:itemId
// @access  Private
export const updateCartItem = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new ApiError(404, 'Cart not found'));
  }

  const cartItem = cart.items.id(itemId);
  if (!cartItem) {
    return next(new ApiError(404, 'Cart item not found'));
  }

  const variant = await ProductVariant.findById(cartItem.variant);
  if (!variant) {
    // Variant was deleted underneath us — prune the line and report it gone.
    cart.items.pull(itemId);
    await cart.save();
    return next(new ApiError(404, 'Cart item no longer exists'));
  }

  const stock = Number(variant.stock) || 0;
  const maxAllowed = Math.min(stock, MAX_QTY_PER_LINE);

  if (stock <= 0) {
    return next(new ApiError(409, 'This item is out of stock'));
  }
  if (quantity > maxAllowed) {
    return next(
      new ApiError(400, `Only ${maxAllowed} of this item are available.`)
    );
  }

  cartItem.quantity = quantity;
  await cart.save();

  const updatedCart = await loadPopulatedCart(cart._id);

  res.status(200).json({
    success: true,
    message: 'Cart item quantity updated',
    data: buildCartResponse(updatedCart),
  });
});

// @desc    Remove an item from cart (owner only)
// @route   DELETE /api/v1/cart/items/:itemId
// @access  Private
export const removeCartItem = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new ApiError(404, 'Cart not found'));
  }

  const cartItem = cart.items.id(itemId);
  if (!cartItem) {
    return next(new ApiError(404, 'Cart item not found'));
  }

  cart.items.pull(itemId);
  await cart.save();

  const updatedCart = await loadPopulatedCart(cart._id);

  res.status(200).json({
    success: true,
    message: 'Cart item removed',
    data: buildCartResponse(updatedCart),
  });
});

// @desc    Clear entire cart (owner only)
// @route   DELETE /api/v1/cart
// @access  Private
export const clearCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (cart) {
    cart.items = [];
    await cart.save();
  }

  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
    data: buildCartResponse(cart),
  });
});


// @desc    Merge guest cart lines into the server cart (login flow)
// @route   POST /api/v1/cart/merge
// @access  Private
export const mergeCart = asyncHandler(async (req, res, next) => {
  const { items = [] } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  const skipped = [];
  const adjusted = [];

  for (const guestLine of items) {
    const { productId, variantId, quantity } = guestLine;

    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      skipped.push({ productId, variantId, reason: 'unavailable' });
      continue;
    }

    const variant = await ProductVariant.findById(variantId);
    if (!variant || variant.product.toString() !== productId) {
      skipped.push({ productId, variantId, reason: 'unavailable' });
      continue;
    }

    const stock = Number(variant.stock) || 0;
    if (stock <= 0) {
      skipped.push({ productId, variantId, reason: 'out_of_stock' });
      continue;
    }

    const maxAllowed = Math.min(stock, MAX_QTY_PER_LINE);

    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === productId &&
        item.variant.toString() === variantId,
    );

    // Take the larger of server/guest quantities (never the sum) so merging
    // twice cannot double-add; always clamp to the available maximum.
    const requested = Math.max(existingItem?.quantity || 0, quantity);
    const finalQuantity = Math.min(requested, maxAllowed);

    if (finalQuantity !== requested) {
      adjusted.push({
        productId,
        variantId,
        from: requested,
        to: finalQuantity,
      });
    }

    if (existingItem) {
      existingItem.quantity = finalQuantity;
    } else {
      cart.items.push({
        product: productId,
        variant: variantId,
        quantity: finalQuantity,
      });
    }
  }

  await cart.save();

  const updatedCart = await loadPopulatedCart(cart._id);

  res.status(200).json({
    success: true,
    message: 'Cart merged',
    data: {
      ...buildCartResponse(updatedCart),
      skipped,
      adjusted,
    },
  });
});

