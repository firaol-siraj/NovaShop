import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import Cart from '../models/cartModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { emailQueue, queueOrSendEmail } from '../queues/emailQueue.js';
import { getUnitPrice } from '../utils/pricing.js';
import chapaService from '../services/chapaService.js';
import paymentService from '../services/paymentService.js';
import logger from '../utils/logger.js';
import { clearCachePattern } from '../utils/clearCache.js';
import { sanitizePhoneNumber, formatPhoneForChapa } from '../utils/phone.js';
import {
  sendEmail,
  getOrderConfirmationEmail,
  getPaymentSuccessEmail,
  getOrderStatusEmail,
} from '../services/emailService.js';
import {
  syncProductStock,
} from '../services/inventoryService.js';
import {
  validateDiscount,
  findApplicableAutomaticDiscount,
  recordDiscountRedemption,
  reverseDiscountRedemption,
} from '../services/discountService.js';
import Setting from '../models/settingModel.js';
import { calculateTaxForOrder } from '../services/settingsService.js';

const ALLOWED_TRANSITIONS = {
  pending: ['pending_payment', 'paid', 'processing', 'cancelled'],
  pending_payment: ['paid', 'processing', 'cancelled'],
  paid: ['processing', 'shipped', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['out_for_delivery', 'delivered', 'cancelled', 'refunded'],
  out_for_delivery: ['delivered', 'cancelled', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

/**
 * Reconciles customer's server cart after verified order placement or payment.
 * Removes only the items that were included in the order.
 */
export const reconcileUserCart = async (userId, orderItems) => {
  if (!userId || !orderItems || orderItems.length === 0) return;
  try {
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items || cart.items.length === 0) return;

    const orderedProductIds = new Set(
      orderItems.map((item) => (item.product?._id || item.product).toString())
    );

    cart.items = cart.items.filter((cartItem) => {
      const cProdId = (cartItem.product?._id || cartItem.product).toString();
      return !orderedProductIds.has(cProdId);
    });

    await cart.save();
  } catch (err) {
    logger.error(`[OrderController] Error reconciling user cart: ${err.message}`);
  }
};

/**
 * Decrement stock for order items when payment is confirmed or for COD.
 */
export const decrementStockForOrder = async (order, session = null) => {
  if (order.isStockReserved) return;

  const sessionOption = session ? { session } : {};

  for (const item of order.orderItems) {
    const itemQty = Number(item.qty || 1);
    if (item.variant) {
      const variant = await ProductVariant.findById(item.variant, null, sessionOption);
      if (variant) {
        variant.stock = Math.max(0, variant.stock - itemQty);
        await variant.save(sessionOption);
        await syncProductStock(variant.product);
      }
    } else if (item.product) {
      const product = await Product.findById(item.product, null, sessionOption);
      if (product) {
        product.countInStock = Math.max(0, product.countInStock - itemQty);
        await product.save(sessionOption);
      }
    }
  }

  order.isStockReserved = true;
};

/**
 * Restore stock when order is cancelled or refunded.
 */
export const releaseStockForOrder = async (order) => {
  if (!order.isStockReserved) return;

  for (const item of order.orderItems) {
    const itemQty = Number(item.qty || 1);
    if (item.variant) {
      const variant = await ProductVariant.findById(item.variant);
      if (variant) {
        variant.stock += itemQty;
        await variant.save();
        await syncProductStock(variant.product);
      }
    } else if (item.product) {
      const product = await Product.findById(item.product);
      if (product) {
        product.countInStock += itemQty;
        await product.save();
      }
    }
  }

  order.isStockReserved = false;
};

/**
 * Periodically cancel expired unpaid orders and release stock.
 */
export const cancelExpiredUnpaidOrders = async () => {
  const now = new Date();
  const expiredOrders = await Order.find({
    isPaid: false,
    status: { $in: ['pending', 'pending_payment'] },
    stockReservedUntil: { $lte: now, $ne: null },
  });

  if (!expiredOrders.length) {
    return { cancelledCount: 0 };
  }

  let cancelledCount = 0;
  for (const order of expiredOrders) {
    try {
      await releaseStockForOrder(order);
      order.status = 'cancelled';
      order.paymentStatus = 'cancelled';
      order.stockReservedUntil = null;
      if (!order.statusHistory) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: 'Order automatically cancelled due to expiration of payment reservation window',
      });
      await order.save();
      cancelledCount++;
      logger.info(`[cancelExpiredUnpaidOrders] Cancelled expired unpaid order ${order._id} and released stock.`);
    } catch (orderErr) {
      logger.error(`[cancelExpiredUnpaidOrders] Failed to cancel order ${order._id}:`, orderErr);
    }
  }

  return { cancelledCount };
};

/**
 * Verifies that the payment provider's verified transaction amount and currency
 * accurately match the order's required total.
 * Handles ETB/USD currency conversion rates safely and strictly prevents underpayments.
 *
 * @param {Object} order - Mongoose Order document
 * @param {Object} verification - Normalized verified data from chapaService.verifyPayment
 * @returns {{ valid: boolean, reason?: string }}
 */
