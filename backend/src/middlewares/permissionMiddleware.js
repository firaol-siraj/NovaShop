import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const ADMIN_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPPORT: 'support',
  VIEWER: 'viewer',
};

// Resource x Action permission definitions
export const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.OWNER]: {
    orders: ['read', 'write'],
    products: ['read', 'write'],
    inventory: ['read', 'write'],
    customers: ['read', 'write'],
    support: ['read', 'write'],
    payments: ['read', 'write'],
    analytics: ['read', 'write'],
    discounts: ['read', 'write'],
    content: ['read', 'write'],
    returns: ['read', 'write'],
    shipping: ['read', 'write'],
    reviews: ['read', 'write'],
    settings: ['read', 'write', 'team'],
  },
  [ADMIN_ROLES.ADMIN]: {
    orders: ['read', 'write'],
    products: ['read', 'write'],
    inventory: ['read', 'write'],
    customers: ['read', 'write'],
    support: ['read', 'write'],
    payments: ['read', 'write'],
    analytics: ['read', 'write'],
    discounts: ['read', 'write'],
    content: ['read', 'write'],
    returns: ['read', 'write'],
    shipping: ['read', 'write'],
    reviews: ['read', 'write'],
    settings: ['read', 'write'], // cannot manage team roles
  },
  [ADMIN_ROLES.MANAGER]: {
    orders: ['read', 'write'],
    products: ['read', 'write'],
    inventory: ['read', 'write'],
    customers: ['read', 'write'],
    support: ['read', 'write'],
    payments: ['read'],
    analytics: ['read'],
    discounts: ['read', 'write'],
    content: ['read', 'write'],
    returns: ['read', 'write'],
    shipping: ['read', 'write'],
    reviews: ['read', 'write'],
    settings: [],
  },
  [ADMIN_ROLES.SUPPORT]: {
    orders: ['read'],
    products: ['read'],
    inventory: ['read'],
    customers: ['read'],
    support: ['read', 'write'],
    payments: [],
    analytics: [],
    discounts: [],
    content: [],
    returns: ['read', 'write'],
    shipping: [],
    reviews: ['read', 'write'],
    settings: [],
  },
  [ADMIN_ROLES.VIEWER]: {
    orders: [],
    products: ['read'],
    inventory: [],
    customers: [],
    support: [],
    payments: [],
    analytics: [],
    discounts: [],
    content: ['read', 'write'],
    returns: [],
    shipping: [],
    reviews: ['read'],
    settings: [],
  },
};

/**
 * Middleware enforcing RBAC permissions on admin routes
 * @param {string} resource e.g. 'orders', 'products', 'settings', 'support'
 * @param {string} action e.g. 'read', 'write', 'team'
 */
export const requirePermission = (resource, action = 'read') => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ApiError(403, 'Administrator access required'));
    }

    const effectiveRole = req.user.adminRole || 'owner';

    // Owners have unconstrained authority
    if (effectiveRole === ADMIN_ROLES.OWNER) {
      return next();
    }

    const allowedActions = ROLE_PERMISSIONS[effectiveRole]?.[resource] || [];

    // 'write' permission satisfies 'create', 'update', 'delete', 'patch', and 'email' requests
    const isWriteAction = ['write', 'create', 'update', 'delete', 'patch', 'email'].includes(action);
    const hasPermission =
      allowedActions.includes(action) ||
      (allowedActions.includes('write') && (isWriteAction || action === 'read')) ||
      (action === 'read' && allowedActions.includes('write')) ||
      (allowedActions.includes('*'));

    if (!hasPermission) {
      return next(
        new ApiError(
          403,
          `Access Denied: Your role (${effectiveRole}) lacks ${action} permission for ${resource}.`
        )
      );
    }

    next();
  });
};
