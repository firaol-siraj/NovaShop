import Joi from 'joi'; // Import the Joi validation library

export const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid ID format. Must be a 24-character MongoDB ObjectId',
    'string.hex': 'ID must only contain hexadecimal characters',
  }), 
});

// Accepts a 24-hex MongoDB ObjectId OR a product slug (lowercase letters,
// digits, hyphens, underscores; max 160 chars) for public product lookups.
export const productIdOrSlugParamSchema = Joi.object({
  id: Joi.string()
    .max(160)
    .pattern(/^(?:[0-9a-fA-F]{24}|[a-z0-9_-]+)$/)
    .required()
    .messages({
      'string.pattern.base':
        'Invalid product identifier. Must be a 24-character MongoDB ObjectId or a valid slug',
      'string.max': 'Product identifier cannot exceed 160 characters',
    }),
});