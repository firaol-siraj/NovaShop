import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// Protect private routes
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Not authorized, no token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user and attach to request object (excluding password)
    req.user = await User.findById(decoded.id).select('-password -refreshToken +tokenVersion');

    if (!req.user) {
      return next(new ApiError(401, 'The user associated with this token no longer exists'));
    }

    if ((decoded.tokenVersion ?? 0) !== (req.user.tokenVersion ?? 0)) {
      return next(new ApiError(401, 'Not authorized, invalid or expired token'));
    }

    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authorized, invalid or expired token'));
  }
});

// Restrict routes to specific roles (e.g., admin)
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'You do not have permission to perform this action')
      );
    }
    next();
  };
};