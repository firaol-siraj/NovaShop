import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'order_confirmation',
        'payment_receipt',
        'payment_failed',
        'verification',
        'password_reset',
        'security_notice',
        'security_alert',
        'account_deactivated',
        'account_reactivated',
        'welcome',
        'status_update',
        'support_reply',
        'support_acknowledgment',
        'promotional',
        'admin_test',
        'test',
        'admin_message',
        'customer_invite',
        'review_reply',
        'return_requested',
        'return_request',
        'return_approved',
        'return_rejected',
        'return_received',
        'refund_issued',
      ],
      default: 'payment_receipt',
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'bounced', 'failed', 'skipped'],
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      default: null,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    accepted: {
      type: [String],
      default: [],
    },
    rejected: {
      type: [String],
      default: [],
    },
    smtpResponse: {
      type: String,
      default: '',
    },
    bounceReason: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    preview: {
      type: String,
      default: '',
    },
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminName: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const EmailLog = mongoose.model('EmailLog', emailLogSchema);
export default EmailLog;
