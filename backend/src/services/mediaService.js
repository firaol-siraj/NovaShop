import mongoose from 'mongoose';
import { MediaFile, MediaFolder } from '../models/mediaModel.js';
import Product from '../models/productModel.js';
import Category from '../models/categoryModel.js';
import { HeroSlide } from '../models/heroSlideModel.js';
import { HomepageLayout } from '../models/homepageModel.js';
import Setting from '../models/settingModel.js';

/**
 * Formats byte size into human readable string (e.g. 840 KB, 4.2 GB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Finds all places in the store where a media file is referenced
 */
export async function findMediaUsage(mediaFileIdOrUrl) {
  let fileDoc = null;
  if (mongoose.Types.ObjectId.isValid(mediaFileIdOrUrl)) {
    fileDoc = await MediaFile.findById(mediaFileIdOrUrl).lean();
  } else {
    fileDoc = await MediaFile.findOne({ url: mediaFileIdOrUrl }).lean();
  }

  const url = fileDoc ? fileDoc.url : String(mediaFileIdOrUrl);
  const fileId = fileDoc ? fileDoc._id : null;

  const usages = [];

  // 1. Products
  const products = await Product.find({
    $or: [{ image: url }, { images: url }],
  }).select('_id name slug image images').lean();

  for (const prod of products) {
    usages.push({
      type: 'product',
      typeLabel: 'Product',
      id: String(prod._id),
      name: prod.name,
      link: `/admin/products/${prod._id}/edit`,
    });
  }

  // 2. Categories
  const categories = await Category.find({ image: url }).select('_id name slug').lean();
  for (const cat of categories) {
    usages.push({
      type: 'category',
      typeLabel: 'Category',
      id: String(cat._id),
      name: cat.name,
      link: `/admin/categories`,
    });
  }

  // 3. Hero Slides
  const heroSlideConditions = [{ image: url }, { mobileImage: url }];
  if (fileId) {
    heroSlideConditions.push({ mediaFile: fileId });
  }
  const slides = await HeroSlide.find({ $or: heroSlideConditions }).select('_id headline buttonLabel').lean();
  for (const slide of slides) {
    usages.push({
      type: 'hero_slide',
      typeLabel: 'Hero Slide',
      id: String(slide._id),
      name: slide.headline,
      link: `/admin/content/hero`,
    });
  }

  // 4. Homepage Sections (in draft or published layout)
  const layouts = await HomepageLayout.find({}).lean();
  for (const layout of layouts) {
    for (const sec of layout.sections || []) {
      const cfg = sec.config || {};
      const match =
        cfg.imageUrl === url ||
        cfg.image === url ||
        cfg.bgImage === url ||
        (Array.isArray(cfg.images) && cfg.images.includes(url));

      if (match) {
        usages.push({
          type: 'homepage_section',
          typeLabel: 'Homepage Section',
          id: sec.id,
          name: `${sec.label} (${layout.status})`,
          link: `/admin/content/homepage`,
        });
      }
    }
  }

  const totalUsages = usages.length;
  const inUse = totalUsages > 0;

  // Sync usageCount on MediaFile document if found
  if (fileDoc && fileDoc.usageCount !== totalUsages) {
    await MediaFile.updateOne({ _id: fileDoc._id }, { $set: { usageCount: totalUsages } });
  }

  return {
    inUse,
    totalUsages,
    usages,
  };
}

/**
 * Computes Media Library KPIs and tab counts
 */
export async function getMediaStatistics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const activeFilter = { deletedAt: null };

  const [
    totalFiles,
    storageAgg,
    unusedFiles,
    uploadedThisMonth,
    uploadedLastMonth,
    imageCount,
    videoCount,
    documentCount,
    configuredQuotaBytes,
  ] = await Promise.all([
    MediaFile.countDocuments(activeFilter),
    MediaFile.aggregate([
      { $match: activeFilter },
      { $group: { _id: null, totalBytes: { $sum: '$size' } } },
    ]),
    MediaFile.countDocuments({ ...activeFilter, usageCount: 0 }),
    MediaFile.countDocuments({ ...activeFilter, createdAt: { $gte: startOfMonth } }),
    MediaFile.countDocuments({
      ...activeFilter,
      createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
    }),
    MediaFile.countDocuments({ ...activeFilter, kind: 'image' }),
    MediaFile.countDocuments({ ...activeFilter, kind: 'video' }),
    MediaFile.countDocuments({ ...activeFilter, kind: 'document' }),
    Setting.getSetting('mediaQuotaBytes', null),
  ]);

  const totalBytes = storageAgg[0]?.totalBytes || 0;
  const formattedStorage = formatBytes(totalBytes);

  let quotaLabel = '-';
  if (configuredQuotaBytes && Number(configuredQuotaBytes) > 0) {
    const quotaNum = Number(configuredQuotaBytes);
    const pct = Math.min(100, Math.round((totalBytes / quotaNum) * 100));
    quotaLabel = `${pct}% of ${formatBytes(quotaNum, 0)}`;
  }

  let uploadTrend = '-';
  if (uploadedLastMonth > 0) {
    const diffPct = Math.round(((uploadedThisMonth - uploadedLastMonth) / uploadedLastMonth) * 100);
    uploadTrend = `${diffPct >= 0 ? '+' : ''}${diffPct}%`;
  } else if (uploadedThisMonth > 0) {
    uploadTrend = `+${uploadedThisMonth} this month`;
  }

  return {
    totalFiles,
    totalFilesTrend: uploadedThisMonth > 0 ? `+${uploadedThisMonth} this month` : '-',
    storageBytes: totalBytes,
    storageUsedFormatted: formattedStorage,
    quotaLabel,
    unusedFiles,
    unusedFilesTrend: unusedFiles > 0 ? `+${unusedFiles} unused` : '-',
    uploadedThisMonth,
    uploadedThisMonthTrend: uploadTrend,
    tabCounts: {
      All: totalFiles,
      image: imageCount,
      video: videoCount,
      document: documentCount,
    },
  };
}

/**
 * Recomputes usage counts for all media files in the database
 */
export async function recomputeAllMediaUsage() {
  const files = await MediaFile.find({ deletedAt: null }).select('_id url').lean();
  let updatedCount = 0;

  for (const file of files) {
    const result = await findMediaUsage(file.url);
    await MediaFile.updateOne({ _id: file._id }, { $set: { usageCount: result.totalUsages } });
    updatedCount++;
  }

  return { updatedCount };
}

export default {
  formatBytes,
  findMediaUsage,
  getMediaStatistics,
  recomputeAllMediaUsage,
};
