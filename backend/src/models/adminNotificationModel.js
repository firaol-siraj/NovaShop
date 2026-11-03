import mongoose from 'mongoose';

const adminNotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'new_order',
        'low_stock',
        'failed_payment',
        'new_customer',
        'refund_request',
        'cancelled_order',
        'new_review',
        'discount_limit_reached',
        'discount_expired',
        'new_ticket',
        'new_conversation',
        'new_message',
        'support_reply',
        'assigned',
        'resolved',
        'email_failed',
        'mention',
        'system',
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ['order', 'product', 'variant', 'customer', 'category', 'review', 'discount', 'conversation', 'return', 'system'],
      default: 'system',
      index: true,
    },
    entityId: {
      type: String,
      default: '',
      index: true,
    },
    link: {
      type: String,
      default: '',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

adminNotificationSchema.virtual('user_id').get(function () {
  return this.recipient;
});
adminNotificationSchema.virtual('body').get(function () {
  return this.message;
});

adminNotificationSchema.index({ isRead: 1, createdAt: -1 });
adminNotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ type: 1, createdAt: -1 });

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

export default AdminNotification;
