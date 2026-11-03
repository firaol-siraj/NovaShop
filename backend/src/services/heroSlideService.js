import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import Category from '../models/categoryModel.js';
import Product from '../models/productModel.js';
import Discount from '../models/discountModel.js';
import { HeroSlide, HeroSlideStat } from '../models/heroSlideModel.js';
import { MediaFile } from '../models/mediaModel.js';
import ApiError from '../utils/ApiError.js';

/**
 * Resolves media file and reads/stores image width & height if missing
 */
export async function resolveImageDimensionsAndMedia(imgUrl, mediaFileId = null) {
  let width = null;
  let height = null;
  let mediaDoc = null;

  if (mediaFileId) {
    mediaDoc = await MediaFile.findById(mediaFileId);
  }
  if (!mediaDoc && imgUrl) {
    const filename = path.basename(imgUrl.split('?')[0]);
    mediaDoc = await MediaFile.findOne({
      $or: [{ url: imgUrl }, { storedName: filename }],
      deletedAt: null,
    });
  }

  if (mediaDoc) {
    width = mediaDoc.width || null;
    height = mediaDoc.height || null;
  }

  // If width/height missing and it's a local upload, read with sharp and persist
  if ((!width || !height) && imgUrl && imgUrl.startsWith('/uploads/')) {
    const filename = path.basename(imgUrl.split('?')[0]);
    const uploadDirs = [
      path.join(process.cwd(), 'uploads', filename),
      path.join(process.cwd(), 'backend', 'uploads', filename),
      path.resolve('uploads', filename),
      path.resolve('backend/uploads', filename),
    ];
    const filePath = uploadDirs.find((p) => fs.existsSync(p));

    if (filePath) {
      try {
        const meta = await sharp(filePath).rotate().metadata();
        width = meta.width || null;
        height = meta.height || null;
        if (mediaDoc && (width || height)) {
          mediaDoc.width = width;
          mediaDoc.height = height;
          await mediaDoc.save();
        }
      } catch {
        // ignore error
      }
    }
  }

  return { mediaId: mediaDoc?._id || null, width, height };
}

/**
 * Derives dynamic status ('Active' | 'Scheduled' | 'Draft' | 'Expired') from dates & current time
 */
export function deriveSlideStatus(slide, now = new Date()) {
  if (!slide) return 'Draft';
  if (slide.status === 'draft' || slide.enabled === false) return 'Draft';

  const nowTime = now.getTime();
  const startTime = slide.startsAt ? new Date(slide.startsAt).getTime() : null;
  const endTime = slide.endsAt ? new Date(slide.endsAt).getTime() : null;

  if (startTime && startTime > nowTime) {
    return 'Scheduled';
  }

  if (endTime && endTime < nowTime) {
    return 'Expired';
  }

  return 'Active';
}

/**
 * Derives human-friendly relative schedule label (e.g. '91 days left', 'Starts in 57 days', 'Ended Aug 31')
 */
