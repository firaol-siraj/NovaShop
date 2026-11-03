import mongoose from 'mongoose';

const linkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const homeContentSchema = new mongoose.Schema(
  {
    eyebrow: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    primaryCta: {
      type: linkSchema,
      default: () => ({ label: '', link: '' }),
    },
    secondaryCta: {
      type: linkSchema,
      default: () => ({ label: '', link: '' }),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const HomeContent = mongoose.model('HomeContent', homeContentSchema);

export default HomeContent;
