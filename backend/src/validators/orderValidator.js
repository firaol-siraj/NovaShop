import Joi from 'joi';

// Defines validation rules when placing an order
export const createOrderSchema = Joi.object({
  orderItems: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().allow('', null).optional(),
        qty: Joi.number().integer().min(1).optional(),
        quantity: Joi.number().integer().min(1).optional(),
        image: Joi.string().allow('', null).optional(),
        price: Joi.number().min(0).optional(),
        product: Joi.string().hex().length(24).required().messages({
          'string.length': 'Invalid MongoDB ObjectId for product',
        }),
        variant: Joi.string().hex().length(24).allow(null, '').optional(),
        sku: Joi.string().allow('', null).optional(),
        size: Joi.string().allow('', null).optional(),
        color: Joi.alternatives().try(Joi.string(), Joi.object()).allow('', null).optional(),
      })
    )
    .min(1)
    .optional()
    .messages({
      'array.min': 'Order cart cannot be empty',
    }),

  shippingAddress: Joi.object({
    recipientName: Joi.string().allow('', null).optional(),
    phone: Joi.string().allow('', null).optional(),
    address: Joi.string().required(),
    address2: Joi.string().allow('', null).optional(),
    city: Joi.string().required(),
    state: Joi.string().allow('', null).optional(),
    postalCode: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),

  paymentMethod: Joi.string()
    .valid('PayPal', 'Stripe', 'Chapa', 'Cash', 'Cash on Delivery')
    .default('Chapa')
    .optional()
    .messages({
      'any.only': 'Payment method must be PayPal, Stripe, Chapa, Cash, or Cash on Delivery',
    }),

  itemsPrice: Joi.number().min(0).optional(),
  taxPrice: Joi.number().min(0).optional(),
  shippingPrice: Joi.number().min(0).optional(),
  totalPrice: Joi.number().min(0).optional(),
  currency: Joi.string().valid('USD', 'ETB').default('USD').optional(),
  discountCode: Joi.string().allow('', null).optional(),
  sessionId: Joi.string().allow('', null).optional(),
});

export const initializePaymentSchema = Joi.object({
  paymentMethod: Joi.string().valid('Chapa', 'Cash', 'Cash on Delivery').default('Chapa'),
  returnUrl: Joi.string().uri().optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'pending_payment', 'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')
    .required()
    .messages({
      'any.only': 'Status must be one of: pending, pending_payment, paid, processing, shipped, out_for_delivery, delivered, cancelled, refunded',
    }),
});
