import mongoose from 'mongoose';
import Product from './productModel.js';
import { clearCachePattern } from '../utils/clearCache.js';

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    reviewCode: {
      type: String,
      unique: true,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required (1-5)'],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: [true, 'Review title is required'],
      trim: true,
      maxlength: 120,
    },
    body: {
      type: String,
      required: [true, 'Review body is required'],
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    verifiedPurchase: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    adminReply: {
      text: { type: String, default: '' },
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      repliedAt: { type: Date, default: null },
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Pre-save hook to assign sequential or timestamped unique review code
reviewSchema.pre('save', function () {
  if (!this.reviewCode) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.reviewCode = `REV-${Date.now().toString().slice(-4)}${randomSuffix}`;
  }
});

// Enforce one review per user per product per order
reviewSchema.index(
  { product: 1, user: 1, order: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Query performance indexes
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ featured: 1 });

/**
 * Re-calculate product average rating and review count from approved reviews only.
 * Safely maintains the product model aggregates and invalidates redis cache.
 */
export async function recalculateProductRating(productId) {
  if (!productId) return;

  const objectId = mongoose.Types.ObjectId.isValid(productId)
    ? new mongoose.Types.ObjectId(productId)
    : productId;

  const stats = await mongoose.model('Review').aggregate([
    {
      $match: {
        product: objectId,
        status: 'approved',
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  const avgRating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
  const numReviews = stats.length > 0 ? stats[0].numReviews : 0;

  await Product.findByIdAndUpdate(productId, {
    rating: avgRating,
    numReviews: numReviews,
  });

  await clearCachePattern('products');
}

const Review = mongoose.model('Review', reviewSchema);
export default Review;
