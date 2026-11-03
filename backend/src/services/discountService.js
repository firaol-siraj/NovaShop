import mongoose from 'mongoose';
import Discount from '../models/discountModel.js';
import DiscountRedemption from '../models/discountRedemptionModel.js';
import Order from '../models/orderModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import Product from '../models/productModel.js';
import logger from '../utils/logger.js';

/**
 * Shared discount eligibility verification function.
 * Used identically across:
 * 1. Discount code validation (cart & checkout)
 * 2. Order creation (server-side finalization)
 * 3. Payment confirmation (markOrderPaid / webhook)
 *
 * @param {Object} discount - The Discount Mongoose document or object
 * @param {Object|string} userOrEmail - Customer user document, user ID, email string, or object containing user and email
 * @param {Object} cart - Cart details { items, subtotal, shippingPrice }
 * @param {Date} now - Current time reference (defaults to new Date())
 * @param {Object} options - Additional options, e.g. { excludeOrderId: ObjectId|string }
 * @returns {Promise<{ eligible: boolean, message?: string, eligibleSubtotal?: number }>}
 */
export async function checkDiscountEligibility(
  discount,
  userOrEmail = null,
  cart = {},
  now = new Date(),
  options = {}
) {
  if (!discount || discount.isDeleted) {
    return {
      eligible: false,
      message: `Invalid discount code: '${discount?.code || ''}'.`,
    };
  }

  const cleanCode = discount.code;

  if (discount.status === 'disabled') {
    return {
      eligible: false,
      message: `Discount code '${cleanCode}' has been disabled.`,
    };
  }

  if (discount.status === 'draft') {
    return {
      eligible: false,
      message: `Discount code '${cleanCode}' is not yet active.`,
    };
  }

  if (discount.startsAt && new Date(discount.startsAt).getTime() > now.getTime()) {
    return {
      eligible: false,
      message: `Discount code '${cleanCode}' is scheduled and starts later.`,
    };
  }

  if (discount.endsAt && new Date(discount.endsAt).getTime() < now.getTime()) {
    return {
      eligible: false,
      message: `Discount code '${cleanCode}' has expired.`,
    };
  }

  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    return {
      eligible: false,
      message: `Discount code '${cleanCode}' has reached its maximum usage limit.`,
    };
  }

  // Extract userId and customerEmail cleanly
  let userId = null;
  let email = '';

  if (userOrEmail) {
    if (typeof userOrEmail === 'string') {
      if (userOrEmail.includes('@')) {
        email = userOrEmail.trim().toLowerCase();
      } else if (mongoose.Types.ObjectId.isValid(userOrEmail)) {
        userId = userOrEmail;
      }
    } else if (typeof userOrEmail === 'object') {
      userId =
        userOrEmail._id ||
        userOrEmail.id ||
        userOrEmail.userId ||
        (userOrEmail.user?._id || userOrEmail.user) ||
        null;
      email = (
        userOrEmail.email ||
        userOrEmail.customerEmail ||
        userOrEmail.user?.email ||
        ''
      )
        .trim()
        .toLowerCase();
    }
  }

  // Rule: First-time orders only
  if (discount.firstOrderOnly) {
    const userOrEmailFilter = [];

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      userOrEmailFilter.push({ user: new mongoose.Types.ObjectId(userId.toString()) });
    }

    if (email && email.trim()) {
      const escapedEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
      userOrEmailFilter.push({ customerEmail: { $regex: emailRegex } });
      userOrEmailFilter.push({ 'paymentResult.email_address': { $regex: emailRegex } });
    }

    if (userOrEmailFilter.length === 0) {
      return {
        eligible: false,
        message: `Discount code '${cleanCode}' is valid for first-time orders only.`,
      };
    }

    const priorOrderQuery = {
      $and: [
        { $or: userOrEmailFilter },
        {
          $or: [
            { paymentStatus: { $regex: /^paid$/i } },
            { isPaid: true },
            { status: { $in: ['paid', 'processing', 'shipped', 'out_for_delivery', 'delivered'] } },
          ],
        },
        {
          paymentStatus: { $nin: ['failed', 'cancelled'] },
          status: { $nin: ['cancelled', 'pending_payment'] },
        },
      ],
    };

    if (options.excludeOrderId && mongoose.Types.ObjectId.isValid(options.excludeOrderId)) {
      const excludeId =
        typeof options.excludeOrderId === 'object' && options.excludeOrderId._id
          ? options.excludeOrderId._id
          : options.excludeOrderId;
      priorOrderQuery.$and.push({
        _id: { $ne: new mongoose.Types.ObjectId(excludeId.toString()) },
      });
    }

    const priorPaidCount = await Order.countDocuments(priorOrderQuery);

    if (priorPaidCount > 0) {
      return {
        eligible: false,
        message: `Discount code '${cleanCode}' is valid for first-time orders only.`,
      };
    }
  }

  // Rule: Per-customer limit
  if (discount.perCustomerLimit != null && discount.perCustomerLimit > 0) {
    const userOrEmailFilter = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      userOrEmailFilter.push({ user: new mongoose.Types.ObjectId(userId.toString()) });
    }
    if (email && email.trim()) {
      const escapedEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      userOrEmailFilter.push({
        customerEmail: { $regex: new RegExp(`^${escapedEmail}$`, 'i') },
      });
    }

    if (userOrEmailFilter.length > 0) {
      const redemptionCount = await DiscountRedemption.countDocuments({
        discount: discount._id,
        $or: userOrEmailFilter,
      });

      if (redemptionCount >= discount.perCustomerLimit) {
        return {
          eligible: false,
          message: `You have reached the limit of ${discount.perCustomerLimit} redemption(s) for '${cleanCode}'.`,
        };
      }
    }
  }

  // Rule: Minimum spend
  const numericSubtotal = Number(cart.subtotal) || 0;
  if (discount.minimumSpend != null && numericSubtotal < discount.minimumSpend) {
    return {
      eligible: false,
      message: `Minimum spend of $${discount.minimumSpend.toFixed(2)} required for '${cleanCode}'.`,
    };
  }

  // Rule: Minimum quantity
  const items = cart.items || [];
  const totalItemQty = items.reduce(
    (sum, item) => sum + (Number(item.qty || item.quantity) || 1),
    0
  );
  if (discount.minimumQuantity != null && totalItemQty < discount.minimumQuantity) {
    return {
      eligible: false,
      message: `Minimum quantity of ${discount.minimumQuantity} item(s) required for '${cleanCode}'.`,
    };
  }

  // Rule: Applies to specific products / categories
  let eligibleSubtotal = numericSubtotal;

  if (discount.appliesTo === 'specific_products' && discount.targetProducts?.length > 0) {
    const targetSet = new Set(discount.targetProducts.map((p) => p.toString()));
    const matchingLines = items.filter((item) => {
      const prodId = String(item.product?._id || item.product || item.productId || item.id || '');
      return targetSet.has(prodId);
    });

    if (matchingLines.length === 0) {
      return {
        eligible: false,
        message: `Discount code '${cleanCode}' does not apply to the items currently in your cart.`,
      };
    }

    eligibleSubtotal = matchingLines.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty || item.quantity) || 1),
      0
    );
  } else if (discount.appliesTo === 'specific_categories' && discount.targetCategories?.length > 0) {
    const categorySet = new Set(discount.targetCategories.map((c) => c.toString()));

    const productIds = items
      .map((item) => item.product?._id || item.product || item.productId || item.id)
      .filter(Boolean);

    const products = await Product.find({ _id: { $in: productIds } }).select('_id category');
    const productCategoryMap = new Map(products.map((p) => [p._id.toString(), p.category?.toString()]));

    const matchingLines = items.filter((item) => {
      const prodId = String(item.product?._id || item.product || item.productId || item.id || '');
      const catId = productCategoryMap.get(prodId);
      return catId && categorySet.has(catId);
    });

    if (matchingLines.length === 0) {
      return {
        eligible: false,
        message: `Discount code '${cleanCode}' does not apply to items in your selected categories.`,
      };
    }

    eligibleSubtotal = matchingLines.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty || item.quantity) || 1),
      0
    );
  }

  return {
    eligible: true,
    eligibleSubtotal,
  };
}

