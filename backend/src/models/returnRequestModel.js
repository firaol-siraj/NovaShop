import mongoose from 'mongoose';
import { RETURN_STATUSES, RETURN_REASONS, RETURN_RESOLUTIONS } from '../constants/returnConstants.js';

const returnItemSchema = new mongoose.Schema(
  {
    orderItemIndex: {
      type: Number,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    productName: {
      type: String,
      required: true,
    },
    variantName: {
      type: String,
      default: '',
    },
    sku: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    refundValue: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      enum: RETURN_REASONS,
      required: true,
    },
    restocked: {
      type: Boolean,
      default: false,
    },
    restockedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const returnRequestSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    items: [returnItemSchema],
    itemCount: {
      type: Number,
      default: 1,
    },
    reason: {
      type: String,
      enum: RETURN_REASONS,
      default: 'Wrong size',
      index: true,
    },
    customerNote: {
      type: String,
      default: '',
    },
    resolution: {
      type: String,
      enum: ['Refund', 'Store credit', 'Exchange', 'refund', 'store_credit', 'exchange'],
      default: RETURN_RESOLUTIONS.REFUND,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(RETURN_STATUSES),
      default: RETURN_STATUSES.REQUESTED,
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
    refundMethod: {
      type: String,
      default: 'Original payment method',
    },
    refundReference: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    adminNotes: [
      {
        body: { type: String, required: true },
        author: { type: String, default: 'Admin' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    statusHistory: [
      {
        status: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        at: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
    tracking: {
      type: String,
      default: 'Prepaid label · Tracking pending',
    },
    trackingNumber: {
      type: String,
      default: '',
    },
    carrier: {
      type: String,
      default: 'Prepaid Courier',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

returnRequestSchema.index({ status: 1, requestedAt: -1 });
returnRequestSchema.index({ order: 1, status: 1 });

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);

export default ReturnRequest;
