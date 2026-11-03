import mongoose from 'mongoose';

const heroSlideSchema = new mongoose.Schema(
  {
    headline: {
      type: String,
      required: [true, 'Headline is required'],
      trim: true,
      maxlength: [140, 'Headline cannot exceed 140 characters'],
    },
    subheadline: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Subheadline cannot exceed 300 characters'],
    },
    image: {
      type: String,
      required: [true, 'Desktop image is required'],
      trim: true,
    },
    mobileImage: {
      type: String,
      trim: true,
      default: '',
    },
    imageFit: {
      type: String,
      enum: ['auto', 'cover', 'contain'],
      default: 'cover',
    },
    imagePosition: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'right',
    },
    focalPointX: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    focalPointY: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    mediaFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaFile',
      default: null,
    },
    buttonLabel: {
      type: String,
      trim: true,
      default: 'Shop Now',
    },
    buttonLink: {
      type: String,
      trim: true,
      default: '/shop',
    },
    position: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active'],
      default: 'active',
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
      index: true,
    },
    endsAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

heroSlideSchema.index({ position: 1, createdAt: -1 });

const heroSlideStatSchema = new mongoose.Schema(
  {
    slide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HeroSlide',
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

heroSlideStatSchema.index({ slide: 1, date: 1 }, { unique: true });

export const HeroSlide = mongoose.model('HeroSlide', heroSlideSchema);
export const HeroSlideStat = mongoose.model('HeroSlideStat', heroSlideStatSchema);

export default {
  HeroSlide,
  HeroSlideStat,
};
