/**
 * Shared Order and Payment status constants
 */
export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

/**
 * Statuses considered verified PAID for revenue, sales analytics, and fulfillment.
 * Orders cancelled or refunded are excluded.
 */
export const VERIFIED_PAID_STATUSES = Object.freeze([
  ORDER_STATUS.PAID,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
]);

/**
 * Orders fulfilled / delivered
 */
export const FULFILLED_STATUSES = Object.freeze([
  ORDER_STATUS.DELIVERED,
]);

/**
 * Orders in queue awaiting shipment / courier dispatch
 */
export const FULFILLMENT_QUEUE_STATUSES = Object.freeze([
  ORDER_STATUS.PAID,
  ORDER_STATUS.PROCESSING,
]);

/**
 * Target SLA: orders dispatched within 48 hours (2 days) of payment confirmation are timely
 */
export const TIMELY_DISPATCH_HOURS = 48;

/**
 * Default threshold under which product variants trigger low stock alerts
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
