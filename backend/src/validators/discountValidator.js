import Joi from 'joi';

export const validateDiscountSchema = Joi.object({
  code: Joi.string().trim().required().messages({
    'string.empty': 'Please provide a discount code',
    'any.required': 'Discount code is required',
  }),
  items: Joi.array()
    .items(
      Joi.object({
        product: Joi.string().allow('', null).optional(),
        category: Joi.string().allow('', null).optional(),
        categories: Joi.array().items(Joi.string()).optional(),
        price: Joi.number().min(0).optional(),
        qty: Joi.number().integer().min(1).optional(),
        quantity: Joi.number().integer().min(1).optional(),
      })
    )
    .optional(),
  subtotal: Joi.number().min(0).optional(),
  shippingPrice: Joi.number().min(0).optional(),
  customerEmail: Joi.string().email().allow('', null).optional(),
});

export const createDiscountSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required().messages({
    'string.empty': 'Discount name is required',
    'any.required': 'Discount name is required',
  }),
  code: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9_-]+$/)
    .min(2)
    .max(30)
    .required()
    .messages({
      'string.pattern.base': 'Code can only contain alphanumeric characters, hyphens, and underscores',
      'string.empty': 'Discount code is required',
      'any.required': 'Discount code is required',
    }),
  method: Joi.string().valid('code', 'automatic').default('code'),
  type: Joi.string().valid('percentage', 'fixed_amount', 'free_shipping').required(),
  value: Joi.number().min(0).required(),
  appliesTo: Joi.string().valid('all_products', 'specific_categories', 'specific_products').default('all_products'),
  targetCategories: Joi.array().items(Joi.string().hex().length(24)).default([]),
  targetProducts: Joi.array().items(Joi.string().hex().length(24)).default([]),
  minimumSpend: Joi.number().min(0).allow(null).optional(),
  minimumQuantity: Joi.number().integer().min(0).allow(null).optional(),
  firstOrderOnly: Joi.boolean().default(false),
  usageLimit: Joi.number().integer().min(1).allow(null).optional(),
  perCustomerLimit: Joi.number().integer().min(1).allow(null).optional(),
  startsAt: Joi.date().iso().default(() => new Date()),
  endsAt: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('draft', 'active', 'disabled').default('active'),
  stackable: Joi.boolean().default(false),
});

export const updateDiscountSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  code: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9_-]+$/)
    .min(2)
    .max(30)
    .optional(),
  method: Joi.string().valid('code', 'automatic').optional(),
  type: Joi.string().valid('percentage', 'fixed_amount', 'free_shipping').optional(),
  value: Joi.number().min(0).optional(),
  appliesTo: Joi.string().valid('all_products', 'specific_categories', 'specific_products').optional(),
  targetCategories: Joi.array().items(Joi.string().hex().length(24)).optional(),
  targetProducts: Joi.array().items(Joi.string().hex().length(24)).optional(),
  minimumSpend: Joi.number().min(0).allow(null).optional(),
  minimumQuantity: Joi.number().integer().min(0).allow(null).optional(),
  firstOrderOnly: Joi.boolean().optional(),
  usageLimit: Joi.number().integer().min(1).allow(null).optional(),
  perCustomerLimit: Joi.number().integer().min(1).allow(null).optional(),
  startsAt: Joi.date().iso().optional(),
  endsAt: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('draft', 'active', 'disabled').optional(),
  stackable: Joi.boolean().optional(),
});

export const adminDiscountsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('All', 'Active', 'Scheduled', 'Expired', 'all', 'active', 'scheduled', 'expired', '').default('All'),
  type: Joi.string().allow('', null).optional(),
  appliesTo: Joi.string().allow('', null).optional(),
  dateRange: Joi.string().allow('', null).optional(),
  sortBy: Joi.string().valid('createdAt', 'startsAt', 'endsAt', 'usedCount', 'name', 'code').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export const bulkDiscountsSchema = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  action: Joi.string().valid('duplicate', 'end', 'delete').required(),
});
