import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema(
  {
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: false,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['initial', 'restock', 'adjustment', 'sale', 'cancel_restore', 'refund_restore', 'return_restore'],
      index: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    stockBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    stockAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    orderNumber: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

inventoryMovementSchema.index({ variant: 1, createdAt: -1 });
inventoryMovementSchema.index({ product: 1, createdAt: -1 });
inventoryMovementSchema.index({ type: 1, createdAt: -1 });

const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);

export default InventoryMovement;
