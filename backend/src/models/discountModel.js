import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Discount name is required'],
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: [true, 'Discount code is required'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]+$/, 'Code can only contain alphanumeric characters, hyphens, and underscores'],
    },
    method: {
      type: String,
      enum: ['code', 'automatic'],
      default: 'code',
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'free_shipping'],
      required: [true, 'Discount type is required'],
    },
    value: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Value cannot be negative'],
    },
    appliesTo: {
      type: String,
      enum: ['all_products', 'specific_categories', 'specific_products'],
      default: 'all_products',
    },
    targetCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    targetProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    minimumSpend: {
      type: Number,
      default: null,
      min: 0,
    },
    minimumQuantity: {
      type: Number,
      default: null,
      min: 0,
    },
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    perCustomerLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startsAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'disabled'],
      default: 'active',
      index: true,
    },
    stackable: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Returns dynamic status based on status flag, start/end dates, and current server time.
 * Never drifts because it is dynamically derived rather than statically persisted.
 */
discountSchema.methods.getDynamicStatus = function (now = new Date()) {
  if (this.isDeleted) return 'Archived';
  if (this.status === 'disabled') return 'Disabled';
  if (this.status === 'draft') return 'Draft';

  const startTime = new Date(this.startsAt).getTime();
  const currentTime = now.getTime();

  if (startTime > currentTime) {
    return 'Scheduled';
  }

  if (this.endsAt) {
    const endTime = new Date(this.endsAt).getTime();
    if (endTime < currentTime) {
      return 'Expired';
    }
  }

  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return 'Expired';
  }

  return 'Active';
};

// Indexes for fast lookup and filtering
discountSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
discountSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
discountSchema.index({ createdAt: -1 });

const Discount = mongoose.model('Discount', discountSchema);
export default Discount;
