import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ProductVariant',
        },
        sku: { type: String },
        size: { type: String },
        color: { type: String },
      },
    ],
    shippingAddress: {
      recipientName: { type: String },
      phone: { type: String },
      address: { type: String, required: true },
      address2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, default: '' },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      countryOrRegion: { type: String, default: 'Ethiopia' },
    },
    paymentMethod: {
      type: String,
      required: true,
      default: 'Chapa',
    },
    paymentReference: {
      type: String,
      index: true,
    },
    chapaReference: {
      type: String,
      index: true,
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    status: {
      type: String,
      enum: ['pending', 'pending_payment', 'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
      default: 'pending_payment',
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
      },
    ],
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },
    totalPriceETB: {
      type: Number,
      default: 0.0,
    },
    usdToEtbRate: {
      type: Number,
      default: 120,
    },
    isStockReserved: {
      type: Boolean,
      default: false,
    },
    stockReservedUntil: {
      type: Date,
      default: null,
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    subtotalPrice: {
      type: Number,
      default: 0.0,
    },
    discountCode: {
      type: String,
      default: null,
      index: true,
    },
    discountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount',
      default: null,
      index: true,
    },
    discountAmount: {
      type: Number,
      default: 0.0,
    },
    discountType: {
      type: String,
      default: null,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    taxName: {
      type: String,
      default: 'VAT',
    },
    taxRate: {
      type: Number,
      default: 0.0,
    },
    taxIncluded: {
      type: Boolean,
      default: false,
    },
    taxShippingAmount: {
      type: Number,
      default: 0.0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      index: true,
    },
    isShipped: {
      type: Boolean,
      default: false,
    },
    shippedAt: {
      type: Date,
      default: null,
      index: true,
    },
    shippingZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingZone',
      default: null,
    },
    shippingMethodName: {
      type: String,
      default: 'Standard Delivery',
    },
    shippingEstimatedDays: {
      type: String,
      default: '2–4 business days',
    },
    shippingCarrier: {
      type: String,
      default: 'Local Courier',
    },
    trackingNumber: {
      type: String,
      default: '',
    },
    carrier: {
      type: String,
      default: '',
    },
    refundedAmountUSD: {
      type: Number,
      default: 0,
    },
    refundedAmountETB: {
      type: Number,
      default: 0,
    },
    returnRequested: {
      type: Boolean,
      default: false,
    },
    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    customerEmail: {
      type: String,
      trim: true,
      default: '',
    },
    confirmationEmailSent: {
      type: Boolean,
      default: false,
    },
    paymentEmailSent: {
      type: Boolean,
      default: false,
    },
    emailDeliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped'],
      default: 'pending',
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate unique order number if missing
orderSchema.pre('save', function () {
  if (!this.orderNumber) {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    this.orderNumber = `NS-${Date.now().toString().slice(-4)}${randomSuffix}`;
  }
});

// 1. Customer Order History (User ID + Newest Orders First)
orderSchema.index({ user: 1, createdAt: -1 });

// 2. Admin Status Filter (Filter orders by 'pending', 'processing', 'shipped', 'delivered')
orderSchema.index({ status: 1 });

// 3. Expiry cleanup index for unpaid orders with active stock reservations
orderSchema.index({ isPaid: 1, isStockReserved: 1, stockReservedUntil: 1 });

// 4. Admin Dashboard Revenue & KPI Aggregation Indexes
orderSchema.index({ createdAt: -1, isPaid: 1, status: 1 });
orderSchema.index({ paidAt: -1, isPaid: 1 });
orderSchema.index({ isDelivered: 1, deliveredAt: -1 });
orderSchema.index({ paymentStatus: 1, isPaid: 1 });
orderSchema.index({ 'orderItems.product': 1, isPaid: 1, createdAt: -1 });
orderSchema.index({ isPaid: 1, 'shippingAddress.country': 1 });
orderSchema.index({ isPaid: 1, paymentMethod: 1 });
orderSchema.index({ isPaid: 1, refundedAt: -1 });
orderSchema.index({ discountCode: 1, isPaid: 1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
