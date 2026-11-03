import mongoose from 'mongoose';
import Review, { recalculateProductRating } from '../models/reviewModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import AuditLog from '../models/auditLogModel.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import emailService from '../services/emailService.js';

/**
 * Format relative time (e.g. "2 hours ago", "3 days ago")
 */
function formatTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMin > 0) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Format display date (e.g. "Sep 29, 2026")
 */
function formatDisplayDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =========================================================================
// CUSTOMER ENDPOINTS
// =========================================================================

/**
 * POST /api/v1/reviews
 * Creates a review for a product the customer has purchased in a paid/delivered order.
 */
export const createReview = asyncHandler(async (req, res, next) => {
  const { product: productId, order: orderId, rating, title, body } = req.body;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check that customer actually bought this product in a paid order
  const orderQuery = {
    user: userId,
    isPaid: true,
    'orderItems.product': productId,
  };
  if (orderId) {
    orderQuery._id = orderId;
  }

  const qualifyingOrder = await Order.findOne(orderQuery).sort({ createdAt: -1 });

  if (!qualifyingOrder) {
    return next(
      new ApiError(403, 'You can only review products from your verified paid orders.')
    );
  }

  // Check if review already exists for this order + product
  const existingReview = await Review.findOne({
    user: userId,
    product: productId,
    order: qualifyingOrder._id,
    isDeleted: false,
  });

  if (existingReview) {
    return next(
      new ApiError(400, 'You have already submitted a review for this purchase.')
    );
  }

  const review = await Review.create({
    product: productId,
    user: userId,
    order: qualifyingOrder._id,
    rating: Number(rating),
    title: title.trim(),
    body: body.trim(),
    status: 'pending',
    verifiedPurchase: true,
  });

  // Notify admins of new pending review
  await AdminNotification.create({
    type: 'new_review',
    title: 'New Review Pending Moderation',
    message: `${req.user.name || 'A customer'} reviewed "${product.name}" (${rating}★).`,
    entityType: 'review',
    entityId: review._id,
    link: '/admin/reviews',
  }).catch((err) => logger.warn(`Failed to create review notification: ${err.message}`));

  res.status(201).json({
    status: 'success',
    message: 'Your review has been submitted and is awaiting moderation.',
    data: { review },
  });
});

/**
 * GET /api/v1/reviews/check-eligibility/:productId
 * Checks if the authenticated customer can review this product.
 */
export const checkUserReviewEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Find paid orders containing this product
  const paidOrders = await Order.find({
    user: userId,
    isPaid: true,
    'orderItems.product': productId,
  }).select('_id orderNumber createdAt');

  if (!paidOrders || paidOrders.length === 0) {
    return res.json({
      status: 'success',
      data: {
        eligible: false,
        reason: 'No verified paid purchase found for this product.',
      },
    });
  }

  // Check if all those orders have already been reviewed
  const reviewedOrderIds = await Review.find({
    user: userId,
    product: productId,
    isDeleted: false,
  }).distinct('order');

  const reviewedSet = new Set(reviewedOrderIds.map((id) => id.toString()));
  const eligibleOrder = paidOrders.find((o) => !reviewedSet.has(o._id.toString()));

  if (!eligibleOrder) {
    return res.json({
      status: 'success',
      data: {
        eligible: false,
        reason: 'You have already reviewed all orders containing this product.',
      },
    });
  }

  res.json({
    status: 'success',
    data: {
      eligible: true,
      orderId: eligibleOrder._id,
      orderNumber: eligibleOrder.orderNumber,
    },
  });
});

/**
 * GET /api/v1/products/:id/reviews
 * Public endpoint: Approved reviews for a product with breakdown and stats.
 */
