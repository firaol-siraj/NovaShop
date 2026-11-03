import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import shippingService from '../services/shippingService.js';
import Setting from '../models/settingModel.js';
import Order from '../models/orderModel.js';

// @desc    Get Shipping page statistics and all tab lists
// @route   GET /api/v1/admin/shipping/stats
// @access  Private/Admin
export const getAdminShippingStats = asyncHandler(async (req, res, next) => {
  const data = await shippingService.getShippingStats();
  res.status(200).json({ success: true, data });
});

// @desc    Get all shipping zones
// @route   GET /api/v1/admin/shipping/zones
// @access  Private/Admin
export const getAdminZones = asyncHandler(async (req, res, next) => {
  const stats = await shippingService.getShippingStats();
  res.status(200).json({ success: true, count: stats.deliveryZones.length, data: stats.deliveryZones });
});

// @desc    Get all shipping methods
// @route   GET /api/v1/admin/shipping/methods
// @access  Private/Admin
export const getAdminMethods = asyncHandler(async (req, res, next) => {
  const stats = await shippingService.getShippingStats();
  res.status(200).json({ success: true, count: stats.shippingMethods.length, data: stats.shippingMethods });
});

// @desc    Get all shipping rates
// @route   GET /api/v1/admin/shipping/rates
// @access  Private/Admin
export const getAdminRates = asyncHandler(async (req, res, next) => {
  const stats = await shippingService.getShippingStats();
  res.status(200).json({ success: true, count: stats.shippingRates.length, data: stats.shippingRates });
});

// @desc    Get all delivery times
// @route   GET /api/v1/admin/shipping/delivery-times
// @access  Private/Admin
export const getAdminDeliveryTimes = asyncHandler(async (req, res, next) => {
  const stats = await shippingService.getShippingStats();
  res.status(200).json({ success: true, count: stats.deliveryTimes.length, data: stats.deliveryTimes });
});

// @desc    Get shipping zone by ID
// @route   GET /api/v1/admin/shipping/zones/:id
// @access  Private/Admin
export const getAdminZoneById = asyncHandler(async (req, res, next) => {
  const zone = await shippingService.getZoneById(req.params.id);
  if (!zone) {
    return next(new ApiError(404, 'Shipping zone not found'));
  }
  res.status(200).json({ success: true, data: zone });
});

// @desc    Create new shipping zone
// @route   POST /api/v1/admin/shipping/zones
// @access  Private/Admin
export const createAdminZone = asyncHandler(async (req, res, next) => {
  const { name, countries, regions, status, freeOverThresholdUSD, handlingTime } = req.body;
  if (!name || !countries || countries.length === 0) {
    return next(new ApiError(400, 'Zone name and at least one country are required'));
  }

  const zone = await shippingService.createZone({
    name,
    countries,
    regions: regions || [],
    status: status || 'Active',
    freeOverThresholdUSD: Number(freeOverThresholdUSD) || 300,
    handlingTime: handlingTime || '1–2 business days',
  });

  res.status(201).json({ success: true, data: zone });
});

// @desc    Update shipping zone
// @route   PUT /api/v1/admin/shipping/zones/:id
// @access  Private/Admin
export const updateAdminZone = asyncHandler(async (req, res, next) => {
  const zone = await shippingService.updateZone(req.params.id, req.body);
  if (!zone) {
    return next(new ApiError(404, 'Shipping zone not found'));
  }
  res.status(200).json({ success: true, data: zone });
});

// @desc    Delete shipping zone
// @route   DELETE /api/v1/admin/shipping/zones/:id
// @access  Private/Admin
export const deleteAdminZone = asyncHandler(async (req, res, next) => {
  const referencingOrders = await Order.countDocuments({
    shippingZone: req.params.id,
  });

  if (referencingOrders > 0) {
    // Cannot destructively delete zone referenced by existing orders; deactivate instead to protect historical order records
    const zone = await shippingService.updateZone(req.params.id, { status: 'inactive' });
    return res.status(200).json({
      success: true,
      message: `Delivery zone is referenced by ${referencingOrders} order(s). It has been deactivated instead of permanently deleted to preserve historical order records.`,
      data: zone,
      deactivated: true,
    });
  }

  await shippingService.deleteZone(req.params.id);
  res.status(200).json({ success: true, message: 'Shipping zone deleted successfully' });
});

// @desc    Get shipping method by ID
// @route   GET /api/v1/admin/shipping/methods/:id
// @access  Private/Admin
export const getAdminMethodById = asyncHandler(async (req, res, next) => {
  const method = await shippingService.getMethodById(req.params.id);
  if (!method) {
    return next(new ApiError(404, 'Shipping method not found'));
  }
  res.status(200).json({ success: true, data: method });
});

// @desc    Create shipping method
// @route   POST /api/v1/admin/shipping/methods
// @access  Private/Admin
export const createAdminMethod = asyncHandler(async (req, res, next) => {
  const { name, zone, carrier, rateStructure, estimatedMinDays, estimatedMaxDays, estimatedDeliveryNote, rateUSD, rateETB } = req.body;
  if (!name || !zone) {
    return next(new ApiError(400, 'Method name and zone ID are required'));
  }

  const minD = Number(estimatedMinDays) || 1;
  const maxD = Number(estimatedMaxDays) || 1;
  if (minD < 0 || maxD < 0 || minD > maxD) {
    return next(new ApiError(400, 'Estimated min days must be >= 0 and <= max days'));
  }

  const method = await shippingService.createMethod({
    name,
    zone,
    carrier: carrier || 'Local Courier',
    rateStructure: rateStructure || 'Flat rate',
    estimatedMinDays: minD,
    estimatedMaxDays: maxD,
    estimatedDeliveryNote: estimatedDeliveryNote || 'business days',
    rateUSD: Math.max(0, Number(rateUSD) || 0),
    rateETB: Math.max(0, Number(rateETB) || 0),
  });

  res.status(201).json({ success: true, data: method });
});

