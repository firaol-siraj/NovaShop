import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    size: {
      type: String,
      required: [true, 'Size is required'],
      uppercase: true,
      trim: true,
    },
    color: {
      name: {
        type: String,
        required: [true, 'Color name is required'],
        trim: true,
      },
      hex: {
        type: String,
        trim: true,
        default: '#000000',
      },
    },
    price: {
      type: Number,
      default: null,
      min: [0, 'Price cannot be negative'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    image: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound index: A product cannot have two variants with the exact same size and color name
productVariantSchema.index(
  { product: 1, size: 1, 'color.name': 1 },
  { unique: true }
);

const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);

export default ProductVariant;
