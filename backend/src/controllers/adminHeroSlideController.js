import jwt from 'jsonwebtoken';
import { HeroSlide, HeroSlideStat } from '../models/heroSlideModel.js';
import { MediaFile } from '../models/mediaModel.js';
import {
  deriveSlideStatus,
  deriveRelativeSchedule,
  validateButtonLink,
  getHeroSlideStatistics,
  formatSlideRow,
  resolveImageDimensionsAndMedia,
} from '../services/heroSlideService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { clearCachePattern } from '../utils/clearCache.js';

/**
 * GET /api/admin/hero-slides
 */
export const getAdminHeroSlidesList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { search, status = 'All', dates = 'All' } = req.query;

  const slides = await HeroSlide.find({}).sort({ position: 1, createdAt: -1 }).lean();
  const now = new Date();

  // Load telemetry stats for the last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const statsAgg = await HeroSlideStat.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: '$slide',
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
      },
    },
  ]);
  const statsMap = new Map(statsAgg.map((s) => [String(s._id), s]));

  // Format and filter
  const formattedRows = [];
  for (const slide of slides) {
    const formatted = await formatSlideRow(slide, statsMap);

    // Search filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const matchHead = formatted.headline.toLowerCase().includes(q);
      const matchSub = (formatted.sub || '').toLowerCase().includes(q);
      if (!matchHead && !matchSub) continue;
    }

    // Status filter ('All', 'Active', 'Scheduled', 'Draft', 'Expired')
    if (status !== 'All' && formatted.status !== status) {
      continue;
    }

    // Date filter
    if (dates !== 'All') {
      if (dates === 'Ending soon' && !formatted.relative.includes('days left')) continue;
      if (dates === 'Starting soon' && !formatted.relative.includes('Starts in')) continue;
      if (dates === 'No schedule' && formatted.relative !== 'No schedule') continue;
      if (dates === 'Already ended' && !formatted.relative.startsWith('Ended')) continue;
    }

    formattedRows.push(formatted);
  }

  const paginatedRows = formattedRows.slice(skip, skip + limit);
  const totalCount = formattedRows.length;
  const stats = await getHeroSlideStatistics();

  res.status(200).json({
    success: true,
    data: {
      slides: paginatedRows,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      limit,
      stats,
    },
  });
});

/**
 * GET /api/admin/hero-slides/stats
 */
