import AnalyticsEvent from '../models/analyticsEventModel.js';
import { deriveTrafficChannel } from '../utils/analyticsMetrics.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

const BOT_USER_AGENTS = [
  'bot',
  'crawler',
  'spider',
  'headless',
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'exabot',
  'facebookexternalhit',
  'whatsapp',
  'twitterbot',
];

export const trackEvent = asyncHandler(async (req, res) => {
  // 1. Respect Do-Not-Track request header
  const dnt = req.headers['dnt'] || req.headers['x-do-not-track'];
  if (dnt === '1') {
    return res.status(204).end();
  }

  // 2. Filter automated search/crawler bots
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = BOT_USER_AGENTS.some((bot) => userAgent.includes(bot));
  if (isBot) {
    return res.status(204).end();
  }

  const {
    sessionId,
    eventType,
    referrer = '',
    utmSource = '',
    utmMedium = '',
    utmCampaign = '',
    landingPage = '',
    path = '',
    deviceType = 'desktop',
    productId = null,
    productName = '',
    productCategory = '',
    metadata = {},
  } = req.body;

  const trafficChannel = deriveTrafficChannel({
    referrer,
    utmSource,
    utmMedium,
  });

  try {
    await AnalyticsEvent.create({
      sessionId,
      eventType,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      trafficChannel,
      landingPage,
      path,
      deviceType,
      productId: productId || null,
      productName,
      productCategory,
      metadata,
    });
  } catch (err) {
    logger.warn(`[Tracking] Error recording analytics event: ${err.message}`);
  }

  return res.status(200).json({ success: true });
});
