import ReturnRequest from '../models/returnRequestModel.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import User from '../models/userModel.js';
import Setting from '../models/settingModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import { syncProductStock, recordMovement, checkAndTriggerLowStockAlert, withTransaction } from './inventoryService.js';
import chapaService from './chapaService.js';
import {
  sendEmail,
  getReturnRequestedEmail,
  getReturnApprovedEmail,
  getReturnRejectedEmail,
  getReturnReceivedEmail,
  getRefundIssuedEmail,
} from './emailService.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import { RETURN_STATUSES, RETURN_REASONS, RETURN_RESOLUTIONS, DEFAULT_RETURN_WINDOW_DAYS } from '../constants/returnConstants.js';
import { PAYMENT_STATUSES } from '../constants/paymentConstants.js';

class ReturnService {
  /**
   * Helper: Resolves authoritative customer name and email from User document or Order snapshot.
   */
  async resolveCustomerIdentity(order) {
    let name = order.shippingAddress?.recipientName;
    let email = order.customerEmail;

    if (order.user) {
      const userDoc = order.user._id ? order.user : await User.findById(order.user).select('name email');
      if (userDoc) {
        name = name || userDoc.name;
        email = email || userDoc.email;
      }
    }

    return {
      customerName: (name || 'Customer').trim(),
      customerEmail: (email || '').toLowerCase().trim(),
    };
  }

