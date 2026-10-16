import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import Cart from '../models/cartModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { emailQueue } from '../queues/emailQueue.js';
import { getUnitPrice } from '../utils/pricing.js';

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
export const addOrderItems = asyncHandler(async (req, res, next) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    taxPrice = 0,
    shippingPrice = 0,
  } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return next(new ApiError(400, 'No order items provided'));
  }

  let calculatedItemsPrice = 0;
  const validatedOrderItems = [];

  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      return next(new ApiError(404, `Product not found: ${item.product}`));
    }

    let itemPrice = product.price;
    let itemVariantId = item.variant;
    let itemSku = item.sku;
    let itemSize = item.size;
    let itemColor = item.color;
    const itemQty = Number(item.qty || item.quantity || 1);

    if (itemVariantId) {
      const variant = await ProductVariant.findById(itemVariantId);
      if (!variant) {
        return next(new ApiError(404, `Product variant not found`));
      }
      if (variant.stock < itemQty) {
        return next(
          new ApiError(
            400,
            `Insufficient stock for ${product.name} (${variant.size}/${variant.color.name}). Only ${variant.stock} available.`
          )
        );
      }
      // Server-computed unit price: variant price when > 0, else product price.
      itemPrice = getUnitPrice(product, variant);
      itemSku = variant.sku;
      itemSize = variant.size;
      itemColor = typeof variant.color === 'string' ? variant.color : variant.color.name;

      // Decrement variant stock
      variant.stock -= itemQty;
      await variant.save();
    } else if (product.countInStock < itemQty) {
      return next(
        new ApiError(
          400,
          `Insufficient stock for ${product.name}. Only ${product.countInStock} available.`
        )
      );
    } else {
      product.countInStock -= itemQty;
      await product.save();
    }

    const lineTotal = itemPrice * itemQty;
    calculatedItemsPrice += lineTotal;

    validatedOrderItems.push({
      name: product.name,
      qty: itemQty,
      image: item.image || product.image,
      price: itemPrice,
      product: product._id,
      variant: itemVariantId || null,
      sku: itemSku || 'N/A',
      size: itemSize || 'OS',
      color: itemColor || 'N/A',
    });
  }

  const calculatedTotalPrice = calculatedItemsPrice + Number(taxPrice) + Number(shippingPrice);

  const order = new Order({
    orderItems: validatedOrderItems,
    user: req.user._id,
    shippingAddress,
    paymentMethod: paymentMethod || 'Stripe',
    itemsPrice: Number(calculatedItemsPrice.toFixed(2)),
    taxPrice: Number(taxPrice),
    shippingPrice: Number(shippingPrice),
    totalPrice: Number(calculatedTotalPrice.toFixed(2)),
  });

  const createdOrder = await order.save();

  // Clear user's server-side cart after successful order creation
  const userCart = await Cart.findOne({ user: req.user._id });
  if (userCart) {
    userCart.items = [];
    await userCart.save();
  }

  // Send order confirmation email asynchronously
  const itemsList = validatedOrderItems
    .map(
      (item) =>
        `<li>${item.name} (${item.size}/${item.color}) x ${item.qty} - $${item.price}</li>`
    )
    .join('');

  try {
    await emailQueue.add('sendOrderConfirmationEmail', {
      email: req.user.email,
      subject: `Order Placed Successfully #${createdOrder._id}`,
      message: `Thank you for your order! Order ID: ${createdOrder._id}. Total: $${createdOrder.totalPrice}`,
      html: `
        <h2>Thank you for your order, ${req.user.name || 'Customer'}!</h2>
        <p>We've received your order <strong>#${createdOrder._id}</strong>.</p>
        <h3>Order Items:</h3>
        <ul>${itemsList}</ul>
        <p><strong>Total Amount:</strong> $${createdOrder.totalPrice}</p>
        <p>Payment Method: ${paymentMethod}</p>
      `,
    });
  } catch (err) {
    console.error('Email queue error:', err.message);
  }

  res.status(201).json({ success: true, data: createdOrder });
});

// @desc    Get order by ID
// @route   GET /api/v1/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new ApiError(403, 'Not authorized to view this order'));
  }

  res.status(200).json({ success: true, data: order });
});

// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders
// @access  Private
export const getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc    Update order to paid
// @route   PUT /api/v1/orders/:id/pay
// @access  Private
export const updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  order.isPaid = true;
  order.paidAt = Date.now();
  order.paymentResult = {
    id: req.body.id,
    status: req.body.status,
    update_time: req.body.update_time,
    email_address: req.body.payer?.email_address,
  };

  const updatedOrder = await order.save();

  const recipientEmail = order.user?.email || req.body.payer?.email_address;
  if (recipientEmail) {
    try {
      await emailQueue.add('sendPaymentReceiptEmail', {
        email: recipientEmail,
        subject: `Payment Confirmed for Order #${order._id}`,
        message: `Your payment of $${order.totalPrice} for Order #${order._id} was successfully processed.`,
        html: `
          <h2>Payment Received!</h2>
          <p>Hi ${order.user?.name || 'Customer'},</p>
          <p>We've successfully received your payment of <strong>$${order.totalPrice}</strong> for order <strong>#${order._id}</strong>.</p>
          <p>Payment ID: <code>${req.body.id || 'N/A'}</code></p>
        `,
      });
    } catch (err) {
      console.error('Email queue error:', err.message);
    }
  }

  res.status(200).json({ success: true, data: updatedOrder });
});

// @desc    Get all orders
// @route   GET /api/v1/orders
// @access  Private/Admin
export const getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({}).populate('user', 'id name email').sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc    Update order to delivered
// @route   PUT /api/v1/orders/:id/deliver
// @access  Private/Admin
export const updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();

  if (order.user?.email) {
    try {
      await emailQueue.add('sendOrderStatusEmail', {
        email: order.user.email,
        subject: `Your Order #${order._id} Has Been Delivered! 📦`,
        message: `Great news! Your order #${order._id} has been delivered.`,
        html: `
          <h2>Order Delivered!</h2>
          <p>Hi ${order.user.name},</p>
          <p>Your order <strong>#${order._id}</strong> has been marked as <strong>Delivered</strong>.</p>
          <p>Thank you for shopping with NovaShop!</p>
        `,
      });
    } catch (err) {
      console.error('Email queue error:', err.message);
    }
  }

  res.status(200).json({ success: true, data: updatedOrder });
});
