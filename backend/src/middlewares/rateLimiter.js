import rateLimit from 'express-rate-limit';

// General API rate limiter (2000 requests per 15 minutes per IP)
// High capacity to comfortably support rich SPA navigation, catalogue browsing, and admin polling
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing') return true;
    const url = req.originalUrl || req.path || '';
    // Never rate-limit critical payment webhooks, health checks, or telemetry impressions
    if (url.includes('/webhook') || url.includes('/track') || url === '/health') {
      return true;
    }
    return false;
  },
  message: {
    success: false,
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter specifically for credential-sensitive authentication actions (30 failed attempts per 15 mins)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  // Only count failed attempts (e.g. wrong passwords). Successful logins do not penalize users
  skipSuccessfulRequests: true,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing') return true;
    // Never rate-limit read operations, session verification (/me), token refreshes, or logout
    if (req.method === 'GET' || req.method === 'OPTIONS') return true;
    const url = req.originalUrl || req.path || '';
    if (
      url.includes('/me') ||
      url.includes('/refresh-token') ||
      url.includes('/logout') ||
      url.includes('/verify-email')
    ) {
      return true;
    }
    return false;
  },
  message: {
    success: false,
    status: 429,
    message: 'Too many login/register attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