export const verifyPaymentAgainstOrder = (order, verification) => {
  if (!verification || !verification.success || verification.status !== 'success') {
    return { valid: false, reason: verification?.message || 'Gateway reported non-success payment status' };
  }

  const verifiedAmount = Number(verification.amount);
  const verifiedCurrency = (verification.currency || 'ETB').toUpperCase();
  const orderCurrency = (order.currency || 'USD').toUpperCase();
  const orderUSD = Number(order.totalPrice || 0);
  const usdRate = order.usdToEtbRate || chapaService.usdToEtbRate || 120;
  const orderETB = order.totalPriceETB ? Number(order.totalPriceETB) : Number((orderUSD * usdRate).toFixed(2));

  if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
    return { valid: false, reason: `Invalid verified payment amount: ${verification.amount}` };
  }

  let amountMatches = false;
  let currencyMatches = false;

  if (verifiedCurrency === 'ETB') {
    currencyMatches = true;
    const diffETB = Math.abs(verifiedAmount - orderETB);
    const convertedUSD = chapaService.convertToUsd(verifiedAmount);
    const diffUSD = Math.abs(convertedUSD - orderUSD);
    // Allow up to 2 ETB variance due to rounding or <= 0.05 USD equivalent
    amountMatches = diffETB <= 2.0 || diffUSD <= 0.05 || (orderETB > 0 && diffETB / orderETB < 0.015);
  } else if (verifiedCurrency === orderCurrency) {
    currencyMatches = true;
    amountMatches = Math.abs(verifiedAmount - orderUSD) <= 0.05;
  }

  if (!currencyMatches) {
    return {
      valid: false,
      reason: `Currency mismatch: order expects ETB or ${orderCurrency}, gateway returned ${verifiedCurrency}`,
    };
  }

  if (!amountMatches) {
    return {
      valid: false,
      reason: `Amount mismatch: expected $${orderUSD.toFixed(2)} USD (~${orderETB.toFixed(2)} ETB), gateway verified ${verifiedAmount} ${verifiedCurrency}`,
    };
  }

  return { valid: true };
};

/**
 * Confirms payment for an order idempotently, updates status, decrements stock,
 * reconciles cart, records payment and sends confirmation receipt email.
 */
