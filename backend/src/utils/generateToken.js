import jwt from 'jsonwebtoken'; // Import jsonwebtoken library

// Generates a short-lived access token for authorization headers (15-minute lifespan)
export const generateAccessToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

// Generates a long-lived refresh token (7-day lifespan by default)
export const generateRefreshToken = (userId, expiresIn = '7d') => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
};

// Helper function to send the refresh token securely via an HTTP-Only cookie
export const sendRefreshTokenCookie = (res, refreshToken, maxAge = 7 * 24 * 60 * 60 * 1000) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
  if (maxAge) {
    options.maxAge = maxAge;
  }
  res.cookie('refreshToken', refreshToken, options);
};