import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import User from '../models/userModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import Setting from '../models/settingModel.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import emailService from '../services/emailService.js';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  VERIFIED_PAID_STATUSES,
  FULFILLED_STATUSES,
  FULFILLMENT_QUEUE_STATUSES,
  TIMELY_DISPATCH_HOURS,
  DEFAULT_LOW_STOCK_THRESHOLD,
} from '../constants/orderConstants.js';

/**
 * Resolves date boundaries for query period and comparison period of equal length
 */
export function resolveDateRanges(fromQuery, toQuery) {
  const now = new Date();
  let currentStart;
  let currentEnd;

  if (fromQuery && toQuery) {
    currentStart = new Date(fromQuery);
    currentEnd = new Date(toQuery);
  } else {
    // Default: Current Month to date
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Ensure valid dates
  if (isNaN(currentStart.getTime())) {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  if (isNaN(currentEnd.getTime())) {
    currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const durationMs = Math.max(1, currentEnd.getTime() - currentStart.getTime());
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { currentStart, currentEnd, prevStart, prevEnd };
}

/**
 * Helper to calculate percentage change safely, returning null (or formatted as "-") if prev is zero
 */
function calculatePercentageChange(current, previous) {
  const currNum = Number(current) || 0;
  const prevNum = Number(previous) || 0;
  if (prevNum <= 0) {
    return null; // Prevents NaN or Infinity
  }
  return Number((((currNum - prevNum) / prevNum) * 100).toFixed(1));
}

/**
 * @desc    Get dashboard KPI summaries with comparison to previous period
 * @route   GET /api/v1/admin/dashboard/summary
 * @access  Private/Admin
 */
export const getDashboardSummary = asyncHandler(async (req, res, next) => {
  const { currentStart, currentEnd, prevStart, prevEnd } = resolveDateRanges(req.query.from, req.query.to);

  // Read configurable low-stock threshold and store currency from settings
  const settingsDoc = await Setting.getSingleton();
  const lowStockThreshold = Number(settingsDoc?.inventory?.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD) || DEFAULT_LOW_STOCK_THRESHOLD;
  const storeCurrency = settingsDoc?.storeDetails?.currency || settingsDoc?.currency || 'USD';

  // 1. REVENUE AGGREGATION (PAID orders only, subtract refunds, exclude cancelled)
  const [revenueResult] = await Order.aggregate([
    {
      $facet: {
        currentPeriod: [
          {
            $match: {
              createdAt: { $gte: currentStart, $lte: currentEnd },
              isPaid: true,
              paymentStatus: { $ne: PAYMENT_STATUS.CANCELLED },
            },
          },
          {
            $group: {
              _id: null,
              grossRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$status', ORDER_STATUS.REFUNDED] }, 0, '$totalPrice'],
                },
              },
              refunds: {
                $sum: {
                  $cond: [{ $eq: ['$status', ORDER_STATUS.REFUNDED] }, '$totalPrice', 0],
                },
              },
              paidOrdersCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', ORDER_STATUS.REFUNDED] }, 0, 1],
                },
              },
            },
          },
        ],
        previousPeriod: [
          {
            $match: {
              createdAt: { $gte: prevStart, $lte: prevEnd },
              isPaid: true,
              paymentStatus: { $ne: PAYMENT_STATUS.CANCELLED },
            },
          },
          {
            $group: {
              _id: null,
              grossRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$status', ORDER_STATUS.REFUNDED] }, 0, '$totalPrice'],
                },
              },
              refunds: {
                $sum: {
                  $cond: [{ $eq: ['$status', ORDER_STATUS.REFUNDED] }, '$totalPrice', 0],
                },
              },
              paidOrdersCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', ORDER_STATUS.REFUNDED] }, 0, 1],
                },
              },
            },
          },
        ],
        dailyCurrentRevenue: [
          {
            $match: {
              createdAt: { $gte: currentStart, $lte: currentEnd },
              isPaid: true,
              status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              dailyNet: { $sum: '$totalPrice' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const curRevGross = revenueResult?.currentPeriod[0]?.grossRevenue || 0;
  const curRefunds = revenueResult?.currentPeriod[0]?.refunds || 0;
  const currentNetRevenue = Math.max(0, curRevGross - curRefunds);
  const currentPaidOrders = revenueResult?.currentPeriod[0]?.paidOrdersCount || 0;

  const prevRevGross = revenueResult?.previousPeriod[0]?.grossRevenue || 0;
  const prevRefunds = revenueResult?.previousPeriod[0]?.refunds || 0;
  const previousNetRevenue = Math.max(0, prevRevGross - prevRefunds);
  const previousPaidOrders = revenueResult?.previousPeriod[0]?.paidOrdersCount || 0;

  const revenueChange = calculatePercentageChange(currentNetRevenue, previousNetRevenue);
  const revenueDifference = currentNetRevenue - previousNetRevenue;

  // 2. ORDERS FULFILLED AGGREGATION (Delivered count, timely dispatch %)
  const [fulfilledResult] = await Order.aggregate([
    {
      $facet: {
        currentPeriod: [
          {
            $match: {
              status: { $in: FULFILLED_STATUSES },
              $or: [
                { deliveredAt: { $gte: currentStart, $lte: currentEnd } },
                { updatedAt: { $gte: currentStart, $lte: currentEnd } },
              ],
            },
          },
          {
            $project: {
              isTimely: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$paidAt', false] },
                      { $ifNull: ['$deliveredAt', false] },
                      {
                        $lte: [
                          { $subtract: ['$deliveredAt', '$paidAt'] },
                          TIMELY_DISPATCH_HOURS * 3600000,
                        ],
                      },
                    ],
                  },
                  1,
                  // If delivered without exact paidAt timing, fallback to SLA
                  1,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalFulfilled: { $sum: 1 },
              timelyCount: { $sum: '$isTimely' },
            },
          },
        ],
        previousPeriod: [
          {
            $match: {
              status: { $in: FULFILLED_STATUSES },
              $or: [
                { deliveredAt: { $gte: prevStart, $lte: prevEnd } },
                { updatedAt: { $gte: prevStart, $lte: prevEnd } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              totalFulfilled: { $sum: 1 },
            },
          },
        ],
        dailyFulfilled: [
          {
            $match: {
              status: { $in: FULFILLED_STATUSES },
              $or: [
                { deliveredAt: { $gte: currentStart, $lte: currentEnd } },
                { updatedAt: { $gte: currentStart, $lte: currentEnd } },
              ],
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: { $ifNull: ['$deliveredAt', '$updatedAt'] },
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const currentFulfilled = fulfilledResult?.currentPeriod[0]?.totalFulfilled || 0;
  const currentTimelyCount = fulfilledResult?.currentPeriod[0]?.timelyCount || 0;
  const timelyDispatchRate = currentFulfilled > 0
    ? Number(((currentTimelyCount / currentFulfilled) * 100).toFixed(1))
    : 100.0;

  const previousFulfilled = fulfilledResult?.previousPeriod[0]?.totalFulfilled || 0;
  const fulfilledChange = calculatePercentageChange(currentFulfilled, previousFulfilled);

  // 3. ACTIVE CUSTOMERS & REPEAT CUSTOMER RATE
  const [activeCustomersCurrent] = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: currentStart, $lte: currentEnd },
        isPaid: true,
        paymentStatus: { $ne: PAYMENT_STATUS.CANCELLED },
      },
    },
    {
      $group: {
        _id: '$user',
        orderCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        totalActiveCustomers: { $sum: 1 },
      },
    },
  ]);

  const [activeCustomersPrev] = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: prevStart, $lte: prevEnd },
        isPaid: true,
        paymentStatus: { $ne: PAYMENT_STATUS.CANCELLED },
      },
    },
    {
      $group: {
        _id: '$user',
      },
    },
    {
      $group: {
        _id: null,
        totalActiveCustomers: { $sum: 1 },
      },
    },
  ]);

  // Real repeat customer rate: customers with 2+ paid orders / customers with 1+ paid orders
  const [repeatCustomerStats] = await Order.aggregate([
    {
      $match: {
        isPaid: true,
        paymentStatus: { $ne: PAYMENT_STATUS.CANCELLED },
      },
    },
    {
      $group: {
        _id: '$user',
        totalPaidOrders: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        allCustomersWithOrders: { $sum: 1 },
        repeatCustomers: {
          $sum: {
            $cond: [{ $gte: ['$totalPaidOrders', 2] }, 1, 0],
          },
        },
      },
    },
  ]);

  const currentActiveCustomers = activeCustomersCurrent?.totalActiveCustomers || 0;
  const prevActiveCustomers = activeCustomersPrev?.totalActiveCustomers || 0;
  const activeCustomersChange = calculatePercentageChange(currentActiveCustomers, prevActiveCustomers);

  const totalBuyers = repeatCustomerStats?.allCustomersWithOrders || 0;
  const repeatBuyers = repeatCustomerStats?.repeatCustomers || 0;
  const repeatCustomerRate = totalBuyers > 0
    ? Number(((repeatBuyers / totalBuyers) * 100).toFixed(1))
    : 0.0;

  // 4. CATALOG HEALTH (real SKU/variant counts, in stock, low stock, critical)
  const [catalogHealth] = await ProductVariant.aggregate([
    {
      $group: {
        _id: null,
        totalVariants: { $sum: 1 },
        inStock: {
          $sum: {
            $cond: [{ $gt: ['$stock', lowStockThreshold] }, 1, 0],
          },
        },
        lowStock: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$stock', 0] },
                  { $lte: ['$stock', lowStockThreshold] },
                ],
              },
              1,
              0,
            ],
          },
        },
        critical: {
          $sum: {
            $cond: [{ $eq: ['$stock', 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  const totalSKUs = catalogHealth?.totalVariants || 0;
  const inStockCount = catalogHealth?.inStock || 0;
  const lowStockCount = catalogHealth?.lowStock || 0;
  const criticalCount = catalogHealth?.critical || 0;

  // Build real sparkline data points
  const revenueSparkline = (revenueResult?.dailyCurrentRevenue || []).map((d) => d.dailyNet);
  const fulfilledSparkline = (fulfilledResult?.dailyFulfilled || []).map((d) => d.count);

  res.status(200).json({
    success: true,
    data: {
      dateRange: {
        from: currentStart.toISOString(),
        to: currentEnd.toISOString(),
        prevFrom: prevStart.toISOString(),
        prevTo: prevEnd.toISOString(),
      },
      currency: storeCurrency,
      revenue: {
        totalNetRevenue: currentNetRevenue,
        previousNetRevenue,
        difference: revenueDifference,
        percentageChange: revenueChange,
        sparkline: revenueSparkline,
      },
      ordersFulfilled: {
        totalFulfilled: currentFulfilled,
        previousFulfilled,
        percentageChange: fulfilledChange,
        timelyDispatchRate,
        timelyDispatchThresholdHours: TIMELY_DISPATCH_HOURS,
        sparkline: fulfilledSparkline,
      },
      activeCustomers: {
        totalActiveCustomers: currentActiveCustomers,
        previousActiveCustomers: prevActiveCustomers,
        percentageChange: activeCustomersChange,
        repeatCustomerRate,
      },
      catalogHealth: {
        totalSKUs,
        inStock: inStockCount,
        lowStock: lowStockCount,
        critical: criticalCount,
        lowStockThreshold,
        needsRestockCount: lowStockCount + criticalCount,
      },
    },
  });
});

/**
 * @desc    Get Revenue Velocity Chart series (current vs previous period)
 * @route   GET /api/v1/admin/dashboard/revenue
 * @access  Private/Admin
 */
export const getRevenueVelocity = asyncHandler(async (req, res, next) => {
  const { currentStart, currentEnd, prevStart, prevEnd } = resolveDateRanges(req.query.from, req.query.to);
  const interval = req.query.interval || 'day';

  const settingsDoc = await Setting.getSingleton();
  const storeCurrency = settingsDoc?.storeDetails?.currency || settingsDoc?.currency || 'USD';

  // 1. Fetch all paid orders for both periods with orderItems to determine daily best sellers
  const [currentOrders, prevOrders] = await Promise.all([
    Order.find({
      createdAt: { $gte: currentStart, $lte: currentEnd },
      isPaid: true,
      status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] },
    }).select('orderNumber totalPrice orderItems createdAt'),
    Order.find({
      createdAt: { $gte: prevStart, $lte: prevEnd },
      isPaid: true,
      status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] },
    }).select('orderNumber totalPrice createdAt'),
  ]);

  // Helper to format date key YYYY-MM-DD
  const toDayKey = (d) => new Date(d).toISOString().slice(0, 10);

  // Map daily revenue and products sold for current period
  const dailyCurrentMap = new Map();
  const dayProductsMap = new Map();

  for (const order of currentOrders) {
    const dayKey = toDayKey(order.createdAt);
    const existing = dailyCurrentMap.get(dayKey) || { revenue: 0, orderCount: 0 };
    existing.revenue += Number(order.totalPrice || 0);
    existing.orderCount += 1;
    dailyCurrentMap.set(dayKey, existing);

    // Track products sold on this day
    const prodCountMap = dayProductsMap.get(dayKey) || new Map();
    for (const item of order.orderItems || []) {
      const name = item.name || 'Item';
      prodCountMap.set(name, (prodCountMap.get(name) || 0) + (item.qty || 1));
    }
    dayProductsMap.set(dayKey, prodCountMap);
  }

  // Map daily revenue for previous period
  const dailyPrevMap = new Map();
  for (const order of prevOrders) {
    const dayKey = toDayKey(order.createdAt);
    const existing = dailyPrevMap.get(dayKey) || { revenue: 0, orderCount: 0 };
    existing.revenue += Number(order.totalPrice || 0);
    existing.orderCount += 1;
    dailyPrevMap.set(dayKey, existing);
  }

  // Generate continuous timeline buckets filling zero for empty days
  const currentDaysList = [];
  const curCursor = new Date(currentStart);
  while (curCursor <= currentEnd) {
    currentDaysList.push(toDayKey(curCursor));
    curCursor.setDate(curCursor.getDate() + 1);
  }

  const prevDaysList = [];
  const prevCursor = new Date(prevStart);
  while (prevCursor <= prevEnd) {
    prevDaysList.push(toDayKey(prevCursor));
    prevCursor.setDate(prevCursor.getDate() + 1);
  }

  let peakDay = null;
  let maxRevenue = -1;
  let totalNetRevenue = 0;
  let totalPaidOrders = 0;

  const currentSeries = currentDaysList.map((dayKey, index) => {
    const curData = dailyCurrentMap.get(dayKey) || { revenue: 0, orderCount: 0 };
    const rev = Number(curData.revenue.toFixed(2));
    totalNetRevenue += rev;
    totalPaidOrders += curData.orderCount;

    // Find top product for this day
    const prods = dayProductsMap.get(dayKey);
    let topProductOfDay = 'Standard Order';
    if (prods && prods.size > 0) {
      let maxUnits = -1;
      for (const [pName, units] of prods.entries()) {
        if (units > maxUnits) {
          maxUnits = units;
          topProductOfDay = pName;
        }
      }
    }

    if (rev > maxRevenue) {
      maxRevenue = rev;
      peakDay = {
        date: dayKey,
        formattedDate: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dayKey)),
        fullDate: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(dayKey)).toUpperCase(),
        revenue: rev,
        orderCount: curData.orderCount,
        topProduct: topProductOfDay,
      };
    }

    // Compare with corresponding day in previous period
    const prevDayKey = prevDaysList[index];
    const prevData = prevDayKey ? (dailyPrevMap.get(prevDayKey) || { revenue: 0, orderCount: 0 }) : { revenue: 0, orderCount: 0 };
    const dayChange = calculatePercentageChange(rev, prevData.revenue);

    return {
      date: dayKey,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dayKey)),
      netRevenue: rev,
      orderCount: curData.orderCount,
      topProduct: topProductOfDay,
      changeVsPrevious: dayChange,
    };
  });

  const previousSeries = prevDaysList.map((dayKey) => {
    const prevData = dailyPrevMap.get(dayKey) || { revenue: 0, orderCount: 0 };
    return {
      date: dayKey,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dayKey)),
      netRevenue: Number(prevData.revenue.toFixed(2)),
      orderCount: prevData.orderCount,
    };
  });

  // Calculate Real AOV: net revenue / paid orders
  const aov = totalPaidOrders > 0 ? Number((totalNetRevenue / totalPaidOrders).toFixed(2)) : 0;

  // Fallback peak day if all days had 0 revenue
  if (!peakDay && currentSeries.length > 0) {
    const first = currentSeries[0];
    peakDay = {
      date: first.date,
      formattedDate: first.label,
      fullDate: first.label.toUpperCase(),
      revenue: 0,
      orderCount: 0,
      topProduct: 'No orders',
    };
  }

  res.status(200).json({
    success: true,
    data: {
      currency: storeCurrency,
      netSales: Number(totalNetRevenue.toFixed(2)),
      aov,
      conversionRate: null,
      conversionRateLabel: 'Not tracked',
      conversionRateTracked: false,
      peakDay,
      currentSeries,
      previousSeries,
    },
  });
});

