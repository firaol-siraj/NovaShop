import Joi from 'joi';

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'Category name cannot be empty',
    'string.min': 'Category name must be at least 2 characters long',
  }),
  slug: Joi.string().trim().lowercase().optional(),
  description: Joi.string().trim().allow('').optional(),
  image: Joi.string().trim().allow('').optional(),
  parent: Joi.string().hex().length(24).allow(null, '').optional(),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  slug: Joi.string().trim().lowercase().optional(),
  description: Joi.string().trim().allow('').optional(),
  image: Joi.string().trim().allow('').optional(),
  parent: Joi.string().hex().length(24).allow(null, '').optional(),
});
