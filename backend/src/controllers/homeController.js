import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import HomeContent from '../models/homeContentModel.js';
import { HeroSlide, HeroSlideStat } from '../models/heroSlideModel.js';
import { HomepageLayout, Subscriber } from '../models/homepageModel.js';
import { MediaFile } from '../models/mediaModel.js';
import {
  ensureHomepageLayouts,
  resolveHomepageData,
} from '../services/homepageService.js';
import { deriveSlideStatus, resolveImageDimensionsAndMedia } from '../services/heroSlideService.js';
import { buildImageVariants, buildSrcSet } from '../services/storageService.js';
import sendEmail from '../utils/sendEmail.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { clearCachePattern } from '../utils/clearCache.js';

// @desc    Fetch legacy campaign hero banner configuration
// @route   GET /api/v1/home/hero
// @access  Public
export const getHeroBanner = asyncHandler(async (req, res) => {
  const hero = await HomeContent.findOne({ isActive: true });

  res.status(200).json({
    success: true,
    data: hero || null,
  });
});

// @desc    Update legacy hero banner configuration
// @route   PUT /api/v1/home/hero
// @access  Private/Admin
export const updateHeroBanner = asyncHandler(async (req, res) => {
  const { eyebrow, title, subtitle, imageUrl, primaryCta, secondaryCta, isActive } = req.body;

  let hero = await HomeContent.findOne();

  if (hero) {
    if (eyebrow !== undefined) hero.eyebrow = eyebrow;
    if (title !== undefined) hero.title = title;
    if (subtitle !== undefined) hero.subtitle = subtitle;
    if (imageUrl !== undefined) hero.imageUrl = imageUrl;
    if (primaryCta !== undefined) hero.primaryCta = primaryCta;
    if (secondaryCta !== undefined) hero.secondaryCta = secondaryCta;
    if (isActive !== undefined) hero.isActive = isActive;
    await hero.save();
  } else {
    hero = await HomeContent.create({
      eyebrow: eyebrow || '',
      title,
      subtitle: subtitle || '',
      imageUrl: imageUrl || '',
      primaryCta: primaryCta || { label: '', link: '' },
      secondaryCta: secondaryCta || { label: '', link: '' },
      isActive: isActive !== undefined ? isActive : true,
    });
  }

  try {
    await clearCachePattern('home');
  } catch (cacheError) {
    console.error('Home cache invalidation error:', cacheError);
  }

  res.status(200).json({
    success: true,
    data: hero,
  });
});