export const markOrderPaid = async (orderOrId, verificationData = {}, recipientEmail = '') => {
  const orderId = orderOrId?._id || orderOrId;
  const existingOrder = await Order.findById(orderId).populate('user', 'name email');

  if (!existingOrder) {
    throw new Error(`Order ${orderId} not found for payment confirmation`);
  }

  if (existingOrder.isPaid && existingOrder.paymentStatus === 'paid') {
    logger.info(`[markOrderPaid] Order ${existingOrder._id} is already marked as paid. Skipping.`);
    return existingOrder;
  }

  const chapaRef =
    verificationData.chapaReference ||
    verificationData.chapa_reference ||
    verificationData.reference ||
    verificationData.txRef ||
    verificationData.tx_ref ||
    verificationData.id ||
    existingOrder.chapaReference ||
    existingOrder.paymentReference;

  const paidAt = existingOrder.paidAt || new Date();
  const paymentResult = {
    id: chapaRef,
    status: 'COMPLETED',
    update_time: new Date().toISOString(),
    email_address: recipientEmail || existingOrder.customerEmail || existingOrder.user?.email,
  };

  const isReplicaSet = Boolean(
    mongoose.connection?.client?.topology?.description?.type?.includes('ReplicaSet') ||
    (mongoose.connection?.client?.topology?.description?.servers &&
      mongoose.connection.client.topology.description.servers.size > 1)
  );

  let order;

  if (isReplicaSet) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Atomic claim: only the first claimant can update isPaid from false/unset
      const claimedOrder = await Order.findOneAndUpdate(
        { _id: orderId, isPaid: { $ne: true } },
        {
          $set: {
            isPaid: true,
            paidAt,
            paymentStatus: 'paid',
            status: 'processing',
            chapaReference: chapaRef,
            stockReservedUntil: null,
            paymentResult,
            isStockReserved: true,
          },
        },
        { session, new: true }
      ).populate('user', 'name email');

      if (!claimedOrder) {
        await session.abortTransaction();
        logger.info(`[markOrderPaid] Order ${orderId} was already claimed by concurrent request. Skipping.`);
        return await Order.findById(orderId).populate('user', 'name email');
      }

      // Decrement stock inside transaction if not already reserved (e.g. not COD)
      if (!existingOrder.isStockReserved) {
        await decrementStockForOrder(existingOrder, session);
      }

      await session.commitTransaction();
      order = claimedOrder;
    } catch (txErr) {
      try {
        await session.abortTransaction();
      } catch (_) {}
      logger.error(`[markOrderPaid] Transaction failed for order ${orderId}: ${txErr.message}`);
      throw txErr;
    } finally {
      try {
        await session.endSession();
      } catch (_) {}
    }
  } else {
    // Standalone fallback with atomic compare-and-swap and stock rollback on error
    const claimedOrder = await Order.findOneAndUpdate(
      { _id: orderId, isPaid: { $ne: true } },
      {
        $set: {
          isPaid: true,
          paidAt,
          paymentStatus: 'paid',
          status: 'processing',
          chapaReference: chapaRef,
          stockReservedUntil: null,
          paymentResult,
          isStockReserved: true,
        },
      },
      { new: true }
    ).populate('user', 'name email');

    if (!claimedOrder) {
      logger.info(`[markOrderPaid] Order ${orderId} was already claimed by concurrent request. Skipping.`);
      return await Order.findById(orderId).populate('user', 'name email');
    }

    try {
      if (!existingOrder.isStockReserved) {
        await decrementStockForOrder(existingOrder);
      }
    } catch (stockErr) {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          isPaid: false,
          paymentStatus: 'pending',
          status: 'pending',
          isStockReserved: false,
        },
      });
      logger.error(`[markOrderPaid] Stock deduction failed for order ${orderId}. Reverted payment status: ${stockErr.message}`);
      throw stockErr;
    }

    order = claimedOrder;
  }

  // Record discount redemption idempotently if discount applied
  if (order.discountCode || order.discountId) {
    try {
      await recordDiscountRedemption(order);
    } catch (redemptionErr) {
      logger.error(`[markOrderPaid] Failed to record discount redemption for order ${order._id}: ${redemptionErr.message}`);
    }
  }

  // Reconcile user cart
  const userId = order.user?._id || order.user;
  await reconcileUserCart(userId, order.orderItems);

  // Record in Payment collection
  try {
    await paymentService.recordSuccess({
      order,
      txRef: chapaRef,
      chapaReference: chapaRef,
      method: verificationData.paymentMethod || order.paymentMethod,
      rawMethod: verificationData.paymentMethod || verificationData.method,
      rawData: verificationData,
      paidAt: order.paidAt,
    });
  } catch (payErr) {
    logger.error(`[markOrderPaid] Failed to record payment in Payment model: ${payErr.message}`);
  }

  // Notify admins of new paid order
  try {
    await AdminNotification.create({
      type: 'new_order',
      title: `New Paid Order #${order.orderNumber || order._id}`,
      message: `Order #${order.orderNumber || order._id} confirmed paid for $${Number(order.totalPrice || 0).toFixed(2)}.`,
      entityType: 'order',
      entityId: order._id.toString(),
      link: `/admin/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber },
    });
  } catch (notifErr) {
    // Non-fatal
  }

  // Dispatch confirmation receipt email
  const targetEmail = (recipientEmail || order.customerEmail || order.user?.email || '').trim();
  if (targetEmail) {
    try {
      const emailContent = getPaymentSuccessEmail({ order, paymentResult: order.paymentResult });
      await queueOrSendEmail('sendPaymentReceiptEmail', {
        to: targetEmail,
        email: targetEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        message: emailContent.text,
        html: emailContent.html,
        orderId: order._id,
        userId: userId?.toString(),
      });
      order.paymentEmailSent = true;
      await order.save();
    } catch (emailErr) {
      logger.error(`[markOrderPaid] Error dispatching payment receipt email: ${emailErr.message}`);
    }
  }

  return order;
};

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
export const addOrderItems = asyncHandler(async (req, res, next) => {
  let {
    orderItems,
    shippingAddress,
    paymentMethod = 'Chapa',
    taxPrice = 0,
    shippingPrice = 0,
    currency = 'USD',
  } = req.body;

  // Validate shipping address required fields
  if (
    !shippingAddress ||
    !shippingAddress.address?.trim() ||
    !shippingAddress.city?.trim() ||
    !shippingAddress.postalCode?.trim() ||
    !shippingAddress.country?.trim()
  ) {
    return next(new ApiError(400, 'Invalid shippingAddress: address, city, postalCode, and country are required'));
  }

  // Populate from user's server-side cart if orderItems is omitted or empty
  if (!orderItems || orderItems.length === 0) {
    const userCart = await Cart.findOne({ user: req.user._id }).populate('items.product items.variant');
    if (userCart && userCart.items && userCart.items.length > 0) {
      orderItems = userCart.items.map((ci) => ({
        product: ci.product?._id ? ci.product._id.toString() : ci.product.toString(),
        variant: ci.variant?._id ? ci.variant._id.toString() : ci.variant ? ci.variant.toString() : null,
        qty: Number(ci.quantity || ci.qty || 1),
        price: ci.price,
      }));
    }
  }

  if (!orderItems || orderItems.length === 0) {
    return next(new ApiError(400, 'Order cart cannot be empty'));
  }

  const isCash = paymentMethod === 'Cash on Delivery' || paymentMethod === 'Cash';
  let calculatedItemsPrice = 0;
  const validatedOrderItems = [];
  const modifiedVariants = [];
  const modifiedProducts = [];

  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      return next(new ApiError(404, `Product not found: ${item.product}`));
    }

    if (product.status && product.status !== 'active') {
      return next(new ApiError(400, `Product ${product.name} is not available for purchase`));
    }

    const itemQty = Number(item.qty || item.quantity || 1);
    if (!Number.isInteger(itemQty) || itemQty < 1) {
      return next(new ApiError(400, `Invalid quantity for product ${product.name}`));
    }

    let itemPrice = product.price;
    let itemVariantId = item.variant || null;
    let itemSku = item.sku || 'N/A';
    let itemSize = item.size || 'OS';
    let itemColor = item.color || 'N/A';
    let itemImage = item.image || product.image;

    if (itemVariantId) {
      const variant = await ProductVariant.findById(itemVariantId);
      if (!variant) {
        return next(new ApiError(404, 'Product variant not found'));
      }

      if (variant.product.toString() !== product._id.toString()) {
        return next(new ApiError(400, `Variant does not belong to product ${product.name}`));
      }

      const availableStock = Number(variant.stock) || 0;
      if (availableStock < itemQty) {
        return next(
          new ApiError(
            400,
            `Insufficient stock for ${product.name} (${variant.size}/${variant.color?.name || variant.color}). Only ${availableStock} available.`
          )
        );
      }

      itemPrice = getUnitPrice(product, variant);
      itemSku = variant.sku || 'N/A';
      itemSize = variant.size || 'OS';
      itemColor = typeof variant.color === 'string' ? variant.color : variant.color?.name || 'N/A';
      itemImage = variant.image || product.image;

      if (isCash) {
        variant.stock -= itemQty;
        modifiedVariants.push(variant);
      }
    } else {
      const availableStock = Number(product.countInStock) || 0;
      if (availableStock < itemQty) {
        return next(
          new ApiError(
            400,
            `Insufficient stock for ${product.name}. Only ${availableStock} available.`
          )
        );
      }

      if (isCash) {
        product.countInStock -= itemQty;
        modifiedProducts.push(product);
      }
    }

    const lineTotal = itemPrice * itemQty;
    calculatedItemsPrice += lineTotal;

    validatedOrderItems.push({
      name: product.name,
      qty: itemQty,
      image: itemImage,
      price: itemPrice,
      product: product._id,
      variant: itemVariantId || null,
      sku: itemSku,
      size: itemSize,
      color: typeof itemColor === 'string' ? itemColor : JSON.stringify(itemColor),
    });
  }

  // Persist stock decrements immediately for Cash on Delivery orders
  for (const v of modifiedVariants) {
    await v.save();
    await syncProductStock(v.product);
  }
  for (const p of modifiedProducts) {
    await p.save();
  }
  if (isCash && (modifiedVariants.length > 0 || modifiedProducts.length > 0)) {
    await clearCachePattern('products');
  }

  // Handle discounts if applicable
  let discountAmount = 0;
  let appliedDiscount = null;
  let effectiveShippingPrice = Number(shippingPrice) || 0;

  // Server-side shipping recalculation & validation against zones
  let matchedShippingQuote = null;
  let resolvedShippingZoneId = req.body.shippingZone || null;
  let resolvedMethodName = req.body.shippingMethodName || 'Standard Delivery';
  let resolvedEstimatedDays = req.body.shippingEstimatedDays || '2–4 business days';
  let resolvedCarrier = req.body.shippingCarrier || 'Local Courier';

  if (shippingAddress?.country) {
    try {
      const { shippingService } = await import('../services/shippingService.js');
      const activeZone = await shippingService.getZoneByCountry(shippingAddress.country);
      if (activeZone) {
        resolvedShippingZoneId = activeZone._id;
        const quotes = await shippingService.getShippingQuote({
          country: shippingAddress.country,
          region: shippingAddress.region || shippingAddress.city || '',
          cartTotalUSD: calculatedItemsPrice,
        });

        if (quotes.length > 0) {
          const requestedMethod = req.body.shippingMethodId || req.body.shippingMethod;
          const matched = quotes.find(
            (q) =>
              String(q.id) === String(requestedMethod) ||
              String(q.methodId) === String(requestedMethod) ||
              q.name.toLowerCase() === String(req.body.shippingMethodName || '').toLowerCase()
          );
          matchedShippingQuote = matched || quotes[0];
          effectiveShippingPrice = matchedShippingQuote.priceUSD;
          resolvedShippingZoneId = matchedShippingQuote.zoneId || activeZone._id;
          resolvedMethodName = matchedShippingQuote.name || resolvedMethodName;
          resolvedEstimatedDays = matchedShippingQuote.estimatedDelivery || resolvedEstimatedDays;
          resolvedCarrier = matchedShippingQuote.carrier || resolvedCarrier;
        }
      } else if (shippingPrice !== undefined && !isNaN(Number(shippingPrice))) {
        effectiveShippingPrice = Number(shippingPrice);
      }
    } catch (shipErr) {
      logger.warn(`[OrderController] Server-side shipping verification note: ${shipErr.message}`);
      if (shippingPrice !== undefined && !isNaN(Number(shippingPrice))) {
        effectiveShippingPrice = Number(shippingPrice);
      }
    }
  } else if (shippingPrice !== undefined && !isNaN(Number(shippingPrice))) {
    effectiveShippingPrice = Number(shippingPrice);
  }

  const orderCustomerEmail = (req.user?.email || req.body.customerEmail || req.body.email || req.body.shippingAddress?.email || '').trim();

  if (req.body.discountCode && typeof req.body.discountCode === 'string' && req.body.discountCode.trim()) {
    try {
      const discountRes = await validateDiscount({
        code: req.body.discountCode.trim(),
        items: validatedOrderItems,
        subtotal: calculatedItemsPrice,
        shippingPrice: effectiveShippingPrice,
        user: req.user,
        customerEmail: orderCustomerEmail,
      });
      if (discountRes && discountRes.valid) {
        appliedDiscount = discountRes.discount;
        discountAmount = discountRes.discountAmount || 0;
        if (appliedDiscount.type === 'free_shipping' || appliedDiscount.isFreeShipping) {
          effectiveShippingPrice = 0;
          discountAmount = Number(shippingPrice) || 0;
        }
      }
    } catch (discErr) {
      logger.warn(`[OrderController] Discount validation note: ${discErr.message}`);
    }
  } else {
    // Check automatic discounts if no promo code explicitly supplied
    try {
      const autoRes = await findApplicableAutomaticDiscount({
        items: validatedOrderItems,
        subtotal: calculatedItemsPrice,
        shippingPrice: effectiveShippingPrice,
        user: req.user,
        customerEmail: orderCustomerEmail,
      });
      if (autoRes && autoRes.valid) {
        appliedDiscount = autoRes.discount;
        discountAmount = autoRes.discountAmount || 0;
        if (appliedDiscount.type === 'free_shipping' || appliedDiscount.isFreeShipping) {
          effectiveShippingPrice = 0;
          discountAmount = Number(shippingPrice) || 0;
        }
      }
    } catch (autoErr) {
      logger.warn(`[OrderController] Automatic discount evaluation note: ${autoErr.message}`);
    }
  }

  // Real server-side tax calculation from store settings and active tax regions
  const netItemsPrice = Math.max(0, calculatedItemsPrice - (appliedDiscount?.isFreeShipping ? 0 : discountAmount));
  const taxResult = await calculateTaxForOrder({
    shippingAddress,
    itemsPrice: netItemsPrice,
    shippingPrice: effectiveShippingPrice,
  });

  let finalTaxPrice = req.body.taxPrice !== undefined ? Number(req.body.taxPrice) : taxResult.taxAmount;
  const calculatedTotalPrice = Math.max(
    0,
    netItemsPrice + (taxResult.taxIncluded ? 0 : finalTaxPrice) + effectiveShippingPrice
  );

  const sanitizedShippingAddress = {
    ...shippingAddress,
    phone: sanitizePhoneNumber(shippingAddress.phone || ''),
  };

  const normalizedCurrency = ['USD', 'ETB'].includes(String(currency || '').trim().toUpperCase())
    ? String(currency).trim().toUpperCase()
    : 'USD';

  const usdToEtbRate = chapaService.usdToEtbRate || 120;
  const totalPriceETB = normalizedCurrency === 'ETB'
    ? calculatedTotalPrice
    : chapaService.convertToEtb(calculatedTotalPrice);

  const settingsDoc = await Setting.getSingleton();
  const configuredPrefix = settingsDoc?.store?.orderPrefix || 'NS-';
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const orderNumber = `${configuredPrefix}${Date.now().toString().slice(-4)}${randomSuffix}`;

  const order = new Order({
    orderNumber,
    orderItems: validatedOrderItems,
    user: req.user._id,
    customerEmail: (req.user?.email || req.body.customerEmail || req.body.email || req.body.shippingAddress?.email || '').trim(),
    shippingAddress: sanitizedShippingAddress,
    paymentMethod,
    currency: normalizedCurrency,
    totalPriceETB,
    usdToEtbRate,
    isStockReserved: isCash ? true : false,
    stockReservedUntil: isCash ? null : new Date(Date.now() + 30 * 60 * 1000),
    status: isCash ? 'processing' : 'pending',
    paymentStatus: 'pending',
    isPaid: false,
    itemsPrice: Number(calculatedItemsPrice.toFixed(2)),
    subtotalPrice: Number(calculatedItemsPrice.toFixed(2)),
    discountCode: appliedDiscount ? appliedDiscount.code : null,
    discountId: appliedDiscount ? appliedDiscount._id : null,
    discountAmount: Number(discountAmount.toFixed(2)),
    discountType: appliedDiscount ? appliedDiscount.type : null,
    taxPrice: Number(finalTaxPrice.toFixed(2)),
    taxName: taxResult.taxName || 'VAT',
    taxRate: Number(taxResult.taxRate || 0),
    taxIncluded: Boolean(taxResult.taxIncluded),
    taxShippingAmount: Number(taxResult.taxShippingAmount || 0),
    shippingZone: resolvedShippingZoneId,
    shippingMethodName: resolvedMethodName,
    shippingEstimatedDays: resolvedEstimatedDays,
    shippingCarrier: resolvedCarrier,
    shippingPrice: Number(effectiveShippingPrice.toFixed(2)),
    totalPrice: Number(calculatedTotalPrice.toFixed(2)),
  });

  const createdOrder = await order.save();

  // Clear user cart and record pending payment if Cash on Delivery
  if (isCash) {
    await reconcileUserCart(req.user._id, validatedOrderItems);
    try {
      await paymentService.recordCashOnDelivery({
        order: createdOrder,
        user: req.user,
      });
    } catch (payErr) {
      logger.error(`[OrderController] Failed to record COD payment: ${payErr.message}`);
    }
  }

  // Queue initial order confirmation email
  try {
    await emailQueue.add('sendOrderConfirmationEmail', {
      email: req.user.email,
      subject: `Order Placed Successfully #${createdOrder.orderNumber || createdOrder._id} (${createdOrder._id})`,
      message: `Thank you for your order! Order Number: ${createdOrder.orderNumber || createdOrder._id}. Total: $${createdOrder.totalPrice}`,
      html: `
        <h2>Thank you for your order, ${req.user.name || 'Customer'}!</h2>
        <p>We've received your order <strong>#${createdOrder.orderNumber || createdOrder._id}</strong>.</p>
        <p>Total: $${createdOrder.totalPrice}</p>
        <p>Payment Method: ${paymentMethod}</p>
      `,
    });
  } catch (err) {
    logger.error(`[OrderController] Email queue error: ${err.message}`);
  }

  res.status(201).json({ success: true, data: createdOrder });
});

