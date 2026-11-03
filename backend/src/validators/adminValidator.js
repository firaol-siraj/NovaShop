import Joi from 'joi';
import { isValidPhoneNumber } from '../utils/phone.js';

export const summaryQuerySchema = Joi.object({
  from: Joi.date().iso().optional().messages({
    'date.format': '"from" must be a valid ISO-8601 date string',
  }),
  to: Joi.date().iso().min(Joi.ref('from')).optional().messages({
    'date.format': '"to" must be a valid ISO-8601 date string',
    'date.min': '"to" date must be equal to or later than "from" date',
  }),
});

export const revenueQuerySchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional(),
  interval: Joi.string().valid('day', 'week', 'month').default('day').optional(),
});

export const topProductsQuerySchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional(),
  limit: Joi.number().integer().min(1).max(50).default(5).optional(),
});

export const inventoryAlertsQuerySchema = Joi.object({
  threshold: Joi.number().integer().min(0).max(100).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
});

export const fulfillmentQueueQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).optional(),
});

export const dispatchOrdersSchema = Joi.object({
  orderIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  note: Joi.string().trim().max(500).allow('').optional(),
  carrier: Joi.string().trim().max(100).allow('').optional(),
  trackingNumberPrefix: Joi.string().trim().max(50).allow('').optional(),
});

export const adminOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(6).optional(),
  search: Joi.string().trim().allow('').max(100).optional(),
  status: Joi.string().trim().allow('').max(50).optional(),
  customer: Joi.string().hex().length(24).allow('', null).optional(),
  discount: Joi.string().trim().max(100).allow('', null).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

export const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Search query is required',
    'any.required': 'Search query is required',
  }),
});

export const exportReportSchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional(),
  format: Joi.string().valid('csv', 'json').default('csv').optional(),
});

// ==========================================
// PRODUCTS VALIDATION SCHEMAS
// ==========================================

export const adminProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(500).default(10).optional(),
  search: Joi.string().trim().allow('').max(100).optional(),
  category: Joi.string().trim().allow('').max(100).optional(),
  product: Joi.string().hex().length(24).allow('', null).optional(),
  productId: Joi.string().hex().length(24).allow('', null).optional(),
  status: Joi.string().valid('all', 'active', 'draft', 'archived').default('all').optional(),
  stockState: Joi.string().valid('all', 'in_stock', 'low_stock', 'out_of_stock').default('all').optional(),
  sortBy: Joi.string().valid('createdAt', 'name', 'price', 'countInStock', 'sales').default('createdAt').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional(),
});

const variantItemSchema = Joi.object({
  id: Joi.string().allow('').optional(),
  _id: Joi.string().allow('').optional(),
  sku: Joi.string().trim().required().messages({
    'string.empty': 'Every variant must have a SKU',
    'any.required': 'Every variant must have a SKU',
  }),
  size: Joi.string().trim().required(),
  color: Joi.alternatives().try(
    Joi.object({
      name: Joi.string().trim().required(),
      hex: Joi.string().trim().default('#000000').optional(),
    }),
    Joi.string().trim()
  ).required(),
  stock: Joi.number().integer().min(0).required().messages({
    'number.min': 'Stock must be greater than or equal to 0',
    'any.required': 'Stock quantity per variant is required',
  }),
  price: Joi.number().min(0).allow(null).optional(),
  lowStockThreshold: Joi.number().integer().min(0).allow(null).optional(),
  image: Joi.string().allow('').optional(),
});

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  slug: Joi.string().trim().max(200).allow('').optional(),
  description: Joi.string().trim().min(5).required(),
  category: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Category must be a valid category ID',
    'any.required': 'Category selection is required',
  }),
  brand: Joi.string().trim().max(100).default('NovaShop').optional(),
  price: Joi.number().min(0).required(),
  status: Joi.string().valid('active', 'draft', 'archived').default('active').optional(),
  image: Joi.string().uri().allow('').optional(),
  images: Joi.array().items(Joi.string().uri()).min(1).required().messages({
    'array.min': 'At least one product image is required',
  }),
  imagePublicIds: Joi.array().items(Joi.string()).optional(),
  variants: Joi.array().items(variantItemSchema).min(1).required().messages({
    'array.min': 'At least one variant (color & size with stock) is required',
  }),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).optional(),
  slug: Joi.string().trim().max(200).allow('').optional(),
  description: Joi.string().trim().min(5).optional(),
  category: Joi.string().hex().length(24).optional(),
  brand: Joi.string().trim().max(100).optional(),
  price: Joi.number().min(0).optional(),
  status: Joi.string().valid('active', 'draft', 'archived').optional(),
  image: Joi.string().uri().allow('').optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  imagePublicIds: Joi.array().items(Joi.string()).optional(),
  variants: Joi.array().items(variantItemSchema).optional(),
});