export const getProductReviews = asyncHandler(async (req, res, next) => {
  const { id: paramId } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const isObjectId = mongoose.Types.ObjectId.isValid(paramId);
  const product = isObjectId
    ? await Product.findById(paramId).select('name rating numReviews')
    : await Product.findOne({ slug: paramId }).select('name rating numReviews');

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  const productId = product._id;

  const filter = {
    product: productId,
    status: 'approved',
    isDeleted: false,
  };

  const [reviews, totalCount, breakdownAgg] = await Promise.all([
    Review.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved', isDeleted: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sumRatings = 0;
  for (const item of breakdownAgg) {
    if (ratingBreakdown[item._id] !== undefined) {
      ratingBreakdown[item._id] = item.count;
      sumRatings += item._id * item.count;
    }
  }

  const averageRating = totalCount > 0 ? Number((sumRatings / totalCount).toFixed(1)) : 0;

  const formattedReviews = reviews.map((r) => ({
    id: r._id,
    name: r.user?.name || 'Verified Buyer',
    rating: r.rating,
    title: r.title,
    text: r.body,
    body: r.body,
    date: formatDisplayDate(r.createdAt),
    verified: r.verifiedPurchase,
    helpfulCount: r.helpfulCount || 0,
    adminReply: r.adminReply?.text
      ? {
          text: r.adminReply.text,
          date: formatDisplayDate(r.adminReply.repliedAt),
        }
      : null,
  }));

  res.json({
    status: 'success',
    data: {
      reviews: formattedReviews,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      averageRating,
      ratingBreakdown,
    },
  });
});

// =========================================================================
// ADMIN ENDPOINTS
// =========================================================================

/**
 * GET /api/v1/admin/reviews
 * Paginated list of reviews for the admin table with filtering and search.
 */
export const getAdminReviewsList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { search, status, rating, product, dateRange, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const filter = { isDeleted: false };

  // Status Filter
  if (status && status !== 'all' && ['pending', 'approved', 'rejected'].includes(status.toLowerCase())) {
    filter.status = status.toLowerCase();
  }

  // Rating Filter
  if (rating && rating !== 'All ratings') {
    const numericRating = parseInt(rating, 10);
    if (!isNaN(numericRating)) {
      filter.rating = numericRating;
    }
  }

  // Product Filter (by name or ID)
  if (product && product !== 'All products') {
    if (mongoose.Types.ObjectId.isValid(product)) {
      filter.product = product;
    } else {
      const matchedProducts = await Product.find({
        name: { $regex: product, $options: 'i' },
      }).distinct('_id');
      filter.product = { $in: matchedProducts };
    }
  }

  // Date Range Filter
  if (dateRange && dateRange !== 'All dates') {
    const now = new Date();
    if (dateRange === 'Last 7 days') {
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: since };
    } else if (dateRange === 'Last 14 days') {
      const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: since };
    } else if (dateRange === 'Last 30 days') {
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: since };
    } else if (dateRange === 'Older than 30 days') {
      const before = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $lt: before };
    }
  }

  // Search by code, title, body, user name/email, product name
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    const searchRegex = { $regex: cleanSearch, $options: 'i' };

    const [matchingUsers, matchingProducts] = await Promise.all([
      User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      }).distinct('_id'),
      Product.find({ name: searchRegex }).distinct('_id'),
    ]);

    filter.$or = [
      { reviewCode: searchRegex },
      { title: searchRegex },
      { body: searchRegex },
      { user: { $in: matchingUsers } },
      { product: { $in: matchingProducts } },
    ];
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortDirection };

  const [reviews, totalCount, pendingCount] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('product', 'name image slug')
      .populate('user', 'name email avatar')
      .populate('order', 'orderNumber')
      .populate('moderatedBy', 'name')
      .lean(),
    Review.countDocuments(filter),
    Review.countDocuments({ isDeleted: false, status: 'pending' }),
  ]);

  const formattedReviews = reviews.map((r) => {
    const orderNum = r.order?.orderNumber
      ? `#${r.order.orderNumber}`
      : r.order?._id
      ? `#NS-${r.order._id.toString().slice(-5).toUpperCase()}`
      : 'N/A';

    return {
      id: r._id.toString(),
      _id: r._id.toString(),
      reviewCode: r.reviewCode || `REV-${r._id.toString().slice(-4).toUpperCase()}`,
      rating: r.rating,
      title: r.title,
      body: r.body,
      product: r.product?.name || 'Archived Product',
      productId: r.product?._id?.toString() || null,
      productIcon: 'package',
      customer: r.user?.name || 'Customer',
      customerId: r.user?._id?.toString() || null,
      userId: r.user?._id?.toString() || null,
      customerEmail: r.user?.email || '',
      date: formatDisplayDate(r.createdAt),
      age: formatTimeAgo(r.createdAt),
      verified: r.verifiedPurchase,
      status: r.status,
      order: orderNum,
      orderId: r.order?._id?.toString() || null,
      starred: Boolean(r.featured),
      adminReply: r.adminReply || { text: '', repliedAt: null },
      moderatedBy: r.moderatedBy?.name || null,
      moderatedAt: r.moderatedAt,
      rejectionReason: r.rejectionReason || '',
      createdAt: r.createdAt,
    };
  });

  res.json({
    status: 'success',
    data: {
      reviews: formattedReviews,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      limit,
      pendingCount,
    },
  });
});

