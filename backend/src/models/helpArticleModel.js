import mongoose from 'mongoose';

const helpArticleSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      enum: ['orders', 'shipping', 'account', 'payments', 'security', 'general'],
      default: 'general',
      index: true,
    },
    question: {
      type: String,
      required: [true, 'Question is required'],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, 'Answer is required'],
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published',
      index: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    unhelpfulVotes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

helpArticleSchema.index({ status: 1, sortOrder: 1 });
helpArticleSchema.index({ question: 'text', answer: 'text' });

const HelpArticle = mongoose.model('HelpArticle', helpArticleSchema);

export default HelpArticle;