export const getAdminHeroSlideStats = asyncHandler(async (req, res) => {
  const stats = await getHeroSlideStatistics();
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * POST /api/admin/hero-slides
 */
export const createHeroSlide = asyncHandler(async (req, res) => {
  const {
    headline,
    title,
    subheadline = '',
    subtitle = '',
    image,
    imageUrl,
    mobileImage = '',
    imageFit = 'cover',
    imagePosition = 'right',
    focalPointX = 50,
    focalPointY = 25,
    buttonLabel,
    buttonText,
    buttonLink = '/shop',
    startsAt = null,
    endsAt = null,
    status,
    enabled,
  } = req.body;

  const resolvedHeadline = headline || title;
  const resolvedImage = image || imageUrl;
  const resolvedSubheadline = subheadline || subtitle || '';
  const resolvedButtonLabel = buttonLabel || buttonText || 'Shop Now';
  const resolvedStatus = status ? status : enabled === false ? 'draft' : 'active';
  const validFits = ['auto', 'cover', 'contain'];
  const cleanFit = imageFit === 'contain' ? 'contain' : 'cover';
  const validPositions = ['left', 'center', 'right'];
  const cleanPosition = validPositions.includes(imagePosition) ? imagePosition : 'right';
  const cleanFocalX = Math.min(100, Math.max(0, Number(focalPointX) ?? 50));
  const cleanFocalY = Math.min(100, Math.max(0, Number(focalPointY) ?? 25));

  if (!resolvedHeadline || !resolvedHeadline.trim()) {
    throw new ApiError(400, 'Headline is required.');
  }
  if (!resolvedImage || !resolvedImage.trim()) {
    throw new ApiError(400, 'Desktop image is required.');
  }

  await validateButtonLink(buttonLink);

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new ApiError(400, 'End date must be after start date.');
  }

  const cleanImg = resolvedImage.trim();
  const { mediaId, width, height } = await resolveImageDimensionsAndMedia(cleanImg);

  const highestPosSlide = await HeroSlide.findOne({}).sort({ position: -1 }).select('position');
  const position = highestPosSlide ? (highestPosSlide.position || 0) + 1 : 0;

  const slide = await HeroSlide.create({
    headline: resolvedHeadline.trim(),
    subheadline: resolvedSubheadline.trim(),
    image: cleanImg,
    mobileImage: mobileImage ? mobileImage.trim() : '',
    imageFit: cleanFit,
    imagePosition: cleanPosition,
    focalPointX: cleanFocalX,
    focalPointY: cleanFocalY,
    width,
    height,
    mediaFile: mediaId,
    buttonLabel: resolvedButtonLabel ? resolvedButtonLabel.trim() : 'Shop Now',
    buttonLink: buttonLink ? buttonLink.trim() : '/shop',
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    status: resolvedStatus === 'draft' ? 'draft' : 'active',
    position,
    createdBy: req.user?._id || null,
  });

  try {
    await clearCachePattern('home');
  } catch {
    // Ignore cache error
  }

  res.status(201).json({
    success: true,
    message: 'Hero slide created successfully.',
    data: slide,
  });
});

/**
 * GET /api/admin/hero-slides/:id
 */
export const getHeroSlideById = asyncHandler(async (req, res) => {
  const slide = await HeroSlide.findById(req.params.id);
  if (!slide) {
    throw new ApiError(404, 'Hero slide not found.');
  }

  const formatted = await formatSlideRow(slide.toObject());
  res.status(200).json({
    success: true,
    data: formatted,
  });
});

/**
 * PUT /api/admin/hero-slides/:id
 */
export const updateHeroSlide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const slide = await HeroSlide.findById(id);
  if (!slide) {
    throw new ApiError(404, 'Hero slide not found.');
  }

  const {
    headline,
    subheadline,
    image,
    mobileImage,
    imageFit,
    imagePosition,
    focalPointX,
    focalPointY,
    buttonLabel,
    buttonLink,
    startsAt,
    endsAt,
    status,
    position,
  } = req.body;

  if (headline !== undefined) {
    if (!headline.trim()) throw new ApiError(400, 'Headline cannot be empty.');
    slide.headline = headline.trim();
  }
  if (subheadline !== undefined) slide.subheadline = subheadline.trim();
  if (image !== undefined) {
    if (!image.trim()) throw new ApiError(400, 'Desktop image cannot be empty.');
    const cleanImg = image.trim();
    slide.image = cleanImg;
    const { mediaId, width, height } = await resolveImageDimensionsAndMedia(cleanImg);
    slide.mediaFile = mediaId;
    if (width) slide.width = width;
    if (height) slide.height = height;
  }
  if (mobileImage !== undefined) slide.mobileImage = mobileImage.trim();
  if (imageFit !== undefined) {
    const validFits = ['auto', 'cover', 'contain'];
    slide.imageFit = validFits.includes(imageFit) ? imageFit : 'auto';
  }
  if (imagePosition !== undefined) {
    const validPositions = ['left', 'center', 'right'];
    slide.imagePosition = validPositions.includes(imagePosition) ? imagePosition : 'right';
  }
  if (focalPointX !== undefined) {
    slide.focalPointX = Math.min(100, Math.max(0, Number(focalPointX) ?? 50));
  }
  if (focalPointY !== undefined) {
    slide.focalPointY = Math.min(100, Math.max(0, Number(focalPointY) ?? 50));
  }
  if (buttonLabel !== undefined) slide.buttonLabel = buttonLabel.trim();
  if (buttonLink !== undefined) {
    await validateButtonLink(buttonLink);
    slide.buttonLink = buttonLink.trim();
  }
  if (startsAt !== undefined) slide.startsAt = startsAt ? new Date(startsAt) : null;
  if (endsAt !== undefined) slide.endsAt = endsAt ? new Date(endsAt) : null;

  if (slide.startsAt && slide.endsAt && new Date(slide.endsAt) <= new Date(slide.startsAt)) {
    throw new ApiError(400, 'End date must be after start date.');
  }

  if (status !== undefined) slide.status = status === 'draft' ? 'draft' : 'active';
  if (position !== undefined) slide.position = Number(position) || 0;

  await slide.save();

  try {
    await clearCachePattern('home');
  } catch {
    // Ignore cache error
  }

  res.status(200).json({
    success: true,
    message: 'Hero slide updated successfully.',
    data: slide,
  });
});