// @desc    Get public homepage layout fully populated
// @route   GET /api/homepage or GET /api/v1/home/layout
// @access  Public (or Admin Preview)
export const getPublicHomepageLayout = asyncHandler(async (req, res) => {
  const { preview, token } = req.query;
  let useDraft = false;

  if (preview === 'true' && token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin' && decoded.preview) {
        useDraft = true;
      }
    } catch {
      // Invalid preview token, fallback to published
    }
  }

  const { draft, published } = await ensureHomepageLayouts();
  const targetLayout = useDraft ? draft : published;

  if (useDraft) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const resolved = await resolveHomepageData(targetLayout);
    return res.status(200).json({
      success: true,
      data: resolved,
      isPreview: true,
    });
  }

  // Caching: short TTL 30-60s, ETag, 304 revalidation
  const etag = `W/"homepage-${targetLayout.version}-${new Date(targetLayout.publishedAt || 0).getTime()}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const resolved = await resolveHomepageData(targetLayout);

  res.status(200).json({
    success: true,
    data: resolved,
    isPreview: false,
  });
});

// @desc    Get active hero slides for carousel
// @route   GET /api/hero-slides or GET /api/v1/home/hero-slides
// @access  Public
export const getPublicHeroSlides = asyncHandler(async (req, res) => {
  const { preview, token } = req.query;
  let showAllActive = false;

  if (preview === 'true' && token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        showAllActive = true;
      }
    } catch {
      // ignore
    }
  }

  const slides = await HeroSlide.find({
    ...(showAllActive ? {} : { status: 'active' }),
  })
    .sort({ position: 1, createdAt: -1 })
    .lean();

  const now = new Date();
  const activeSlides = slides.filter((slide) => {
    if (showAllActive) return true;
    return deriveSlideStatus(slide, now) === 'Active';
  });

  const formatted = await Promise.all(
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

      let mobileVariants = [];
      if (s.mobileImage) {
        mobileVariants = buildImageVariants(s.mobileImage);
      }

      const srcSet = buildSrcSet(variants, s.image);
      const mobileSrcSet = s.mobileImage ? buildSrcSet(mobileVariants, s.mobileImage) : '';

      const rawFit = s.imageFit || 'cover';
      const aspectRatio = width && height ? Number((width / height).toFixed(3)) : null;
      const effectiveFit = rawFit === 'contain' ? 'contain' : 'cover';

      return {
        id: String(s._id),
        _id: String(s._id),
        headline: s.headline,
        subheadline: s.subheadline,
        image: s.image,
        imageUrl: s.image,
        mobileImage: s.mobileImage || '',
        imageFit: rawFit,
        effectiveFit,
        imagePosition: s.imagePosition || 'right',
        focalPointX: typeof s.focalPointX === 'number' ? s.focalPointX : 50,
        focalPointY: typeof s.focalPointY === 'number' ? s.focalPointY : 50,
        variants,
        srcSet,
        mobileSrcSet,
        width,
        height,
        aspectRatio,
        buttonLabel: s.buttonLabel || 'Shop Now',
        buttonLink: s.buttonLink || '/shop',
        position: s.position,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: formatted,
  });
});

// @desc    Track hero slide impressions and clicks
// @route   POST /api/track/hero
// @access  Public (Telemetry)
export const trackHeroSlideEvent = asyncHandler(async (req, res) => {
  const { slideId, event } = req.body;

  // Bot filtering
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(userAgent);
  if (isBot) {
    return res.status(204).end();
  }

  if (!slideId || !['impression', 'click'].includes(event)) {
    return res.status(400).json({ success: false, message: 'Invalid tracking event payload' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const incField = event === 'impression' ? 'impressions' : 'clicks';

  await HeroSlideStat.findOneAndUpdate(
    { slide: slideId, date: todayStr },
    { $inc: { [incField]: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ success: true });
});

// @desc    Subscribe to store newsletter (Double opt-in with honeypot)
// @route   POST /api/v1/newsletter/subscribe or POST /api/v1/home/subscribe
// @access  Public
export const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email, hp_source, website } = req.body || {};

  // Honeypot check: silent 200 response for bots
  if (hp_source || website) {
    return res.status(200).json({
      success: true,
      message: 'Thank you for subscribing to The NovaShop Journal.',
    });
  }

  if (!email || typeof email !== 'string') {
    throw new ApiError(400, 'A valid email address is required.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }

  let subscriber = await Subscriber.findOne({ email: cleanEmail });

  if (subscriber && subscriber.status === 'subscribed') {
    return res.status(200).json({
      success: true,
      alreadySubscribed: true,
      message: 'You are already subscribed to NovaShop Journal.',
    });
  }

  const doubleOptIn = process.env.NEWSLETTER_DOUBLE_OPT_IN === 'true' || req.body?.doubleOptIn === true;

  if (doubleOptIn) {
    const rawConfirmToken = crypto.randomBytes(32).toString('hex');
    const hashedConfirmToken = crypto
      .createHash('sha256')
      .update(rawConfirmToken)
      .digest('hex');
    const confirmExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    if (subscriber) {
      subscriber.status = 'pending';
      subscriber.confirmToken = hashedConfirmToken;
      subscriber.confirmExpires = confirmExpires;
      if (!subscriber.unsubscribeToken) {
        subscriber.unsubscribeToken = crypto.randomBytes(24).toString('hex');
      }
      await subscriber.save();
    } else {
      const unsubscribeToken = crypto.randomBytes(24).toString('hex');
      subscriber = await Subscriber.create({
        email: cleanEmail,
        status: 'pending',
        source: req.body?.source || 'homepage_newsletter',
        confirmToken: hashedConfirmToken,
        confirmExpires,
        unsubscribeToken,
      });
    }

    // Send double opt-in confirmation email
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const confirmUrl = `${frontendUrl}/newsletter/confirm?token=${rawConfirmToken}`;

      await sendEmail({
        to: cleanEmail,
        subject: 'Please confirm your subscription to The NovaShop Journal',
        text: `Thank you for your interest in The NovaShop Journal. Please confirm your subscription by opening the following link:\n\n${confirmUrl}\n\nThis confirmation link expires in 48 hours. If you did not request this, you may safely ignore this email.`,
        html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1A1A1A; background-color: #FDFBF7; border: 1px solid #E6E2DC;">
          <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #78716C; display: block; margin-bottom: 12px;">THE NOVASHOP JOURNAL</span>
          <h2 style="font-size: 24px; font-weight: 400; font-family: Georgia, serif; font-style: italic; letter-spacing: -0.02em; margin: 0 0 16px; color: #1C1917;">Confirm your subscription</h2>
          <p style="font-size: 14px; line-height: 1.7; color: #44403C; margin: 0 0 24px;">
            Thank you for requesting to join The NovaShop Journal. To finalize your subscription and receive private access to seasonal collections, editorial stories, and exclusive releases, please confirm below:
          </p>
          <div style="margin: 28px 0;">
            <a href="${confirmUrl}" style="background-color: #1C1917; color: #FDFBF7; text-decoration: none; padding: 13px 28px; font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; display: inline-block;">
              Confirm Subscription
            </a>
          </div>
          <p style="font-size: 12px; line-height: 1.6; color: #78716C; margin: 24px 0 0;">
            Or copy and paste this link into your browser:<br />
            <a href="${confirmUrl}" style="color: #1C1917; word-break: break-all;">${confirmUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #E6E2DC; margin: 32px 0 16px;" />
          <p style="font-size: 11px; color: #A8A29E; line-height: 1.5; margin: 0;">
            This link is valid for 48 hours. If you did not sign up for The NovaShop Journal, no action is needed.
          </p>
        </div>
      `,
      });
    } catch (emailErr) {
      console.error('Failed to dispatch newsletter confirmation email:', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      pendingConfirmation: true,
      message: 'Please check your inbox to confirm your subscription to The NovaShop Journal.',
    });
  }

  // Single opt-in (default): immediate subscription
  if (subscriber) {
    subscriber.status = 'subscribed';
    subscriber.confirmedAt = new Date();
    subscriber.unsubscribedAt = null;
    subscriber.confirmToken = null;
    subscriber.confirmExpires = null;
    if (!subscriber.unsubscribeToken) {
      subscriber.unsubscribeToken = crypto.randomBytes(24).toString('hex');
    }
    await subscriber.save();
  } else {
    const unsubscribeToken = crypto.randomBytes(24).toString('hex');
    subscriber = await Subscriber.create({
      email: cleanEmail,
      status: 'subscribed',
      confirmedAt: new Date(),
      source: req.body?.source || 'homepage_newsletter',
      unsubscribeToken,
    });
  }

  // Send welcome email with working unsubscribe link and welcome code
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const unsubscribeUrl = `${frontendUrl}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;

    await sendEmail({
      to: subscriber.email,
      subject: 'Welcome to The NovaShop Journal',
      text: `Your subscription to The NovaShop Journal is confirmed. Use welcome code JOURNAL10 for 10% off your next order.\n\nTo unsubscribe at any time: ${unsubscribeUrl}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1A1A1A; background-color: #FDFBF7; border: 1px solid #E6E2DC;">
          <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #78716C; display: block; margin-bottom: 12px;">THE NOVASHOP JOURNAL</span>
          <h2 style="font-size: 24px; font-weight: 400; font-family: Georgia, serif; font-style: italic; letter-spacing: -0.02em; margin: 0 0 16px; color: #1C1917;">Welcome to NovaShop</h2>
          <p style="font-size: 14px; line-height: 1.7; color: #44403C; margin: 0 0 20px;">
            Your subscription has been confirmed. You will receive private access to seasonal edits, luxury new arrivals, and archival notes.
          </p>
          <div style="background-color: #F5F2EB; border: 1px dashed #D6D0C4; padding: 16px 20px; margin: 24px 0; text-align: center;">
            <span style="font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #78716C; display: block; margin-bottom: 6px;">YOUR WELCOME PRIVILEGE</span>
            <span style="font-size: 18px; font-weight: 700; letter-spacing: 0.12em; color: #1C1917;">JOURNAL10</span>
            <p style="font-size: 12px; color: #78716C; margin: 6px 0 0;">Enjoy 10% off your next curated order.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #E6E2DC; margin: 28px 0 16px;" />
          <p style="font-size: 11px; color: #A8A29E; line-height: 1.5; margin: 0;">
            You received this email because you confirmed your subscription to The NovaShop Journal.
            <br />
            <a href="${unsubscribeUrl}" style="color: #1C1917; text-decoration: underline;">Unsubscribe from these emails</a>
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Failed to dispatch welcome email:', emailErr.message);
  }

  res.status(200).json({
    success: true,
    message: 'Thank you for subscribing to The NovaShop Journal.',
  });
});

