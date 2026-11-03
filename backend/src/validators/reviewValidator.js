import Joi from 'joi';

export const createReviewSchema = Joi.object({
  product: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid product ID',
    'any.required': 'Product ID is required',
  }),
  order: Joi.string().hex().length(24).optional().allow('', null),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number',
    'number.min': 'Rating must be at least 1',
    'number.max': 'Rating cannot exceed 5',
    'any.required': 'Rating is required',
  }),
  title: Joi.string().trim().min(2).max(120).required().messages({
    'string.empty': 'Review title cannot be empty',
    'string.min': 'Review title must have at least 2 characters',
    'string.max': 'Review title cannot exceed 120 characters',
    'any.required': 'Review title is required',
  }),
  body: Joi.string().trim().min(5).max(2000).required().messages({
    'string.empty': 'Review body cannot be empty',
    'string.min': 'Review body must have at least 5 characters',
    'string.max': 'Review body cannot exceed 2000 characters',
    'any.required': 'Review body is required',
  }),
});

export const adminReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('all', 'pending', 'approved', 'rejected').default('all'),
  rating: Joi.string().allow('', null).optional(),
  product: Joi.string().allow('', null).optional(),
  dateRange: Joi.string().valid('All dates', 'Last 7 days', 'Last 14 days', 'Last 30 days', 'Older than 30 days', '').optional(),
  sortBy: Joi.string().valid('createdAt', 'rating', 'title').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export const updateReviewStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'pending').required(),
  rejectionReason: Joi.string().allow('', null).max(500).optional(),
});

export const reviewReplySchema = Joi.object({
  text: Joi.string().trim().min(2).max(1500).required().messages({
    'string.empty': 'Reply text cannot be empty',
    'any.required': 'Reply text is required',
  }),
});

export const bulkReviewsSchema = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  action: Joi.string().valid('approved', 'rejected', 'delete').required(),
  rejectionReason: Joi.string().allow('', null).max(500).optional(),
});
