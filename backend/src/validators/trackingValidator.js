import Joi from 'joi';

export const trackEventSchema = Joi.object({
  sessionId: Joi.string().required().trim().max(100),
  eventType: Joi.string()
    .valid('session_start', 'product_view', 'add_to_cart', 'begin_checkout')
    .required(),
  referrer: Joi.string().allow('', null).optional().max(1000),
  utmSource: Joi.string().allow('', null).optional().max(200),
  utmMedium: Joi.string().allow('', null).optional().max(200),
  utmCampaign: Joi.string().allow('', null).optional().max(200),
  landingPage: Joi.string().allow('', null).optional().max(500),
  path: Joi.string().allow('', null).optional().max(500),
  deviceType: Joi.string().valid('desktop', 'mobile', 'tablet').default('desktop').optional(),
  productId: Joi.string().allow('', null).optional(),
  productName: Joi.string().allow('', null).optional().max(200),
  productCategory: Joi.string().allow('', null).optional().max(100),
  metadata: Joi.object().optional(),
});