// @desc    Get order by ID or orderNumber
// @route   GET /api/v1/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req, res, next) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id) && String(new mongoose.Types.ObjectId(req.params.id)) === req.params.id;
  const query = isObjectId ? { _id: req.params.id } : { orderNumber: req.params.id };
  const order = await Order.findOne(query).populate('user', 'name email');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (
    order.user &&
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new ApiError(403, 'Not authorized to view this order'));
  }

  res.status(200).json({ success: true, data: order });
});

// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders & /api/v1/orders/my
// @access  Private
export const getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc    Get single logged in user order
// @route   GET /api/v1/orders/my/:id
// @access  Private
export const getMyOrderById = asyncHandler(async (req, res, next) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id) && String(new mongoose.Types.ObjectId(req.params.id)) === req.params.id;
  const query = isObjectId
    ? { _id: req.params.id, user: req.user._id }
    : { orderNumber: req.params.id, user: req.user._id };
  const order = await Order.findOne(query).populate('user', 'name email');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }
  res.status(200).json({ success: true, data: order });
});

// @desc    Resend order confirmation email
// @route   POST /api/v1/orders/:id/resend-confirmation
// @access  Private
export const resendOrderConfirmation = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to access this order'));
  }

  const recipient = (order.customerEmail || order.user?.email || '').trim();
  if (recipient) {
    const emailContent = order.isPaid
      ? getPaymentSuccessEmail({ order, paymentResult: order.paymentResult })
      : getOrderConfirmationEmail({ order, user: order.user });

    await queueOrSendEmail('sendOrderConfirmationEmail', {
      to: recipient,
      email: recipient,
      subject: emailContent.subject,
      text: emailContent.text,
      message: emailContent.text,
      html: emailContent.html,
      orderId: order._id,
      userId: order.user?._id?.toString(),
    });
  }

  res.status(200).json({
    success: true,
    message: 'Order confirmation email queued successfully',
    targetEmail: recipient,
  });
});

