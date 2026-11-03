import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import returnService from '../services/returnService.js';

// @desc    Get Returns dashboard statistics and KPI cards
// @route   GET /api/v1/admin/returns/stats
// @access  Private/Admin
export const getAdminReturnStats = asyncHandler(async (req, res, next) => {
  const { periodDays, from, to } = req.query;
  const stats = await returnService.getReturnStats({
    periodDays: periodDays ? parseInt(periodDays, 10) : 30,
    from,
    to,
  });
  res.status(200).json({ success: true, data: stats });
});

// @desc    Get Paginated & Filtered Returns list with tab counts
// @route   GET /api/v1/admin/returns
// @access  Private/Admin
export const getAdminReturns = asyncHandler(async (req, res, next) => {
  const { page, limit, status, reason, resolution, search, dateFrom, dateTo, customer, order, periodDays } = req.query;
  const result = await returnService.getReturns({
    page,
    limit,
    status,
    reason,
    resolution,
    search,
    dateFrom,
    dateTo,
    customer,
    order,
    periodDays,
  });
  res.status(200).json({ success: true, data: result });
});

// @desc    Get single return request detail
// @route   GET /api/v1/admin/returns/:id
// @access  Private/Admin
export const getAdminReturnById = asyncHandler(async (req, res, next) => {
  try {
    const detail = await returnService.getReturnById(req.params.id);
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    return next(new ApiError(err.statusCode || 404, err.message));
  }
});

// @desc    Approve a return request
// @route   POST /api/v1/admin/returns/:id/approve
// @access  Private/Admin
export const approveReturn = asyncHandler(async (req, res, next) => {
  const { trackingNumber, instructions, note } = req.body;
  try {
    const updated = await returnService.approveReturn({
      returnId: req.params.id,
      adminUser: req.user,
      trackingNumber,
      instructions,
      note,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return next(new ApiError(err.statusCode || 400, err.message));
  }
});

// @desc    Reject a return request (reason required)
// @route   POST /api/v1/admin/returns/:id/reject
// @access  Private/Admin
export const rejectReturn = asyncHandler(async (req, res, next) => {
  const { reason, note } = req.body;
  try {
    const updated = await returnService.rejectReturn({
      returnId: req.params.id,
      adminUser: req.user,
      reason,
      note,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return next(new ApiError(err.statusCode || 400, err.message));
  }
});

// @desc    Confirm receipt of returned items (restock)
// @route   POST /api/v1/admin/returns/:id/receive
// @access  Private/Admin
export const receiveReturn = asyncHandler(async (req, res, next) => {
  const { restock = true, itemsToRestock, restockItems, note } = req.body;
  try {
    const updated = await returnService.receiveReturn({
      returnId: req.params.id,
      adminUser: req.user,
      restock,
      itemsToRestock: itemsToRestock || restockItems,
      note,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return next(new ApiError(err.statusCode || 400, err.message));
  }
});

// @desc    Process refund for a return request
// @route   POST /api/v1/admin/returns/:id/refund
// @access  Private/Admin
export const processRefund = asyncHandler(async (req, res, next) => {
  const { amountUSD, refundMethod, includeShipping, note } = req.body;
  try {
    const updated = await returnService.processRefund({
      returnId: req.params.id,
      adminUser: req.user,
      amountUSD,
      refundMethod,
      includeShipping,
      note,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return next(new ApiError(err.statusCode || 400, err.message));
  }
});

// @desc    Add admin note to return request
// @route   POST /api/v1/admin/returns/:id/notes
// @access  Private/Admin
export const addAdminNote = asyncHandler(async (req, res, next) => {
  const { note } = req.body;
  if (!note || !note.trim()) {
    return next(new ApiError(400, 'Note content is required'));
  }

  const notes = await returnService.addAdminNote({
    returnId: req.params.id,
    note: note.trim(),
    author: req.user?.name || 'Admin',
  });

  res.status(201).json({ success: true, data: notes });
});

// @desc    Bulk status update
// @route   POST /api/v1/admin/returns/bulk-status
// @access  Private/Admin
export const bulkUpdateReturnStatus = asyncHandler(async (req, res, next) => {
  const { returnIds, status, reason } = req.body;
  if (!returnIds || !Array.isArray(returnIds) || returnIds.length === 0 || !status) {
    return next(new ApiError(400, 'returnIds array and status are required'));
  }

  const result = await returnService.bulkUpdateStatus({
    returnIds,
    newStatus: status,
    adminUser: req.user,
    reason,
  });

  res.status(200).json({ success: true, ...result });
});

// @desc    Export returns to CSV
// @route   GET /api/v1/admin/returns/export
// @access  Private/Admin
export const exportReturnsCsv = asyncHandler(async (req, res, next) => {
  const csv = await returnService.exportCsv(req.query);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="returns_${Date.now()}.csv"`);
  res.status(200).send(csv);
});