/**
 * GET /api/v1/admin/reviews/stats
 * Real stats cards: total reviews, avg rating, pending reviews, reply rate,
 * each with comparative trend for the 30-day period.
 */
export const getAdminReviewStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalAllTime,
    current30dCount,
    previous30dCount,
    currentApproved,
    pendingTotal,
    pendingNewThisWeek,
    allApprovedReviews,
    prevApprovedReviews,
  ] = await Promise.all([
    Review.countDocuments({ isDeleted: false }),
    Review.countDocuments({ isDeleted: false, createdAt: { $gte: currentPeriodStart } }),
    Review.countDocuments({
      isDeleted: false,
      createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart },
    }),
    Review.countDocuments({ isDeleted: false, status: 'approved' }),
    Review.countDocuments({ isDeleted: false, status: 'pending' }),
    Review.countDocuments({ isDeleted: false, status: 'pending', createdAt: { $gte: oneWeekAgo } }),
    Review.find({ isDeleted: false, status: 'approved' }).select('rating adminReply').lean(),
    Review.find({
      isDeleted: false,
      status: 'approved',
      createdAt: { $lt: currentPeriodStart },
    }).select('rating adminReply').lean(),
  ]);

  // Total delta: reviews created this month vs previous month of equal length
  const totalDiff = current30dCount - previous30dCount;
  const totalChange =
    previous30dCount === 0
      ? '-'
      : totalDiff >= 0
      ? `+${totalDiff} this month`
      : `${totalDiff} this month`;

  // Average Rating & Trend
  const currentSumRating = allApprovedReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  const currentAvgRating = allApprovedReviews.length > 0 ? currentSumRating / allApprovedReviews.length : 0;

  const prevSumRating = prevApprovedReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  const prevAvgRating = prevApprovedReviews.length > 0 ? prevSumRating / prevApprovedReviews.length : 0;

  const ratingDiff = currentAvgRating - prevAvgRating;
  const ratingChange =
    prevApprovedReviews.length === 0
      ? '-'
      : ratingDiff >= 0
      ? `+${ratingDiff.toFixed(1)}`
      : `${ratingDiff.toFixed(1)}`;

  // Pending change: +X this week vs previous week
  const pendingChange =
    pendingNewThisWeek > 0 ? `+${pendingNewThisWeek} this week` : '-';

  // Reply Rate: percentage of approved reviews with an admin reply
  const repliedCount = allApprovedReviews.filter((r) => r.adminReply?.text?.trim().length > 0).length;
  const currentReplyRate = allApprovedReviews.length > 0 ? Math.round((repliedCount / allApprovedReviews.length) * 100) : 0;

  const prevRepliedCount = prevApprovedReviews.filter((r) => r.adminReply?.text?.trim().length > 0).length;
  const prevReplyRate = prevApprovedReviews.length > 0 ? Math.round((prevRepliedCount / prevApprovedReviews.length) * 100) : 0;
  const replyDiff = currentReplyRate - prevReplyRate;
  const replyChange =
    prevApprovedReviews.length === 0
      ? '-'
      : replyDiff >= 0
      ? `+${replyDiff}%`
      : `${replyDiff}%`;

  // Counts by Tab
  const [tabAll, tabPending, tabApproved, tabRejected] = await Promise.all([
    Review.countDocuments({ isDeleted: false }),
    Review.countDocuments({ isDeleted: false, status: 'pending' }),
    Review.countDocuments({ isDeleted: false, status: 'approved' }),
    Review.countDocuments({ isDeleted: false, status: 'rejected' }),
  ]);

  res.json({
    status: 'success',
    data: {
      stats: {
        totalReviews: totalAllTime,
        totalReviewsChange: totalChange,
        averageRating: currentAvgRating > 0 ? currentAvgRating.toFixed(1) : '5.0',
        averageRatingChange: ratingChange,
        pendingReviews: pendingTotal,
        pendingReviewsChange: pendingChange,
        replyRate: `${currentReplyRate}%`,
        replyRateChange: replyChange,
      },
      counts: {
        all: tabAll,
        pending: tabPending,
        approved: tabApproved,
        rejected: tabRejected,
      },
    },
  });
});