// @desc    Update order to paid (Direct / Admin override)
// @route   PUT /api/v1/orders/:id/pay
// @access  Private
export const updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to modify this order'));
  }

  const updated = await markOrderPaid(order, req.body, req.body.payer?.email_address || order.customerEmail || order.user?.email);
  res.status(200).json({ success: true, data: updated });
});

// @desc    Get all orders (Admin only)
// @route   GET /api/v1/orders
// @access  Private/Admin
export const getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({}).populate('user', 'id name email').sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc    Update order to delivered (Admin only)
// @route   PUT /api/v1/orders/:id/deliver
// @access  Private/Admin
export const updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  order.isDelivered = true;
  order.deliveredAt = new Date();
  order.status = 'delivered';

  const updatedOrder = await order.save();

  if (order.user?.email || order.customerEmail) {
    try {
      await emailQueue.add('sendOrderStatusEmail', {
        email: order.customerEmail || order.user?.email,
        subject: `Your Order #${order.orderNumber || order._id} Has Been Delivered! 📦`,
        message: `Great news! Your order #${order.orderNumber || order._id} has been delivered.`,
        html: `
          <h2>Order Delivered!</h2>
          <p>Hi ${order.shippingAddress?.recipientName || order.user?.name || 'Valued Customer'},</p>
          <p>Your order <strong>#${order.orderNumber || order._id}</strong> has been marked as <strong>Delivered</strong>.</p>
        `,
      });
    } catch (err) {
      logger.error(`[OrderController] Deliver email error: ${err.message}`);
    }
  }

  res.status(200).json({ success: true, data: updatedOrder });
});