/**
 * POST /api/admin/hero-slides/:id/duplicate
 */
export const duplicateHeroSlide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const source = await HeroSlide.findById(id);
  if (!source) {
    throw new ApiError(404, 'Hero slide not found.');
  }

  const highestPos = await HeroSlide.findOne({}).sort({ position: -1 }).select('position');
  const position = (highestPos?.position || 0) + 1;

  const duplicated = await HeroSlide.create({
    headline: `${source.headline} (copy)`,
    subheadline: source.subheadline,
    image: source.image,
    mobileImage: source.mobileImage,
    buttonLabel: source.buttonLabel,
    buttonLink: source.buttonLink,
    position,
    status: 'draft',
    startsAt: null,
    endsAt: null,
    createdBy: req.user?._id || null,
  });

  res.status(201).json({
    success: true,
    message: 'Slide duplicated as draft.',
    data: duplicated,
  });
});

/**
 * DELETE /api/admin/hero-slides/:id
 */
export const deleteHeroSlide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const slide = await HeroSlide.findByIdAndDelete(id);
  if (!slide) {
    throw new ApiError(404, 'Hero slide not found.');
  }

  await HeroSlideStat.deleteMany({ slide: id });

  try {
    await clearCachePattern('home');
  } catch {
    // Ignore cache error
  }

  res.status(200).json({
    success: true,
    message: 'Hero slide deleted successfully.',
  });
});

/**
 * PATCH /api/admin/hero-slides/reorder
 */
export const reorderHeroSlides = asyncHandler(async (req, res) => {
  const items = req.body.items || (Array.isArray(req.body.slideIds) ? req.body.slideIds.map((id, index) => ({ id, position: index })) : null);
  if (!items || !Array.isArray(items)) {
    throw new ApiError(400, 'Reorder items array is required.');
  }

  const bulkOps = items.map((item, index) => ({
    updateOne: {
      filter: { _id: item.id || item._id },
      update: { $set: { position: item.position !== undefined ? item.position : index } },
    },
  }));

  if (bulkOps.length > 0) {
    await HeroSlide.bulkWrite(bulkOps);
  }

  try {
    await clearCachePattern('home');
  } catch {
    // Ignore cache error
  }

  res.status(200).json({
    success: true,
    message: 'Slides reordered successfully.',
  });
});

/**
 * POST /api/admin/hero-slides/bulk
 */
export const bulkHeroSlideActions = asyncHandler(async (req, res) => {
  const { action, ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'Please select slides to process.');
  }

  if (action === 'delete') {
    await HeroSlide.deleteMany({ _id: { $in: ids } });
    await HeroSlideStat.deleteMany({ slide: { $in: ids } });
  } else if (action === 'active' || action === 'draft') {
    await HeroSlide.updateMany(
      { _id: { $in: ids } },
      { $set: { status: action === 'active' ? 'active' : 'draft' } }
    );
  } else {
    throw new ApiError(400, `Unsupported action: ${action}`);
  }

  try {
    await clearCachePattern('home');
  } catch {
    // Ignore cache error
  }

  res.status(200).json({
    success: true,
    message: `Bulk ${action} completed for ${ids.length} slides.`,
  });
});

/**
 * GET /api/admin/hero-slides/preview-token
 * Generates an admin signed JWT token for viewing draft preview on storefront
 */
export const getPreviewToken = asyncHandler(async (req, res) => {
  const token = jwt.sign(
    { role: 'admin', preview: true, id: req.user?._id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(200).json({
    success: true,
    data: { token },
  });
});

export default {
  getAdminHeroSlidesList,
  getAdminHeroSlideStats,
  createHeroSlide,
  getHeroSlideById,
  updateHeroSlide,
  duplicateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
  bulkHeroSlideActions,
  getPreviewToken,
};
