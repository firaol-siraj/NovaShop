import mongoose from 'mongoose';
import { SHIPPING_STATUSES, SHIPPING_RATE_TYPES } from '../constants/shippingConstants.js';

// 1. Shipping Zone
const shippingZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    countries: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    regions: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: Object.values(SHIPPING_STATUSES),
      default: SHIPPING_STATUSES.ACTIVE,
      lowercase: true,
      index: true,
    },
    freeOverThresholdUSD: {
      type: Number,
      default: 300,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    handlingTime: {
      type: String,
      default: '1–2 business days',
    },
  },
  { timestamps: true }
);

// 2. Shipping Method
const shippingMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingZone',
      required: true,
      index: true,
    },
    carrier: {
      type: String,
      default: 'Local Courier',
    },
    rateStructure: {
      type: String,
      enum: ['Flat rate', 'Free', 'By total', 'By weight'],
      default: 'Flat rate',
    },
    status: {
      type: String,
      enum: Object.values(SHIPPING_STATUSES),
      default: SHIPPING_STATUSES.ACTIVE,
      lowercase: true,
      index: true,
    },
    estimatedMinDays: {
      type: Number,
      required: true,
      default: 2,
    },
    estimatedMaxDays: {
      type: Number,
      required: true,
      default: 4,
    },
    estimatedDeliveryNote: {
      type: String,
      default: 'business days',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// 3. Shipping Rate
const shippingRateSchema = new mongoose.Schema(
  {
    method: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingMethod',
      required: true,
      index: true,
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingZone',
      required: true,
      index: true,
    },
    rateType: {
      type: String,
      enum: Object.values(SHIPPING_RATE_TYPES),
      default: SHIPPING_RATE_TYPES.FLAT,
    },
    amountETB: {
      type: Number,
      required: true,
      min: 0,
      default: 150,
    },
    amountUSD: {
      type: Number,
      required: true,
      min: 0,
      default: 1.25,
    },
    minOrderTotalUSD: {
      type: Number,
      default: 0,
    },
    maxOrderTotalUSD: {
      type: Number,
      default: null,
    },
    freeOverThresholdUSD: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

export const ShippingZone = mongoose.model('ShippingZone', shippingZoneSchema);
export const ShippingMethod = mongoose.model('ShippingMethod', shippingMethodSchema);
export const ShippingRate = mongoose.model('ShippingRate', shippingRateSchema);

export default {
  ShippingZone,
  ShippingMethod,
  ShippingRate,
};