// @desc    Initiate Chapa payment attempt for an order
// @route   POST /api/v1/orders/:id/initialize-payment
// @access  Private
export const initializeOrderPayment = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to initialize payment for this order'));
  }

  if (order.isPaid || order.paymentStatus === 'paid') {
    return next(new ApiError(400, 'Order is already paid'));
  }

  if (!process.env.CHAPA_SECRET_KEY) {
    return next(new ApiError(500, 'CHAPA_SECRET_KEY is missing from server environment'));
  }

  const newTxRef = `NS_${order._id}_${Date.now()}`;
  order.paymentReference = newTxRef;
  order.paymentStatus = 'pending';
  order.status = 'pending';
  order.stockReservedUntil = new Date(Date.now() + 30 * 60 * 1000);
  await order.save();

  const { returnUrl } = req.body || {};
  const fullName = req.user.name || order.shippingAddress?.recipientName || 'Valued Customer';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || 'Valued';

  const customer = {
    firstName,
    lastName,
    email: req.user.email || order.customerEmail || '',
    phone: formatPhoneForChapa(order.shippingAddress?.phone || ''),
  };

  let paymentResult;
  try {
    paymentResult = await chapaService.initializePayment({
      order,
      customer,
      returnUrl,
      txRef: newTxRef,
    });
  } catch (err) {
    logger.error(`[OrderController] Payment initialization error: ${err.message}`);
    if (err.message && err.message.includes('CHAPA_SECRET_KEY is missing')) {
      return next(new ApiError(500, err.message, 'PAYMENT_CONFIG_ERROR'));
    }
    return next(
      new ApiError(500, "We couldn't start your payment. Please try again.", 'PAYMENT_INITIALIZATION_FAILED')
    );
  }

  order.chapaReference = paymentResult.chapaReference;
  await order.save();

  // Record initialization in Payment model
  try {
    await paymentService.recordInitialization({
      order,
      user: req.user,
      txRef: newTxRef,
      chapaReference: paymentResult.chapaReference,
      amountETB: paymentResult.amount,
      amountUSD: order.totalPrice,
      currency: paymentResult.currency || 'ETB',
      customer,
    });
  } catch (recErr) {
    logger.error(`[OrderController] Payment recording error: ${recErr.message}`);
  }

  res.status(200).json({
    success: true,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      checkoutUrl: paymentResult.checkoutUrl,
      txRef: newTxRef,
      merchantReference: newTxRef,
      chapaReference: paymentResult.chapaReference,
      amount: paymentResult.amount,
      currency: paymentResult.currency,
    },
  });
});

// @desc    Query verified payment status for an order
// @route   GET /api/v1/orders/:id/payment-status
// @access  Private
export const getPaymentStatus = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to view payment status for this order'));
  }

  if (order.isPaid && order.paymentStatus === 'paid') {
    return res.status(200).json({
      success: true,
      data: {
        isPaid: true,
        paymentStatus: 'paid',
        status: order.status,
        orderId: order._id,
        orderNumber: order.orderNumber,
        paidAt: order.paidAt,
        confirmationEmailSent: Boolean(order.paymentEmailSent),
      },
    });
  }

  const lookupRef = order.chapaReference || order.paymentReference;
  if (!lookupRef) {
    return res.status(200).json({
      success: true,
      data: {
        isPaid: false,
        paymentStatus: order.paymentStatus,
        status: order.status,
        orderId: order._id,
      },
    });
  }

  let verification;
  try {
    verification = await chapaService.verifyPayment(lookupRef);
  } catch (err) {
    logger.error(`[OrderController] Verification request failed: ${err.message}`);
    return res.status(200).json({
      success: true,
      data: {
        isPaid: false,
        paymentStatus: order.paymentStatus,
        status: order.status,
        orderId: order._id,
      },
    });
  }

  if (verification && verification.success && verification.status === 'success') {
    const check = verifyPaymentAgainstOrder(order, verification);
    if (check.valid) {
      await markOrderPaid(order, verification, order.customerEmail || order.user?.email);
      return res.status(200).json({
        success: true,
        data: {
          isPaid: true,
          paymentStatus: 'paid',
          status: 'processing',
          orderId: order._id,
          orderNumber: order.orderNumber,
          paidAt: order.paidAt,
          confirmationEmailSent: Boolean(order.paymentEmailSent),
        },
      });
    } else {
      logger.warn(`[OrderController] Payment validation failed in getPaymentStatus for order ${order._id}: ${check.reason}`);
    }
  } else if (verification && verification.status === 'pending') {
    return res.status(200).json({
      success: true,
      data: {
        isPaid: false,
        paymentStatus: 'pending',
        status: order.status,
        orderId: order._id,
      },
    });
  } else if (verification && verification.data && (verification.status === 'failed' || verification.status === 'cancelled')) {
    order.paymentStatus = verification.status;
    if (verification.status === 'cancelled') {
      order.status = 'cancelled';
      await releaseStockForOrder(order);
    }
    await order.save();
    return res.status(200).json({
      success: true,
      data: {
        isPaid: false,
        paymentStatus: order.paymentStatus,
        status: order.status,
        orderId: order._id,
        message: verification.message,
      },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      isPaid: false,
      paymentStatus: order.paymentStatus,
      status: order.status,
      orderId: order._id,
    },
  });
});

