import Product from '../models/productModel.js';
import Category from '../models/categoryModel.js';
import Order from '../models/orderModel.js';
import Discount from '../models/discountModel.js';
import { HeroSlide } from '../models/heroSlideModel.js';
import { HomepageLayout, HomepageVersion } from '../models/homepageModel.js';
import { MediaFile } from '../models/mediaModel.js';
import { deriveSlideStatus, resolveImageDimensionsAndMedia } from './heroSlideService.js';
import { buildImageVariants, buildSrcSet } from './storageService.js';
import { clearCachePattern } from '../utils/clearCache.js';
import ApiError from '../utils/ApiError.js';

export const DEFAULT_HOMEPAGE_SECTIONS = [
  {
    id: 'announcement',
    type: 'announcement',
    label: 'Announcement bar',
    icon: 'bell',
    visible: true,
    order: 0,
    config: {
      text: 'Free shipping on orders over $300',
      link: '/shop',
    },
  },
  {
    id: 'hero',
    type: 'hero',
    label: 'Hero slides',
    icon: 'content',
    visible: true,
    order: 1,
    config: {},
  },
  {
    id: 'categories',
    type: 'categories',
    label: 'Featured categories',
    icon: 'categories',
    visible: true,
    order: 2,
    config: {
      categoryIds: [],
      layout: 'Grid',
      limit: 4,
    },
  },
  {
    id: 'arrivals',
    type: 'arrivals',
    label: 'New arrivals',
    icon: 'package',
    visible: true,
    order: 3,
    config: {
      mode: 'Automatic',
      limit: 8,
    },
  },
  {
    id: 'promo',
    type: 'promo',
    label: 'Promotional banner',
    icon: 'discounts',
    visible: true,
    order: 4,
    config: {
      title: 'Autumn Sale',
      discountCode: 'WELCOME10',
      text: '20% off',
    },
  },
  {
    id: 'bestsellers',
    type: 'bestsellers',
    label: 'Best sellers',
    icon: 'analytics',
    visible: true,
    order: 5,
    config: {
      mode: 'Automatic',
      limit: 8,
      windowDays: 30,
    },
  },
  {
    id: 'brandstory',
    type: 'brandstory',
    label: 'Brand story',
    icon: 'document',
    visible: false,
    order: 6,
    config: {
      title: 'Modern Essentials.',
      description: 'Timeless silhouettes, refined materials, and effortless pieces designed for everyday wear.',
      ctaLabel: 'EXPLORE COLLECTION',
      ctaPath: '/shop',
    },
  },
  {
    id: 'newsletter',
    type: 'newsletter',
    label: 'Newsletter signup',
    icon: 'mail',
    visible: true,
    order: 7,
    config: {
      title: 'Subscribe to our newsletter',
      subtitle: 'Receive seasonal edits, new arrivals, and private sale access directly in your inbox.',
    },
  },
];

/**
 * Ensures Draft and Published layout documents exist
 */
export async function ensureHomepageLayouts() {
  let published = await HomepageLayout.findOne({ status: 'published' });
  if (!published) {
    published = await HomepageLayout.create({
      status: 'published',
      version: 1,
      sections: DEFAULT_HOMEPAGE_SECTIONS,
      publishedAt: new Date(),
      publishedByName: 'Store Admin',
    });
  }

  let draft = await HomepageLayout.findOne({ status: 'draft' });
  if (!draft) {
    draft = await HomepageLayout.create({
      status: 'draft',
      version: published.version,
      sections: published.sections,
      publishedAt: published.publishedAt,
      publishedByName: published.publishedByName,
    });
  }

  return { draft, published };
}

/**
 * Computes dynamic subtitle meta string for a section in the admin list
 */