  /**
   * Helper: Authoritative return rate calculation used across Returns, Sales, Products & Dashboard.
   * Numerator: returned units in period.
   * Denominator: delivered units in period.
   */
  async calculateReturnRateMetrics({ start, end }) {
    const [returnedAgg] = await ReturnRequest.aggregate([
      { $match: { requestedAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      { $group: { _id: null, total: { $sum: '$items.qty' } } },
    ]);

    const [deliveredAgg] = await Order.aggregate([
      { $match: { isDelivered: true, deliveredAt: { $gte: start, $lte: end } } },
      { $unwind: '$orderItems' },
      { $group: { _id: null, total: { $sum: '$orderItems.qty' } } },
    ]);

    const returnedUnits = returnedAgg?.total || 0;
    const deliveredUnits = deliveredAgg?.total || 0;

    const settingDoc = await Setting.getSingleton();
    const threshold = Number(settingDoc?.operational?.returnRateThreshold ?? 5.0);

    let rate = 0;
    let rateFormatted = '-';
    let trend = '-';
    let tone = 'neutral';

    if (deliveredUnits > 0) {
      rate = Number(((returnedUnits / deliveredUnits) * 100).toFixed(1));
      rateFormatted = `${rate.toFixed(1)}%`;
      if (rate <= threshold) {
        trend = 'Within healthy SLA';
        tone = 'positive';
      } else {
        trend = 'Above average threshold';
        tone = 'negative';
      }
    } else {
      // When denominator is zero, show '-' with neutral tone per specification
      rate = 0;
      rateFormatted = '-';
      trend = '-';
      tone = 'neutral';
    }

    return {
      returnedUnits,
      deliveredUnits,
      rate,
      rateFormatted,
      trend,
      tone,
      threshold,
    };
  }

  /**
   * Customer initiates return request for a delivered order within policy window.
   */
  async createReturnRequest({ orderId, user, items, customerNote = '', resolution = RETURN_RESOLUTIONS.REFUND }) {
    const order = await Order.findById(orderId).populate('user', 'name email');
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    const userId = user._id ? user._id.toString() : user.toString();
    const orderUserId = order.user?._id ? order.user._id.toString() : (order.user ? order.user.toString() : '');

    if (userId !== orderUserId && user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized to request return for this order');
    }

    if (!order.isDelivered && order.status !== 'delivered') {
      throw new ApiError(400, 'Returns can only be requested for delivered orders');
    }

    // Check delivery window from Settings singleton
    const settingDoc = await Setting.getSingleton();
    const windowDays = Number(settingDoc?.operational?.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS);
    const deliveryDate = order.deliveredAt || (order.isDelivered ? order.updatedAt : null);

    if (deliveryDate) {
      const windowMs = windowDays * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(deliveryDate).getTime() > windowMs) {
        throw new ApiError(400, `The ${windowDays}-day return window for this order has expired`);
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Please select at least one item to return');
    }

    // Check if open return request already exists
    const existingOpen = await ReturnRequest.findOne({
      order: order._id,
      status: { $in: [RETURN_STATUSES.REQUESTED, RETURN_STATUSES.APPROVED, RETURN_STATUSES.RECEIVED] },
    });
    if (existingOpen) {
      throw new ApiError(400, `A return request (${existingOpen.returnNumber}) is already in progress for this order`);
    }

    // Validate returned items snapshot
    let totalRefundUSD = 0;
    const validatedItems = [];

    for (const item of items) {
      const itemIdx = item.orderItemIndex !== undefined ? Number(item.orderItemIndex) : 0;
      const orderItem = order.orderItems[itemIdx];
      if (!orderItem) {
        throw new ApiError(400, 'Invalid item selection for order');
      }

      const returnQty = Math.max(1, Math.min(Number(item.qty || 1), orderItem.qty));
      const unitPrice = Number(orderItem.price) || 0;
      const refundValue = Number((unitPrice * returnQty).toFixed(2));
      totalRefundUSD += refundValue;

      const variantDisplay = [orderItem.size, orderItem.color].filter((v) => v && v !== 'N/A' && v !== 'OS').join(' / ');

      validatedItems.push({
        orderItemIndex: itemIdx,
        product: orderItem.product,
        variant: orderItem.variant || null,
        productName: orderItem.name,
        variantName: variantDisplay,
        sku: orderItem.sku || 'N/A',
        image: orderItem.image || '',
        qty: returnQty,
        unitPrice,
        refundValue,
        reason: item.reason || 'Wrong size',
        restocked: false,
      });
    }

    const usdRate = order.usdToEtbRate || Number(process.env.USD_TO_ETB_RATE) || 120;
    const totalRefundETB = Number((totalRefundUSD * usdRate).toFixed(2));

    const count = await ReturnRequest.countDocuments();
    const returnNumber = `RT-${new Date().getFullYear()}-${String(1000 + count + 1).padStart(4, '0')}`;

    const { customerName, customerEmail } = await this.resolveCustomerIdentity(order);

    const returnRequest = await ReturnRequest.create({
      returnNumber,
      order: order._id,
      orderNumber: order.orderNumber || String(order._id),
      user: order.user?._id || order.user,
      customerName,
      customerEmail,
      items: validatedItems,
      itemCount: validatedItems.reduce((acc, curr) => acc + curr.qty, 0),
      reason: validatedItems[0]?.reason || 'Wrong size',
      customerNote,
      resolution: resolution === 'Store credit' ? RETURN_RESOLUTIONS.STORE_CREDIT : RETURN_RESOLUTIONS.REFUND,
      status: RETURN_STATUSES.REQUESTED,
      refundAmountUSD: totalRefundUSD,
      refundAmountETB: totalRefundETB,
      refundMethod: order.paymentMethod || 'Original payment method',
      tracking: 'Prepaid courier · Pickup scheduled',
      requestedAt: new Date(),
      statusHistory: [
        {
          status: RETURN_STATUSES.REQUESTED,
          by: user._id || null,
          at: new Date(),
          note: customerNote || 'Customer initiated return request',
        },
      ],
    });

    order.returnRequested = true;
    await order.save();

    // Create AdminNotification pointing directly to the return
    try {
      await AdminNotification.create({
        type: 'refund_request',
        title: `Return Request: ${returnRequest.returnNumber}`,
        message: `${customerName} requested a return for Order #${order.orderNumber || order._id}.`,
        entityType: 'order',
        entityId: returnRequest._id.toString(),
        link: `/admin/returns/${returnRequest.returnNumber}`,
        data: {
          returnId: returnRequest._id.toString(),
          returnNumber: returnRequest.returnNumber,
          orderId: order._id.toString(),
        },
      });
    } catch (notifErr) {
      logger.warn(`[ReturnService] Admin notification failed: ${notifErr.message}`);
    }

    // Send confirmation email to customer
    try {
      const emailContent = getReturnRequestedEmail({
        returnRequest,
        order,
        user: { name: customerName, email: customerEmail },
      });
      await sendEmail({
        to: customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        orderId: order._id,
        userId: order.user?._id || order.user,
        type: 'return_request',
      });
    } catch (mailErr) {
      logger.warn(`[ReturnService] Customer confirmation email failed: ${mailErr.message}`);
    }

    return returnRequest;
  }

  /**
   * Aggregates KPI statistics for /admin/returns/stats
   */
  async getReturnStats({ periodDays = 30, from, to } = {}) {
    let currentStart;
    let currentEnd = new Date();

    if (from && to) {
      currentStart = new Date(from);
      currentEnd = new Date(to);
    } else {
      const days = Math.max(1, parseInt(periodDays, 10) || 30);
      currentStart = new Date(currentEnd.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - durationMs);
    const previousEnd = new Date(currentStart.getTime());

    // 1. Total Returns (requests created in period)
    const [currTotalReturns, prevTotalReturns] = await Promise.all([
      ReturnRequest.countDocuments({ requestedAt: { $gte: currentStart, $lte: currentEnd } }),
      ReturnRequest.countDocuments({ requestedAt: { $gte: previousStart, $lt: previousEnd } }),
    ]);

    let totalReturnsTrend = '-';
    let totalReturnsTone = 'neutral';
    if (prevTotalReturns > 0) {
      const delta = ((currTotalReturns - prevTotalReturns) / prevTotalReturns) * 100;
      totalReturnsTrend = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      totalReturnsTone = delta <= 0 ? 'positive' : 'negative';
    }

    // 2. Pending Requests (status: requested)
    const [currPendingReturns, prevPendingReturns] = await Promise.all([
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.REQUESTED, requestedAt: { $gte: currentStart, $lte: currentEnd } }),
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.REQUESTED, requestedAt: { $gte: previousStart, $lt: previousEnd } }),
    ]);