// @desc    Confirm store newsletter subscription (Double opt-in verification)
// @route   GET /api/v1/newsletter/confirm or GET /api/v1/home/newsletter/confirm
// @access  Public
export const confirmNewsletter = asyncHandler(async (req, res) => {
  const rawToken = req.query.token;
  if (!rawToken || typeof rawToken !== 'string') {
    throw new ApiError(400, 'Confirmation token is required.');
  }

  const hashedConfirmToken = crypto
    .createHash('sha256')
    .update(rawToken.trim())
    .digest('hex');

  const subscriber = await Subscriber.findOne({
    $or: [
      { confirmToken: hashedConfirmToken, confirmExpires: { $gt: Date.now() } },
      { confirmToken: rawToken.trim(), confirmExpires: { $gt: Date.now() } },
    ],
  });

  if (!subscriber) {
    throw new ApiError(400, 'Confirmation link is invalid or has expired.');
  }

  subscriber.status = 'subscribed';
  subscriber.confirmedAt = new Date();
  subscriber.confirmToken = null;
  subscriber.confirmExpires = null;
  subscriber.unsubscribedAt = null;
  await subscriber.save();

  // Send welcome email with working unsubscribe link and welcome code
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const unsubscribeUrl = `${frontendUrl}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;

    await sendEmail({
      to: subscriber.email,
      subject: 'Welcome to The NovaShop Journal',
      text: `Your subscription to The NovaShop Journal is confirmed. Use welcome code JOURNAL10 for 10% off your next order.\n\nTo unsubscribe at any time: ${unsubscribeUrl}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1A1A1A; background-color: #FDFBF7; border: 1px solid #E6E2DC;">
          <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #78716C; display: block; margin-bottom: 12px;">THE NOVASHOP JOURNAL</span>
          <h2 style="font-size: 24px; font-weight: 400; font-family: Georgia, serif; font-style: italic; letter-spacing: -0.02em; margin: 0 0 16px; color: #1C1917;">Welcome to NovaShop</h2>
          <p style="font-size: 14px; line-height: 1.7; color: #44403C; margin: 0 0 20px;">
            Your subscription has been confirmed. You will receive private access to seasonal edits, luxury new arrivals, and archival notes.
          </p>
          <div style="background-color: #F5F2EB; border: 1px dashed #D6D0C4; padding: 16px 20px; margin: 24px 0; text-align: center;">
            <span style="font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #78716C; display: block; margin-bottom: 6px;">YOUR WELCOME PRIVILEGE</span>
            <span style="font-size: 18px; font-weight: 700; letter-spacing: 0.12em; color: #1C1917;">JOURNAL10</span>
            <p style="font-size: 12px; color: #78716C; margin: 6px 0 0;">Enjoy 10% off your next curated order.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #E6E2DC; margin: 28px 0 16px;" />
          <p style="font-size: 11px; color: #A8A29E; line-height: 1.5; margin: 0;">
            You received this email because you confirmed your subscription to The NovaShop Journal.
            <br />
            <a href="${unsubscribeUrl}" style="color: #1C1917; text-decoration: underline;">Unsubscribe from these emails</a>
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Failed to dispatch welcome email:', emailErr.message);
  }

  res.status(200).json({
    success: true,
    message: 'Subscription confirmed! Welcome to The NovaShop Journal.',
  });
});

// @desc    Unsubscribe from store newsletter
// @route   GET /api/v1/newsletter/unsubscribe or GET /api/v1/home/unsubscribe
// @access  Public
export const unsubscribeNewsletter = asyncHandler(async (req, res) => {
  const token = req.query.token || req.body?.token;
  if (!token) {
    throw new ApiError(400, 'Unsubscribe token is required.');
  }

  const subscriber = await Subscriber.findOne({ unsubscribeToken: String(token).trim() });
  if (!subscriber) {
    throw new ApiError(404, 'Subscriber record not found or link has expired.');
  }

  subscriber.status = 'unsubscribed';
  subscriber.unsubscribedAt = new Date();
  await subscriber.save();

  res.status(200).json({
    success: true,
    message: 'You have been successfully unsubscribed from NovaShop emails.',
  });
});
