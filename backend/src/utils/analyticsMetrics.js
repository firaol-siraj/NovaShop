import Setting from '../models/settingModel.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../constants/orderConstants.js';

export const DEFAULT_STORE_TIMEZONE = 'Africa/Addis_Ababa';
export const DEFAULT_DISPLAY_CURRENCY = 'USD';

/**
 * Resolves date boundaries for query period and preceding comparison period of equal length
 */
export function resolveAnalyticsPeriod(fromQuery, toQuery) {
  const now = new Date();
  let currentStart;
  let currentEnd;

  if (fromQuery && toQuery) {
    currentStart = new Date(fromQuery);
    currentEnd = new Date(toQuery);
  } else if (fromQuery && !toQuery) {
    currentStart = new Date(fromQuery);
    currentEnd = new Date(now);
  } else {
    // Default: Last 30 days
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    currentEnd = new Date(now);
  }

  if (isNaN(currentStart.getTime())) {
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (isNaN(currentEnd.getTime())) {
    currentEnd = new Date(now);
  }

  // Ensure currentEnd is not earlier than currentStart
  if (currentEnd.getTime() < currentStart.getTime()) {
    const temp = currentStart;
    currentStart = currentEnd;
    currentEnd = temp;
  }

  const durationMs = Math.max(1000, currentEnd.getTime() - currentStart.getTime());
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  const durationDays = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));

  return {
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
    durationDays,
    durationMs,
  };
}

/**
 * Returns the configured store timezone and its human-readable display label
 */
export async function getStoreTimezone() {
  let tz = DEFAULT_STORE_TIMEZONE;
  try {
    const stored = await Setting.getSetting('storeTimezone');
    if (stored && typeof stored === 'string') {
      tz = stored.trim();
    } else if (process.env.STORE_TIMEZONE) {
      tz = process.env.STORE_TIMEZONE.trim();
    }
  } catch {
    tz = DEFAULT_STORE_TIMEZONE;
  }

  let label = 'EAT (STORE TIME)';
  if (tz === 'Africa/Addis_Ababa' || tz.includes('Addis_Ababa')) {
    label = 'EAT (STORE TIME)';
  } else if (tz === 'UTC' || tz === 'Etc/UTC') {
    label = 'UTC (STORE TIME)';
  } else if (tz.includes('Europe/Berlin') || tz.includes('Europe/Paris') || tz === 'CET') {
    label = 'CET (STORE TIME)';
  } else {
    label = `${tz} (STORE TIME)`;
  }

  return { timezone: tz, timezoneLabel: label };
}

/**
 * Calculates percentage trend comparison vs previous period safely
 * Returns null if previous value was <= 0 to avoid NaN or +Infinity
 */
export function calculateTrend(current, previous) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (prev <= 0) {
    return {
      trend: null,
      formattedTrend: '-',
      positive: curr >= 0,
    };
  }

  const change = Number((((curr - prev) / prev) * 100).toFixed(1));
  const isPositive = change >= 0;
  const formattedTrend = `${isPositive ? '+' : ''}${change}%`;

  return {
    trend: change,
    formattedTrend,
    positive: isPositive,
  };
}

/**
 * Derives acquisition channel category from referrer and UTM parameters
 */