    let pendingTrend = '-';
    let pendingTone = 'neutral';
    if (prevPendingReturns > 0) {
      const pendingDelta = currPendingReturns - prevPendingReturns;
      pendingTrend = `${pendingDelta >= 0 ? '+' : ''}${pendingDelta} vs last period`;
      pendingTone = pendingDelta <= 0 ? 'positive' : 'negative';
    }

    // 3. Refunded Amount (sum of completed refunds in period, in display USD, never mixing USD/ETB)
    const [currRefundedAgg] = await ReturnRequest.aggregate([
      { $match: { status: RETURN_STATUSES.REFUNDED, refundedAt: { $gte: currentStart, $lte: currentEnd } } },
      { $group: { _id: null, totalUSD: { $sum: '$refundAmountUSD' } } },
    ]);
    const [prevRefundedAgg] = await ReturnRequest.aggregate([
      { $match: { status: RETURN_STATUSES.REFUNDED, refundedAt: { $gte: previousStart, $lt: previousEnd } } },
      { $group: { _id: null, totalUSD: { $sum: '$refundAmountUSD' } } },
    ]);

    const currRefundedUsd = currRefundedAgg?.totalUSD || 0;
    const prevRefundedUsd = prevRefundedAgg?.totalUSD || 0;

    let refundedTrend = '-';
    if (prevRefundedUsd > 0) {
      const delta = ((currRefundedUsd - prevRefundedUsd) / prevRefundedUsd) * 100;
      refundedTrend = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
    }

    // 4. Return Rate (authoritative shared definition: returned units / delivered units)
    const rateMetrics = await this.calculateReturnRateMetrics({
      start: currentStart,
      end: currentEnd,
    });

