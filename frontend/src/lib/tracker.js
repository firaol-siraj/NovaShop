/**
 * NovaShop Storefront Privacy-First Anonymous Telemetry Tracker
 *
 * - Anonymous session identifier in localStorage / cookie
 * - No personal data (PII) is transmitted
 * - Respects browser Do-Not-Track (DNT: 1) setting
 * - Rate-limited & bot-filtered on the backend
 */

const SESSION_KEY = 'novashop_session_id';
const SESSION_TIMESTAMP_KEY = 'novashop_session_last_active';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/**
 * Generates an anonymous random UUIDv4
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns or creates the current anonymous session ID
 */
export function getSessionId() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    const lastActive = Number(localStorage.getItem(SESSION_TIMESTAMP_KEY)) || 0;
    const isExpired = Date.now() - lastActive > SESSION_TIMEOUT_MS;

    if (existing && !isExpired) {
      localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
      return existing;
    }

    // Generate fresh session
    const newSessionId = generateUUID();
    localStorage.setItem(SESSION_KEY, newSessionId);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
    return newSessionId;
  } catch {
    return generateUUID();
  }
}

/**
 * Detects device category from viewport width and user agent
 */
function getDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

/**
 * Parses UTM query parameters from current URL
 */
function getUtmParams() {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
    };
  } catch {
    return {};
  }
}

/**
 * Checks if browser has Do-Not-Track enabled
 */
function isDntEnabled() {
  if (typeof navigator === 'undefined') return false;
  return (
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1'
  );
}

/**
 * Core event sender (uses fetch with keepalive or navigator.sendBeacon)
 */
async function sendEvent(eventType, details = {}) {
  if (isDntEnabled()) return;

  const sessionId = getSessionId();
  const utm = getUtmParams();

  const payload = {
    sessionId,
    eventType,
    referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
    landingPage: typeof window !== 'undefined' ? window.location.pathname : '',
    path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
    deviceType: getDeviceType(),
    ...utm,
    ...details,
  };

  try {
    // Standard endpoint: /api/track or /api/v1/track
    const trackUrl = `${API_BASE.replace(/\/v1$/, '')}/track`;
    await fetch(trackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Non-blocking telemetry failure is quietly ignored
  }
}

/**
 * Initializes storefront tracker and records session_start
 */
export function initTracker() {
  if (typeof window === 'undefined') return;

  // Don't track inside admin panel
  if (window.location.pathname.startsWith('/admin')) return;

  const hasFiredThisSession = sessionStorage.getItem('novashop_session_started');
  if (!hasFiredThisSession) {
    sessionStorage.setItem('novashop_session_started', 'true');
    void sendEvent('session_start');
  }
}

/**
 * Track single product view
 */
export function trackProductView(product) {
  if (!product) return;
  void sendEvent('product_view', {
    productId: product._id || product.id,
    productName: product.name,
    productCategory: typeof product.category === 'object' ? product.category?.name : product.category,
    metadata: { price: product.price },
  });
}

/**
 * Track add to bag / cart event
 */
export function trackAddToCart(item) {
  if (!item) return;
  void sendEvent('add_to_cart', {
    productId: item.product?._id || item.productId || item._id,
    productName: item.name || item.product?.name,
    metadata: {
      qty: item.qty || item.quantity || 1,
      price: item.price,
    },
  });
}

/**
 * Track begin checkout step
 */
export function trackBeginCheckout(cartTotal, itemCount) {
  void sendEvent('begin_checkout', {
    metadata: {
      cartTotal,
      itemCount,
    },
  });
}

export default {
  initTracker,
  getSessionId,
  trackProductView,
  trackAddToCart,
  trackBeginCheckout,
};