/**
 * PATCH /api/v1/admin/reviews/:id/status
 * Moderates review: approved or rejected.
 */
export const updateReviewStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status, rejectionReason = '' } = req.body;

  const review = await Review.findOne({ _id: id, isDeleted: false })
    .populate('user', 'name email settings')
    .populate('product', 'name');

  if (!review) {
    return next(new ApiError(404, 'Review not found'));
  }

  review.status = status;
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();

  if (status === 'rejected') {
    review.rejectionReason = rejectionReason;
  } else if (status === 'approved') {
    review.rejectionReason = '';
  }

  await review.save();

  // Recalculate average rating on product
  await recalculateProductRating(review.product?._id || review.product);

  // Send customer email if opted in
  const user = review.user;
  const userWantsEmail =
    user?.settings?.notifications?.reviewUpdates ??
    user?.settings?.notifications?.orderUpdates ??
    true;

  if (user?.email && userWantsEmail) {
    try {
      if (status === 'approved') {
        const mail = emailService.getReviewApprovedEmail({
          review,
          user,
          product: review.product,
        });
        await emailService.sendEmail({
          to: user.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          userId: user._id,
          type: 'review_approved',
          statusCategory: 'general',
        });
      } else if (status === 'rejected') {
        const mail = emailService.getReviewRejectedEmail({
          review,
          user,
          product: review.product,
          rejectionReason,
        });
        await emailService.sendEmail({
          to: user.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          userId: user._id,
          type: 'review_rejected',
          statusCategory: 'general',
        });
      }
    } catch (mailErr) {
      logger.warn(`Failed to send review status email to ${user.email}: ${mailErr.message}`);
    }
  }

  res.json({
    status: 'success',
    message: `Review ${status} successfully.`,
    data: { review },
  });
});

/**
 * POST /api/v1/admin/reviews/:id/reply
 * Adds or updates admin reply to a review, records audit log, and emails customer.
 */
export const replyToReview = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { text } = req.body;

  const review = await Review.findOne({ _id: id, isDeleted: false })
    .populate('user', 'name email settings')
    .populate('product', 'name');

  if (!review) {
    return next(new ApiError(404, 'Review not found'));
  }

  // Sanitize text
  const sanitizedText = text
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, 1500);

  const isUpdate = Boolean(review.adminReply?.text);

  review.adminReply = {
    text: sanitizedText,
    adminId: req.user._id,
    repliedAt: new Date(),
  };

  await review.save();

  // Audit log
  await AuditLog.create({
    action: isUpdate ? 'review_reply_updated' : 'review_replied',
    section: 'reviews',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: review._id.toString(),
    metadata: {
      productId: review.product?._id || review.product,
      productName: review.product?.name,
      customerEmail: review.user?.email,
      replyText: sanitizedText,
    },
    ipAddress: req.ip || '',
  }).catch(() => {});

  // Email customer notification if opted in
  const user = review.user;
  const userWantsEmail =
    user?.settings?.notifications?.reviewUpdates ??
    user?.settings?.notifications?.orderUpdates ??
    true;

  if (user?.email && userWantsEmail) {
    try {
      const mail = emailService.getReviewReplyEmail({
        review,
        user,
        product: review.product,
        replyText: sanitizedText,
      });
      await emailService.sendEmail({
        to: user.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        userId: user._id,
        type: 'review_reply',
        statusCategory: 'general',
      });
    } catch (mailErr) {
      logger.warn(`Failed to send review reply email to ${user.email}: ${mailErr.message}`);
    }
  }

  res.json({
    status: 'success',
    message: isUpdate ? 'Reply updated successfully.' : 'Reply posted successfully.',
    data: { adminReply: review.adminReply },
  });
});

