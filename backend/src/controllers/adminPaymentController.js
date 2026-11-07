import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import paymentService from '../services/paymentService.js';
import Payment from '../models/paymentModel.js';
import Order from '../models/orderModel.js';
import Setting from '../models/settingModel.js';
import { emailQueue, queueOrSendEmail } from '../queues/emailQueue.js';
import logger from '../utils/logger.js';

// @desc    Get Payments Dashboard Stats & KPI Cards
// @route   GET /api/v1/admin/payments/stats
// @access  Private/Admin
export const getAdminPaymentStats = asyncHandler(async (req, res, next) => {
  const periodDays = parseInt(req.query.periodDays, 10) || 30;
  const stats = await paymentService.getPaymentStats({ periodDays });
  res.status(200).json({ success: true, data: stats });
});

// @desc    Get Detailed Payment by ID or txRef
// @route   GET /api/v1/admin/payments/:id
// @access  Private/Admin
export const getAdminPaymentDetail = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isMongoId = mongoose.Types.ObjectId.isValid(id);
  const query = isMongoId
    ? { $or: [{ _id: id }, { txRef: id }, { chapaReference: id }] }
    : { $or: [{ txRef: id }, { chapaReference: id }] };

  const payment = await Payment.findOne(query)
    .populate({
      path: 'order',
      select: 'orderNumber status isPaid paidAt totalPrice totalPriceETB orderItems shippingAddress',
    })
    .populate('user', 'name email phone')
    .lean();

  if (!payment) {
    return next(new ApiError(404, 'Payment record not found'));
  }

  res.status(200).json({ success: true, data: payment });
});

// @desc    Get Paginated & Filtered Transactions list
// @route   GET /api/v1/admin/payments/transactions
// @access  Private/Admin
export const getAdminTransactions = asyncHandler(async (req, res, next) => {
  const { page, limit, search, status, method, periodDays, customer, order } = req.query;
  const result = await paymentService.getTransactions({
    page,
    limit,
    search,
    status,
    method,
    periodDays,
    customer,
    order,
  });
  res.status(200).json({ success: true, data: result });
});

// @desc    Get Payout detail by payoutNumber or ID
// @route   GET /api/v1/admin/payments/payouts/:id
// @access  Private/Admin
export const getAdminPayoutDetail = asyncHandler(async (req, res, next) => {
  const payout = await paymentService.getPayoutById(req.params.id);
  if (!payout) {
    return next(new ApiError(404, 'Payout not found'));
  }
  res.status(200).json({ success: true, data: payout });
});

// @desc    Get Payouts list
// @route   GET /api/v1/admin/payments/payouts
// @access  Private/Admin
export const getAdminPayouts = asyncHandler(async (req, res, next) => {
  const { status } = req.query;
  const payouts = await paymentService.getPayouts({ status });
  res.status(200).json({ success: true, data: payouts });
});

// @desc    Record manual or scheduled Payout
// @route   POST /api/v1/admin/payments/payouts
// @access  Private/Admin
export const recordAdminPayout = asyncHandler(async (req, res, next) => {
  const { amount, destination, ordersCount, status, expectedArrival, reference, notes } = req.body;
  if (!amount || Number(amount) <= 0) {
    return next(new ApiError(400, 'Valid payout amount is required'));
  }

  const payout = await paymentService.recordPayout({
    amount,
    destination,
    ordersCount,
    status,
    expectedArrival,
    reference,
    notes,
    adminId: req.user?._id,
  });

  res.status(201).json({ success: true, data: payout });
});

// @desc    Get Payment Methods with Real processed counts and shares
// @route   GET /api/v1/admin/payments/methods
// @access  Private/Admin
export const getAdminPaymentMethods = asyncHandler(async (req, res, next) => {
  const methods = await paymentService.getPaymentMethods();
  res.status(200).json({ success: true, data: methods });
});

// @desc    Reverify a transaction with Chapa gateway
// @route   POST /api/v1/admin/payments/reverify
// @access  Private/Admin
export const reverifyPaymentTransaction = asyncHandler(async (req, res, next) => {
  const txRef = req.params.id || req.body.txRef || req.body.id;
  if (!txRef) {
    return next(new ApiError(400, 'Transaction reference (txRef) is required'));
  }

  try {
    const result = await paymentService.reverifyWithChapa(txRef);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error(`[AdminPaymentController] Reverify error: ${err.message}`);
    return next(new ApiError(400, err.message));
  }
});

