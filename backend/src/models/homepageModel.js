import mongoose from 'mongoose';

const homepageSectionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: 'document',
    },
    visible: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

const homepageLayoutSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['draft', 'published'],
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    sections: {
      type: [homepageSectionSchema],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedByName: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const homepageVersionSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
      index: true,
    },
    sections: {
      type: [homepageSectionSchema],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedByName: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'subscribed', 'unsubscribed'],
      default: 'pending',
      index: true,
    },
    source: {
      type: String,
      default: 'homepage_newsletter',
    },
    confirmToken: {
      type: String,
      default: null,
      index: true,
    },
    confirmExpires: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    unsubscribeToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const HomepageLayout = mongoose.model('HomepageLayout', homepageLayoutSchema);
export const HomepageVersion = mongoose.model('HomepageVersion', homepageVersionSchema);
export const Subscriber = mongoose.model('Subscriber', subscriberSchema);

export default {
  HomepageLayout,
  HomepageVersion,
  Subscriber,
};
