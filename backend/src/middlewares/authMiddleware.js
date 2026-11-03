import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// Base protect middleware: verifies access token & attaches user
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query?.token) {
    token = req.query.token;
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

    if (req.user.status === 'deactivated' || req.user.isActive === false) {
      return next(new ApiError(401, 'Your account is currently deactivated. Please log in to reactivate.'));
    }

    req.tokenRole = decoded.role || req.user.role;

    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authorized, invalid or expired token'));
  }
});

// Protect customer-specific storefront endpoints: rejects admin tokens
export const protectCustomer = asyncHandler(async (req, res, next) => {
  return protect(req, res, (err) => {
    if (err) return next(err);
    if (req.tokenRole === 'admin' || (req.user && req.user.role === 'admin' && req.tokenRole !== 'customer')) {
      return next(
        new ApiError(403, 'Admin tokens cannot be used on customer storefront endpoints. Please use a customer session.')
      );
    }
    next();
  });
});

// Protect admin-specific endpoints: requires role=admin
export const protectAdmin = asyncHandler(async (req, res, next) => {
  return protect(req, res, (err) => {
    if (err) return next(err);
    if (req.user?.role !== 'admin' || req.tokenRole !== 'admin') {
      return next(
        new ApiError(403, 'Administrator access is required for this action')
      );
    }
    next();
  });
});

// Optional protect middleware: attaches user if valid token exists, proceeds as guest otherwise
export const protectOptional = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query?.token) {
    token = req.query.token;
  }
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -refreshToken +tokenVersion');
    req.tokenRole = decoded.role || req.user?.role;
  } catch {
    // Continue as guest
  }
  next();
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
