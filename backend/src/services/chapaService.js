import crypto from 'crypto';
import logger from '../utils/logger.js';
import { sanitizePhoneNumber, formatPhoneForChapa } from '../utils/phone.js';

const CHAPA_API_URL = 'https://api.chapa.co/v1';

/**
 * Sanitizes free-text fields for Chapa API compliance.
 * Chapa strictly permits only letters, numbers, hyphens (-), underscores (_), spaces, and dots (.).
 * Disallows: #, :, /, (, ), commas, $, &, emojis, and special symbols.
 * Collapses multiple spaces and trims.
 *
 * @param {string} text
 * @param {string} [fallback='']
 * @returns {string}
 */
export function sanitizeChapaText(text, fallback = '') {
  if (text === null || text === undefined) {
    return fallback;
  }
  const cleaned = String(text)
    .replace(/[^a-zA-Z0-9\-_. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

class ChapaService {
  constructor() {
    this.baseUrl = CHAPA_API_URL;
  }

  get secretKey() {
    return (process.env.CHAPA_SECRET_KEY || '').trim();
  }

  get webhookSecret() {
    return (process.env.CHAPA_WEBHOOK_SECRET || '').trim();
  }

  get mode() {
    return process.env.CHAPA_MODE || 'test';
  }

  get usdToEtbRate() {
    const rate = Number(process.env.USD_TO_ETB_RATE);
    return Number.isFinite(rate) && rate > 0 ? rate : 120;
  }

  isConfigured() {
    return Boolean(this.secretKey && this.secretKey.length > 0);
  }

  isWebhookConfigured() {
    return Boolean(this.webhookSecret && this.webhookSecret.length > 0);
  }

  /**
   * Converts USD amount to ETB for Chapa payment
   * @param {number} amountInUsd
   * @returns {number}
   */
  convertToEtb(amountInUsd) {
    return Number((Number(amountInUsd) * this.usdToEtbRate).toFixed(2));
  }

  /**
   * Converts ETB amount to USD for verification
   * @param {number} amountInEtb
   * @returns {number}
   */
  convertToUsd(amountInEtb) {
    return Number((Number(amountInEtb) / this.usdToEtbRate).toFixed(2));
  }

  /**
   * Safely formats error messages from Chapa gateway responses.
   * Handles string messages, nested error objects, and Laravel validation error dictionaries.
   * @param {Object} result
   * @param {number} statusCode
   * @returns {string}
   */
  formatGatewayError(result, statusCode) {
    if (!result || typeof result !== 'object') {
      return `Provider responded with HTTP ${statusCode || 500}`;
    }

    if (result.errors && typeof result.errors === 'object') {
      return Object.entries(result.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
    }

    if (typeof result.message === 'string' && result.message.trim().length > 0) {
      return result.message;
    }

    if (typeof result.message === 'object' && result.message !== null) {
      return Object.entries(result.message)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
    }

    if (typeof result.error === 'string' && result.error.trim().length > 0) {
      return result.error;
    }

    if (typeof result.error === 'object' && result.error !== null) {
      return result.error.message || JSON.stringify(result.error);
    }

    return `Provider responded with HTTP ${statusCode || 500}`;
  }

  /**
   * Builds and sanitizes the transaction initialization payload for Chapa API v1.
   * Ensures that every free-text and customization field strictly conforms to Chapa's regex:
   * /^[a-zA-Z0-9\-_. ]*$/ with collapsed whitespace and no special punctuation (#, :, /, commas, $, emojis).
   *
   * @param {Object} params
   * @param {Object} params.order - Authoritative Mongoose Order document
   * @param {Object} [params.customer] - Customer contact info { firstName, lastName, name, email, phone }
   * @param {string} [params.returnUrl] - Customer redirect URL after payment
   * @param {string} [params.txRef] - Explicit unique transaction reference for this attempt
   * @returns {Object} Chapa initialization payload
   */
  buildInitializePayload({ order, customer, returnUrl, txRef: explicitTxRef }) {
    if (!order || !order.totalPrice || order.totalPrice <= 0) {
      throw new Error('Invalid order total for payment initialization');
    }

    // Always ensure a unique, safe tx_ref per payment attempt
    const rawTxRef =
      explicitTxRef ||
      `NS_${order._id}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const txRef = sanitizeChapaText(rawTxRef).replace(/\s+/g, '_') || `NS_${Date.now()}`;

    const fullName = (customer?.name || '').trim();
    let firstName = (customer?.firstName || '').trim();
    let lastName = (customer?.lastName || '').trim();
    if (!firstName && fullName) {
      const parts = fullName.split(' ').filter(Boolean);
      firstName = parts[0] || 'Customer';
      lastName = parts.slice(1).join(' ') || 'Valued';
    }
    if (!firstName) firstName = 'Customer';
    if (!lastName) lastName = 'Valued';

    firstName = sanitizeChapaText(firstName, 'Customer');
    lastName = sanitizeChapaText(lastName, 'Valued');

    const rawPhone = customer?.phone || customer?.phoneNumber || order.shippingAddress?.phone || '';
    // Format specifically for Chapa (10 digits starting with 09 or 07)
    const chapaPhone = formatPhoneForChapa(rawPhone);
    const email = (customer?.email || order.user?.email || '').trim();

    // In test mode, Chapa expects Ethiopian Birr (ETB). We convert USD to ETB if order is in USD.
    const isUsd = (order.currency || 'USD').toUpperCase() === 'USD';
    const chapaCurrency = 'ETB';
    const chapaAmount = isUsd
      ? (order.totalPriceETB || this.convertToEtb(order.totalPrice))
      : Number(order.totalPrice.toFixed(2));

    const frontendBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const backendBase =
      process.env.CHAPA_CALLBACK_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.API_BASE_URL ||
      'http://localhost:5000/api/v1';

    // Construct public callback URL for webhook delivery
    let callbackUrl;
    if (process.env.CHAPA_CALLBACK_URL) {
      callbackUrl = process.env.CHAPA_CALLBACK_URL;
    } else {
      const base = backendBase.replace(/\/$/, '');
      const path = base.endsWith('/api/v1') ? '/orders/webhook/chapa' : '/api/v1/orders/webhook/chapa';
      callbackUrl = `${base}${path}`;
    }

    const resolvedReturnUrl =
      returnUrl || `${frontendBase}/checkout/confirmation?orderId=${order._id}&trx_ref=${txRef}`;

    // Strictly sanitize customization fields: title, description, and order number
    const rawOrderNum = order.orderNumber || String(order._id || '');
    const cleanOrderNum = sanitizeChapaText(rawOrderNum).replace(/\s+/g, '-');
    const orderPrefix = /^NS[-_]?/i.test(cleanOrderNum) ? '' : 'NS-';
    const title = sanitizeChapaText('NovaShop', 'NovaShop');
    const description = sanitizeChapaText(`Payment for order ${orderPrefix}${cleanOrderNum}`, 'Payment for NovaShop order');

    return {
      amount: chapaAmount,
      currency: chapaCurrency,
      email: email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: resolvedReturnUrl,
      ...(chapaPhone ? { phone_number: chapaPhone } : {}),
      customization: {
        title,
        description,
      },
      meta: {
        order_id: String(order._id),
        order_number: sanitizeChapaText(order.orderNumber || ''),
        user_id: String(order.user?._id || order.user || ''),
        original_amount_usd: isUsd ? Number(order.totalPrice.toFixed(2)) : undefined,
        usd_to_etb_rate: isUsd ? this.usdToEtbRate : undefined,
      },
    };
  }

  /**
   * Initializes a hosted payment checkout session with Chapa API v1
   * Endpoint: POST https://api.chapa.co/v1/transaction/initialize
   *
   * @param {Object} params
   * @param {Object} params.order - Authoritative Mongoose Order document
   * @param {Object} [params.customer] - Customer contact info { firstName, lastName, email, phone }
   * @param {string} [params.returnUrl] - Customer redirect URL after payment
   * @param {string} [params.txRef] - Explicit unique transaction reference for this attempt
   * @returns {Promise<{ checkoutUrl: string, merchantReference: string, txRef: string, chapaReference: string, amount: number, currency: string }>}
   */
  async initializePayment({ order, customer, returnUrl, txRef: explicitTxRef }) {
    if (!this.isConfigured()) {
      throw new Error(
        'Chapa payment gateway is not configured: CHAPA_SECRET_KEY is missing. ' +
        'Please configure valid Chapa test credentials in environment variables.'
      );
    }

    const payload = this.buildInitializePayload({
      order,
      customer,
      returnUrl,
      txRef: explicitTxRef,
    });

    logger.info(
      `[ChapaService] Initializing payment for order ${order._id} (tx_ref: ${payload.tx_ref}, amount: ${payload.amount} ${payload.currency}, return_url: ${payload.return_url})`
    );

    let response;
    try {
      response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      logger.error(`[ChapaService] Network error during payment initialization: ${networkError.message}`);
      throw new Error(`Failed to reach Chapa payment provider: ${networkError.message}`);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success' || !result.data?.checkout_url) {
      const errorMsg = this.formatGatewayError(result, response.status);
      logger.error(`[ChapaService] Payment initialization failed: ${errorMsg}`);
      const err = new Error(`Chapa payment initialization failed: ${errorMsg}`);
      err.statusCode = response.status || 500;
      err.gatewayError = errorMsg;
      err.gatewayResponse = result;
      throw err;
    }

    return {
      checkoutUrl: result.data.checkout_url,
      merchantReference: payload.tx_ref,
      txRef: payload.tx_ref,
      chapaReference: result.data?.chapa_reference || result.data?.reference || payload.tx_ref,
      amount: payload.amount,
      currency: payload.currency,
    };
  }

  /**
   * Verifies a transaction with Chapa API v1
   * Endpoint: GET https://api.chapa.co/v1/transaction/verify/{tx_ref}
   *
   * @param {string} txRef - Transaction reference (tx_ref)
   * @returns {Promise<Object>} Verified transaction data with distinct statuses
   */
  async verifyPayment(txRef) {
    if (!this.isConfigured()) {
      throw new Error(
        'Chapa payment gateway is not configured: CHAPA_SECRET_KEY is missing.'
      );
    }

    if (!txRef || typeof txRef !== 'string') {
      throw new Error('A valid transaction reference (tx_ref) is required for payment verification');
    }

    logger.info(`[ChapaService] Verifying payment for tx_ref: ${txRef}`);

    let response;
    try {
      response = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(txRef.trim())}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (networkError) {
      logger.error(`[ChapaService] Network error during payment verification: ${networkError.message}`);
      throw new Error(`Failed to reach Chapa payment provider during verification: ${networkError.message}`);
    }

    const result = await response.json().catch(() => ({}));

    const data = result?.data || {};
    const rawStatus = (data.status || result?.status || '').toLowerCase();

    let resolvedStatus = 'failed';
    if (rawStatus === 'success' || rawStatus === 'paid' || rawStatus === 'completed') {
      resolvedStatus = 'success';
    } else if (rawStatus === 'pending' || rawStatus === 'pending_payment' || rawStatus === 'initiated') {
      resolvedStatus = 'pending';
    } else if (rawStatus === 'cancelled') {
      resolvedStatus = 'cancelled';
    }

    if ((!response.ok && resolvedStatus !== 'pending') || (resolvedStatus === 'failed' && !data.amount)) {
      const errorMsg = this.formatGatewayError(result, response.status);
      logger.warn(`[ChapaService] Verification unsuccessful for ${txRef}: ${errorMsg}`);
      return {
        success: false,
        status: resolvedStatus === 'cancelled' ? 'cancelled' : 'failed',
        message: errorMsg,
        data: null,
      };
    }

    return {
      success: resolvedStatus === 'success',
      status: resolvedStatus, // 'success' | 'pending' | 'failed' | 'cancelled'
      txRef: data.tx_ref || txRef,
      chapaReference: data.reference || data.tx_ref || txRef,
      merchantReference: data.tx_ref || txRef,
      amount: Number(data.amount) || 0,
      currency: data.currency ? String(data.currency).toUpperCase() : 'ETB',
      paymentMethod: data.method || 'chapa',
      customer: {
        email: data.email || null,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
      },
      raw: data,
    };
  }

  /**
   * Validates webhook signature according to Chapa documentation
   * Header: x-chapa-signature = HMAC-SHA256(secret, rawBody) (hex string)
   *
   * @param {Buffer|string} rawBody - Raw HTTP body
   * @param {string} signature - Value of x-chapa-signature header
   * @returns {{ valid: boolean, reason?: string }}
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!this.isWebhookConfigured()) {
      return {
        valid: false,
        reason: 'Webhook secret is not configured in server environment',
      };
    }

    if (!rawBody || !signature) {
      return {
        valid: false,
        reason: 'Missing raw request body or x-chapa-signature header',
      };
    }

    try {
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
      const expectedDigest = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(bodyBuffer)
        .digest('hex');

      const cleanSig = String(signature).trim().toLowerCase();
      const sigBuffer = Buffer.from(cleanSig, 'hex');
      const expectedBuffer = Buffer.from(expectedDigest.toLowerCase(), 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return { valid: false, reason: 'Signature buffer length mismatch' };
      }

      const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
      return { valid: isValid, reason: isValid ? undefined : 'Signature hash mismatch' };
    } catch (err) {
      return { valid: false, reason: `Verification error: ${err.message}` };
    }
  }

  /**
   * Issues refund request to Chapa API
   * Endpoint: POST https://api.chapa.co/v1/refund/{tx_ref}
   */
  async refundPayment(txRef, amountETB = null) {
    if (!txRef) throw new Error('Transaction reference is required for refund');
    if (!this.isConfigured()) {
      logger.warn('[ChapaService] Secret key missing during refund. Falling back to manual recorded refund.');
      return { success: true, refundReference: `REF-MANUAL-${Date.now()}` };
    }

    try {
      const response = await fetch(`${this.baseUrl}/refund/${encodeURIComponent(txRef)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(amountETB ? { amount: Number(amountETB) } : {}),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'success') {
        return {
          success: true,
          refundReference: data.data?.refund_reference || data.data?.reference || `REF-CHAPA-${Date.now()}`,
          raw: data,
        };
      } else {
        logger.warn(`[ChapaService] Refund request note: ${data.message || response.statusText}`);
        return {
          success: false,
          message: data.message || 'Gateway refund recorded',
          refundReference: `REF-RECORDED-${Date.now()}`,
        };
      }
    } catch (err) {
      logger.error(`[ChapaService] Refund network error: ${err.message}`);
      return {
        success: false,
        message: err.message,
        refundReference: `REF-FALLBACK-${Date.now()}`,
      };
    }
  }
}

export const chapaService = new ChapaService();
export default chapaService;
