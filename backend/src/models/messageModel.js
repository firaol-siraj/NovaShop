import mongoose from 'mongoose';
import { sanitizeHtml, textToHtml } from '../utils/sanitizeHtml.js';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    storagePath: { type: String, default: '' },
    filename: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

attachmentSchema.virtual('mime_type').get(function () {
  return this.mimeType;
});
attachmentSchema.virtual('storage_path').get(function () {
  return this.storagePath || this.url;
});

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: function () {
        return this.senderType === 'customer' ? 'inbound' : 'outbound';
      },
      index: true,
    },
    type: {
      type: String,
      enum: ['reply', 'internal_note', 'system_event'],
      default: 'reply',
      index: true,
    },
    channel: {
      type: String,
      enum: ['web', 'email', 'system'],
      default: 'web',
    },
    attachments: [attachmentSchema],
    emailHeaders: {
      messageId: { type: String, default: null, index: true },
      inReplyTo: { type: String, default: null },
      references: { type: [String], default: [] },
    },
    emailMessageId: {
      type: String,
      default: null,
    },
    deliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'failed', 'bounced', 'none'],
      default: 'none',
      index: true,
    },
    error: {
      type: String,
      default: '',
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

// Auto-sanitize bodyHtml and generate fallback from body text before saving
messageSchema.pre('save', function () {
  if (this.bodyHtml) {
    this.bodyHtml = sanitizeHtml(this.bodyHtml);
  } else if (this.body) {
    this.bodyHtml = textToHtml(this.body);
  }

  if (this.emailHeaders?.messageId && !this.emailMessageId) {
    this.emailMessageId = this.emailHeaders.messageId;
  }
});

// Virtual aliases
messageSchema.virtual('conversation_id').get(function () {
  return this.conversation;
});
messageSchema.virtual('sender_type').get(function () {
  return this.senderType;
});
messageSchema.virtual('sender_id').get(function () {
  return this.sender;
});
messageSchema.virtual('body_text').get(function () {
  return this.body;
});
messageSchema.virtual('body_html').get(function () {
  return this.bodyHtml;
});
messageSchema.virtual('delivery_status').get(function () {
  return this.deliveryStatus;
});
messageSchema.virtual('in_reply_to').get(function () {
  return this.emailHeaders?.inReplyTo || null;
});

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ emailMessageId: 1 }, { sparse: true });

const Message = mongoose.model('Message', messageSchema);

export default Message;
