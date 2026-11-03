import Joi from 'joi';

export const analyticsQuerySchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  interval: Joi.string().valid('day', 'week', 'month', 'Daily', 'Weekly', 'Monthly').default('day').optional(),
});

export const productAnalyticsQuerySchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  tab: Joi.string().valid('Best sellers', 'Most viewed', 'Low performers').default('Best sellers').optional(),
});

export const exportAnalyticsQuerySchema = Joi.object({
  page: Joi.string().valid('overview', 'sales', 'products', 'customers').required(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  interval: Joi.string().valid('day', 'week', 'month', 'Daily', 'Weekly', 'Monthly').optional(),
});