// @desc    Resend receipt email for a payment transaction
// @route   POST /api/v1/admin/payments/resend-receipt
// @access  Private/Admin
export const resendPaymentReceipt = asyncHandler(async (req, res, next) => {
  const txRef = req.params.id || req.body.txRef || req.body.id;
  const email = req.body.email;
  if (!txRef) {
    return next(new ApiError(400, 'Transaction reference (txRef) is required'));
  }

  const payment = await Payment.findOne({
    $or: [{ txRef }, { chapaReference: txRef }],
  }).populate('order');

  if (!payment) {
    return next(new ApiError(404, 'Payment transaction not found'));
  }

  const recipient = (email || payment.customerEmail || payment.order?.customerEmail || '').trim();
  if (!recipient) {
    return next(new ApiError(400, 'No customer email found for this transaction'));
  }

  await queueOrSendEmail('sendPaymentReceiptEmail', {
    to: recipient,
    email: recipient,
    subject: `Payment Receipt: ${payment.txRef}`,
    text: `Payment confirmation of $${payment.amountUSD} (${payment.amountETB} ETB) for Order ${payment.order?.orderNumber || payment.order?._id}.`,
    message: `Payment confirmation of $${payment.amountUSD} (${payment.amountETB} ETB) for Order ${payment.order?.orderNumber || payment.order?._id}.`,
    html: `
      <h2>Payment Receipt</h2>
      <p>Payment ID: <code>${payment.txRef}</code></p>
      <p>Amount: <strong>$${payment.amountUSD}</strong> (${payment.amountETB} ETB)</p>
      <p>Method: ${payment.label || payment.method}</p>
      <p>Status: ${payment.status}</p>
    `,
    orderId: payment.order?._id,
    userId: payment.user,
  });

  res.status(200).json({ success: true, message: `Receipt successfully queued for ${recipient}` });
});

// @desc    Export transactions to CSV
// @route   GET /api/v1/admin/payments/export
// @access  Private/Admin
export const exportTransactionsCsv = asyncHandler(async (req, res, next) => {
  const { status, method, periodDays } = req.query;
  const result = await paymentService.getTransactions({
    page: 1,
    limit: 5000,
    status,
    method,
    periodDays,
  });

  const headers = ['Transaction ID', 'Order ID', 'Customer', 'Email', 'Method', 'Amount USD', 'Amount ETB', 'Status', 'Date', 'Gateway Ref'];
  const rows = result.transactions.map((t) => [
    `"${t.id}"`,
    `"${t.orderId}"`,
    `"${(t.customer || '').replace(/"/g, '""')}"`,
    `"${t.email}"`,
    `"${t.label || t.method}"`,
    t.amount,
    t.amountETB,
    `"${t.status}"`,
    `"${t.date}"`,
    `"${t.chapaReference}"`,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
  res.status(200).send(csv);
});

// @desc    Get payment settings
// @route   GET /api/v1/admin/payments/settings
// @access  Private/Admin
export const getPaymentSettings = asyncHandler(async (req, res, next) => {
  const settingDoc = await Setting.getSingleton();
  const locale = settingDoc?.locale || {};
  const operational = settingDoc?.operational || {};

  res.status(200).json({
    success: true,
    data: {
      provider: 'Chapa',
      testMode: process.env.CHAPA_MODE === 'test' || !process.env.CHAPA_MODE || process.env.CHAPA_SECRET_KEY?.startsWith('CHASECK_TEST'),
      currency: locale.currency || 'USD',
      usdToEtbRate: Number(locale.usdToEtbRate) || 120,
      reservationExpiryMinutes: Number(operational.reservationExpiryMinutes) || 60,
      retryLimit: Number(operational.retryLimit) || 3,
      publicKey: process.env.CHAPA_PUBLIC_KEY ? `${process.env.CHAPA_PUBLIC_KEY.slice(0, 10)}...` : 'CHAPUBK_TEST-••••',
      webhookConfigured: Boolean(process.env.CHAPA_WEBHOOK_SECRET),
      methodsSupported: ['telebirr', 'cbebirr', 'card', 'cod'],
    },
  });
});

// @desc    Update payment settings
// @route   PUT /api/v1/admin/payments/settings
// @access  Private/Admin
export const updatePaymentSettings = asyncHandler(async (req, res, next) => {
  const { currency, usdToEtbRate, reservationExpiryMinutes, retryLimit } = req.body;
  const settingDoc = await Setting.getSingleton();

  if (currency) {
    settingDoc.locale.currency = currency.toUpperCase();
  }
  if (usdToEtbRate && Number(usdToEtbRate) > 0) {
    settingDoc.locale.usdToEtbRate = Number(usdToEtbRate);
  }
  if (reservationExpiryMinutes && Number(reservationExpiryMinutes) > 0) {
    if (!settingDoc.operational) settingDoc.operational = {};
    settingDoc.operational.reservationExpiryMinutes = Number(reservationExpiryMinutes);
  }
  if (retryLimit && Number(retryLimit) > 0) {
    if (!settingDoc.operational) settingDoc.operational = {};
    settingDoc.operational.retryLimit = Number(retryLimit);
  }

  await settingDoc.save();
  res.status(200).json({ success: true, message: 'Payment settings updated successfully' });
});