/**
 * @desc    Get top products by units sold (verified paid orders only)
 * @route   GET /api/v1/admin/dashboard/top-products
 * @access  Private/Admin
 */
export const getTopProducts = asyncHandler(async (req, res, next) => {
  const { currentStart, currentEnd } = resolveDateRanges(req.query.from, req.query.to);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 4));

  const [topProductsAgg, totalCatalogCount] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: currentStart, $lte: currentEnd },
          isPaid: true,
          status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] },
        },
      },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          unitsSold: { $sum: '$orderItems.qty' },
          totalRevenue: {
            $sum: { $multiply: ['$orderItems.price', '$orderItems.qty'] },
          },
          storedPrice: { $first: '$orderItems.price' },
          itemImage: { $first: '$orderItems.image' },
          itemName: { $first: '$orderItems.name' },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDoc.category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          productId: '$_id',
          name: { $ifNull: ['$productDoc.name', '$itemName'] },
          slug: '$productDoc.slug',
          image: { $ifNull: ['$productDoc.image', '$itemImage'] },
          category: { $ifNull: ['$categoryDoc.name', 'Collection'] },
          price: { $ifNull: ['$storedPrice', '$productDoc.price'] },
          unitsSold: 1,
          totalRevenue: 1,
        },
      },
    ]),
    Product.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCatalogCount,
      topProducts: topProductsAgg,
    },
  });
});