// @desc    Update shipping method
// @route   PUT /api/v1/admin/shipping/methods/:id
// @access  Private/Admin
export const updateAdminMethod = asyncHandler(async (req, res, next) => {
  if (req.body.estimatedMinDays !== undefined && req.body.estimatedMaxDays !== undefined) {
    const minD = Number(req.body.estimatedMinDays);
    const maxD = Number(req.body.estimatedMaxDays);
    if (minD < 0 || maxD < 0 || minD > maxD) {
      return next(new ApiError(400, 'Estimated min days must be >= 0 and <= max days'));
    }
  }

  const method = await shippingService.updateMethod(req.params.id, req.body);
  if (!method) {
    return next(new ApiError(404, 'Shipping method not found'));
  }
  res.status(200).json({ success: true, data: method });
});

// @desc    Delete shipping method
// @route   DELETE /api/v1/admin/shipping/methods/:id
// @access  Private/Admin
export const deleteAdminMethod = asyncHandler(async (req, res, next) => {
  await shippingService.deleteMethod(req.params.id);
  res.status(200).json({ success: true, message: 'Shipping method deleted successfully' });
});

// @desc    Create shipping rate
// @route   POST /api/v1/admin/shipping/rates
// @access  Private/Admin
export const createAdminRate = asyncHandler(async (req, res, next) => {
  const { method, zone, amountUSD, amountETB, rateType, minOrderTotalUSD, freeOverThresholdUSD } = req.body;
  if (!method || !zone) {
    return next(new ApiError(400, 'Method ID and Zone ID are required'));
  }

  const usd = Number(amountUSD) || 0;
  const etb = Number(amountETB) || 0;
  if (usd < 0 || etb < 0) {
    return next(new ApiError(400, 'Shipping rate amounts must be non-negative'));
  }

  const rate = await shippingService.createRate({
    method,
    zone,
    amountUSD: usd,
    amountETB: etb,
    rateType: rateType || 'Flat rate',
    minOrderTotalUSD: Number(minOrderTotalUSD) || 0,
    freeOverThresholdUSD: freeOverThresholdUSD ? Number(freeOverThresholdUSD) : null,
  });

  res.status(201).json({ success: true, data: rate });
});

// @desc    Update shipping rate
// @route   PUT /api/v1/admin/shipping/rates/:id
// @access  Private/Admin
export const updateAdminRate = asyncHandler(async (req, res, next) => {
  if (req.body.amountUSD !== undefined && Number(req.body.amountUSD) < 0) {
    return next(new ApiError(400, 'Shipping rate amountUSD must be >= 0'));
  }
  if (req.body.amountETB !== undefined && Number(req.body.amountETB) < 0) {
    return next(new ApiError(400, 'Shipping rate amountETB must be >= 0'));
  }

  const rate = await shippingService.updateRate(req.params.id, req.body);
  if (!rate) {
    return next(new ApiError(404, 'Shipping rate not found'));
  }
  res.status(200).json({ success: true, data: rate });
});

// @desc    Delete shipping rate
// @route   DELETE /api/v1/admin/shipping/rates/:id
// @access  Private/Admin
export const deleteAdminRate = asyncHandler(async (req, res, next) => {
  await shippingService.deleteRate(req.params.id);
  res.status(200).json({ success: true, message: 'Shipping rate deleted successfully' });
});

// @desc    Update delivery times
// @route   PUT /api/v1/admin/shipping/delivery-times/:zoneId
// @access  Private/Admin
export const updateAdminDeliveryTimes = asyncHandler(async (req, res, next) => {
  await shippingService.updateDeliveryTime(req.params.zoneId, req.body);
  res.status(200).json({ success: true, message: 'Delivery times updated successfully' });
});

// @desc    Get shipping settings
// @route   GET /api/v1/admin/shipping/settings
// @access  Private/Admin
export const getAdminShippingSettings = asyncHandler(async (req, res, next) => {
  const [freeShippingThreshold, originSetting] = await Promise.all([
    Setting.getSetting('free_shipping_threshold', 300),
    Setting.findOne({ key: 'shipping_origin_address' }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      freeShippingThreshold: Number(freeShippingThreshold) || 300,
      originAddress: originSetting?.value || 'Bole, Addis Ababa, Ethiopia',
      currency: 'USD',
    },
  });
});

// @desc    Update shipping settings
// @route   PUT /api/v1/admin/shipping/settings
// @access  Private/Admin
export const updateAdminShippingSettings = asyncHandler(async (req, res, next) => {
  const { freeShippingThreshold, originAddress } = req.body;

  if (freeShippingThreshold !== undefined) {
    await Setting.findOneAndUpdate(
      { key: 'free_shipping_threshold' },
      { value: String(freeShippingThreshold), group: 'shipping' },
      { upsert: true, new: true }
    );
  }

  if (originAddress) {
    await Setting.findOneAndUpdate(
      { key: 'shipping_origin_address' },
      { value: String(originAddress), group: 'shipping' },
      { upsert: true, new: true }
    );
  }

  res.status(200).json({ success: true, message: 'Shipping settings updated successfully' });
});
