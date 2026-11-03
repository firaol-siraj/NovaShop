import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    amountETB: {
      type: Number,
      default: 0,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    destination: {
      type: String,
      required: true,
      trim: true, // e.g. "Chase •••• 5521" or "CBE •••• 1042"
    },
    status: {
      type: String,
      enum: ['scheduled', 'pending', 'paid', 'failed'],
      default: 'paid',
      index: true,
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    expectedArrival: {
      type: Date,
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

payoutSchema.index({ status: 1, expectedArrival: 1 });
payoutSchema.index({ createdAt: -1 });

const Payout = mongoose.model('Payout', payoutSchema);

export default Payout;
