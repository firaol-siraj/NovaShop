export const PAYMENT_PROVIDERS = {
  CHAPA: 'chapa',
  COD: 'cod',
};

export const PAYMENT_STATUSES = {
  INITIATED: 'initiated',
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
};

export const PAYMENT_METHODS = {
  TELEBIRR: 'Telebirr',
  CBE_BIRR: 'CBE Birr',
  MPESA: 'M-Pesa',
  CARD: 'Credit / Debit Card',
  BANK: 'Bank Transfer',
  CHAPA: 'Chapa Hosted Checkout',
  COD: 'Cash on Delivery',
};

export const DEFAULT_STORE_TIMEZONE = 'Africa/Addis_Ababa';
export const DEFAULT_USD_TO_ETB_RATE = 120;
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 300;
