import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    topic: {
      type: String,
      enum: [
        'order', 'shipping', 'payment', 'returns', 'product', 'account', 'other',
        'Shipping', 'Returns', 'Payments', 'Product Inquiry', 'Discounts', 'General'
      ],
      default: 'General',
      index: true,
      set: (val) => {
        if (!val) return 'General';
        const lower = val.toLowerCase().trim();
        if (lower === 'shipping') return 'Shipping';
        if (lower === 'returns' || lower === 'refund') return 'Returns';
        if (lower === 'payment' || lower === 'payments') return 'Payments';
        if (lower === 'product' || lower === 'product inquiry') return 'Product Inquiry';
        if (lower === 'discounts' || lower === 'discount') return 'Discounts';
        if (lower === 'order') return 'order';
        if (lower === 'account') return 'account';
        if (lower === 'other') return 'other';
        return val;
      },
    },
    status: {
      type: String,
      enum: ['Open', 'Replied', 'Resolved', 'open', 'replied', 'resolved'],
      default: 'Open',
      index: true,
      set: (val) => {
        if (!val) return 'Open';
        const capitalized = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        return ['Open', 'Replied', 'Resolved'].includes(capitalized) ? capitalized : val;
      },
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    customerAvatar: {
      type: String,
      default: '',
    },
    linkedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    linkedOrderNumber: {
      type: String,
      default: '',
      trim: true,
    },
    linkedOrderStatus: {
      type: String,
      default: '',
      trim: true,
    },
    linkedReturn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReturnRequest',
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedToName: {
      type: String,
      default: 'Unassigned',
      trim: true,
    },
    channel: {
      type: String,
      enum: ['web_form', 'email', 'chat', 'admin'],
      default: 'web_form',
    },
    unreadForAdmin: {
      type: Boolean,
      default: true,
      index: true,
    },
    unreadForCustomer: {
      type: Boolean,
      default: false,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    emailThreadId: {
      type: String,
      default: null,
      index: true,
    },
    emailMessageIds: {
      type: [String],
      default: [],
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isSpam: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases to support requested snake_case properties
conversationSchema.virtual('customer_id').get(function () {
  return this.customer;
});
conversationSchema.virtual('customer_name').get(function () {
  return this.customerName;
});
conversationSchema.virtual('customer_email').get(function () {
  return this.customerEmail;
});
conversationSchema.virtual('assignee_id').get(function () {
  return this.assignedTo;
});
conversationSchema.virtual('related_order_id').get(function () {
  return this.linkedOrder;
});
conversationSchema.virtual('is_unread_for_admin').get(function () {
  return this.unreadForAdmin;
});
conversationSchema.virtual('last_message_at').get(function () {
  return this.lastMessageAt;
});
conversationSchema.virtual('first_response_at').get(function () {
  return this.firstResponseAt;
});
conversationSchema.virtual('resolved_at').get(function () {
  return this.resolvedAt;
});
conversationSchema.virtual('source').get(function () {
  return this.channel;
});
conversationSchema.virtual('email_thread_id').get(function () {
  return this.emailThreadId;
});

// Indexes
conversationSchema.index({ createdAt: -1 });
conversationSchema.index({ status: 1, unreadForAdmin: 1 });
conversationSchema.index({ customerEmail: 1, createdAt: -1 });
conversationSchema.index({ isArchived: 1, isSpam: 1 });
conversationSchema.index({ assignedTo: 1, lastMessageAt: -1 });

// Helper to generate initials avatar
conversationSchema.methods.getAvatarInitials = function () {
  if (this.customerAvatar) return this.customerAvatar;
  const name = this.customerName || 'Customer';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