/**
 * Evaluates available automatic discounts and returns the best matching one.
 */
export async function findApplicableAutomaticDiscount({
  items = [],
  subtotal = 0,
  shippingPrice = 0,
  user = null,
  customerEmail = '',
}) {
  const now = new Date();
  const automaticDiscounts = await Discount.find({
    method: 'automatic',
    status: 'active',
    isDeleted: false,
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
  }).sort({ value: -1 });

  let bestResult = null;

  for (const discount of automaticDiscounts) {
    const res = await validateDiscount({
      code: discount.code,
      items,
      subtotal,
      shippingPrice,
      user,
      customerEmail,
    });

    if (res.valid) {
      if (!bestResult || res.discountAmount > bestResult.discountAmount) {
        bestResult = res;
      }
    }
  }

  return bestResult;
}

/**
 * Validates a discount code against cart lines, totals, and customer usage rules.
 */
export async function validateDiscount({
  code,
  items = [],
  subtotal = 0,
  shippingPrice = 0,
  user = null,
  customerEmail = '',
  excludeOrderId = null,
  cart = null,
}) {
  if (cart) {
    if ((!items || items.length === 0) && cart.items) items = cart.items;
    if (!subtotal && cart.subtotal != null) subtotal = cart.subtotal;
  }
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { valid: false, message: 'Please provide a discount code.' };
  }

  const cleanCode = code.trim().toUpperCase();
  const now = new Date();

  const discount = await Discount.findOne({ code: cleanCode, isDeleted: false });

  if (!discount) {
    return { valid: false, message: `Invalid discount code: '${cleanCode}'.` };
  }

  const eligibility = await checkDiscountEligibility(
    discount,
    { user, customerEmail },
    { items, subtotal, shippingPrice },
    now,
    { excludeOrderId }
  );

  if (!eligibility.eligible) {
    return {
      valid: false,
      message: eligibility.message,
    };
  }

  const eligibleSubtotal = eligibility.eligibleSubtotal != null ? eligibility.eligibleSubtotal : Number(subtotal) || 0;

  // Calculate discount amount
  let calculatedDiscount = 0;
  let isFreeShipping = false;

  if (discount.type === 'percentage') {
    calculatedDiscount = Math.round(eligibleSubtotal * (discount.value / 100) * 100) / 100;
  } else if (discount.type === 'fixed_amount') {
    calculatedDiscount = Math.min(eligibleSubtotal, Number(discount.value) || 0);
  } else if (discount.type === 'free_shipping') {
    calculatedDiscount = Number(shippingPrice) || 0;
    isFreeShipping = true;
  }

  calculatedDiscount = Number(calculatedDiscount.toFixed(2));

  return {
    valid: true,
    discountAmount: calculatedDiscount,
    discount: {
      _id: discount._id,
      id: discount._id.toString(),
      name: discount.name,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      firstOrderOnly: Boolean(discount.firstOrderOnly),
      appliesTo: discount.appliesTo,
      discountAmount: calculatedDiscount,
      isFreeShipping,
      description:
        discount.type === 'percentage'
          ? `${discount.value}% off`
          : discount.type === 'fixed_amount'
          ? `$${discount.value} off`
          : 'Free shipping',
    },
  };
}