/**
 * @desc    Get real low-stock and out-of-stock variants sorted by urgency
 * @route   GET /api/v1/admin/dashboard/inventory-alerts
 * @access  Private/Admin
 */
export const getInventoryAlerts = asyncHandler(async (req, res, next) => {
  const lowStockThreshold = Number(await Setting.getSetting('lowStockThreshold', DEFAULT_LOW_STOCK_THRESHOLD)) || DEFAULT_LOW_STOCK_THRESHOLD;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const variants = await ProductVariant.find({
    stock: { $lte: lowStockThreshold },
  })
    .sort({ stock: 1 }) // 0 units first (critical urgency), then lowest
    .limit(limit)
    .populate('product', 'name category image slug');

  const alerts = variants.map((v) => {
    const isCritical = (Number(v.stock) || 0) === 0;
    const isLow = (Number(v.stock) || 0) > 0 && (Number(v.stock) || 0) <= lowStockThreshold;
    const colorName = v.color?.name || 'Standard';
    const size = v.size || 'One Size';

    return {
      variantId: v._id,
      productId: v.product?._id || null,
      productName: v.product?.name || 'Product',
      productSlug: v.product?.slug || '',
      sku: v.sku,
      color: colorName,
      size,
      details: `${colorName} · ${size} · SKU: ${v.sku}`,
      stock: v.stock,
      unitsLeftLabel: `${v.stock} left`,
      isCritical,
      isLow,
      restockPath: v.product?._id ? `/admin/products/${v.product._id}/edit` : '/admin/inventory',
    };
  });

  const criticalCount = alerts.filter((a) => a.isCritical).length;

  res.status(200).json({
    success: true,
    data: {
      alerts,
      criticalCount,
      threshold: lowStockThreshold,
    },
  });
});

