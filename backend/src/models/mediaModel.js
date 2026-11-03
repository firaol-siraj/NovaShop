import mongoose from 'mongoose';

const mediaFolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: [100, 'Folder name cannot exceed 100 characters'],
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaFolder',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique folder name within the same parent folder
mediaFolderSchema.index({ name: 1, parent: 1 }, { unique: true });

const mediaFileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ['image', 'video', 'document'],
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    duration: {
      type: String,
      default: null,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaFolder',
      default: null,
      index: true,
    },
    altText: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    hash: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      index: true,
    },
    variants: [
      {
        width: { type: Number },
        height: { type: Number },
        url: { type: String },
        format: { type: String, default: 'webp' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

mediaFileSchema.index({ createdAt: -1 });
mediaFileSchema.index({ deletedAt: 1, kind: 1, folder: 1 });

export const MediaFolder = mongoose.model('MediaFolder', mediaFolderSchema);
export const MediaFile = mongoose.model('MediaFile', mediaFileSchema);

export default {
  MediaFolder,
  MediaFile,
};