export async function computeSectionMeta(section) {
  if (!section.visible && section.id === 'brandstory') {
    return 'Hidden from your store';
  }

  const cfg = section.config || {};

  switch (section.id) {
    case 'announcement':
      return cfg.text || 'Free shipping on orders over $300';

    case 'hero': {
      const slides = await HeroSlide.find({ status: 'active' }).lean();
      const now = new Date();
      const activeCount = slides.filter((s) => deriveSlideStatus(s, now) === 'Active').length;
      return `${activeCount} active slide${activeCount === 1 ? '' : 's'}`;
    }

    case 'categories': {
      const layoutStr = cfg.layout || 'Grid';
      const count = Array.isArray(cfg.categoryIds) && cfg.categoryIds.length > 0 ? cfg.categoryIds.length : 4;
      return `${count} categories · ${layoutStr}`;
    }

    case 'arrivals': {
      const limit = cfg.limit || 8;
      const mode = cfg.mode || 'Automatic';
      return `${limit} products · ${mode}`;
    }

    case 'promo': {
      let promoLabel = cfg.title ? `${cfg.title} · ${cfg.text || ''}` : 'Promotional banner';
      if (cfg.discountCode) {
        const discount = await Discount.findOne({ code: cfg.discountCode.toUpperCase(), isDeleted: false }).lean();
        if (discount) {
          const now = new Date();
          const isExpired = discount.endsAt && new Date(discount.endsAt) < now;
          const isInactive = discount.status !== 'active' || isExpired;
          const discountDesc = discount.type === 'percentage' ? `${discount.value}% off` : `$${discount.value} off`;
          promoLabel = `${discount.name || cfg.title || 'Special Offer'} · ${discountDesc}${isInactive ? ' · Expired' : ''}`;
        }
      }
      return promoLabel;
    }

    case 'bestsellers': {
      const limit = cfg.limit || 8;
      const mode = cfg.mode || 'Automatic';
      return `${limit} products · ${mode}`;
    }

    case 'brandstory':
      return section.visible ? (cfg.title || 'Brand story') : 'Hidden from your store';

    case 'newsletter':
      return 'Email form';

    default:
      return section.label;
  }
}

/**
 * Resolves all homepage sections server-side for customer storefront or admin preview
 */
export async function resolveHomepageData(layoutDoc) {
  const sections = layoutDoc.sections || [];
  const now = new Date();

  const resolved = [];

  for (const sec of sections) {
    if (!sec.visible) continue;

    const cfg = sec.config || {};
    const item = {
      id: sec.id,
      type: sec.type,
      label: sec.label,
      order: sec.order,
      config: cfg,
    };

    switch (sec.id) {
      case 'announcement': {
        item.data = {
          text: cfg.text || 'Free shipping on orders over $300',
          link: cfg.link || '/shop',
        };
        break;
      }

      case 'hero': {
        const slides = await HeroSlide.find({ status: 'active' }).sort({ position: 1, createdAt: -1 }).lean();
        const activeSlides = slides.filter((s) => deriveSlideStatus(s, now) === 'Active');

        const resolvedSlides = await Promise.all(
          activeSlides.map(async (s) => {
            let variants = [];
            let width = s.width || null;
            let height = s.height || null;

            if (s.mediaFile) {
              const media = await MediaFile.findById(s.mediaFile).select('variants width height url').lean();
              if (media) {
                variants = media.variants || [];
                if (!width) width = media.width || null;
                if (!height) height = media.height || null;
              }
            }

            if ((!width || !height) && s.image) {
              const resolved = await resolveImageDimensionsAndMedia(s.image, s.mediaFile);
              if (!width) width = resolved.width;
              if (!height) height = resolved.height;
            }

            if (variants.length === 0 && s.image) {
              variants = buildImageVariants(s.image, width, height);
            }

            const srcSet = buildSrcSet(variants, s.image);
            const mobileSrcSet = s.mobileImage ? buildSrcSet(buildImageVariants(s.mobileImage), s.mobileImage) : '';

            const rawFit = s.imageFit || 'cover';
            const aspectRatio = width && height ? Number((width / height).toFixed(3)) : null;
            const effectiveFit = rawFit === 'contain' ? 'contain' : 'cover';

            return {
              ...s,
              id: String(s._id),
              imageUrl: s.image,
              imageFit: rawFit,
              effectiveFit,
              imagePosition: s.imagePosition || 'right',
              focalPointX: typeof s.focalPointX === 'number' ? s.focalPointX : 50,
              focalPointY: typeof s.focalPointY === 'number' ? s.focalPointY : 50,
              width,
              height,
              aspectRatio,
              variants,
              srcSet,
              mobileSrcSet,
            };
          })
        );

        item.data = {
          slides: resolvedSlides,
        };
        break;
      }

      case 'categories': {
        let catQuery = {};
        if (Array.isArray(cfg.categoryIds) && cfg.categoryIds.length > 0) {
          catQuery = { _id: { $in: cfg.categoryIds } };
        }
        const cats = await Category.find(catQuery).limit(cfg.limit || 4).lean();
        item.data = {
          categories: cats,
          layout: cfg.layout || 'Grid',
        };
        break;
      }

      case 'arrivals': {
        const limit = Number(cfg.limit) || 8;
        const products = await Product.find({ isActive: { $ne: false } })
          .sort({ createdAt: -1 })
          .limit(limit)
          .select('name slug price discountPrice image images category countInStock')
          .lean();
        item.data = {
          products,
        };
        break;
      }

      case 'promo': {
        let promoActive = true;
        let discountDetails = null;

        if (cfg.discountCode) {
          const discount = await Discount.findOne({
            code: cfg.discountCode.toUpperCase(),
            isDeleted: false,
            status: 'active',
            startsAt: { $lte: now },
            $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
          }).lean();

          if (!discount || (discount.usageLimit && discount.usedCount >= discount.usageLimit)) {
            promoActive = false;
          } else {
            discountDetails = discount;
          }
        }

        if (promoActive) {
          item.data = {
            title: cfg.title || discountDetails?.name || 'Seasonal Promotion',
            text: cfg.text || (discountDetails ? `${discountDetails.value}% off` : 'Special Offer'),
            discountCode: cfg.discountCode || null,
            image: cfg.image || cfg.imageUrl || null,
            discount: discountDetails,
          };
        } else {
          // If linked discount is invalid, do not display banner to customers
          continue;
        }
        break;
      }

      case 'bestsellers': {
        const limit = Number(cfg.limit) || 8;
        const thirtyDaysAgo = new Date(now.getTime() - (cfg.windowDays || 30) * 24 * 60 * 60 * 1000);

        const bestSellerAgg = await Order.aggregate([
          { $match: { isPaid: true, paidAt: { $gte: thirtyDaysAgo } } },
          { $unwind: '$orderItems' },
          { $group: { _id: '$orderItems.product', soldQty: { $sum: '$orderItems.qty' } } },
          { $sort: { soldQty: -1 } },
          { $limit: limit },
        ]);

        const prodIds = bestSellerAgg.map((b) => b._id).filter(Boolean);
        let products = [];
        if (prodIds.length > 0) {
          products = await Product.find({ _id: { $in: prodIds }, isActive: { $ne: false } })
            .select('name slug price discountPrice image images category countInStock')
            .lean();
        }

        // Fallback to top products if no sales yet
        if (products.length < limit) {
          const fallbackProds = await Product.find({ _id: { $nin: prodIds }, isActive: { $ne: false } })
            .sort({ createdAt: -1 })
            .limit(limit - products.length)
            .select('name slug price discountPrice image images category countInStock')
            .lean();
          products = [...products, ...fallbackProds];
        }

        item.data = { products };
        break;
      }

      case 'brandstory': {
        item.data = {
          title: cfg.title || 'Modern Essentials.',
          description: cfg.description || '',
          ctaLabel: cfg.ctaLabel || 'EXPLORE COLLECTION',
          ctaPath: cfg.ctaPath || '/shop',
          image: cfg.image || cfg.imageUrl || null,
        };
        break;
      }

      case 'newsletter': {
        item.data = {
          title: cfg.title || 'Subscribe to our newsletter',
          subtitle: cfg.subtitle || '',
        };
        break;
      }

      default:
        break;
    }

    resolved.push(item);
  }

  return {
    version: layoutDoc.version,
    publishedAt: layoutDoc.publishedAt,
    publishedByName: layoutDoc.publishedByName,
    sections: resolved,
  };
}

