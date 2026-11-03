import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import returnService from '../services/returnService.js';
import ReturnRequest from '../models/returnRequestModel.js';

// @desc    Customer submits a return request for a delivered order
// @route   POST /api/v1/returns
// @access  Private
export const submitReturnRequest = asyncHandler(async (req, res, next) => {
  const { orderId, items, customerNote, resolution } = req.body;
  if (!orderId) {
    return next(new ApiError(400, 'Order ID is required'));
  }

  try {
    const returnRequest = await returnService.createReturnRequest({
      orderId,
      user: req.user,
      items,
      customerNote,
      resolution,
    });

    res.status(201).json({ success: true, data: returnRequest });
  } catch (err) {
    return next(new ApiError(400, err.message));
  }
});

// @desc    Customer gets their return requests
// @route   GET /api/v1/returns/my
// @access  Private
export const getMyReturns = asyncHandler(async (req, res, next) => {
  const returns = await ReturnRequest.find({ user: req.user._id }).sort({ requestedAt: -1 }).lean();
  res.status(200).json({ success: true, count: returns.length, data: returns });
});

// @desc    Check return eligibility or active request for an order
// @route   GET /api/v1/returns/order/:orderId
// @access  Private
export const getReturnForOrder = asyncHandler(async (req, res, next) => {
  const returnDoc = await ReturnRequest.findOne({ order: req.params.orderId, user: req.user._id }).lean();
  res.status(200).json({ success: true, data: returnDoc || null });
});
