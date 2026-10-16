import Joi from 'joi';
import { MAX_QTY_PER_LINE } from '../utils/pricing.js';

// Quantity is optional on add/merge (defaults to 1) but required on update.
const quantitySchema = Joi.number()
  .integer()
  .min(1)
  .max(MAX_QTY_PER_LINE)
  .messages({
    'number.min': 'Quantity must be at least 1',
    'number.max': `Quantity cannot exceed ${MAX_QTY_PER_LINE}`,
  });

export const addCartItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required().messages({
    'string.empty': 'Product ID is required',
  }),
  variantId: Joi.string().hex().length(24).required().messages({
    'string.empty': 'Variant ID is required',
  }),
  quantity: quantitySchema.default(1),
});

export const updateCartItemSchema = Joi.object({
  quantity: quantitySchema.required(),
});

const mergeCartItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  variantId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(MAX_QTY_PER_LINE).required(),
});

export const mergeCartSchema = Joi.object({
  items: Joi.array().items(mergeCartItemSchema).max(50).required().messages({
    'array.max': 'Cannot merge more than 50 cart items at once',
  }),
});

export const cartItemIdParamSchema = Joi.object({
  itemId: Joi.string().hex().length(24).required().messages({
    'string.empty': 'Cart item ID is required',
  }),
});