/**
 * Atomically records redemption when order is confirmed paid.
 * Ensures strict idempotency (exactly one redemption per order).
 */
export async function recordDiscountRedemption(order) {
  if (!order || (!order.discountId && !order.discountCode)) {
    return null;
  }

  const discount = order.discountId
    ? await Discount.findById(order.discountId)
    : await Discount.findOne({ code: order.discountCode.toUpperCase() });

  if (!discount) {
    return null;
  }

  // Idempotency: verify this order has not already been recorded
  const existing = await DiscountRedemption.findOne({
    discount: discount._id,
    order: order._id,
  });

  if (existing) {
    return existing;
  }

  // Re-verify eligibility at payment confirmation time
  const eligibility = await checkDiscountEligibility(
    discount,
    { user: order.user, customerEmail: order.customerEmail },
    {
      items: order.orderItems,
      subtotal: order.itemsPrice || order.subtotalPrice || order.totalPrice,
      shippingPrice: order.shippingPrice,
    },
    new Date(),
    { excludeOrderId: order._id }
  );

  if (!eligibility.eligible) {
    logger.warn(
      `[DiscountService] Discount ${discount.code} ineligible on order ${order._id}: ${eligibility.message}`
    );
    throw new Error(eligibility.message);
  }

  // Atomically increment usedCount conditionally to prevent race conditions
  const updateCondition = {
    _id: discount._id,
    isDeleted: false,
    status: { $ne: 'disabled' },
    $or: [
      { usageLimit: null },
      { usageLimit: { $exists: false } },
      { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
    ],
  };

  const updatedDiscount = await Discount.findOneAndUpdate(
    updateCondition,
    { $inc: { usedCount: 1 } },
    { returnDocument: 'after' }
  );

  if (!updatedDiscount) {
    logger.warn(`[DiscountService] Usage limit reached for ${discount.code} on order ${order._id}`);
    throw new Error(`Discount code '${discount.code}' has reached its maximum usage limit.`);
  }

  const redemption = await DiscountRedemption.create({
    discount: discount._id,
    code: discount.code,
    order: order._id,
    user: order.user?._id || order.user || null,
    customerEmail: order.customerEmail || '',
    amountDiscounted: Number(order.discountAmount) || 0,
    orderTotal: Number(order.totalPrice) || 0,
  });

  logger.info(`[DiscountService] Recorded redemption for discount ${discount.code} on order ${order.orderNumber}`);

  // Check if usage limit reached to alert administrators
  if (updatedDiscount.usageLimit != null && updatedDiscount.usedCount >= updatedDiscount.usageLimit) {
    await AdminNotification.create({
      type: 'discount_limit_reached',
      title: `Discount Limit Reached: ${updatedDiscount.code}`,
      message: `Discount code '${updatedDiscount.code}' reached its limit of ${updatedDiscount.usageLimit} uses.`,
      entityType: 'discount',
      entityId: updatedDiscount._id.toString(),
      link: '/admin/discounts',
      data: { discountId: updatedDiscount._id, code: updatedDiscount.code, limit: updatedDiscount.usageLimit },
    }).catch(() => {});
  }

  return redemption;
}

/**
 * Reverses a discount redemption upon order refund.
 */
export async function reverseDiscountRedemption(order) {
  if (!order || (!order.discountId && !order.discountCode)) {
    return null;
  }

  const redemption = await DiscountRedemption.findOneAndDelete({ order: order._id });
  if (redemption) {
    await Discount.findByIdAndUpdate(redemption.discount, {
      $inc: { usedCount: -1 },
    });
    logger.info(`[DiscountService] Reversed redemption for discount on order ${order.orderNumber}`);
  }
}

/**
 * Shared Authoritative Discount Performance Analytics
 *
 * One shared backend function used across:
 * 1. Sales analytics Discount performance card (/api/admin/analytics/sales)
 * 2. Sales analytics "Total promo attributed volume" & promo share of gross
 * 3. Sales report CSV export (/api/admin/analytics/export?page=sales)
 * 4. Discounts page KPIs and table (/api/v1/admin/discounts/stats)
 *
 * Metric definitions:
 * - Redemption count: count of DiscountRedemption records for PAID orders in the period.
 * - Discounted revenue: net paid order totals of those orders (order.totalPrice).
 */
export async function getSharedDiscountAnalytics({
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
} = {}) {
  const matchFilter = {
    'orderDoc.isPaid': true,
    'orderDoc.paymentStatus': { $ne: 'cancelled' },
  };

  const andDateConditions = [];
  if (currentStart) {
    andDateConditions.push({ $gte: [{ $ifNull: ['$orderDoc.paidAt', '$createdAt'] }, new Date(currentStart)] });
  }
  if (currentEnd) {
    andDateConditions.push({ $lte: [{ $ifNull: ['$orderDoc.paidAt', '$createdAt'] }, new Date(currentEnd)] });
  }

  const currentPipeline = [
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'orderDoc',
      },
    },
    { $unwind: '$orderDoc' },
    {
      $match: {
        ...matchFilter,
        ...(andDateConditions.length > 0 ? { $expr: { $and: andDateConditions } } : {}),
      },
    },
    {
      $group: {
        _id: '$code',
        discountId: { $first: '$discount' },
        redemptions: { $sum: 1 },
        revenue: { $sum: '$orderDoc.totalPrice' },
        totalSavings: { $sum: { $ifNull: ['$amountDiscounted', '$orderDoc.discountAmount', 0] } },
      },
    },
    { $sort: { redemptions: -1, revenue: -1 } },
  ];

  const currentRedemptionsAgg = await DiscountRedemption.aggregate(currentPipeline);

  let totalRedemptions = 0;
  let totalPromoRevenue = 0;
  let totalSavings = 0;

  const discountPerformance = await Promise.all(
    currentRedemptionsAgg.map(async (item) => {
      totalRedemptions += item.redemptions;
      totalPromoRevenue += item.revenue;
      totalSavings += item.totalSavings;

      let discountName = item._id;
      try {
        const disc = await Discount.findById(item.discountId).select('name');
        if (disc?.name) discountName = disc.name;
      } catch {
        // ignore
      }

      return {
        name: discountName,
        code: item._id,
        redemptions: item.redemptions,
        revenue: Math.round(item.revenue),
        savings: Math.round(item.totalSavings),
      };
    })
  );

  let prevRedemptions = 0;
  let prevPromoRevenue = 0;
  if (prevStart && prevEnd) {
    const prevPipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'order',
          foreignField: '_id',
          as: 'orderDoc',
        },
      },
      { $unwind: '$orderDoc' },
      {
        $match: {
          ...matchFilter,
          $expr: {
            $and: [
              { $gte: [{ $ifNull: ['$orderDoc.paidAt', '$createdAt'] }, new Date(prevStart)] },
              { $lte: [{ $ifNull: ['$orderDoc.paidAt', '$createdAt'] }, new Date(prevEnd)] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          redemptions: { $sum: 1 },
          revenue: { $sum: '$orderDoc.totalPrice' },
        },
      },
    ];
    const [prevAgg] = await DiscountRedemption.aggregate(prevPipeline);
    prevRedemptions = prevAgg?.redemptions || 0;
    prevPromoRevenue = prevAgg?.revenue || 0;
  }

  // All-time totals across all paid orders with a redemption
  const allTimePipeline = [
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'orderDoc',
      },
    },
    { $unwind: '$orderDoc' },
    {
      $match: matchFilter,
    },
    {
      $group: {
        _id: null,
        redemptions: { $sum: 1 },
        revenue: { $sum: '$orderDoc.totalPrice' },
      },
    },
  ];
  const [allTimeAgg] = await DiscountRedemption.aggregate(allTimePipeline);
  const allTimeRedemptions = allTimeAgg?.redemptions || 0;
  const allTimePromoRevenue = allTimeAgg?.revenue || 0;

  return {
    discountPerformance,
    totalRedemptions,
    totalPromoRevenue: Math.round(totalPromoRevenue),
    totalSavings: Math.round(totalSavings),
    prevRedemptions,
    prevPromoRevenue: Math.round(prevPromoRevenue),
    allTimeRedemptions,
    allTimePromoRevenue: Math.round(allTimePromoRevenue),
  };
}