/**
 * @desc    Get fulfillment queue: count and list of paid orders awaiting dispatch
 * @route   GET /api/v1/admin/dashboard/fulfillment-queue
 * @access  Private/Admin
 */
export const getFulfillmentQueue = asyncHandler(async (req, res, next) => {
  const queueOrders = await Order.find({
    isPaid: true,
    status: { $in: FULFILLMENT_QUEUE_STATUSES },
  })
    .sort({ paidAt: 1, createdAt: 1 }) // Earliest first
    .populate('user', 'name email')
    .select('orderNumber status isPaid paidAt createdAt customerEmail shippingAddress orderItems totalPrice currency');

  const earliestOrder = queueOrders[0];
  const readySince = earliestOrder?.paidAt || earliestOrder?.createdAt || null;

  res.status(200).json({
    success: true,
    data: {
      count: queueOrders.length,
      readySince,
      orders: queueOrders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.user?.name || o.shippingAddress?.recipientName || 'Customer',
        customerEmail: o.customerEmail || o.user?.email || '',
        paidAt: o.paidAt || o.createdAt,
        totalPrice: o.totalPrice,
        currency: o.currency || 'USD',
        itemsCount: (o.orderItems || []).reduce((acc, curr) => acc + (curr.qty || 1), 0),
        shippingAddress: o.shippingAddress,
        items: o.orderItems,
      })),
    },
  });
});

