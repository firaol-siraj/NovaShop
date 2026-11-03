import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ['session_start', 'product_view', 'add_to_cart', 'begin_checkout'],
      index: true,
    },
    referrer: {
      type: String,
      default: '',
      trim: true,
    },
    utmSource: {
      type: String,
      default: '',
      trim: true,
    },
    utmMedium: {
      type: String,
      default: '',
      trim: true,
    },
    utmCampaign: {
      type: String,
      default: '',
      trim: true,
    },
    trafficChannel: {
      type: String,
      default: 'Direct',
      enum: ['Direct', 'Organic search', 'Email', 'Social', 'Paid', 'Referral'],
      index: true,
    },
    landingPage: {
      type: String,
      default: '',
      trim: true,
    },
    path: {
      type: String,
      default: '',
      trim: true,
    },
    deviceType: {
      type: String,
      default: 'desktop',
      enum: ['desktop', 'mobile', 'tablet'],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    productName: {
      type: String,
      default: '',
      trim: true,
    },
    productCategory: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Retention policy: automatically expire raw event records after 180 days (TTL index)
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Compound indexes for fast aggregations
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ sessionId: 1, eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ trafficChannel: 1, createdAt: -1 });
analyticsEventSchema.index({ productId: 1, eventType: 1, createdAt: -1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
export default AnalyticsEvent;