// @desc    Chapa Webhook handler
// @route   POST /api/v1/orders/webhook/chapa
// @access  Public
export const handleChapaWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers['x-chapa-signature'];
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, missing webhook secret must reject with 500 and never proceed silently
  if (!webhookSecret) {
    if (isProduction) {
      logger.error('[handleChapaWebhook] CRITICAL: CHAPA_WEBHOOK_SECRET is missing in production environment');
      return res.status(500).json({ message: 'Webhook signature verification is not configured on server' });
    }
    logger.warn('[handleChapaWebhook] CHAPA_WEBHOOK_SECRET is not configured. Webhooks require signature in production.');
  }

  // Signature verification is mandatory whenever secret is set OR in production
  if (webhookSecret || isProduction) {
    if (!signature) {
      return res.status(400).json({ message: 'Missing x-chapa-signature header' });
    }
    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const sigCheck = chapaService.verifyWebhookSignature(rawBody, signature);
    if (!sigCheck.valid) {
      logger.warn(`[handleChapaWebhook] Signature verification failed: ${sigCheck.reason}`);
      return res.status(400).json({ message: 'Invalid webhook signature', reason: sigCheck.reason });
    }
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ message: 'Invalid JSON payload' });
    }
  }

  const txRef = payload.merchant_reference || payload.tx_ref || payload.trx_ref;
  const chapaRef = payload.chapa_reference || payload.reference || txRef;

  const query = [
    { paymentReference: txRef },
    { chapaReference: chapaRef },
    { chapaReference: txRef },
    { paymentReference: chapaRef },
  ];
  if (payload.meta?.order_id && mongoose.Types.ObjectId.isValid(payload.meta.order_id)) {
    query.push({ _id: payload.meta.order_id });
  }
  if (payload.meta?.order_number) {
    query.push({ orderNumber: payload.meta.order_number });
  }

  const order = await Order.findOne({ $or: query }).populate('user', 'name email');

  if (!order) {
    logger.warn(`[handleChapaWebhook] No order found for reference: ${txRef} / ${chapaRef}`);
    return res.status(200).json({ received: true, ignored: true, reason: 'Order not found' });
  }

  if (order.isPaid && order.paymentStatus === 'paid') {
    return res.status(200).json({ received: true, alreadyProcessed: true });
  }

  const event = (payload.event || '').toLowerCase();
  const status = (payload.status || '').toLowerCase();

  if (event === 'payment.cancelled' || status === 'cancelled') {
    await releaseStockForOrder(order);
    order.status = 'cancelled';
    order.paymentStatus = 'cancelled';
    await order.save();
    return res.status(200).json({ received: true, status: 'cancelled' });
  }

  if (event === 'payment.failed' || status === 'failed') {
    order.paymentStatus = 'failed';
    await order.save();
    return res.status(200).json({ received: true, status: 'failed' });
  }

  if (event === 'payment.success' || event === 'charge.complete' || status === 'success') {
    try {
      // Authoritative verification: NEVER mark paid without verifying directly with Chapa API
      const verifyRes = await chapaService.verifyPayment(chapaRef || txRef || order.paymentReference);
      if (verifyRes && verifyRes.success && verifyRes.status === 'success') {
        const check = verifyPaymentAgainstOrder(order, verifyRes);
        if (check.valid) {
          await markOrderPaid(order, verifyRes, order.customerEmail || order.user?.email);
          return res.status(200).json({ received: true, status: 'paid' });
        } else {
          logger.warn(`[handleChapaWebhook] Secondary verification amount check failed: ${check.reason}`);
          return res.status(400).json({ received: true, error: check.reason });
        }
      }
    } catch (vErr) {
      logger.error(`[handleChapaWebhook] Secondary verification error: ${vErr.message}`);
    }

    // Do NOT mark order paid based solely on unverified webhook data!
    return res.status(400).json({ received: true, error: 'Payment could not be verified with gateway' });
  }

  res.status(200).json({ received: true });
});

