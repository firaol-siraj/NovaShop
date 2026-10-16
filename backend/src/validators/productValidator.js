import Joi from 'joi';

const imagePathSchema = Joi.alternatives().try(
  Joi.string().trim().uri({ scheme: ['http', 'https'] }),
  Joi.string().trim().pattern(/^\/(?!\/)\S+$/)
);
const productImagePublicIdSchema = Joi.string().pattern(/^novashop\/products\/[A-Za-z0-9_.-]+$/);

const variantSchema = Joi.object({
  sku: Joi.string().trim().uppercase().optional(),
  size: Joi.string().trim().uppercase().required(),
  color: Joi.alternatives().try(
    Joi.object({
      name: Joi.string().trim().required(),
      hex: Joi.string().trim().optional(),
    }),
    Joi.string().trim()
  ).required(),
  price: Joi.number().min(0).optional(),
  stock: Joi.number().integer().min(0).required(),
  image: imagePathSchema.allow('').optional(),
});

export const createProductSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Product name cannot be empty',
  }),
  slug: Joi.string().trim().lowercase().optional(),
  price: Joi.number().min(0).required().messages({
    'number.min': 'Price cannot be a negative number',
  }),
  basePrice: Joi.number().min(0).optional(),
  description: Joi.string().trim().required(),
  image: imagePathSchema.required(),
  images: Joi.array().max(6).items(imagePathSchema).optional(),
  imagePublicIds: Joi.array().max(6).items(productImagePublicIdSchema).default([]),
  brand: Joi.string().trim().default('NovaShop'),
  category: Joi.string().trim().required(),
  gender: Joi.string().valid('men', 'women', 'kids', 'unisex').default('unisex'),
  material: Joi.string().trim().optional(),
  careInstructions: Joi.string().trim().optional(),
  fit: Joi.string().trim().optional(),
  status: Joi.string().valid('draft', 'active', 'archived').default('active'),
  countInStock: Joi.number().integer().min(0).optional(),
  variants: Joi.array().items(variantSchema).optional(),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().optional(),
  slug: Joi.string().trim().lowercase().optional(),
  price: Joi.number().min(0).optional(),
  basePrice: Joi.number().min(0).optional(),
  description: Joi.string().trim().optional(),
  image: imagePathSchema.optional(),
  images: Joi.array().max(6).items(imagePathSchema).optional(),
  imagePublicIds: Joi.array().max(6).items(productImagePublicIdSchema).optional(),
  brand: Joi.string().trim().optional(),
  category: Joi.string().trim().optional(),
  gender: Joi.string().valid('men', 'women', 'kids', 'unisex').optional(),
  material: Joi.string().trim().optional(),
  careInstructions: Joi.string().trim().optional(),
  fit: Joi.string().trim().optional(),
  status: Joi.string().valid('draft', 'active', 'archived').optional(),
  countInStock: Joi.number().integer().min(0).optional(),
  variants: Joi.array().items(variantSchema).optional(),
});

export const createReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required().messages({
    'number.min': 'Rating must be at least 1',
    'number.max': 'Rating cannot exceed 5',
  }),
  comment: Joi.string().trim().required().messages({
    'string.empty': 'Comment cannot be empty',
  }),
});

export const getProductsQuerySchema = Joi.object({
  pageNumber: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(8),
  keyword: Joi.string().trim().allow('').default(''),
  category: Joi.string().trim().allow('').default(''),
  categoryId: Joi.string().trim().allow('').default(''),
  gender: Joi.string().valid('men', 'women', 'kids', 'unisex', '').default(''),
  size: Joi.string().trim().uppercase().allow('').default(''),
  color: Joi.string().trim().allow('').default(''),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
});