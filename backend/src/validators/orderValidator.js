import Joi from 'joi'; // Imports the Joi library

// Defines validation rules when placing an order
export const createOrderSchema = Joi.object({
  orderItems: Joi.array() 
    .items(
      Joi.object({
        name: Joi.string().required(), 
        qty: Joi.number().integer().min(1).required(), 
        image: Joi.string().required(), 
        price: Joi.number().min(0).required(), 
        product: Joi.string().hex().length(24).required().messages({
          'string.length': 'Invalid MongoDB ObjectId for product', 
        }), 
      })
    )
    .min(1) 
    .required() 
    .messages({
      'array.min': 'Order cart cannot be empty', 
    }),

  shippingAddress: Joi.object({
    address: Joi.string().required(), 
    city: Joi.string().required(), 
    postalCode: Joi.string().required(), 
    country: Joi.string().required(), 
  }).required(), 

  paymentMethod: Joi.string()
    .valid('PayPal', 'Stripe', 'Chapa', 'Cash') 
    .required() 
    .messages({
      'any.only': 'Payment method must be PayPal, Stripe, Chapa, or Cash', 
    }),

  itemsPrice: Joi.number().min(0).required(), 
  taxPrice: Joi.number().min(0).required(), 
  shippingPrice: Joi.number().min(0).required(), 
  totalPrice: Joi.number().min(0).required(), 
});