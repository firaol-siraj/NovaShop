import jwt from 'jsonwebtoken';

// Generates a short-lived access token for authorization headers (15-minute lifespan)
// Now includes role in JWT payload to support role-based session isolation
export const generateAccessToken = (userId, tokenVersion = 0, role = 'customer') => {
  return jwt.sign({ id: userId, tokenVersion, role }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

// Generates a long-lived refresh token (7-day lifespan by default)
export const generateRefreshToken = (userId, expiresIn = '7d', role = 'customer') => {
  return jwt.sign({ id: userId, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
};

// Helper to compute unified, production-ready cookie security attributes
export const getCookieOptions = (maxAge = null) => {
  const isProd = process.env.NODE_ENV === 'production';
  const rawSameSite = (process.env.COOKIE_SAME_SITE || 'strict').toLowerCase();
  const sameSite = ['strict', 'lax', 'none'].includes(rawSameSite) ? rawSameSite : 'strict';
  const secure = isProd || sameSite === 'none';

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  if (maxAge !== null && maxAge !== undefined) {
    options.maxAge = maxAge;
  }

  return options;
};

// Helper function to send the refresh token securely via an HTTP-Only cookie with role-specific cookie name
export const sendRefreshTokenCookie = (
  res,
  refreshToken,
  maxAge = 7 * 24 * 60 * 60 * 1000,
  role = 'customer'
) => {
  const cookieName = role === 'admin' ? 'nova_admin_session' : 'nova_customer_session';
  const options = getCookieOptions(maxAge);
  res.cookie(cookieName, refreshToken, options);
};

export const clearRefreshTokenCookie = (res, role = 'customer') => {
  const cookieName = role === 'admin' ? 'nova_admin_session' : 'nova_customer_session';
  const cookieOptions = getCookieOptions();
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie(cookieName, cookieOptions);
};