/**
 * @desc    Dispatch all orders in fulfillment queue in one transaction/batch with status history & emails
 * @route   POST /api/v1/admin/orders/dispatch
 * @access  Private/Admin
 */
export const dispatchOrders = asyncHandler(async (req, res, next) => {
  const { orderIds, note, carrier } = req.body;

  let query = {
    isPaid: true,
    status: { $in: FULFILLMENT_QUEUE_STATUSES },
  };

  if (Array.isArray(orderIds) && orderIds.length > 0) {
    query._id = { $in: orderIds };
  }

  const ordersToDispatch = await Order.find(query).populate('user', 'name email settings');

  if (ordersToDispatch.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No orders awaiting dispatch in queue.',
      dispatchedCount: 0,
    });
  }

  const dispatchedOrderNumbers = [];

  for (const order of ordersToDispatch) {
    order.status = ORDER_STATUS.SHIPPED;
    if (carrier) order.carrier = carrier;

    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: ORDER_STATUS.SHIPPED,
      timestamp: new Date(),
      admin: req.user?._id || null,
      note: note || 'Dispatched by admin courier handoff',
    });

    await order.save();
    dispatchedOrderNumbers.push(order.orderNumber);

    // Trigger existing status update email (sendEmail respects user deliveryUpdates setting)
    const targetEmail = order.customerEmail || order.user?.email;
    if (targetEmail) {
      try {
        const emailContent = emailService.getOrderStatusEmail({
          order,
          newStatus: ORDER_STATUS.SHIPPED,
        });

        await emailService.sendEmail({
          to: targetEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          orderId: order._id,
          userId: order.user?._id || order.user,
          type: 'status_update',
          statusCategory: 'delivery',
        });
      } catch (err) {
        logger.error(`[dispatchOrders] Failed to deliver dispatch email for ${order.orderNumber}: ${err.message}`);
      }
    }
  }

  // Create admin notification record for record keeping
  await AdminNotification.create({
    type: 'system',
    title: 'Orders Dispatched',
    message: `${ordersToDispatch.length} orders marked as Shipped and courier dispatched.`,
    data: { orderNumbers: dispatchedOrderNumbers },
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: `Successfully dispatched ${ordersToDispatch.length} order(s).`,
    dispatchedCount: ordersToDispatch.length,
    orderNumbers: dispatchedOrderNumbers,
  });
});

