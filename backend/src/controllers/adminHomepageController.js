import crypto from 'crypto';
import { Subscriber } from '../models/homepageModel.js';
import {
  ensureHomepageLayouts,
  computeSectionMeta,
  publishHomepageLayout,
  discardHomepageDraft,
} from '../services/homepageService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/admin/homepage
 * Loads draft and published sections, computed subtitles, and publication metadata
 */
export const getAdminHomepage = asyncHandler(async (req, res) => {
  const { draft, published } = await ensureHomepageLayouts();

  // Enrich draft sections with real-time computed subtitles (meta)
  const enrichedSections = await Promise.all(
    (draft.sections || []).map(async (sec) => {
      const meta = await computeSectionMeta(sec);
      return {
        id: sec.id,
        type: sec.type,
        label: sec.label,
        icon: sec.icon,
        visible: sec.visible,
        order: sec.order,
        meta,
        config: sec.config || {},
      };
    })
  );

  const draftNormalized = (draft.sections || []).map((s) => ({
    id: s.id,
    type: s.type || s.id,
    label: s.label,
    visible: Boolean(s.visible),
    order: s.order,
    config: s.config || {},
  }));

  const publishedNormalized = (published.sections || []).map((s) => ({
    id: s.id,
    type: s.type || s.id,
    label: s.label,
    visible: Boolean(s.visible),
    order: s.order,
    config: s.config || {},
  }));

  const draftHash = crypto.createHash('sha256').update(JSON.stringify(draftNormalized)).digest('hex');
  const publishedHash = crypto.createHash('sha256').update(JSON.stringify(publishedNormalized)).digest('hex');
  const isDirty = draftHash !== publishedHash;

  const subscribersCount = await Subscriber.countDocuments({ status: 'subscribed' });

  const lastPublishedStr = published.publishedAt
    ? new Date(published.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }) +
      ', ' +
      new Date(published.publishedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  res.status(200).json({
    success: true,
    data: {
      sections: enrichedSections,
      isDirty,
      meta: {
        lastPublished: lastPublishedStr,
        publishedBy: published.publishedByName || 'Administrator',
        version: String(published.version || '1.0'),
      },
      subscribersCount,
      version: draft.version,
    },
  });
});

/**
 * PUT /api/admin/homepage/draft
 * Updates draft sections with concurrent edit conflict detection
 */
export const updateAdminHomepageDraft = asyncHandler(async (req, res) => {
  const { sections, clientVersion } = req.body;
  if (!sections || !Array.isArray(sections)) {
    throw new ApiError(400, 'Sections array is required.');
  }

  const { draft } = await ensureHomepageLayouts();

  // Concurrent editing conflict detection
  if (clientVersion !== undefined && Number(clientVersion) !== Number(draft.version)) {
    return res.status(409).json({
      success: false,
      conflict: true,
      serverVersion: draft.version,
      currentVersion: draft.version,
      message: `Conflict: Another administrator has updated the homepage layout (Current version ${draft.version}). Please refresh before editing.`,
    });
  }

  // Update draft sections
  draft.sections = sections.map((s, idx) => ({
    id: s.id,
    type: s.type || s.id,
    label: s.label,
    icon: s.icon || 'document',
    visible: Boolean(s.visible),
    order: s.order !== undefined ? s.order : idx,
    config: s.config || {},
  }));

  await draft.save();

  res.status(200).json({
    success: true,
    message: 'Draft layout updated successfully.',
    data: {
      sections: draft.sections,
      version: draft.version,
    },
  });
});

/**
 * POST /api/admin/homepage/publish
 */
export const publishAdminHomepage = asyncHandler(async (req, res) => {
  const published = await publishHomepageLayout({ adminUser: req.user });

  const lastPublishedStr = new Date(published.publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }) +
  ', ' +
  new Date(published.publishedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  res.status(200).json({
    success: true,
    message: 'Homepage content published successfully.',
    data: {
      version: published.version,
      meta: {
        lastPublished: lastPublishedStr,
        publishedBy: published.publishedByName,
        version: String(published.version),
      },
    },
  });
});

/**
 * POST /api/admin/homepage/discard
 */
export const discardAdminHomepage = asyncHandler(async (req, res) => {
  const draft = await discardHomepageDraft();

  res.status(200).json({
    success: true,
    message: 'Draft changes discarded.',
    data: {
      sections: draft.sections,
      version: draft.version,
    },
  });
});

/**
 * GET /api/admin/homepage/subscribers
 */
export const getAdminSubscribers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && ['pending', 'subscribed', 'unsubscribed'].includes(req.query.status)) {
    filter.status = req.query.status;
  } else if (!req.query.status) {
    // default to showing subscribed
    filter.status = 'subscribed';
  }

  const [subscribers, total, subscribedCount, pendingCount, unsubscribedCount] = await Promise.all([
    Subscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Subscriber.countDocuments(filter),
    Subscriber.countDocuments({ status: 'subscribed' }),
    Subscriber.countDocuments({ status: 'pending' }),
    Subscriber.countDocuments({ status: 'unsubscribed' }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      subscribers,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      counts: {
        subscribed: subscribedCount,
        pending: pendingCount,
        unsubscribed: unsubscribedCount,
        total: subscribedCount + pendingCount + unsubscribedCount,
      },
    },
  });
});

export default {
  getAdminHomepage,
  updateAdminHomepageDraft,
  publishAdminHomepage,
  discardAdminHomepage,
  getAdminSubscribers,
};
