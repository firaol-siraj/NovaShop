import mongoose from 'mongoose';
import Discount from '../models/discountModel.js';
import DiscountRedemption from '../models/discountRedemptionModel.js';
import Category from '../models/categoryModel.js';
import Product from '../models/productModel.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateDiscount, getSharedDiscountAnalytics } from '../services/discountService.js';
import logger from '../utils/logger.js';

/**
 * Format relative dates for discounts table (e.g. "30 days left", "No end date", "Expired")
 */
function formatDiscountRelativeDate(discount) {
  const now = new Date();
  const startTime = new Date(discount.startsAt).getTime();
  const nowTime = now.getTime();

  if (startTime > nowTime) {
    const diffDays = Math.ceil((startTime - nowTime) / (1000 * 60 * 60 * 24));
    return `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }

  if (!discount.endsAt) {
    return 'No end date';
  }

  const endTime = new Date(discount.endsAt).getTime();
  if (endTime < nowTime) {
    return 'Expired';
  }

  const daysLeft = Math.ceil((endTime - nowTime) / (1000 * 60 * 60 * 24));
  return `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`;
}

/**
 * Format human-readable requirement string
 */
function formatRequirement(discount) {
  if (discount.firstOrderOnly) return 'First order only';
  if (discount.minimumSpend && discount.minimumSpend > 0) {
    return `Min. spend $${discount.minimumSpend}`;
  }
  if (discount.minimumQuantity && discount.minimumQuantity > 0) {
    return `Min. ${discount.minimumQuantity} items`;
  }
  return 'No minimum';
}

/**
 * Format type string for display
 */
function formatTypeDisplay(discount) {
  if (discount.type === 'percentage') return 'Percentage';
  if (discount.type === 'fixed_amount') return 'Fixed amount';
  if (discount.type === 'free_shipping') return 'Free shipping';
  return discount.type;
}

/**
 * Format applies to string for display
 */
function formatAppliesToDisplay(discount) {
  if (discount.appliesTo === 'all_products') return 'All products';
  if (discount.appliesTo === 'specific_categories') {
    const cats = discount.targetCategories || [];
    if (cats.length === 1 && cats[0]?.name) return cats[0].name;
    if (cats.length > 1) return `${cats.length} categories`;
    return 'Specific categories';
  }
  if (discount.appliesTo === 'specific_products') {
    const prods = discount.targetProducts || [];
    if (prods.length === 1 && prods[0]?.name) return prods[0].name;
    if (prods.length > 1) return `${prods.length} products`;
    return 'Specific products';
  }
  return 'All products';
}

/**
 * Format value description for table (e.g. "20% off", "$50 off", "Free shipping")
 */
function formatDiscountDescription(discount) {
  if (discount.type === 'percentage') return `${discount.value}% off`;
  if (discount.type === 'fixed_amount') return `$${discount.value} off`;
  if (discount.type === 'free_shipping') return 'Free shipping';
  return discount.name;
}

// =========================================================================
// CUSTOMER / CHECKOUT ENDPOINTS
// =========================================================================

/**
 * POST /api/v1/discounts/validate
 * Validates a discount code for the active cart.
 */
export const validateDiscountEndpoint = asyncHandler(async (req, res, next) => {
  const { code, items = [], subtotal = 0, shippingPrice = 0, customerEmail = '' } = req.body;

  const result = await validateDiscount({
    code,
    items,
    subtotal: Number(subtotal) || 0,
    shippingPrice: Number(shippingPrice) || 0,
    user: req.user || null,
    customerEmail: customerEmail || req.user?.email || '',
  });

  if (!result.valid) {
    return next(new ApiError(400, result.message));
  }

  res.json({
    status: 'success',
    data: {
      valid: true,
      discountAmount: result.discountAmount,
      discount: result.discount,
      message: `Discount "${result.discount.code}" applied!`,
    },
  });
});

// =========================================================================
// ADMIN ENDPOINTS
// =========================================================================

/**
 * GET /api/v1/admin/discounts
 * Paginated, filtered list of discounts for admin table.
 */
export const getAdminDiscountsList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const {
    search,
    status = 'All',
    type = 'All',
    appliesTo = 'All',
    dateRange = 'All',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filter = { isDeleted: false };
  const now = new Date();

  // Search by name or code
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    filter.$or = [
      { name: { $regex: cleanSearch, $options: 'i' } },
      { code: { $regex: cleanSearch, $options: 'i' } },
    ];
  }

  // Type filter
  if (type && type !== 'All') {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('percent')) filter.type = 'percentage';
    else if (typeLower.includes('fixed')) filter.type = 'fixed_amount';
    else if (typeLower.includes('shipping')) filter.type = 'free_shipping';
  }

  // Applies to filter
  if (appliesTo && appliesTo !== 'All') {
    const appliesLower = appliesTo.toLowerCase();
    if (appliesLower.includes('all')) filter.appliesTo = 'all_products';
    else if (appliesLower.includes('categor')) filter.appliesTo = 'specific_categories';
    else if (appliesLower.includes('product')) filter.appliesTo = 'specific_products';
  }

  // Date Range filter
  if (dateRange && dateRange !== 'All') {
    if (dateRange === 'Active now') {
      filter.status = 'active';
      filter.startsAt = { $lte: now };
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
      });
    } else if (dateRange === 'Starts this month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      filter.startsAt = { $gte: monthStart, $lte: monthEnd };
    } else if (dateRange === 'Ends this month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      filter.endsAt = { $gte: monthStart, $lte: monthEnd };
    }
  }

  // Status Filter (derives dynamically)
  const statusNormalized = status ? status.toLowerCase() : 'all';
  if (statusNormalized === 'active') {
    filter.status = 'active';
    filter.startsAt = { $lte: now };
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    });
  } else if (statusNormalized === 'scheduled') {
    filter.status = 'active';
    filter.startsAt = { $gt: now };
  } else if (statusNormalized === 'expired') {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { endsAt: { $lt: now } },
        { status: 'disabled' },
        {
          $and: [
            { usageLimit: { $gt: 0 } },
            { $expr: { $gte: ['$usedCount', '$usageLimit'] } },
          ],
        },
      ],
    });
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortDirection };

  const [discounts, totalCount] = await Promise.all([
    Discount.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('targetCategories', 'name')
      .populate('targetProducts', 'name')
      .lean(),
    Discount.countDocuments(filter),
  ]);

  const formattedDiscounts = discounts.map((d) => {
    // Dynamic status derivation
    let dynamicStatus = 'Active';
    if (d.status === 'disabled') dynamicStatus = 'Expired';
    else if (d.status === 'draft') dynamicStatus = 'Draft';
    else if (new Date(d.startsAt).getTime() > now.getTime()) dynamicStatus = 'Scheduled';
    else if (d.endsAt && new Date(d.endsAt).getTime() < now.getTime()) dynamicStatus = 'Expired';
    else if (d.usageLimit && d.usedCount >= d.usageLimit) dynamicStatus = 'Expired';

    const startDateStr = new Date(d.startsAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const endDateStr = d.endsAt
      ? new Date(d.endsAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      : '';

    const createdStr = `Created ${new Date(d.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })} · ${d.code}`;

    return {
      id: d._id.toString(),
      _id: d._id.toString(),
      name: d.name,
      code: d.code,
      description: formatDiscountDescription(d),
      type: formatTypeDisplay(d),
      rawType: d.type,
      value: d.value,
      appliesTo: formatAppliesToDisplay(d),
      rawAppliesTo: d.appliesTo,
      requirement: formatRequirement(d),
      used: d.usedCount || 0,
      limit: d.usageLimit || null,
      start: startDateStr,
      end: endDateStr,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      relativeDate: formatDiscountRelativeDate(d),
      status: dynamicStatus,
      rawStatus: d.status,
      created: createdStr,
      minimumSpend: d.minimumSpend,
      minimumQuantity: d.minimumQuantity,
      firstOrderOnly: d.firstOrderOnly,
      perCustomerLimit: d.perCustomerLimit,
      stackable: d.stackable,
    };
  });

  res.json({
    status: 'success',
    data: {
      discounts: formattedDiscounts,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      limit,
    },
  });
});

/**
 * GET /api/v1/admin/discounts/stats
 * Real metrics for stat cards: Active, Scheduled, Total Redemptions, Discounted Revenue,
 * each with comparative trend for the 30-day period.
 */
export const getAdminDiscountStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Active discounts count
  const activeCount = await Discount.countDocuments({
    isDeleted: false,
    status: 'active',
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
  });

  // Active discounts created in last 30 days
  const activeCreatedThisMonth = await Discount.countDocuments({
    isDeleted: false,
    status: 'active',
    createdAt: { $gte: currentPeriodStart },
  });

  // Scheduled discounts
  const scheduledCount = await Discount.countDocuments({
    isDeleted: false,
    status: 'active',
    startsAt: { $gt: now },
  });

  const scheduledCreatedThisMonth = await Discount.countDocuments({
    isDeleted: false,
    status: 'active',
    startsAt: { $gt: now },
    createdAt: { $gte: currentPeriodStart },
  });

  // Total redemptions all-time & period comparison (synchronized across authoritative sources)
  const sharedDiscountStats = await getSharedDiscountAnalytics({
    currentStart: currentPeriodStart,
    currentEnd: now,
    prevStart: previousPeriodStart,
    prevEnd: currentPeriodStart,
  });

  const [totalRedemptionsInDb, usedAgg] = await Promise.all([
    DiscountRedemption.countDocuments(),
    Discount.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalUsed: { $sum: '$usedCount' } } },
    ]),
  ]);

  const totalRedemptions = Math.max(
    totalRedemptionsInDb,
    usedAgg[0]?.totalUsed || 0,
    sharedDiscountStats.allTimeRedemptions
  );
  const currentPeriodRedemptions = sharedDiscountStats.totalRedemptions;
  const prevPeriodRedemptions = sharedDiscountStats.prevRedemptions;

  const redemptionTrend =
    prevPeriodRedemptions === 0
      ? '-'
      : (() => {
          const pct = ((currentPeriodRedemptions - prevPeriodRedemptions) / prevPeriodRedemptions) * 100;
          return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
        })();

  const currentRevenue = sharedDiscountStats.totalPromoRevenue;
  const prevRevenue = sharedDiscountStats.prevPromoRevenue;
  const allTimeDiscountedRevenue = sharedDiscountStats.allTimePromoRevenue;

  const revenueTrend =
    prevRevenue === 0
      ? '-'
      : (() => {
          const pct = ((currentRevenue - prevRevenue) / prevRevenue) * 100;
          return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
        })();

  res.json({
    status: 'success',
    data: {
      stats: {
        activeCount,
        activeTrend: activeCreatedThisMonth > 0 ? `+${activeCreatedThisMonth} this month` : '-',
        scheduledCount,
        scheduledTrend: scheduledCreatedThisMonth > 0 ? `+${scheduledCreatedThisMonth} this month` : '-',
        totalRedemptions,
        redemptionsTrend: redemptionTrend,
        discountedRevenue: allTimeDiscountedRevenue,
        discountedRevenueCurrency: 'USD',
        discountedRevenueTrend: revenueTrend,
      },
    },
  });
});

/**
 * POST /api/v1/admin/discounts
 * Creates a new discount.
 */
export const createAdminDiscount = asyncHandler(async (req, res, next) => {
  const {
    name,
    code,
    method = 'code',
    type,
    value,
    appliesTo = 'all_products',
    targetCategories = [],
    targetProducts = [],
    minimumSpend = null,
    minimumQuantity = null,
    firstOrderOnly = false,
    usageLimit = null,
    perCustomerLimit = null,
    startsAt = new Date(),
    endsAt = null,
    status = 'active',
    stackable = false,
  } = req.body;

  const cleanCode = code.trim().toUpperCase();

  const existing = await Discount.findOne({ code: cleanCode, isDeleted: false });
  if (existing) {
    return next(new ApiError(400, `A discount with code "${cleanCode}" already exists.`));
  }

  // Permanently clear any soft-deleted legacy discount with the same code
  await Discount.deleteMany({ code: cleanCode, isDeleted: true });

  const discount = await Discount.create({
    name: name.trim(),
    code: cleanCode,
    method,
    type,
    value: Number(value),
    appliesTo,
    targetCategories,
    targetProducts,
    minimumSpend: minimumSpend ? Number(minimumSpend) : null,
    minimumQuantity: minimumQuantity ? Number(minimumQuantity) : null,
    firstOrderOnly: Boolean(firstOrderOnly),
    usageLimit: usageLimit ? Number(usageLimit) : null,
    perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
    startsAt: new Date(startsAt),
    endsAt: endsAt ? new Date(endsAt) : null,
    status,
    stackable: Boolean(stackable),
    createdBy: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    message: 'Discount created successfully.',
    data: { discount },
  });
});

/**
 * GET /api/v1/admin/discounts/:id
 * Single discount details with performance metrics.
 */
export const getAdminDiscountById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let discount;
  if (mongoose.Types.ObjectId.isValid(id)) {
    discount = await Discount.findOne({ _id: id, isDeleted: false })
      .populate('targetCategories', 'name slug')
      .populate('targetProducts', 'name slug image basePrice');
  } else {
    discount = await Discount.findOne({ code: id.toUpperCase(), isDeleted: false })
      .populate('targetCategories', 'name slug')
      .populate('targetProducts', 'name slug image basePrice');
  }

  if (!discount) {
    return next(new ApiError(404, 'Discount not found'));
  }

  // Aggregate redemptions and revenue for this discount
  const [redemptionsCount, revenueAgg] = await Promise.all([
    DiscountRedemption.countDocuments({ discount: discount._id }),
    DiscountRedemption.aggregate([
      { $match: { discount: discount._id } },
      { $group: { _id: null, totalRevenue: { $sum: '$orderTotal' }, totalSavings: { $sum: '$amountDiscounted' } } },
    ]),
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
  const totalSavings = revenueAgg[0]?.totalSavings || 0;

  res.json({
    status: 'success',
    data: {
      discount,
      stats: {
        redemptions: redemptionsCount,
        discountedRevenue: totalRevenue,
        customerSavings: totalSavings,
      },
    },
  });
});

/**
 * PUT /api/v1/admin/discounts/:id
 * Updates an existing discount.
 */
export const updateAdminDiscount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let discount;
  if (mongoose.Types.ObjectId.isValid(id)) {
    discount = await Discount.findOne({ _id: id, isDeleted: false });
  } else {
    discount = await Discount.findOne({ code: id.toUpperCase(), isDeleted: false });
  }

  if (!discount) {
    return next(new ApiError(404, 'Discount not found'));
  }

  const {
    name,
    code,
    method,
    type,
    value,
    appliesTo,
    targetCategories,
    targetProducts,
    minimumSpend,
    minimumQuantity,
    firstOrderOnly,
    usageLimit,
    perCustomerLimit,
    startsAt,
    endsAt,
    status,
    stackable,
  } = req.body;

  if (code && code.trim().toUpperCase() !== discount.code) {
    const cleanCode = code.trim().toUpperCase();
    const existing = await Discount.findOne({ code: cleanCode, isDeleted: false, _id: { $ne: discount._id } });
    if (existing) {
      return next(new ApiError(400, `A discount with code "${cleanCode}" already exists.`));
    }
    await Discount.deleteMany({ code: cleanCode, isDeleted: true, _id: { $ne: discount._id } });
    discount.code = cleanCode;
  }

  if (name !== undefined) discount.name = name.trim();
  if (method !== undefined) discount.method = method;
  if (type !== undefined) discount.type = type;
  if (value !== undefined) discount.value = Number(value);
  if (appliesTo !== undefined) discount.appliesTo = appliesTo;
  if (targetCategories !== undefined) discount.targetCategories = targetCategories;
  if (targetProducts !== undefined) discount.targetProducts = targetProducts;
  if (minimumSpend !== undefined) discount.minimumSpend = minimumSpend ? Number(minimumSpend) : null;
  if (minimumQuantity !== undefined) discount.minimumQuantity = minimumQuantity ? Number(minimumQuantity) : null;
  if (firstOrderOnly !== undefined) discount.firstOrderOnly = Boolean(firstOrderOnly);
  if (usageLimit !== undefined) discount.usageLimit = usageLimit ? Number(usageLimit) : null;
  if (perCustomerLimit !== undefined) discount.perCustomerLimit = perCustomerLimit ? Number(perCustomerLimit) : null;
  if (startsAt !== undefined) discount.startsAt = new Date(startsAt);
  if (endsAt !== undefined) discount.endsAt = endsAt ? new Date(endsAt) : null;
  if (status !== undefined) discount.status = status;
  if (stackable !== undefined) discount.stackable = Boolean(stackable);

  await discount.save();

  res.json({
    status: 'success',
    message: 'Discount updated successfully.',
    data: { discount },
  });
});

/**
 * POST /api/v1/admin/discounts/:id/duplicate
 * Duplicates a discount with an incremental -COPY suffix.
 */
export const duplicateAdminDiscount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let source;
  if (mongoose.Types.ObjectId.isValid(id)) {
    source = await Discount.findOne({ _id: id, isDeleted: false });
  } else {
    source = await Discount.findOne({ code: id.toUpperCase(), isDeleted: false });
  }

  if (!source) {
    return next(new ApiError(404, 'Discount not found'));
  }

  // Generate unique copy code
  let newCode = `${source.code}-COPY`;
  let counter = 2;
  while (await Discount.findOne({ code: newCode, isDeleted: false })) {
    newCode = `${source.code}-COPY${counter}`;
    counter++;
  }
  await Discount.deleteMany({ code: newCode, isDeleted: true });

  const duplicated = await Discount.create({
    name: `${source.name} (Copy)`,
    code: newCode,
    method: source.method,
    type: source.type,
    value: source.value,
    appliesTo: source.appliesTo,
    targetCategories: source.targetCategories,
    targetProducts: source.targetProducts,
    minimumSpend: source.minimumSpend,
    minimumQuantity: source.minimumQuantity,
    firstOrderOnly: source.firstOrderOnly,
    usageLimit: source.usageLimit,
    perCustomerLimit: source.perCustomerLimit,
    usedCount: 0,
    startsAt: new Date(),
    endsAt: source.endsAt,
    status: 'draft',
    stackable: source.stackable,
    createdBy: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    message: `Discount duplicated as ${duplicated.code}`,
    data: { discount: duplicated },
  });
});

/**
 * PATCH /api/v1/admin/discounts/:id/end
 * Immediately ends an active discount.
 */
export const endAdminDiscount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let discount;
  if (mongoose.Types.ObjectId.isValid(id)) {
    discount = await Discount.findOne({ _id: id, isDeleted: false });
  } else {
    discount = await Discount.findOne({ code: id.toUpperCase(), isDeleted: false });
  }

  if (!discount) {
    return next(new ApiError(404, 'Discount not found'));
  }

  discount.endsAt = new Date();
  discount.status = 'disabled';
  await discount.save();

  res.json({
    status: 'success',
    message: `Discount "${discount.code}" ended.`,
    data: { discount },
  });
});

/**
 * DELETE /api/v1/admin/discounts/:id
 * Soft deletes a discount.
 */
export const deleteAdminDiscount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let discount;
  if (mongoose.Types.ObjectId.isValid(id)) {
    discount = await Discount.findOne({ _id: id, isDeleted: false });
  } else {
    discount = await Discount.findOne({ code: id.toUpperCase(), isDeleted: false });
  }

  if (!discount) {
    return next(new ApiError(404, 'Discount not found'));
  }

  discount.isDeleted = true;
  await discount.save();

  res.json({
    status: 'success',
    message: `Discount "${discount.code}" deleted.`,
  });
});

/**
 * POST /api/v1/admin/discounts/bulk
 * Bulk action: duplicate, end, or delete.
 */
export const bulkUpdateDiscounts = asyncHandler(async (req, res, next) => {
  const { ids, action } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ApiError(400, 'Please select discounts to update.'));
  }

  const query = mongoose.Types.ObjectId.isValid(ids[0])
    ? { _id: { $in: ids }, isDeleted: false }
    : { code: { $in: ids.map((c) => c.toUpperCase()) }, isDeleted: false };

  const discounts = await Discount.find(query);

  if (action === 'delete') {
    await Discount.updateMany({ _id: { $in: discounts.map((d) => d._id) } }, { isDeleted: true });
  } else if (action === 'end') {
    const now = new Date();
    await Discount.updateMany(
      { _id: { $in: discounts.map((d) => d._id) } },
      { endsAt: now, status: 'disabled' }
    );
  } else if (action === 'duplicate') {
    for (const source of discounts) {
      let newCode = `${source.code}-COPY`;
      let counter = 2;
      while (await Discount.findOne({ code: newCode, isDeleted: false })) {
        newCode = `${source.code}-COPY${counter}`;
        counter++;
      }
      await Discount.deleteMany({ code: newCode, isDeleted: true });
      await Discount.create({
        name: `${source.name} (Copy)`,
        code: newCode,
        method: source.method,
        type: source.type,
        value: source.value,
        appliesTo: source.appliesTo,
        targetCategories: source.targetCategories,
        targetProducts: source.targetProducts,
        minimumSpend: source.minimumSpend,
        minimumQuantity: source.minimumQuantity,
        firstOrderOnly: source.firstOrderOnly,
        usageLimit: source.usageLimit,
        perCustomerLimit: source.perCustomerLimit,
        usedCount: 0,
        startsAt: new Date(),
        endsAt: source.endsAt,
        status: 'draft',
        stackable: source.stackable,
        createdBy: req.user._id,
      });
    }
  }

  res.json({
    status: 'success',
    message: `Updated ${discounts.length} discounts.`,
  });
});

/**
 * GET /api/v1/admin/discounts/export
 * Exports discounts to CSV.
 */
export const exportDiscountsCsv = asyncHandler(async (req, res) => {
  const discounts = await Discount.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .populate('targetCategories', 'name')
    .populate('targetProducts', 'name')
    .lean();

  const headers = ['Code', 'Name', 'Type', 'Value', 'Applies To', 'Requirement', 'Used Count', 'Usage Limit', 'Starts At', 'Ends At', 'Status', 'Created At'];
  const rows = discounts.map((d) => [
    `"${d.code}"`,
    `"${(d.name || '').replace(/"/g, '""')}"`,
    d.type,
    d.value,
    formatAppliesToDisplay(d),
    `"${formatRequirement(d)}"`,
    d.usedCount,
    d.usageLimit || 'Unlimited',
    `"${new Date(d.startsAt).toISOString()}"`,
    d.endsAt ? `"${new Date(d.endsAt).toISOString()}"` : 'None',
    d.status,
    `"${new Date(d.createdAt).toISOString()}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="novashop-discounts.csv"');
  res.status(200).send(csvContent);
});

/**
 * GET /api/v1/admin/discounts/:id/redemptions
 * Lists recent redemptions / usages for a specific discount.
 */
export const getDiscountRedemptionsList = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let discount;
  if (mongoose.Types.ObjectId.isValid(id)) {
    discount = await Discount.findOne({ _id: id, isDeleted: false });
  } else {
    discount = await Discount.findOne({ code: id.toUpperCase(), isDeleted: false });
  }

  if (!discount) {
    return next(new ApiError(404, 'Discount not found'));
  }

  const redemptions = await DiscountRedemption.find({ discount: discount._id })
    .populate('order', 'orderNumber totalPrice isPaid status createdAt')
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.status(200).json({
    status: 'success',
    data: {
      discount: {
        _id: discount._id,
        name: discount.name,
        code: discount.code,
        usedCount: discount.usedCount,
      },
      redemptions: redemptions.map((r) => ({
        _id: r._id,
        orderNumber: r.order?.orderNumber || (r.order?._id ? `ORD-${String(r.order._id).slice(-6).toUpperCase()}` : '—'),
        orderId: r.order?._id || r.order,
        orderStatus: r.order?.status || 'completed',
        isPaid: r.order?.isPaid ?? true,
        customerName: r.user?.name || (r.customerEmail ? r.customerEmail.split('@')[0] : 'Guest customer'),
        customerEmail: r.customerEmail || r.user?.email || '—',
        amountSaved: r.amountDiscounted || 0,
        orderTotal: r.orderTotal || r.order?.totalPrice || 0,
        date: r.createdAt,
      })),
    },
  });
});