/**
 * DELETE /api/v1/admin/reviews/:id/reply
 * Removes an admin reply and records audit log.
 */
export const deleteReviewReply = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const review = await Review.findOne({ _id: id, isDeleted: false });

  if (!review) {
    return next(new ApiError(404, 'Review not found'));
  }

  review.adminReply = { text: '', adminId: null, repliedAt: null };
  await review.save();

  await AuditLog.create({
    action: 'review_reply_deleted',
    section: 'reviews',
    performedBy: req.user._id,
    performerEmail: req.user.email,
    targetEntityId: review._id.toString(),
    ipAddress: req.ip || '',
  }).catch(() => {});

  res.json({
    status: 'success',
    message: 'Reply removed.',
  });
});

/**
 * PATCH /api/v1/admin/reviews/:id/star
 * Toggles the featured / starred flag for a review.
 */
export const toggleStarReview = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const review = await Review.findOne({ _id: id, isDeleted: false });

  if (!review) {
    return next(new ApiError(404, 'Review not found'));
  }

  review.featured = !review.featured;
  await review.save();

  res.json({
    status: 'success',
    message: review.featured ? 'Review starred' : 'Review unstarred',
    data: { starred: review.featured },
  });
});

/**
 * DELETE /api/v1/admin/reviews/:id
 * Soft deletes a review and recalculates product rating.
 */
export const deleteReview = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const review = await Review.findOne({ _id: id, isDeleted: false });

  if (!review) {
    return next(new ApiError(404, 'Review not found'));
  }

  review.isDeleted = true;
  await review.save();

  await recalculateProductRating(review.product);

  res.json({
    status: 'success',
    message: 'Review deleted successfully.',
  });
});

/**
 * POST /api/v1/admin/reviews/bulk
 * Bulk approve, reject, or delete reviews.
 */
export const bulkUpdateReviews = asyncHandler(async (req, res, next) => {
  const { ids, action, rejectionReason = '' } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ApiError(400, 'Please select reviews to update.'));
  }

  const reviews = await Review.find({ _id: { $in: ids }, isDeleted: false });
  const productIds = new Set();

  for (const review of reviews) {
    productIds.add(review.product.toString());

    if (action === 'delete') {
      review.isDeleted = true;
    } else if (action === 'approved' || action === 'rejected') {
      review.status = action;
      review.moderatedBy = req.user._id;
      review.moderatedAt = new Date();
      if (action === 'rejected') review.rejectionReason = rejectionReason;
      if (action === 'approved') review.rejectionReason = '';
    }
    await review.save();
  }

  // Recalculate affected product ratings
  for (const pid of productIds) {
    await recalculateProductRating(pid);
  }

  res.json({
    status: 'success',
    message: `Updated ${reviews.length} reviews.`,
  });
});

/**
 * GET /api/v1/admin/reviews/export
 * Exports filtered reviews to CSV.
 */
export const exportReviewsCsv = asyncHandler(async (req, res) => {
  const { search, status, rating, product, dateRange } = req.query;
  const filter = { isDeleted: false };

  if (status && status !== 'all') filter.status = status;
  if (rating && rating !== 'All ratings') filter.rating = parseInt(rating, 10);

  const reviews = await Review.find(filter)
    .sort({ createdAt: -1 })
    .populate('product', 'name')
    .populate('user', 'name email')
    .populate('order', 'orderNumber')
    .lean();

  const headers = ['Review Code', 'Rating', 'Title', 'Body', 'Product', 'Customer', 'Customer Email', 'Order', 'Status', 'Verified', 'Created At'];
  const rows = reviews.map((r) => [
    `"${r.reviewCode || ''}"`,
    r.rating,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    `"${(r.body || '').replace(/"/g, '""')}"`,
    `"${(r.product?.name || '').replace(/"/g, '""')}"`,
    `"${(r.user?.name || '').replace(/"/g, '""')}"`,
    `"${(r.user?.email || '').replace(/"/g, '""')}"`,
    `"${r.order?.orderNumber || ''}"`,
    r.status,
    r.verifiedPurchase ? 'Yes' : 'No',
    `"${new Date(r.createdAt).toISOString()}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="novashop-reviews.csv"');
  res.status(200).send(csvContent);
});