export const bulkProductStatusSchema = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  status: Joi.string().valid('active', 'draft', 'archived').required(),
});

// ==========================================
// CATEGORIES VALIDATION SCHEMAS
// ==========================================

export const adminCategoriesQuerySchema = Joi.object({
  search: Joi.string().trim().allow('').max(100).optional(),
  status: Joi.string().valid('all', 'active', 'hidden').default('all').optional(),
});

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().max(100).allow('').optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  image: Joi.string().allow('').optional(),
  parent: Joi.string().hex().length(24).allow(null, '').optional(),
  status: Joi.string().valid('active', 'hidden').default('active').optional(),
  sortOrder: Joi.number().integer().default(0).optional(),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  slug: Joi.string().trim().max(100).allow('').optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  image: Joi.string().allow('').optional(),
  parent: Joi.string().hex().length(24).allow(null, '').optional(),
  status: Joi.string().valid('active', 'hidden').optional(),
  sortOrder: Joi.number().integer().optional(),
});

export const reorderCategoriesSchema = Joi.object({
  order: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().hex().length(24).required(),
        sortOrder: Joi.number().integer().required(),
      })
    )
    .min(1)
    .required(),
});

// ==========================================
// CUSTOMERS VALIDATION SCHEMAS
// ==========================================

export const adminCustomersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(500).default(10).optional(),
  search: Joi.string().trim().allow('').max(100).optional(),
  customer: Joi.string().hex().length(24).allow('', null).optional(),
  customerId: Joi.string().hex().length(24).allow('', null).optional(),
  status: Joi.string().valid('all', 'active', 'deactivated', 'blocked', 'invited', 'inactive').default('all').optional(),
  hasOrders: Joi.string().valid('all', 'yes', 'no').default('all').optional(),
  sortBy: Joi.string().valid('createdAt', 'name', 'spent', 'ordersCount', 'lastOrderDate').default('createdAt').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional(),
});

export const updateCustomerStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'deactivated', 'blocked').required(),
  reason: Joi.string().trim().max(500).allow('').optional(),
});

export const updateCustomerProfileSchema = Joi.object({
  firstName: Joi.string().trim().max(60).allow('').optional(),
  lastName: Joi.string().trim().max(60).allow('').optional(),
  name: Joi.string().trim().max(120).allow('').optional(),
  phone: Joi.string()
    .trim()
    .max(30)
    .allow('')
    .optional()
    .custom((val, helpers) => {
      if (!val) return val;
      if (!isValidPhoneNumber(val)) {
        return helpers.message('Please enter a valid phone number (e.g. +251 91 123 4567 or 0911234567).');
      }
      return val;
    }),
  country: Joi.string().trim().max(60).allow('').optional(),
  street: Joi.string().trim().max(200).allow('').optional(),
  street2: Joi.string().trim().max(200).allow('').optional(),
  city: Joi.string().trim().max(100).allow('').optional(),
  state: Joi.string().trim().max(100).allow('').optional(),
  postalCode: Joi.string().trim().max(30).allow('').optional(),
  internalNotes: Joi.string().trim().max(2000).allow('').optional(),
  marketingConsent: Joi.boolean().optional(),
  status: Joi.string().valid('active', 'deactivated', 'blocked', 'invited', 'inactive').optional(),
});