/**
 * @desc    Get paginated real orders with search and status filters
 * @route   GET /api/v1/admin/orders
 * @access  Private/Admin
 */
export const getAdminOrdersList = asyncHandler(async (req, res, next) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 6));
  const skip = (page - 1) * limit;

  const { search, status, from, to } = req.query;
  const matchFilter = {};

  // Status Filter
  if (status && status !== 'All Statuses' && status !== 'all') {
    matchFilter.status = status.toLowerCase().trim();
  }

  // Customer Filter
  if (req.query.customer && mongoose.Types.ObjectId.isValid(req.query.customer)) {
    matchFilter.user = new mongoose.Types.ObjectId(req.query.customer);
  }

  // Discount Filter
  if (req.query.discount) {
    const disc = req.query.discount.trim();
    if (mongoose.Types.ObjectId.isValid(disc)) {
      matchFilter.$or = [
        { discountId: new mongoose.Types.ObjectId(disc) },
        { discountCode: disc },
      ];
    } else {
      matchFilter.discountCode = new RegExp('^' + disc + '$', 'i');
    }
  }

  // Date Range filter
  if (from && to) {
    matchFilter.createdAt = {
      $gte: new Date(from),
      $lte: new Date(to),
    };
  }

  // Search filter across orderNumber, customerEmail, or customer name
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    // Search users matching name or email first
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
      ],
    }).select('_id');

    const userIds = matchingUsers.map((u) => u._id);

    matchFilter.$or = [
      { orderNumber: { $regex: cleanSearch, $options: 'i' } },
      { customerEmail: { $regex: cleanSearch, $options: 'i' } },
      { 'shippingAddress.recipientName': { $regex: cleanSearch, $options: 'i' } },
      { user: { $in: userIds } },
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(matchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name image slug price')
      .populate('orderItems.variant', 'sku size color stock'),
    Order.countDocuments(matchFilter),
  ]);

  const formattedOrders = orders.map((o) => {
    const customerName = o.user?.name || o.shippingAddress?.recipientName || 'Valued Customer';
    const customerEmail = o.customerEmail || o.user?.email || 'N/A';
    const items = o.orderItems || [];
    const firstItem = items[0] || {};
    const totalItemsCount = items.reduce((acc, curr) => acc + (curr.qty || 1), 0);

    const initials = customerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'CU';

    return {
      id: o._id,
      orderNumber: o.orderNumber,
      customerName,
      customerEmail,
      initials,
      firstItem: {
        name: firstItem.name || 'Product Item',
        image: firstItem.image || firstItem.product?.image || '',
        price: firstItem.price || 0,
        qty: firstItem.qty || 1,
      },
      itemsCount: totalItemsCount,
      extraItemsCount: Math.max(0, totalItemsCount - (firstItem.qty || 1)),
      totalPrice: o.totalPrice,
      currency: o.currency || 'USD',
      status: o.status,
      paymentStatus: o.paymentStatus,
      isPaid: o.isPaid,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      shippingAddress: o.shippingAddress,
      orderItems: o.orderItems,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      orders: formattedOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

/**
 * @desc    Get admin notifications with unread count
 * @route   GET /api/v1/admin/notifications
 * @access  Private/Admin
 */
export const getAdminNotifications = asyncHandler(async (req, res, next) => {
  let notifications = await AdminNotification.find()
    .sort({ createdAt: -1 })
    .limit(30);

  // If collection is empty, backfill initial helpful notifications from real data
  if (notifications.length === 0) {
    const recentPaid = await Order.find({ isPaid: true }).sort({ createdAt: -1 }).limit(3);
    for (const ord of recentPaid) {
      await AdminNotification.create({
        type: 'new_order',
        title: `New Paid Order #${ord.orderNumber}`,
        message: `Order #${ord.orderNumber} confirmed paid for $${ord.totalPrice.toFixed(2)}.`,
        entityType: 'order',
        entityId: ord._id.toString(),
        link: `/admin/orders/${ord._id}`,
        data: { orderId: ord._id, orderNumber: ord.orderNumber },
        createdAt: ord.paidAt || ord.createdAt,
      }).catch(() => {});
    }

    const lowStockVar = await ProductVariant.findOne({ stock: { $lte: 5 } }).populate('product', 'name');
    if (lowStockVar) {
      await AdminNotification.create({
        type: 'low_stock',
        title: `Low Stock: ${lowStockVar.product?.name || 'Product'}`,
        message: `Variant ${lowStockVar.sku} has only ${lowStockVar.stock} units remaining.`,
        entityType: 'variant',
        entityId: lowStockVar._id.toString(),
        link: `/admin/inventory?search=${encodeURIComponent(lowStockVar.sku || '')}`,
        data: { variantId: lowStockVar._id, sku: lowStockVar.sku },
      }).catch(() => {});
    }

    notifications = await AdminNotification.find().sort({ createdAt: -1 }).limit(30);
  }

  const unreadCount = await AdminNotification.countDocuments({ isRead: false });

  res.status(200).json({
    success: true,
    data: {
      unreadCount,
      notifications,
    },
  });
});

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/v1/admin/notifications/:id/read
 * @access  Private/Admin
 */
export const markNotificationRead = asyncHandler(async (req, res, next) => {
  const notification = await AdminNotification.findByIdAndUpdate(
    req.params.id,
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return next(new ApiError(404, 'Notification not found'));
  }

  const unreadCount = await AdminNotification.countDocuments({ isRead: false });

  res.status(200).json({
    success: true,
    data: {
      notification,
      unreadCount,
    },
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/v1/admin/notifications/read-all
 * @access  Private/Admin
 */
export const markAllNotificationsRead = asyncHandler(async (req, res, next) => {
  await AdminNotification.updateMany(
    { isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    unreadCount: 0,
  });
});

/**
 * @desc    Global admin search (⌘K) searching real orders, products and customers
 * @route   GET /api/v1/admin/search
 * @access  Private/Admin
 */
export const globalAdminSearch = asyncHandler(async (req, res, next) => {
  const q = req.query.q ? req.query.q.trim() : '';
  if (!q) {
    return res.status(200).json({
      success: true,
      data: { orders: [], products: [], customers: [] },
    });
  }

  const regex = new RegExp(q, 'i');

  const [orders, products, customers] = await Promise.all([
    Order.find({
      $or: [
        { orderNumber: regex },
        { customerEmail: regex },
        { 'shippingAddress.recipientName': regex },
      ],
    })
      .select('orderNumber status totalPrice createdAt customerEmail')
      .sort({ createdAt: -1 })
      .limit(5),

    Product.find({
      $or: [{ name: regex }, { brand: regex }, { slug: regex }],
    })
      .select('name slug price image category brand countInStock')
      .populate('category', 'name')
      .limit(5),

    User.find({
      role: 'customer',
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    })
      .select('name email phone createdAt')
      .limit(5),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders: orders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.totalPrice,
        customerEmail: o.customerEmail,
        createdAt: o.createdAt,
      })),
      products: products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        image: p.image,
        category: p.category?.name || 'Uncategorized',
        stock: p.countInStock,
      })),
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        joinedAt: c.createdAt,
      })),
    },
  });
});

