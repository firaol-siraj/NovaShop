import asyncHandler from '../utils/asyncHandler.js';
import shippingService from '../services/shippingService.js';

// @desc    Get dynamic shipping quotes for customer checkout
// @route   POST /api/v1/shipping/quote
// @access  Public / Authenticated
export const getShippingQuote = asyncHandler(async (req, res, next) => {
  const { country, region, cartTotalUSD, weightKg } = req.body;
  const quotes = await shippingService.getShippingQuote({
    country,
    region,
    cartTotalUSD,
    weightKg,
  });

  res.status(200).json({
    success: true,
    count: quotes.length,
    data: quotes,
    options: quotes,
  });
});
