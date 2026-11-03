import mongoose from 'mongoose';
import { PAYMENT_STATUSES } from '../constants/paymentConstants.js';

const paymentSchema = new mongoose.Schema(
  {
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
    provider: {
      type: String,
      default: 'chapa',
      index: true,
    },
    txRef: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    chapaReference: {
      type: String,
      default: null,
      index: true,
    },
    method: {
      type: String,
      default: 'chapa',
    },
    label: {
      type: String,
      default: 'Chapa Hosted Checkout',
    },
    methodType: {
      type: String,
      default: 'Digital payment',
    },
    amountETB: {
      type: Number,
      required: true,
      default: 0,
    },
    amountUSD: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'ETB',
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.INITIATED,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    customerEmail: {
      type: String,
      trim: true,
      default: '',
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
      index: true,
    },
    refundedAt: {
      type: Date,
      default: null,
      index: true,
    },
    refundAmountUSD: {
      type: Number,
      default: 0,
    },
    refundAmountETB: {
      type: Number,
      default: 0,
    },
    rawProviderStatus: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, paidAt: -1 });
paymentSchema.index({ customerEmail: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
