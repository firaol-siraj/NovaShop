import mongoose from 'mongoose';

const discountRedemptionSchema = new mongoose.Schema(
  {
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    customerEmail: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    amountDiscounted: {
      type: Number,
      required: true,
      min: 0,
    },
    orderTotal: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Enforce one redemption per discount per order (idempotent payment completion)
discountRedemptionSchema.index({ discount: 1, order: 1 }, { unique: true });
discountRedemptionSchema.index({ createdAt: -1 });

const DiscountRedemption = mongoose.model('DiscountRedemption', discountRedemptionSchema);
export default DiscountRedemption;