export const createCustomerSchema = Joi.object({
  firstName: Joi.string().trim().max(60).required(),
  lastName: Joi.string().trim().max(60).allow('').optional(),
  name: Joi.string().trim().max(120).optional(),
  email: Joi.string().email().lowercase().trim().required(),
  phone: Joi.string()
    .trim()
    .max(30)
    .allow('')
    .optional()
    .custom((val, helpers) => {
      if (!val) return val;
      if (!isValidPhoneNumber(val)) {
        return helpers.message('Please enter a valid phone number (e.g. +251 91 123 4567 or 0911234567).');
      }
      return val;
    }),
  country: Joi.string().trim().max(60).allow('').optional(),
  street: Joi.string().trim().max(200).allow('').optional(),
  street2: Joi.string().trim().max(200).allow('').optional(),
  city: Joi.string().trim().max(100).allow('').optional(),
  state: Joi.string().trim().max(100).allow('').optional(),
  postalCode: Joi.string().trim().max(30).allow('').optional(),
  internalNotes: Joi.string().trim().max(2000).allow('').optional(),
  marketingConsent: Joi.boolean().default(false).optional(),
  status: Joi.string().valid('active', 'invited').default('active').optional(),
});

export const sendCustomerEmailSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(200).required(),
  message: Joi.string().trim().min(5).max(10000).required(),
  template: Joi.string().trim().max(50).allow('').optional(),
  orderId: Joi.string().hex().length(24).allow(null, '').optional(),
  idempotencyKey: Joi.string().trim().max(100).allow('', null).optional(),
});

// ==========================================
// INVENTORY VALIDATION SCHEMAS
// ==========================================

export const adminInventoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(500).default(10).optional(),
  search: Joi.string().trim().allow('').max(100).optional(),
  category: Joi.string().trim().allow('').max(100).optional(),
  stockState: Joi.string().valid('all', 'in_stock', 'low', 'critical', 'out_of_stock').default('all').optional(),
  sortBy: Joi.string().valid('urgency', 'stock', 'sku', 'name', 'updatedAt').default('urgency').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional(),
});

export const adjustStockSchema = Joi.object({
  variantId: Joi.string().hex().length(24).required(),
  mode: Joi.string().valid('set', 'delta').default('delta').optional(),
  value: Joi.number().integer().required(),
  reason: Joi.string().trim().min(3).max(500).required().messages({
    'string.empty': 'A reason for adjusting stock is required',
    'any.required': 'A reason for adjusting stock is required',
  }),
});

export const bulkRestockSchema = Joi.object({
  preview: Joi.boolean().default(false).optional(),
  rows: Joi.array()
    .items(
      Joi.object({
        sku: Joi.string().trim().required(),
        quantity: Joi.number().integer().min(1).required(),
        reason: Joi.string().trim().allow('').max(200).optional(),
      })
    )
    .min(1)
    .required(),
});

export const inventorySettingsSchema = Joi.object({
  lowStockThreshold: Joi.number().integer().min(0).max(1000).required(),
});

export const variantThresholdSchema = Joi.object({
  lowStockThreshold: Joi.number().integer().min(0).max(10000).required(),
});

// ==========================================
// NOTIFICATIONS VALIDATION SCHEMAS
// ==========================================

export const adminNotificationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(15).optional(),
  type: Joi.string().valid('all', 'new_order', 'low_stock', 'failed_payment', 'new_customer', 'system', 'new_ticket', 'support_reply').default('all').optional(),
  unreadOnly: Joi.boolean().optional(),
});

// ==========================================
// ADMIN PROFILE VALIDATION SCHEMAS
// ==========================================

export const updateAdminMeSchema = Joi.object({
  firstName: Joi.string().trim().max(60).allow('').optional(),
  lastName: Joi.string().trim().max(60).allow('').optional(),
  displayName: Joi.string().trim().max(100).allow('').optional(),
  phone: Joi.string()
    .trim()
    .max(30)
    .allow('')
    .optional()
    .custom((val, helpers) => {
      if (!val) return val;
      if (!isValidPhoneNumber(val)) {
        return helpers.message('Please enter a valid phone number (e.g. +251 91 123 4567 or 0911234567).');
      }
      return val;
    }),
  jobTitle: Joi.string().trim().max(100).allow('').optional(),
  bio: Joi.string().trim().max(500).allow('').optional(),
  language: Joi.string().trim().max(50).optional(),
  timezone: Joi.string().trim().max(80).optional(),
  email: Joi.string().email().trim().optional(),
  currentPassword: Joi.string().min(1).optional(),
});

export const updateAdminPasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(128).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Confirm password must match new password',
  }),
});
