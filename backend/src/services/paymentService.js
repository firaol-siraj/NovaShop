import Payment from '../models/paymentModel.js';
import Payout from '../models/payoutModel.js';
import Order from '../models/orderModel.js';
import Setting from '../models/settingModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import chapaService from './chapaService.js';
import logger from '../utils/logger.js';
import { PAYMENT_STATUSES, DEFAULT_STORE_TIMEZONE, DEFAULT_USD_TO_ETB_RATE } from '../constants/paymentConstants.js';

class PaymentService {
  /**
   * Records or updates a payment attempt upon checkout initialization
   */
  async recordInitialization({ order, user, txRef, chapaReference, amountETB, amountUSD, currency = 'ETB', customer = {} }) {
    try {
      const email = customer.email || order.customerEmail || user?.email || '';
      const phone = customer.phone || order.shippingAddress?.phone || '';
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || user?.name || 'Customer';

      return await Payment.findOneAndUpdate(
        { txRef },
        {
          order: order._id,
          user: user?._id || user || null,
          provider: 'chapa',
          txRef,
          chapaReference: chapaReference || txRef,
          amountETB: Number(amountETB) || 0,
          amountUSD: Number(amountUSD) || 0,
          currency: (currency || 'ETB').toUpperCase(),
          status: PAYMENT_STATUSES.INITIATED,
          customerEmail: email,
          customerPhone: phone,
          customerName: name,
          label: 'Chapa Hosted Checkout',
          method: 'chapa',
          methodType: 'Digital payment',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      logger.error(`[PaymentService] Failed to record payment initialization for order ${order._id}: ${err.message}`);
      return null;
    }
  }

  /**
   * Updates payment record to SUCCESS upon Chapa verification / webhook
   */
  async recordSuccess({ order, txRef, chapaReference, method, rawMethod, rawData, paidAt = new Date() }) {
    try {
      let resolvedMethod = 'chapa';
      let methodType = 'Digital payment';
      let methodLabel = 'Chapa Checkout';

      const norm = String(rawMethod || method || '').toLowerCase();
      if (norm.includes('telebirr') || norm === 'tele') {
        resolvedMethod = 'telebirr';
        methodType = 'Mobile money';
        methodLabel = 'Telebirr';
      } else if (norm.includes('cbe') || norm.includes('cbebirr')) {
        resolvedMethod = 'cbebirr';
        methodType = 'Mobile banking';
        methodLabel = 'CBE Birr';
      } else if (norm.includes('mpesa') || norm.includes('m-pesa')) {
        resolvedMethod = 'mpesa';
        methodType = 'Mobile money';
        methodLabel = 'M-Pesa';
      } else if (norm.includes('card') || norm.includes('visa') || norm.includes('mastercard') || norm.includes('amex')) {
        resolvedMethod = 'card';
        methodType = 'Credit / Debit Card';
        methodLabel = 'Debit / Credit Card';
      } else if (norm.includes('bank') || norm.includes('transfer')) {
        resolvedMethod = 'bank';
        methodType = 'Bank transfer';
        methodLabel = 'Direct Bank Transfer';
      } else if (norm.includes('cash') || norm.includes('cod')) {
        resolvedMethod = 'cod';
        methodType = 'Cash on Delivery';
        methodLabel = 'Cash on Delivery';
      }

      // Only append card last 4 digits if explicitly returned by provider (never customer phone digits)
      if (rawData?.card_last_four || rawData?.last_four) {
        methodLabel = `${methodLabel} •••• ${rawData.card_last_four || rawData.last_four}`;
      }

      const usdRate = Number(process.env.USD_TO_ETB_RATE) || DEFAULT_USD_TO_ETB_RATE;
      const orderTotalUSD = Number(order.totalPrice) || 0;
      const amountETB = order.totalPriceETB ? Number(order.totalPriceETB) : Number((orderTotalUSD * usdRate).toFixed(2));

      const query = txRef ? { txRef } : { order: order._id };

      return await Payment.findOneAndUpdate(
        query,
        {
          order: order._id,
          user: order.user?._id || order.user || null,
          provider: 'chapa',
          txRef: txRef || order.paymentReference || `NS_${order._id}`,
          chapaReference: chapaReference || order.chapaReference || txRef,
          amountETB,
          amountUSD: orderTotalUSD,
          currency: 'ETB',
          status: PAYMENT_STATUSES.SUCCESS,
          method: resolvedMethod,
          label: methodLabel,
          methodType,
          customerEmail: order.customerEmail || order.user?.email || '',
          customerPhone: order.shippingAddress?.phone || '',
          customerName: [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(' ') || order.user?.name || 'Customer',
          paidAt,
          rawProviderStatus: rawData || null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      logger.error(`[PaymentService] Failed to record payment success for order ${order._id}: ${err.message}`);
      return null;
    }
  }

  /**
   * Updates payment record to FAILED or CANCELLED
   */
  async recordFailure({ txRef, orderId, failureReason, status = PAYMENT_STATUSES.FAILED, rawData }) {
    try {
      const query = txRef ? { txRef } : { order: orderId };
      const updatedPayment = await Payment.findOneAndUpdate(
        query,
        {
          status,
          failureReason: failureReason || 'Payment could not be completed',
          rawProviderStatus: rawData || null,
        },
        { new: true }
      );

      // Create admin notification
      if (orderId) {
        try {
          const ord = await Order.findById(orderId).select('orderNumber');
          await AdminNotification.create({
            type: 'failed_payment',
            title: `Payment Failed: Order #${ord?.orderNumber || orderId}`,
            message: `Payment could not be completed: ${failureReason || 'Declined'}.`,
            entityType: 'order',
            entityId: orderId.toString(),
            link: `/admin/orders/${orderId}`,
            data: { orderId: orderId.toString(), orderNumber: ord?.orderNumber },
          });
        } catch {
          // Non-fatal
        }
      }

      return updatedPayment;
    } catch (err) {
      logger.error(`[PaymentService] Failed to record payment failure: ${err.message}`);
      return null;
    }
  }

  /**
   * Records initial pending payment for Cash on Delivery orders
   */
  async recordCashOnDelivery({ order, user }) {
    try {
      const email = order.customerEmail || user?.email || '';
      const phone = order.shippingAddress?.phone || '';
      const name = [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(' ') || order.shippingAddress?.recipientName || user?.name || 'Customer';
      const orderTotalUSD = Number(order.totalPrice) || 0;
      const amountETB = Number(order.totalPriceETB) || Number((orderTotalUSD * 120).toFixed(2));
      const txRef = `COD_${order.orderNumber || order._id}_${Date.now()}`;

      return await Payment.findOneAndUpdate(
        { order: order._id },
        {
          order: order._id,
          user: user?._id || user || null,
          provider: 'cod',
          txRef,
          chapaReference: txRef,
          amountETB,
          amountUSD: orderTotalUSD,
          currency: 'USD',
          status: PAYMENT_STATUSES.PENDING,
          customerEmail: email,
          customerPhone: phone,
          customerName: name,
          label: 'Cash on Delivery',
          method: 'cod',
          methodType: 'Cash on Delivery',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      logger.error(`[PaymentService] Failed to record COD payment for order ${order._id}: ${err.message}`);
      return null;
    }
  }

  /**
   * Aggregates KPI statistics for the Payments page
   */
  async getPaymentStats({ periodDays = 30 } = {}) {
    const days = Math.max(1, parseInt(periodDays, 10) || 30);
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Total Received in current vs previous period
    const [currentReceived] = await Payment.aggregate([
      { $match: { status: PAYMENT_STATUSES.SUCCESS, paidAt: { $gte: currentStart, $lte: now } } },
      { $group: { _id: null, totalUSD: { $sum: '$amountUSD' }, totalETB: { $sum: '$amountETB' }, count: { $sum: 1 } } },
    ]);

    const [prevReceived] = await Payment.aggregate([
      { $match: { status: PAYMENT_STATUSES.SUCCESS, paidAt: { $gte: previousStart, $lt: currentStart } } },
      { $group: { _id: null, totalUSD: { $sum: '$amountUSD' }, totalETB: { $sum: '$amountETB' }, count: { $sum: 1 } } },
    ]);

    const currUsd = currentReceived?.totalUSD || 0;
    const prevUsd = prevReceived?.totalUSD || 0;
    let receivedTrend = '-';
    let receivedTone = 'neutral';
    if (prevUsd > 0) {
      const delta = ((currUsd - prevUsd) / prevUsd) * 100;
      receivedTrend = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      receivedTone = delta >= 0 ? 'positive' : 'negative';
    }

    // 2. Pending payments (initiated or pending)
    const [currPending] = await Payment.aggregate([
      { $match: { status: { $in: [PAYMENT_STATUSES.INITIATED, PAYMENT_STATUSES.PENDING] }, createdAt: { $gte: currentStart, $lte: now } } },
      { $group: { _id: null, totalUSD: { $sum: '$amountUSD' }, totalETB: { $sum: '$amountETB' }, count: { $sum: 1 } } },
    ]);

    const [prevPending] = await Payment.aggregate([
      { $match: { status: { $in: [PAYMENT_STATUSES.INITIATED, PAYMENT_STATUSES.PENDING] }, createdAt: { $gte: previousStart, $lt: currentStart } } },
      { $group: { _id: null, totalUSD: { $sum: '$amountUSD' }, totalETB: { $sum: '$amountETB' } } },
    ]);

    const currPendingUsd = currPending?.totalUSD || 0;
    const prevPendingUsd = prevPending?.totalUSD || 0;
    let pendingTrend = '-';
    if (prevPendingUsd > 0) {
      const pendingDelta = currPendingUsd - prevPendingUsd;
      pendingTrend = `${pendingDelta >= 0 ? '+$' : '-$'}${Math.abs(pendingDelta).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }

    // 3. Failed payments
    const failedCurrentCount = await Payment.countDocuments({
      status: { $in: [PAYMENT_STATUSES.FAILED, PAYMENT_STATUSES.CANCELLED] },
      createdAt: { $gte: currentStart, $lte: now },
    });

    const failedPrevCount = await Payment.countDocuments({
      status: { $in: [PAYMENT_STATUSES.FAILED, PAYMENT_STATUSES.CANCELLED] },
      createdAt: { $gte: previousStart, $lt: currentStart },
    });

    let failedTrend = '-';
    let failedTone = 'neutral';
    if (failedPrevCount > 0) {
      const delta = ((failedCurrentCount - failedPrevCount) / failedPrevCount) * 100;
      failedTrend = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
      failedTone = delta > 0 ? 'negative' : 'positive';
    }

    // 4. Next Payout
    const nextPayoutDoc = await Payout.findOne({
      status: 'scheduled',
      expectedArrival: { $gte: now },
    }).sort({ expectedArrival: 1 });

    const nextPayoutAmount = nextPayoutDoc ? nextPayoutDoc.amount : 0;
    const nextPayoutDate = nextPayoutDoc?.expectedArrival
      ? nextPayoutDoc.expectedArrival.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      : '-';

    // 5. Tab counts
    const totalTxns = await Payment.countDocuments();
    const totalPayouts = await Payout.countDocuments();

    return {
      totalReceived: {
        usd: currUsd,
        etb: currentReceived?.totalETB || 0,
        trend: receivedTrend,
        tone: receivedTone,
      },
      pending: {
        usd: currPendingUsd,
        etb: currPending?.totalETB || 0,
        trend: pendingTrend,
        tone: 'neutral',
      },
      failed: {
        count: failedCurrentCount,
        trend: failedTrend,
        tone: failedTone,
      },
      nextPayout: {
        amount: nextPayoutDoc ? nextPayoutAmount : 0,
        trend: nextPayoutDate,
        tone: nextPayoutDoc ? 'date' : 'neutral',
      },
      tabCounts: {
        transactions: totalTxns,
        payouts: totalPayouts,
        methods: 4, // Telebirr, CBE Birr, Card, Cash on Delivery
      },
    };
  }

  /**
   * Paginated transaction query matching AdminPaymentsPage UI
   */
  async getTransactions({ page = 1, limit = 10, search = '', status = 'all', method = 'all', periodDays = '30', customer = '', order = '' } = {}) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const query = {};
    const andConditions = [];

    // Status filter
    if (status && status !== 'all') {
      if (status === 'paid') query.status = PAYMENT_STATUSES.SUCCESS;
      else if (status === 'pending') query.status = { $in: [PAYMENT_STATUSES.INITIATED, PAYMENT_STATUSES.PENDING] };
      else if (status === 'failed') query.status = { $in: [PAYMENT_STATUSES.FAILED, PAYMENT_STATUSES.CANCELLED] };
      else if (status === 'refunded') query.status = { $in: [PAYMENT_STATUSES.REFUNDED, PAYMENT_STATUSES.PARTIALLY_REFUNDED] };
      else query.status = status;
    }

    // Method filter
    if (method && method !== 'all') {
      query.method = method;
    }

    // Date range
    if (periodDays && periodDays !== 'all') {
      const days = parseInt(periodDays, 10) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: since };
    }

    // Customer Filter
    if (customer && customer.trim()) {
      const custTrim = customer.trim();
      const isObjectId = custTrim.match(/^[0-9a-fA-F]{24}$/);
      const custRegex = new RegExp(custTrim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      const custOr = [
        { customerName: custRegex },
        { customerEmail: custRegex },
      ];
      if (isObjectId) {
        custOr.push({ user: custTrim });
      }
      andConditions.push({ $or: custOr });
    }

    // Order Filter
    if (order && order.trim()) {
      const ordTrim = order.trim().replace(/^#/, '');
      const isObjectId = ordTrim.match(/^[0-9a-fA-F]{24}$/);
      const ordRegex = new RegExp(ordTrim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      const ordOr = [
        { txRef: ordRegex },
        { chapaReference: ordRegex },
      ];
      if (isObjectId) {
        ordOr.push({ order: ordTrim });
      }
      try {
        const linkedOrders = await Order.find({ orderNumber: ordRegex }).select('_id');
        linkedOrders.forEach((lo) => ordOr.push({ order: lo._id }));
      } catch (err) {
        logger.warn(`[PaymentService] Linked order lookup error: ${err.message}`);
      }
      andConditions.push({ $or: ordOr });
    }

    // Search query
    if (search && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      andConditions.push({
        $or: [
          { txRef: regex },
          { chapaReference: regex },
          { customerName: regex },
          { customerEmail: regex },
          { customerPhone: regex },
          { label: regex },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(query),
      Payment.find(query)
        .populate({
          path: 'order',
          select: 'orderNumber status totalPrice itemsPrice shippingAddress orderItems user',
          populate: { path: 'user', select: 'name email phone' },
        })
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
    ]);

    const mapped = payments.map((txn) => {
      let uiStatus = 'pending';
      if (txn.status === PAYMENT_STATUSES.SUCCESS) uiStatus = 'paid';
      else if (txn.status === PAYMENT_STATUSES.FAILED || txn.status === PAYMENT_STATUSES.CANCELLED) uiStatus = 'failed';
      else if (txn.status === PAYMENT_STATUSES.REFUNDED || txn.status === PAYMENT_STATUSES.PARTIALLY_REFUNDED) uiStatus = 'refunded';

      const orderNum = txn.order?.orderNumber || (txn.txRef ? txn.txRef.split('_')[1] : 'NS-ORDER');
      const dateFormatted = (txn.paidAt || txn.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const customerName =
        txn.user?.name ||
        txn.order?.user?.name ||
        [txn.order?.shippingAddress?.firstName, txn.order?.shippingAddress?.lastName].filter(Boolean).join(' ') ||
        txn.order?.shippingAddress?.recipientName ||
        (txn.customerName && txn.customerName !== 'Customer' && txn.customerName !== 'Valued Customer' ? txn.customerName : '') ||
        (txn.customerEmail ? txn.customerEmail.split('@')[0] : 'Customer');

      const customerEmail = txn.user?.email || txn.customerEmail || txn.order?.user?.email || txn.order?.shippingAddress?.email || '-';

      return {
        id: txn.txRef || String(txn._id),
        orderId: orderNum,
        rawOrderId: txn.order?._id || txn.order,
        customer: customerName,
        email: customerEmail,
        phone: txn.customerPhone || txn.user?.phone || txn.order?.shippingAddress?.phone || '',
        method: txn.method || 'card',
        label: txn.label || 'Chapa Checkout',
        methodType: txn.methodType || 'Digital payment',
        amount: uiStatus === 'refunded' ? -Math.abs(txn.amountUSD) : txn.amountUSD,
        amountETB: txn.amountETB,
        currency: txn.currency || 'ETB',
        date: dateFormatted,
        status: uiStatus,
        chapaReference: txn.chapaReference || txn.txRef,
        createdAt: txn.createdAt,
        paidAt: txn.paidAt,
        failureReason: txn.failureReason,
        shippingAddress: txn.order?.shippingAddress || null,
        orderItems: txn.order?.orderItems || [],
      };
    });

    return {
      transactions: mapped,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    };
  }

  /**
   * Payouts list and management
   */
  async getPayouts({ status = 'all' } = {}) {
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const payouts = await Payout.find(query).sort({ expectedArrival: -1, createdAt: -1 }).lean();

    return payouts.map((p) => ({
      id: p.payoutNumber,
      amount: p.amount,
      currency: p.currency,
      orders: p.ordersCount,
      destination: p.destination,
      expectedArrival: p.expectedArrival ? p.expectedArrival.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-',
      status: p.status,
      reference: p.reference,
    }));
  }

  async getPayoutById(id) {
    const isObjectId = id && typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: id } : { payoutNumber: id };
    const p = await Payout.findOne(query).populate('recordedBy', 'name email').lean();
    if (!p) return null;
    return {
      id: p.payoutNumber,
      rawId: String(p._id),
      payoutNumber: p.payoutNumber,
      amount: p.amount,
      currency: p.currency || 'USD',
      orders: p.ordersCount,
      ordersCount: p.ordersCount,
      destination: p.destination,
      expectedArrival: p.expectedArrival ? p.expectedArrival.toISOString() : null,
      expectedArrivalFormatted: p.expectedArrival ? p.expectedArrival.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-',
      status: p.status,
      reference: p.reference,
      notes: p.notes || '',
      recordedBy: p.recordedBy ? { name: p.recordedBy.name, email: p.recordedBy.email } : null,
      createdAt: p.createdAt,
    };
  }

  async recordPayout({ amount, destination, ordersCount = 0, status = 'paid', expectedArrival, reference, notes, adminId }) {
    const count = await Payout.countDocuments();
    const payoutNumber = `PO-${1040 + count + 1}`;

    return await Payout.create({
      payoutNumber,
      amount: Number(amount),
      currency: 'USD',
      ordersCount: Number(ordersCount) || 0,
      destination: destination || 'CBE •••• 1042',
      status: status || 'paid',
      expectedArrival: expectedArrival ? new Date(expectedArrival) : new Date(),
      reference: reference || `REF-${Date.now()}`,
      notes: notes || '',
      recordedBy: adminId || null,
    });
  }

  /**
   * Payment methods list with calculated statistics
   */
  async getPaymentMethods() {
    const totalSuccessful = await Payment.countDocuments({ status: PAYMENT_STATUSES.SUCCESS });

    const methodsAgg = await Payment.aggregate([
      { $match: { status: PAYMENT_STATUSES.SUCCESS } },
      { $group: { _id: '$method', count: { $sum: 1 } } },
    ]);

    const countsMap = {};
    methodsAgg.forEach((m) => {
      countsMap[m._id] = m.count;
    });

    const definitions = [
      {
        id: 'PM-TELEBIRR',
        methodKey: 'telebirr',
        name: 'Telebirr (Chapa)',
        description: 'Ethiopia national mobile money platform powered by Chapa',
        icon: 'phone',
        fees: 'Variable standard gateway fee',
        availableIn: 'Ethiopia (ETB)',
        status: 'active',
        enabled: true,
      },
      {
        id: 'PM-CBEBIRR',
        methodKey: 'cbebirr',
        name: 'CBE Birr (Chapa)',
        description: 'Commercial Bank of Ethiopia mobile money powered by Chapa',
        icon: 'document',
        fees: 'Variable standard gateway fee',
        availableIn: 'Ethiopia (ETB)',
        status: 'active',
        enabled: true,
      },
      {
        id: 'PM-CARD',
        methodKey: 'card',
        name: 'Credit and Debit Cards',
        description: 'Visa and Mastercard domestic and international processing via Chapa',
        icon: 'payments',
        fees: 'Standard interchange fee',
        availableIn: 'Global & Domestic',
        status: 'active',
        enabled: true,
      },
      {
        id: 'PM-COD',
        methodKey: 'cod',
        name: 'Cash on Delivery',
        description: 'Payment collected upon courier delivery of garments',
        icon: 'receipt',
        fees: '0.0%',
        availableIn: 'Addis Ababa & Regional Delivery',
        status: 'active',
        enabled: true,
      },
    ];

    return definitions.map((def) => {
      const count = countsMap[def.methodKey] || 0;
      const share = totalSuccessful > 0 ? ((count / totalSuccessful) * 100).toFixed(1) : '0.0';
      return {
        ...def,
        processedCount: count,
        volumeShare: `${share}%`,
      };
    });
  }

  /**
   * Re-verifies a payment with Chapa and updates the payment & order records idempotently
   */
  async reverifyWithChapa(txRef) {
    if (!txRef) throw new Error('Transaction reference is required');

    const verification = await chapaService.verifyPayment(txRef);
    const payment = await Payment.findOne({ txRef });

    if (!payment) {
      throw new Error(`Payment with reference ${txRef} not found`);
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      throw new Error(`Order for reference ${txRef} not found`);
    }

    if (verification.success && verification.status === 'success') {
      // Import markOrderPaid dynamically to prevent circular dependencies
      const { markOrderPaid } = await import('../controllers/orderController.js');
      await markOrderPaid(order, verification, order.customerEmail);
      await this.recordSuccess({
        order,
        txRef,
        chapaReference: verification.chapaReference,
        method: verification.paymentMethod,
        rawMethod: verification.paymentMethod,
        rawData: verification.raw,
      });
      return { success: true, status: 'paid', message: 'Payment successfully verified and order marked as paid.' };
    } else {
      await this.recordFailure({
        txRef,
        orderId: order._id,
        failureReason: verification.message || 'Verification reported unfulfilled payment',
        status: PAYMENT_STATUSES.FAILED,
        rawData: verification.raw,
      });
      return { success: false, status: 'failed', message: verification.message || 'Payment verification failed with provider' };
    }
  }

  /**
   * Backfills existing orders into Payment records (with safe dry-run mode)
   */
  async backfillExistingOrders({ dryRun = true } = {}) {
    const orders = await Order.find({ isPaid: true }).lean();
    const results = {
      totalFound: orders.length,
      created: 0,
      alreadyExisted: 0,
      dryRun,
    };

    for (const order of orders) {
      const txRef = order.paymentReference || order.chapaReference || `NS_${order._id}`;
      const existing = await Payment.findOne({ $or: [{ txRef }, { order: order._id }] });

      if (existing) {
        results.alreadyExisted++;
        continue;
      }

      if (!dryRun) {
        await this.recordSuccess({
          order,
          txRef,
          chapaReference: order.chapaReference || txRef,
          method: order.paymentMethod,
          rawMethod: order.paymentMethod,
          paidAt: order.paidAt || order.createdAt,
        });
      }
      results.created++;
    }

    return results;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