    // 5. Tab counts (authoritative sum)
    const [totalAll, countRequested, countApproved, countReceived, countRefunded, countRejected] = await Promise.all([
      ReturnRequest.countDocuments(),
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.REQUESTED }),
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.APPROVED }),
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.RECEIVED }),
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.REFUNDED }),
      ReturnRequest.countDocuments({ status: RETURN_STATUSES.REJECTED }),
    ]);

    return {
      totalReturns: {
        count: currTotalReturns,
        trend: totalReturnsTrend,
        tone: totalReturnsTone,
      },
      pending: {
        count: currPendingReturns,
        trend: pendingTrend,
        tone: pendingTone,
      },
      totalRefunded: {
        amount: currRefundedUsd,
        trend: refundedTrend,
        tone: 'neutral',
      },
      returnRate: {
        rate: rateMetrics.rateFormatted,
        trend: rateMetrics.trend,
        tone: rateMetrics.tone,
        numerator: rateMetrics.returnedUnits,
        denominator: rateMetrics.deliveredUnits,
        threshold: rateMetrics.threshold,
      },
      tabCounts: {
        all: totalAll,
        requested: countRequested,
        approved: countApproved,
        received: countReceived,
        refunded: countRefunded,
        rejected: countRejected,
      },
    };
  }

  /**
   * Paginated returns list with full server-side filters & tab counts.
   */
  async getReturns({
    page = 1,
    limit = 10,
    status = 'all',
    reason = 'all',
    resolution = 'all',
    search = '',
    dateFrom,
    dateTo,
    customer,
    order,
    periodDays,
  } = {}) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const query = {};

    if (status && status !== 'all') {
      query.status = status.toLowerCase();
    }

    if (reason && reason !== 'all') {
      query.reason = reason;
    }

    if (resolution && resolution !== 'all') {
      const resVal = resolution.toLowerCase() === 'refund' ? 'Refund' : 'Store credit';
      query.resolution = { $regex: new RegExp(`^${resVal}$`, 'i') };
    }

    // Date range filters
    if (dateFrom || dateTo) {
      query.requestedAt = {};
      if (dateFrom) query.requestedAt.$gte = new Date(dateFrom);
      if (dateTo) query.requestedAt.$lte = new Date(dateTo);
    } else if (periodDays && periodDays !== 'all') {
      const days = parseInt(periodDays, 10) || 30;
      query.requestedAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const andConditions = [];

    // Direct Customer Filter (?customer=<id>)
    if (customer && customer.trim()) {
      const custTrim = customer.trim();
      const isObjectId = custTrim.match(/^[0-9a-fA-F]{24}$/);
      const custRegex = new RegExp(custTrim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      const custOr = [{ customerName: custRegex }, { customerEmail: custRegex }];
      if (isObjectId) {
        custOr.push({ user: custTrim });
      }
      andConditions.push({ $or: custOr });
    }

    // Direct Order Filter (?order=<id>)
    if (order && order.trim()) {
      const ordTrim = order.trim().replace(/^#/, '');
      const isObjectId = ordTrim.match(/^[0-9a-fA-F]{24}$/);
      const ordRegex = new RegExp(ordTrim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      const ordOr = [
        { orderNumber: ordRegex },
        { orderNumber: `#${ordTrim}` },
        { orderNumber: ordTrim },
      ];
      if (isObjectId) {
        ordOr.push({ order: ordTrim });
      }
      try {
        const orderQuery = isObjectId
          ? { $or: [{ orderNumber: ordRegex }, { _id: ordTrim }] }
          : { orderNumber: ordRegex };
        const linkedOrders = await Order.find(orderQuery).select('_id');
        linkedOrders.forEach((lo) => ordOr.push({ order: lo._id }));
      } catch (err) {
        logger.warn(`[ReturnService] Error querying linked order for filter: ${err.message}`);
      }
      andConditions.push({ $or: ordOr });
    }

    // Server-side text search
    if (search && search.trim()) {
      const s = search.trim().replace(/^#/, '');
      const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      andConditions.push({
        $or: [
          { returnNumber: regex },
          { orderNumber: regex },
          { customerName: regex },
          { customerEmail: regex },
          { trackingNumber: regex },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const [total, returnDocs, stats] = await Promise.all([
      ReturnRequest.countDocuments(query),
      ReturnRequest.find(query)
        .populate('user', 'name email phone')
        .populate('order', 'orderNumber customerEmail shippingAddress orderItems')
        .sort({ requestedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      this.getReturnStats({ periodDays: periodDays || 30, from: dateFrom, to: dateTo }),
    ]);

    const mapped = returnDocs.map((r) => {
      const itemsSummary = (r.items || [])
        .map((i) => `${i.productName}${i.variantName ? ` (${i.variantName})` : ''} x${i.qty}`)
        .join(', ');

      const formattedDate = new Date(r.requestedAt || r.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

      const realUser = r.user && typeof r.user === 'object' && r.user.name ? r.user : null;
      const orderDoc = r.order && typeof r.order === 'object' ? r.order : null;
      const customerName = (realUser?.name || orderDoc?.shippingAddress?.recipientName || 'Customer').trim();
      const customerEmail = (realUser?.email || orderDoc?.customerEmail || '').toLowerCase().trim();
      const firstItemImage = r.items?.[0]?.image || orderDoc?.orderItems?.find((oi) => String(oi.product) === String(r.items?.[0]?.product))?.image || null;

      return {
        id: r.returnNumber,
        rawId: String(r._id),
        orderId: r.orderNumber || orderDoc?.orderNumber,
        orderRef: r.order ? (r.order._id ? String(r.order._id) : String(r.order)) : null,
        userId: r.user ? (r.user._id ? String(r.user._id) : String(r.user)) : null,
        customer: customerName,
        email: customerEmail,
        image: firstItemImage,
        items: itemsSummary || `${r.itemCount || 1} item(s)`,
        reason: r.reason,
        amount: r.refundAmountUSD,
        amountETB: r.refundAmountETB,
        date: formattedDate,
        status: r.status,
        tracking: r.trackingNumber || r.tracking || 'Prepaid label · Tracking pending',
        resolution: r.resolution,
        itemsCount: r.items?.length || 1,
        createdAt: r.createdAt,
      };
    });

    return {
      returns: mapped,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
      tabCounts: stats.tabCounts,
      stats,
    };
  }

  async findReturnDoc(id, populate = '') {
    if (!id) return null;
    const isObjectId = typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId
      ? { _id: id }
      : typeof id === 'string' && id.startsWith('RT-')
      ? { returnNumber: id }
      : { _id: id };
    let q = ReturnRequest.findOne(query);
    if (populate) q = q.populate(populate);
    return await q;
  }

  /**
   * Detail view for AdminReturnDetailPage
   */
  async getReturnById(id) {
    const r = await this.findReturnDoc(id, 'order user');
    if (!r) {
      throw new ApiError(404, `Return request ${id} not found`);
    }

    const orderDoc = r.order;
    const realUser = r.user && typeof r.user === 'object' && r.user.name ? r.user : null;

    // Authoritative customer details: prioritize real linked user, then order snapshot
    const customerName = (realUser?.name || orderDoc?.shippingAddress?.recipientName || 'Customer').trim();
    const customerEmail = (realUser?.email || orderDoc?.customerEmail || '').toLowerCase().trim();
    const customerPhone = (realUser?.phone || orderDoc?.shippingAddress?.phone || '').trim();

    return {
      id: r.returnNumber,
      rawId: String(r._id),
      orderId: r.orderNumber,
      orderNumber: r.orderNumber,
      orderRef: orderDoc ? String(orderDoc._id) : null,
      userId: r.user?._id ? String(r.user._id) : (r.user ? String(r.user) : null),
      status: r.status,
      resolution: r.resolution,
      reason: r.reason,
      customerNote: r.customerNote || 'None provided',
      rejectionReason: r.rejectionReason || '',
      tracking: r.trackingNumber || r.tracking,
      trackingNumber: r.trackingNumber,
      carrier: r.carrier || 'Prepaid Courier',
      requestedAt: r.requestedAt,
      approvedAt: r.approvedAt,
      receivedAt: r.receivedAt,
      refundedAt: r.refundedAt,
      refundAmountUSD: r.refundAmountUSD,
      refundAmountETB: r.refundAmountETB,
      refundMethod: r.refundMethod || 'Original payment method',
      refundReference: r.refundReference,
      customer: {
        id: r.user?._id ? String(r.user._id) : (r.user ? String(r.user) : null),
        _id: r.user?._id ? String(r.user._id) : (r.user ? String(r.user) : null),
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: orderDoc?.shippingAddress
          ? `${orderDoc.shippingAddress.address}, ${orderDoc.shippingAddress.city}, ${orderDoc.shippingAddress.country}`
          : 'Standard Delivery Address',
      },
      items: (r.items || []).map((i) => {
        const matchedOrderItem = orderDoc?.orderItems?.find(
          (oi) => String(oi.product) === String(i.product) || oi.name === i.productName
        );
        const resolvedImage = i.image || matchedOrderItem?.image || '';
        const resolvedSku = i.sku || matchedOrderItem?.sku || 'N/A';
        const resolvedVariant = i.variantName || matchedOrderItem?.size || matchedOrderItem?.color || 'Standard';

        return {
          id: String(i._id),
          name: i.productName,
          productName: i.productName,
          variant: resolvedVariant,
          variantName: resolvedVariant,
          sku: resolvedSku,
          qty: i.qty,
          unitPrice: i.unitPrice,
          refundValue: i.refundValue,
          reason: i.reason,
          image: resolvedImage,
          restocked: i.restocked,
        };
      }),
      timeline: (r.statusHistory || []).map((h) => ({
        status: h.status,
        timestamp: h.at,
        note: h.note,
      })),
      adminNotes: r.adminNotes || [],
    };
  }

  /**
   * Admin approves return request (transition: requested -> approved)
   */
  async approveReturn({ returnId, adminUser, trackingNumber, instructions, note }) {
    const r = await this.findReturnDoc(returnId, 'order user');
    if (!r) throw new ApiError(404, 'Return request not found');

    if (r.status !== RETURN_STATUSES.REQUESTED) {
      throw new ApiError(400, `Cannot approve a return with status "${r.status}". Only requested returns can be approved.`);
    }

    r.status = RETURN_STATUSES.APPROVED;
    r.approvedAt = new Date();
    if (trackingNumber) {
      r.trackingNumber = trackingNumber;
      r.tracking = `Courier: ${r.carrier} · Waybill: ${trackingNumber}`;
    }

    r.statusHistory.push({
      status: RETURN_STATUSES.APPROVED,
      by: adminUser?._id || null,
      at: new Date(),
      note: note || 'Return request approved by admin',
    });

    await r.save();

    // Send customer approved instructions email
    try {
      const emailContent = getReturnApprovedEmail({
        returnRequest: r,
        order: r.order,
        user: { name: r.customerName, email: r.customerEmail },
        instructions,
      });
      await sendEmail({
        to: r.customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        orderId: r.order?._id,
        userId: r.user?._id || r.user,
        type: 'status_update',
        statusCategory: 'order',
      });
    } catch (mailErr) {
      logger.warn(`[ReturnService] Approval email send failed: ${mailErr.message}`);
    }

    return r;
  }

  /**
   * Admin rejects return request (transition: requested -> rejected, reason required)
   */
  async rejectReturn({ returnId, adminUser, reason, note }) {
    if (!reason || !reason.trim()) {
      throw new ApiError(400, 'A non-empty rejection reason is required');
    }

    const r = await this.findReturnDoc(returnId, 'order user');
    if (!r) throw new ApiError(404, 'Return request not found');

    if (r.status !== RETURN_STATUSES.REQUESTED) {
      throw new ApiError(400, `Cannot reject a return with status "${r.status}". Only requested returns can be rejected.`);
    }

    r.status = RETURN_STATUSES.REJECTED;
    r.rejectionReason = reason.trim();

    r.statusHistory.push({
      status: RETURN_STATUSES.REJECTED,
      by: adminUser?._id || null,
      at: new Date(),
      note: note || `Rejected: ${r.rejectionReason}`,
    });

    await r.save();

    // Send customer rejection email
    try {
      const emailContent = getReturnRejectedEmail({
        returnRequest: r,
        order: r.order,
        user: { name: r.customerName, email: r.customerEmail },
        reason: r.rejectionReason,
      });
      await sendEmail({
        to: r.customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        orderId: r.order?._id,
        userId: r.user?._id || r.user,
        type: 'status_update',
        statusCategory: 'order',
      });
    } catch (mailErr) {
      logger.warn(`[ReturnService] Rejection email send failed: ${mailErr.message}`);
    }

    return r;
  }

  /**
   * Admin confirms receipt of return items (transition: approved -> received)
   * Idempotently restocks chosen items exactly once via InventoryMovement with type return_restore.
   */
  async receiveReturn({ returnId, adminUser, restock = true, itemsToRestock = null, note }) {
    const r = await this.findReturnDoc(returnId, 'order user');
    if (!r) throw new ApiError(404, 'Return request not found');

    if (r.status !== RETURN_STATUSES.APPROVED) {
      throw new ApiError(400, `Cannot receive a return with status "${r.status}". Return must be approved first.`);
    }

    r.status = RETURN_STATUSES.RECEIVED;
    r.receivedAt = new Date();

    if (restock) {
      for (let idx = 0; idx < r.items.length; idx++) {
        const item = r.items[idx];
        // Idempotency: skip already restocked items
        if (item.restocked) continue;

        // If specific items were selected, check inclusion
        if (itemsToRestock && Array.isArray(itemsToRestock)) {
          const match = itemsToRestock.some((entry) => {
            if (typeof entry === 'string') {
              return entry === String(item._id) || entry === String(item.product) || entry === String(item.sku);
            }
            if (typeof entry === 'object' && entry !== null) {
              if (entry.shouldRestock === false) return false;
              if (entry.itemIndex !== undefined && entry.itemIndex === idx) return true;
              if (entry.id && String(entry.id) === String(item._id)) return true;
              if (entry.productId && String(entry.productId) === String(item.product)) return true;
              if (entry.sku && entry.sku === item.sku) return true;
            }
            return false;
          });
          if (!match) continue;
        }

        const qty = Number(item.qty) || 1;
        let variant = null;
        if (item.variant) {
          variant = await ProductVariant.findById(item.variant);
        } else if (item.product) {
          variant = await ProductVariant.findOne({ product: item.product });
        }

        if (variant) {
          const stockBefore = variant.stock;
          const stockAfter = stockBefore + qty;
          variant.stock = stockAfter;
          await variant.save();

          await recordMovement({
            variantId: variant._id,
            productId: variant.product,
            type: 'return_restore',
            quantityChange: qty,
            stockBefore,
            stockAfter,
            reason: `Return restore from ${r.returnNumber} (Order #${r.orderNumber})`,
            adminId: adminUser?._id || null,
            orderId: r.order?._id || null,
            orderNumber: r.orderNumber,
          });

          await checkAndTriggerLowStockAlert(variant);
          await syncProductStock(variant.product);
        } else if (item.product) {
          const product = await Product.findById(item.product);
          if (product) {
            const stockBefore = product.countInStock || 0;
            const stockAfter = stockBefore + qty;
            product.countInStock = stockAfter;
            await product.save();

            await recordMovement({
              variantId: null,
              productId: product._id,
              type: 'return_restore',
              quantityChange: qty,
              stockBefore,
              stockAfter,
              reason: `Return restore from ${r.returnNumber} (Order #${r.orderNumber})`,
              adminId: adminUser?._id || null,
              orderId: r.order?._id || null,
              orderNumber: r.orderNumber,
            });
          }
        }

        item.restocked = true;
        item.restockedAt = new Date();
      }
    }

    r.statusHistory.push({
      status: RETURN_STATUSES.RECEIVED,
      by: adminUser?._id || null,
      at: new Date(),
      note: note || `Items received and inspected${restock ? ' (inventory restocked via return_restore)' : ''}`,
    });

    await r.save();

    // Send customer received email
    try {
      const emailContent = getReturnReceivedEmail({
        returnRequest: r,
        order: r.order,
        user: { name: r.customerName, email: r.customerEmail },
      });
      await sendEmail({
        to: r.customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        orderId: r.order?._id,
        userId: r.user?._id || r.user,
        type: 'status_update',
        statusCategory: 'order',
      });
    } catch (mailErr) {
      logger.warn(`[ReturnService] Received email send failed: ${mailErr.message}`);
    }

    return r;
  }

  /**
   * Admin executes refund (transition: received -> refunded)
   * Validates amount <= paid - earlier refunds. Blocks double refunds. Updates payment, order & analytics.
   */
  async processRefund({ returnId, adminUser, amountUSD, refundMethod = 'Original payment method', includeShipping = false, note }) {
    const r = await this.findReturnDoc(returnId, 'order user');
    if (!r) throw new ApiError(404, 'Return request not found');

    if (r.status === RETURN_STATUSES.REFUNDED) {
      throw new ApiError(400, 'Return request has already been refunded');
    }

    if (r.status !== RETURN_STATUSES.RECEIVED) {
      throw new ApiError(400, `Cannot refund a return with status "${r.status}". Items must be marked received first.`);
    }

    const order = r.order ? (r.order._id ? r.order : await Order.findById(r.order)) : null;
    if (!order) {
      throw new ApiError(404, 'Associated order not found');
    }

    // Maximum refundable validation: order.totalPrice - earlier refunds
    const currentOrderRefunded = Number(order.refundedAmountUSD || 0);
    const maxRefundable = Math.max(0, Number((order.totalPrice - currentOrderRefunded).toFixed(2)));

    const requestedAmount = amountUSD !== undefined ? Number(amountUSD) : Number(r.refundAmountUSD);
    if (requestedAmount <= 0) {
      throw new ApiError(400, 'Refund amount must be greater than zero');
    }

    if (requestedAmount > maxRefundable) {
      throw new ApiError(
        400,
        `Refund amount ($${requestedAmount.toFixed(2)}) exceeds maximum refundable amount for this order ($${maxRefundable.toFixed(2)})`
      );
    }

    const usdRate = order.usdToEtbRate || Number(process.env.USD_TO_ETB_RATE) || 120;
    const refundAmountETB = Number((requestedAmount * usdRate).toFixed(2));

    let refundRef = `REF-${Date.now()}`;

    // Attempt Chapa gateway refund if Chapa payment method
    if (order.paymentMethod === 'Chapa' || order.chapaReference) {
      const txRef = order.paymentReference || order.chapaReference;
      try {
        const chapaRes = await chapaService.refundPayment(txRef, refundAmountETB);
        if (chapaRes && chapaRes.success) {
          refundRef = chapaRes.refundReference || refundRef;
        }
      } catch (gateErr) {
        logger.warn(`[ReturnService] Chapa gateway refund note: ${gateErr.message}. Falling back to manual record.`);
      }
    }

    // Update Payment record
    try {
      const isFullOrderRefund = currentOrderRefunded + requestedAmount >= order.totalPrice;
      await Payment.findOneAndUpdate(
        { order: order._id },
        {
          status: isFullOrderRefund ? PAYMENT_STATUSES.REFUNDED : 'partially_refunded',
          refundedAmount: currentOrderRefunded + requestedAmount,
          refundedAt: new Date(),
          refundReference: refundRef,
        }
      );
    } catch (payErr) {
      logger.error(`[ReturnService] Payment model update note: ${payErr.message}`);
    }

    // Update Order record
    order.refundedAmountUSD = Number((currentOrderRefunded + requestedAmount).toFixed(2));
    order.refundedAmountETB = Number(((order.refundedAmountETB || 0) + refundAmountETB).toFixed(2));
    order.refundedAt = new Date();
    if (order.refundedAmountUSD >= order.totalPrice) {
      order.paymentStatus = 'refunded';
      order.status = 'refunded';
    } else {
      order.paymentStatus = 'partially_refunded';
    }
    await order.save();

    // Update ReturnRequest document
    r.status = RETURN_STATUSES.REFUNDED;
    r.refundedAt = new Date();
    r.refundAmountUSD = requestedAmount;
    r.refundAmountETB = refundAmountETB;
    r.refundReference = refundRef;
    r.refundMethod = refundMethod;

    r.statusHistory.push({
      status: RETURN_STATUSES.REFUNDED,
      by: adminUser?._id || null,
      at: new Date(),
      note: note || `Refund of $${requestedAmount.toFixed(2)} processed via ${refundMethod} (Ref: ${refundRef})`,
    });

    await r.save();

    // Send transactional refund issued email (Security/Transactional - always sent)
    try {
      const emailContent = getRefundIssuedEmail({
        returnRequest: r,
        order,
        user: { name: r.customerName, email: r.customerEmail },
        refundAmountUSD: requestedAmount,
        refundAmountETB,
        refundMethod,
        refundRef,
      });
      await sendEmail({
        to: r.customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        orderId: order._id,
        userId: r.user?._id || r.user,
        type: 'refund_issued',
      });
    } catch (mailErr) {
      logger.warn(`[ReturnService] Refund email send failed: ${mailErr.message}`);
    }

    return r;
  }

  /**
   * Admin adds note to return request
   */
  async addAdminNote({ returnId, note, author = 'Admin' }) {
    const r = await this.findReturnDoc(returnId);
    if (!r) throw new ApiError(404, 'Return request not found');

    r.adminNotes.push({
      body: note,
      author,
      createdAt: new Date(),
    });

    await r.save();
    return r.adminNotes;
  }

  /**
   * Bulk status update for returns with transactionality and per-row results
   */
  async bulkUpdateStatus({ returnIds, newStatus, adminUser, reason = '' }) {
    if (!returnIds || !Array.isArray(returnIds) || returnIds.length === 0) {
      return { updatedCount: 0, results: [] };
    }

    const results = [];
    let updatedCount = 0;

    for (const rid of returnIds) {
      try {
        const r = await this.findReturnDoc(rid);
        if (!r) {
          results.push({ id: rid, success: false, message: 'Return not found' });
          continue;
        }

        // Only allow valid transitions
        if (newStatus === RETURN_STATUSES.APPROVED) {
          if (r.status !== RETURN_STATUSES.REQUESTED) {
            results.push({ id: r.returnNumber, success: false, message: `Cannot approve (current status: ${r.status})` });
            continue;
          }
          await this.approveReturn({ returnId: r._id, adminUser });
        } else if (newStatus === RETURN_STATUSES.REJECTED) {
          if (r.status !== RETURN_STATUSES.REQUESTED) {
            results.push({ id: r.returnNumber, success: false, message: `Cannot reject (current status: ${r.status})` });
            continue;
          }
          await this.rejectReturn({ returnId: r._id, adminUser, reason: reason || 'Bulk rejected by administrator' });
        } else {
          results.push({ id: r.returnNumber, success: false, message: `Unsupported bulk transition to ${newStatus}` });
          continue;
        }

        updatedCount++;
        results.push({ id: r.returnNumber, success: true, message: `Successfully updated to ${newStatus}` });
      } catch (err) {
        results.push({ id: rid, success: false, message: err.message });
      }
    }

    return { updatedCount, results };
  }

  /**
   * Generates real CSV export of filtered returns
   */
  async exportCsv(filters = {}) {
    const { returns } = await this.getReturns({ ...filters, limit: 1000, page: 1 });

    const headers = [
      'Return Number',
      'Order Number',
      'Customer Name',
      'Customer Email',
      'Items',
      'Reason',
      'Resolution',
      'Status',
      'Amount (USD)',
      'Requested Date',
      'Tracking',
    ];

    const escapeCsv = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = returns.map((r) => [
      escapeCsv(r.id),
      escapeCsv(r.orderId),
      escapeCsv(r.customer),
      escapeCsv(r.email),
      escapeCsv(r.items),
      escapeCsv(r.reason),
      escapeCsv(r.resolution),
      escapeCsv(r.status),
      escapeCsv(r.amount),
      escapeCsv(r.date),
      escapeCsv(r.tracking),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}

export const returnService = new ReturnService();
export default returnService;
