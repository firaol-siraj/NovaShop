import Joi from 'joi';

export const addWishlistItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required().messages({
    'string.empty': 'Product ID is required',
  }),
});

export const mergeWishlistSchema = Joi.object({
  productIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .max(200)
    .required()
    .messages({
      'array.max': 'Cannot merge more than 200 wishlist items at once',
    }),
});

export const productIdParamSchema = Joi.object({
  productId: Joi.string().hex().length(24).required().messages({
    'string.empty': 'Product ID is required',
  }),
});