/**
 * @desc    Export real report as CSV of selected period
 * @route   GET /api/v1/admin/reports/export
 * @access  Private/Admin
 */
export const exportReport = asyncHandler(async (req, res, next) => {
  const { currentStart, currentEnd } = resolveDateRanges(req.query.from, req.query.to);

  const orders = await Order.find({
    createdAt: { $gte: currentStart, $lte: currentEnd },
    isPaid: true,
    status: { $ne: ORDER_STATUS.CANCELLED },
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name email');

  const totalNetRevenue = orders
    .filter((o) => o.status !== ORDER_STATUS.REFUNDED)
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  const fulfilledCount = orders.filter((o) => o.status === ORDER_STATUS.DELIVERED).length;
  const uniqueCustomers = new Set(orders.map((o) => o.user?.email || o.customerEmail)).size;

  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = [
    ['NOVASHOP STORE PERFORMANCE REPORT'],
    ['Period From', currentStart.toISOString().slice(0, 10)],
    ['Period To', currentEnd.toISOString().slice(0, 10)],
    ['Generated At', new Date().toISOString()],
    [''],
    ['SUMMARY KPI METRICS'],
    ['Total Net Revenue (USD)', `$${totalNetRevenue.toFixed(2)}`],
    ['Total Paid Orders', orders.length],
    ['Orders Fulfilled', fulfilledCount],
    ['Active Customers in Period', uniqueCustomers],
    [''],
    ['DETAILED PAID ORDERS'],
    ['Order ID', 'Date', 'Customer Name', 'Customer Email', 'Status', 'Payment Method', 'Items Count', 'Currency', 'Total Amount'],
    ...orders.map((o) => [
      escapeCsv(o.orderNumber),
      escapeCsv(new Date(o.createdAt).toISOString().slice(0, 19).replace('T', ' ')),
      escapeCsv(o.user?.name || o.shippingAddress?.recipientName || 'Customer'),
      escapeCsv(o.customerEmail || o.user?.email || ''),
      escapeCsv(o.status),
      escapeCsv(o.paymentMethod || 'Chapa'),
      escapeCsv((o.orderItems || []).reduce((acc, curr) => acc + (curr.qty || 1), 0)),
      escapeCsv(o.currency || 'USD'),
      escapeCsv(Number(o.totalPrice || 0).toFixed(2)),
    ]),
  ];

  const csvContent = rows.map((r) => (Array.isArray(r) ? r.join(',') : r)).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="novashop-report-${currentStart.toISOString().slice(0, 10)}-to-${currentEnd.toISOString().slice(0, 10)}.csv"`
  );

  return res.status(200).send(csvContent);
});