export function deriveTrafficChannel({ referrer = '', utmSource = '', utmMedium = '' }) {
  const ref = (referrer || '').toLowerCase();
  const source = (utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();

  // 1. Paid
  if (
    medium.includes('cpc') ||
    medium.includes('ppc') ||
    medium.includes('paid') ||
    medium.includes('ad') ||
    source.includes('adwords') ||
    source.includes('meta-ads') ||
    source.includes('facebook-ads')
  ) {
    return 'Paid';
  }

  // 2. Email
  if (
    medium.includes('email') ||
    medium.includes('newsletter') ||
    source.includes('email') ||
    source.includes('newsletter') ||
    ref.includes('mail.google.com') ||
    ref.includes('outlook.') ||
    ref.includes('mail.yahoo.com')
  ) {
    return 'Email';
  }

  // 3. Social
  const socialDomains = [
    'facebook.com',
    'instagram.com',
    't.co',
    'twitter.com',
    'x.com',
    'tiktok.com',
    'linkedin.com',
    'pinterest.com',
    'youtube.com',
    'reddit.com',
    'telegram.me',
    't.me',
  ];
  if (
    medium.includes('social') ||
    socialDomains.some((d) => ref.includes(d)) ||
    socialDomains.some((d) => source.includes(d.split('.')[0]))
  ) {
    return 'Social';
  }

  // 4. Organic search
  const searchEngines = [
    'google.',
    'bing.',
    'yahoo.',
    'duckduckgo.',
    'ecosia.',
    'yandex.',
    'baidu.',
  ];
  if (
    medium.includes('organic') ||
    searchEngines.some((engine) => ref.includes(engine))
  ) {
    return 'Organic search';
  }

  // 5. Referral
  if (ref && !ref.includes('localhost') && !ref.includes('127.0.0.1')) {
    return 'Referral';
  }

  // 6. Direct
  return 'Direct';
}

/**
 * Computes 5 intensity levels (0 to 4) from real data matrix using quantiles
 */
export function computeHeatmapIntensity(matrix) {
  const flatCounts = matrix.flat().filter((val) => val > 0);

  if (flatCounts.length === 0) {
    return matrix.map((row) => row.map(() => 0));
  }

  flatCounts.sort((a, b) => a - b);
  const q1 = flatCounts[Math.floor(flatCounts.length * 0.25)] || 1;
  const q2 = flatCounts[Math.floor(flatCounts.length * 0.50)] || q1;
  const q3 = flatCounts[Math.floor(flatCounts.length * 0.75)] || q2;
  const q4 = flatCounts[Math.floor(flatCounts.length * 0.90)] || q3;

  return matrix.map((row) =>
    row.map((val) => {
      if (val === 0) return 0;
      if (val <= q1) return 1;
      if (val <= q2) return 2;
      if (val <= q3) return 3;
      return 4;
    })
  );
}

/**
 * Normalizes payment method name for UI display
 */
export function normalizePaymentMethodLabel(rawMethod) {
  if (!rawMethod) return 'Other';
  const m = String(rawMethod).toLowerCase().trim();
  if (m.includes('telebirr') || m === 'tele') return 'Telebirr';
  if (m.includes('cbe') || m.includes('cbebirr')) return 'CBE Birr';
  if (m.includes('mpesa') || m.includes('m-pesa')) return 'M-Pesa';
  if (m.includes('card') || m.includes('visa') || m.includes('mastercard')) return 'Card';
  if (m.includes('apple') || m.includes('applepay')) return 'Apple Pay';
  if (m.includes('paypal')) return 'PayPal';
  if (m.includes('bank') || m.includes('transfer')) return 'Bank transfer';
  if (m === 'cash' || m.includes('delivery') || m === 'cod') return 'Cash on Delivery';
  if (m === 'chapa') return 'Chapa (Digital)';
  return rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1);
}

/**
 * Determines whether a payment method is digital instant checkout
 */
export function isDigitalPaymentMethod(methodLabel) {
  const digitalMethods = ['Telebirr', 'CBE Birr', 'M-Pesa', 'Card', 'Apple Pay', 'PayPal', 'Bank transfer', 'Chapa', 'Chapa (Digital)'];
  return digitalMethods.includes(methodLabel);
}

/**
 * Builds standard MongoDB aggregation match criteria for paid orders in a period
 */
export function buildPaidOrdersMatch(start, end) {
  return {
    $match: {
      isPaid: true,
      paidAt: { $gte: start, $lte: end },
      paymentStatus: { $ne: PAYMENT_STATUS.CANCELLED },
    },
  };
}

/**
 * Format currency in USD with commas
 */
export function formatUSD(amount, fractionDigits = 0) {
  const num = Number(amount) || 0;
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export { getProductStockStatus, analyzeVariantStock } from './stockUtils.js';
export { getSharedDiscountAnalytics } from '../services/discountService.js';