// @desc    Verify transaction with Chapa by transaction reference (tx_ref)
// @route   GET /api/v1/orders/transaction/verify/:tx_ref
// @access  Public / Authenticated (PII is sanitized for public verification)
export const verifyTransactionByRef = asyncHandler(async (req, res, next) => {
  const { tx_ref } = req.params;
  if (!tx_ref) {
    return next(new ApiError(400, 'Transaction reference is required'));
  }

  const query = [
    { paymentReference: tx_ref },
    { chapaReference: tx_ref },
    { orderNumber: tx_ref },
  ];
  if (mongoose.Types.ObjectId.isValid(tx_ref)) {
    query.push({ _id: tx_ref });
  }

  const order = await Order.findOne({ $or: query }).populate('user', 'name email');

  if (!order) {
    return next(new ApiError(404, `No order found for reference ${tx_ref}`));
  }

  // Safe public response sanitizer — never expose customer name, email, phone, shipping address, or internal document details
  const sanitizeOrderForPublic = (ord) => ({
    orderNumber: ord.orderNumber,
    isPaid: Boolean(ord.isPaid),
    paymentStatus: ord.paymentStatus,
    status: ord.status,
    paidAt: ord.paidAt || null,
  });

  // Idempotent: return immediately if already paid
  if (order.isPaid && order.paymentStatus === 'paid') {
    return res.status(200).json({
      success: true,
      verified: true,
      paymentStatus: 'paid',
      status: 'paid',
      data: sanitizeOrderForPublic(order),
    });
  }

  const referenceToVerify = order.paymentReference || order.chapaReference || tx_ref;
  let verification;
  try {
    verification = await chapaService.verifyPayment(referenceToVerify);
  } catch (err) {
    logger.warn(`[verifyTransactionByRef] Chapa verify request error for ${referenceToVerify}: ${err.message}`);
    // Provider network or temporary lookup error: keep current pending status without failing order
    return res.status(200).json({
      success: true,
      verified: false,
      paymentStatus: order.paymentStatus,
      status: order.status,
      data: sanitizeOrderForPublic(order),
    });
  }

  if (verification && verification.success && verification.status === 'success') {
    const check = verifyPaymentAgainstOrder(order, verification);
    if (!check.valid) {
      logger.warn(`[verifyTransactionByRef] Verification amount/currency check failed for ${tx_ref}: ${check.reason}`);
      return res.status(400).json({
        success: false,
        verified: false,
        paymentStatus: 'failed',
        status: 'failed',
        message: check.reason,
      });
    }

    const updatedOrder = await markOrderPaid(order, verification, order.customerEmail || order.user?.email);
    return res.status(200).json({
      success: true,
      verified: true,
      paymentStatus: 'paid',
      status: 'paid',
      data: sanitizeOrderForPublic(updatedOrder),
    });
  } else if (verification && verification.status === 'pending') {
    return res.status(200).json({
      success: true,
      verified: false,
      paymentStatus: 'pending',
      status: 'pending',
      data: sanitizeOrderForPublic(order),
    });
  }

  // Only transition payment status to failed/cancelled when gateway provides authoritative verified data
  if (verification && verification.data) {
    if (verification.status === 'cancelled') {
      order.status = 'cancelled';
      order.paymentStatus = 'cancelled';
      await releaseStockForOrder(order);
      await order.save();
    } else if (verification.status === 'failed') {
      order.paymentStatus = 'failed';
      await order.save();
    }
  }

  // For temporary lookup errors, unindexed transactions, or non-verified states, order remains pending
  res.status(200).json({
    success: true,
    verified: false,
    paymentStatus: order.paymentStatus,
    status: order.status,
    message: verification?.message || 'Payment is awaiting confirmation',
    data: sanitizeOrderForPublic(order),
  });
});

// @desc    Update order status (Admin only)
// @route   PUT /api/v1/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, note, trackingNumber, carrier } = req.body;
  if (!status) {
    return next(new ApiError(400, 'Status is required'));
  }

  const order = await Order.findById(req.params.id).populate('user', 'name email settings');
  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  const previousStatus = order.status || 'pending';
  const normalizedStatus = status.toLowerCase().trim();

  if (normalizedStatus !== previousStatus) {
    const allowed = ALLOWED_TRANSITIONS[previousStatus] || [];
    if (!allowed.includes(normalizedStatus)) {
      return next(
        new ApiError(
          400,
          `Cannot transition order from '${previousStatus}' to '${normalizedStatus}'. Allowed transitions: [${allowed.join(', ')}]`
        )
      );
    }
  }

  order.status = normalizedStatus;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (carrier) order.carrier = carrier;

  if (normalizedStatus === 'shipped' || normalizedStatus === 'out_for_delivery') {
    if (!order.shippedAt) {
      order.shippedAt = new Date();
    }
  }

  if (normalizedStatus === 'delivered') {
    order.isDelivered = true;
    if (!order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    if ((order.paymentMethod === 'Cash' || order.paymentMethod === 'Cash on Delivery') && !order.isPaid) {
      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentStatus = 'paid';
      try {
        await paymentService.recordSuccess({
          order,
          txRef: `COD_${order.orderNumber || order._id}`,
          method: 'cod',
          rawMethod: 'Cash on Delivery',
          paidAt: order.paidAt,
        });
      } catch (codPayErr) {
        logger.error(`[OrderController] Error settling COD payment upon delivery: ${codPayErr.message}`);
      }
    }
  }

  if (normalizedStatus === 'cancelled') {
    await releaseStockForOrder(order);
  }

  if (normalizedStatus === 'refunded') {
    order.paymentStatus = 'refunded';
    order.refundedAt = new Date();
    await releaseStockForOrder(order);
  }

  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    status: normalizedStatus,
    timestamp: new Date(),
    admin: req.user?._id || null,
    note: note || `Admin updated status to ${normalizedStatus}`,
  });

  const updatedOrder = await order.save();

  const targetEmail = order.customerEmail || order.user?.email;
  if (targetEmail) {
    try {
      const emailContent = getOrderStatusEmail({ order: updatedOrder, newStatus: normalizedStatus });
      await queueOrSendEmail('sendOrderStatusEmail', {
        to: targetEmail,
        email: targetEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        message: emailContent.text,
        html: emailContent.html,
        orderId: order._id,
        userId: order.user?._id?.toString(),
      });
    } catch (err) {
      logger.error(`[OrderController] Status update email error: ${err.message}`);
    }
  }

  res.status(200).json({ success: true, data: updatedOrder });
});

export default {
  addOrderItems,
  getOrderById,
  getMyOrders,
  getMyOrderById,
  resendOrderConfirmation,
  updateOrderToPaid,
  getOrders,
  updateOrderToDelivered,
  initializeOrderPayment,
  getPaymentStatus,
  handleChapaWebhook,
  verifyTransactionByRef,
  updateOrderStatus,
  markOrderPaid,
  verifyPaymentAgainstOrder,
  reconcileUserCart,
  decrementStockForOrder,
  releaseStockForOrder,
  cancelExpiredUnpaidOrders,
};
