import rateLimit from 'express-rate-limit';

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing',
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth routes (10 attempts per hour)
export const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing',
  message: {
    success: false,
    status: 429,
    message: 'Too many login/register attempts. Please try again in an hour.',
  },
});