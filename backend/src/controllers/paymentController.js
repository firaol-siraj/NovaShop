import Order from '../models/orderModel.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get real payment records from authenticated user's orders
// @route   GET /api/v1/payments/my
// @access  Private
export const getMyPayments = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

  const payments = orders.map((order) => {
    const isPaid = Boolean(order.isPaid || order.paymentStatus === 'paid');
    const txRef = order.paymentReference || order.chapaReference || `NS-${order._id}`;
    const amountUSD = order.totalPrice;
    const amountETB = order.totalPriceETB || order.totalPrice * (order.usdToEtbRate || 120);

    let statusLabel = 'Pending';
    if (isPaid) statusLabel = 'Paid';
    else if (order.paymentStatus === 'failed') statusLabel = 'Failed';
    else if (order.paymentStatus === 'cancelled') statusLabel = 'Cancelled';

    return {
      id: order._id,
      orderId: order._id,
      orderNumber: order.orderNumber || String(order._id),
      txRef,
      chapaReference: order.chapaReference || order.paymentReference || null,
      amount: amountUSD,
      amountETB: Number(amountETB.toFixed(2)),
      currency: order.currency || 'USD',
      paymentMethod: order.paymentMethod || 'Chapa',
      status: statusLabel,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      date: order.paidAt || order.createdAt,
      createdAt: order.createdAt,
      itemsCount: (order.orderItems || []).reduce((sum, item) => sum + (Number(item.qty) || 1), 0),
      firstItemImage: order.orderItems?.[0]?.image || null,
      orderLink: `/account/orders/${order._id}`,
    };
  });

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});
