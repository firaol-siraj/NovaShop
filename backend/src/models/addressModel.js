import mongoose from 'mongoose';
import { sanitizePhoneNumber } from '../utils/phone.js';

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      default: 'Home',
      trim: true,
    },
    type: {
      type: String,
      enum: ['home', 'work', 'studio', 'other'],
      default: 'home',
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    street2: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      default: 'Addis Ababa',
      trim: true,
    },
    state: {
      type: String,
      default: 'Addis Ababa',
      trim: true,
    },
    postalCode: {
      type: String,
      default: '1000',
      trim: true,
    },
    country: {
      type: String,
      default: 'Ethiopia',
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Pre-save hook: normalize phone number to clean Ethiopian/E.164 format
addressSchema.pre('save', function () {
  if (this.phone) {
    this.phone = sanitizePhoneNumber(this.phone);
  }
});

const Address = mongoose.model('Address', addressSchema);
export default Address;
