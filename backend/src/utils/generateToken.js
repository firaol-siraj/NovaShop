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

// Helper function to send the refresh token securely via an HTTP-Only cookie with role-specific cookie name
export const sendRefreshTokenCookie = (
  res,
  refreshToken,
  maxAge = 7 * 24 * 60 * 60 * 1000,
  role = 'customer'
) => {
  const cookieName = role === 'admin' ? 'nova_admin_session' : 'nova_customer_session';
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
  if (maxAge) {
    options.maxAge = maxAge;
  }
  res.cookie(cookieName, refreshToken, options);
};

export const clearRefreshTokenCookie = (res, role = 'customer') => {
  const cookieName = role === 'admin' ? 'nova_admin_session' : 'nova_customer_session';
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie(cookieName, cookieOptions);
};