/**
 * Publishes draft layout into published layout
 */
export async function publishHomepageLayout({ adminUser }) {
  const { draft, published } = await ensureHomepageLayouts();

  const nextVersion = (Number(published.version || 1) + 0.01).toFixed(2);
  const now = new Date();

  // Update published document
  published.version = Number(nextVersion);
  published.sections = draft.sections;
  published.publishedAt = now;
  published.publishedBy = adminUser?._id || null;
  published.publishedByName = adminUser?.name || 'Administrator';
  await published.save();

  // Update draft to keep in sync
  draft.version = published.version;
  draft.publishedAt = now;
  draft.publishedBy = published.publishedBy;
  draft.publishedByName = published.publishedByName;
  await draft.save();

  // Create version history audit
  await HomepageVersion.create({
    version: published.version,
    sections: published.sections,
    publishedAt: now,
    publishedBy: adminUser?._id || null,
    publishedByName: published.publishedByName,
  });

  // Invalidate Redis cache
  try {
    await clearCachePattern('home');
    await clearCachePattern('homepage');
  } catch {
    // Ignore cache error
  }

  return published;
}

/**
 * Resets draft to published layout
 */
export async function discardHomepageDraft() {
  const { draft, published } = await ensureHomepageLayouts();

  draft.sections = published.sections;
  draft.version = published.version;
  await draft.save();

  return draft;
}

export default {
  DEFAULT_HOMEPAGE_SECTIONS,
  ensureHomepageLayouts,
  computeSectionMeta,
  resolveHomepageData,
  publishHomepageLayout,
  discardHomepageDraft,
};