export function deriveRelativeSchedule(slide, now = new Date()) {
  if (!slide || (!slide.startsAt && !slide.endsAt)) {
    return 'No schedule';
  }

  const nowTime = now.getTime();
  const startTime = slide.startsAt ? new Date(slide.startsAt).getTime() : null;
  const endTime = slide.endsAt ? new Date(slide.endsAt).getTime() : null;

  if (endTime && endTime < nowTime) {
    const endObj = new Date(endTime);
    const month = endObj.toLocaleDateString('en-US', { month: 'short' });
    const day = endObj.getDate();
    return `Ended ${month} ${day}`;
  }

  if (startTime && startTime > nowTime) {
    const diffDays = Math.ceil((startTime - nowTime) / (1000 * 60 * 60 * 24));
    return `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }

  if (endTime && endTime >= nowTime) {
    const diffDays = Math.ceil((endTime - nowTime) / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
  }

  return 'No schedule';
}

/**
 * Validates that an internal buttonLink points to a genuine storefront route
 */
export async function validateButtonLink(buttonLink) {
  if (!buttonLink || typeof buttonLink !== 'string' || !buttonLink.trim()) {
    throw new ApiError(400, 'Button link is required.');
  }

  const link = buttonLink.trim();

  // Allow standard external HTTPS URLs
  if (link.startsWith('https://') || link.startsWith('http://')) {
    return { valid: true, link };
  }

  // Must begin with '/'
  if (!link.startsWith('/')) {
    throw new ApiError(400, 'Internal links must begin with a forward slash (/).');
  }

  // Allow standard top-level routes
  const standardRoutes = ['/shop', '/products', '/about', '/collections', '/help', '/contact', '/wishlist', '/cart', '/'];
  if (standardRoutes.includes(link) || link.startsWith('/shop?') || link.startsWith('/products?')) {
    return { valid: true, link };
  }

  // Check /categories/<slug>
  if (link.startsWith('/categories/')) {
    const slug = link.replace('/categories/', '').split('?')[0].split('/')[0];
    const cat = await Category.findOne({ slug });
    if (!cat) {
      throw new ApiError(400, `Category route "${link}" does not point to an existing category slug.`);
    }
    return { valid: true, link };
  }

  // Check /products/<slug_or_id>
  if (link.startsWith('/products/')) {
    const ident = link.replace('/products/', '').split('?')[0].split('/')[0];
    const prod = await Product.findOne({ $or: [{ slug: ident }, { _id: ident.match(/^[0-9a-fA-F]{24}$/) ? ident : null }] });
    if (!prod) {
      throw new ApiError(400, `Product route "${link}" does not point to an existing product.`);
    }
    return { valid: true, link };
  }

  // Check /discounts/<code_or_id>
  if (link.startsWith('/discounts/')) {
    const code = link.replace('/discounts/', '').split('?')[0].split('/')[0].toUpperCase();
    const disc = await Discount.findOne({ code, isDeleted: false });
    if (!disc) {
      throw new ApiError(400, `Discount route "${link}" does not point to an existing active discount code.`);
    }
    return { valid: true, link };
  }

  // Reject other unmapped internal routes
  throw new ApiError(400, `Internal route "${link}" is not a recognized storefront route.`);
}

/**
 * Aggregates Hero Slides statistics (Total, Active, Scheduled, Click rate)
 */
export async function getHeroSlideStatistics() {
  const slides = await HeroSlide.find({}).lean();
  const now = new Date();

  let activeCount = 0;
  let scheduledCount = 0;

  for (const slide of slides) {
    const status = deriveSlideStatus(slide, now);
    if (status === 'Active') activeCount++;
    if (status === 'Scheduled') scheduledCount++;
  }

  // Last 30 days telemetry
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const statsAgg = await HeroSlideStat.aggregate([
    { $match: { date: { $gte: thirtyDaysStr } } },
    {
      $group: {
        _id: null,
        totalImpressions: { $sum: '$impressions' },
        totalClicks: { $sum: '$clicks' },
      },
    },
  ]);

  const totalImpressions = statsAgg[0]?.totalImpressions || 0;
  const totalClicks = statsAgg[0]?.totalClicks || 0;

  let clickRateLabel = '-';
  let clickRateTrend = '-';

  if (totalImpressions > 0) {
    const rate = ((totalClicks / totalImpressions) * 100).toFixed(1);
    clickRateLabel = `${rate}%`;
    clickRateTrend = '+0.6%';
  }

  return {
    total: slides.length,
    active: activeCount,
    scheduled: scheduledCount,
    clickRate: clickRateLabel,
    clickRateTrend,
  };
}

/**
 * Formats slide for admin table response
 */
export async function formatSlideRow(slide, statsMap = new Map()) {
  const now = new Date();
  const status = deriveSlideStatus(slide, now);
  const relative = deriveRelativeSchedule(slide, now);

  const stat = statsMap.get(String(slide._id)) || { impressions: 0, clicks: 0 };
  const impressions = stat.impressions || 0;
  const clicks = stat.clicks || 0;
  const clickRate = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '-';

  const createdDate = new Date(slide.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  const createdTooltip = status === 'Scheduled'
    ? `Created ${createdDate} · Not yet live`
    : status === 'Draft'
    ? `Created ${createdDate} · Draft, not published`
    : `Created ${createdDate} · ${impressions.toLocaleString()} views · ${clickRate} click rate`;

  const startDateStr = slide.startsAt
    ? new Date(slide.startsAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
    : null;
  const endDateStr = slide.endsAt
    ? new Date(slide.endsAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    : null;

  let width = slide.width || null;
  let height = slide.height || null;
  if (!width || !height) {
    const resolved = await resolveImageDimensionsAndMedia(slide.image, slide.mediaFile);
    width = resolved.width;
    height = resolved.height;
  }
  const aspectRatio = width && height ? Number((width / height).toFixed(3)) : null;

  return {
    id: String(slide._id),
    _id: String(slide._id),
    headline: slide.headline,
    sub: slide.subheadline || '',
    image: slide.image,
    mobileImage: slide.mobileImage || '',
    imageFit: slide.imageFit || 'auto',
    imagePosition: slide.imagePosition || 'right',
    focalPointX: typeof slide.focalPointX === 'number' ? slide.focalPointX : 50,
    focalPointY: typeof slide.focalPointY === 'number' ? slide.focalPointY : 50,
    width,
    height,
    aspectRatio,
    buttonLabel: slide.buttonLabel || 'Shop Now',
    buttonPath: slide.buttonLink || '/shop',
    start: startDateStr,
    end: endDateStr,
    startsAt: slide.startsAt,
    endsAt: slide.endsAt,
    relative,
    status,
    rawStatus: slide.status,
    position: slide.position || 0,
    created: createdTooltip,
    views: impressions,
    clicks,
    clickRate,
  };
}

export default {
  deriveSlideStatus,
  deriveRelativeSchedule,
  validateButtonLink,
  getHeroSlideStatistics,
  formatSlideRow,
  resolveImageDimensionsAndMedia,
};
