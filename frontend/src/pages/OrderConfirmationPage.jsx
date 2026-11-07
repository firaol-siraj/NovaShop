import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { orderApi } from '../lib/api/orderApi';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function formatOrderDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).trim();
  if (cleaned.startsWith('#')) {
    cleaned = '+' + cleaned.slice(1).trim();
  }
  if (/^\+21\d{8,9}$/.test(cleaned)) {
    cleaned = '+251' + cleaned.slice(3);
  }
  return cleaned;
}

export default function OrderConfirmationPage({ go }) {
  const { currentOrder, refreshCart } = useCart();

  // Extract orderId & transaction reference from URL query params or fallback to currentOrder
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const resolvedOrderId = queryParams.get('orderId') || currentOrder?._id || currentOrder?.orderId || null;
  const urlTxRef = queryParams.get('trx_ref') || queryParams.get('tx_ref') || queryParams.get('reference') || null;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(resolvedOrderId));
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState('idle'); // 'idle' | 'verifying' | 'paid' | 'pending' | 'failed' | 'cancelled'
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [resendingReceipt, setResendingReceipt] = useState(false);
  const [receiptFeedback, setReceiptFeedback] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const pollTimerRef = useRef(null);
  const pollCountRef = useRef(0);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearPollTimer();
  }, []);

  const loadOrderStatus = useCallback(async (isManualRefresh = false) => {
    if (!resolvedOrderId && !urlTxRef) {
      setLoading(false);
      return;
    }

    if (isManualRefresh) {
      setRefreshing(true);
      setNotice('');
      pollCountRef.current = 0;
    }

    const currentAttempt = pollCountRef.current + 1;
    console.log('[OrderConfirmation] Verifying order/payment status', {
      orderId: resolvedOrderId,
      trxRef: urlTxRef,
      attempt: currentAttempt,
    });

    let orderData = null;
    let orderFetchError = null;

    // 1. Fetch full authoritative order data from server if authenticated
    if (resolvedOrderId) {
      try {
        const orderRes = await orderApi.getOrder(resolvedOrderId);
        if (orderRes?.success && orderRes?.data) {
          orderData = orderRes.data;
          setOrder(orderData);
        }
      } catch (err) {
        orderFetchError = err;
        console.warn('[OrderConfirmation] Private order fetch bypassed or unauthenticated:', err?.message || err);
      }
    }

    // Check if order is already paid or Cash on Delivery
    const isAlreadyPaid = Boolean(orderData?.isPaid || orderData?.paymentStatus === 'paid');
    const isCash = Boolean(orderData?.paymentMethod === 'Cash' || orderData?.paymentMethod === 'Cash on Delivery');

    if (isAlreadyPaid) {
      setVerificationStatus('paid');
      clearPollTimer();
      if (typeof refreshCart === 'function') {
        await refreshCart();
      }
      if (isManualRefresh) setNotice('Payment confirmed!');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isCash) {
      setVerificationStatus('cash');
      clearPollTimer();
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Check if explicitly cancelled
    if (orderData?.status === 'cancelled' || orderData?.paymentStatus === 'cancelled') {
      setVerificationStatus('cancelled');
      clearPollTimer();
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // 2. Online Payment (Chapa): Perform server-side transaction verification
    // Use reference from return URL redirect or stored on the order, falling back to resolvedOrderId
    const referenceToVerify = urlTxRef || orderData?.paymentReference || orderData?.chapaReference || resolvedOrderId;

    if (referenceToVerify) {
      setVerifying(true);
      try {
        const verifyRes = await orderApi.verifyTransaction(referenceToVerify);
        console.log('[OrderConfirmation] Chapa verification result:', {
          success: verifyRes?.success,
          verified: verifyRes?.verified,
          paymentStatus: verifyRes?.paymentStatus,
        });

        if (verifyRes?.success && (verifyRes.verified || verifyRes.paymentStatus === 'paid' || verifyRes.data?.isPaid)) {
          // Payment verified as successful
          setOrder((prev) => ({
            ...(prev || {}),
            ...(verifyRes.data || {}),
            _id: resolvedOrderId || prev?._id,
            isPaid: true,
            paymentStatus: 'paid',
            status: verifyRes.data?.status || 'processing',
          }));
          setVerificationStatus('paid');
          setError('');
          clearPollTimer();
          if (typeof refreshCart === 'function') {
            await refreshCart();
          }
          if (isManualRefresh) setNotice('Payment verified successfully!');
          setLoading(false);
          setRefreshing(false);
          setVerifying(false);
          return;
        } else if (verifyRes?.paymentStatus === 'pending') {
          // Gateway reports payment is still pending confirmation
          setVerificationStatus('pending');
          if (isManualRefresh) setNotice('Payment is currently pending confirmation from Chapa.');

          // Auto-poll up to 10 times (every 3 seconds)
          if (pollCountRef.current < 10) {
            clearPollTimer();
            pollTimerRef.current = setTimeout(() => {
              pollCountRef.current += 1;
              setPollCount(pollCountRef.current);
              loadOrderStatus(false);
            }, 3000);
          }
        } else if (verifyRes?.paymentStatus === 'failed') {
          // Gateway reports definitive failure
          setVerificationStatus('failed');
          clearPollTimer();
          if (isManualRefresh) setNotice(verifyRes.message || 'Payment transaction failed or declined.');
        } else {
          // Indeterminate status: treat as pending
          setVerificationStatus('pending');
        }
      } catch (verifyErr) {
        console.warn('[OrderConfirmation] verifyTransaction failed or network timeout:', verifyErr?.message || verifyErr);
        // Fallback to order payment-status endpoint if resolvedOrderId is available
        if (resolvedOrderId) {
          try {
            const statusRes = await orderApi.getPaymentStatus(resolvedOrderId);
            if (statusRes?.success && statusRes?.data) {
              const sData = statusRes.data;
              setOrder((prev) => ({
                ...(prev || {}),
                ...sData,
              }));

              if (sData.isPaid || sData.paymentStatus === 'paid') {
                setVerificationStatus('paid');
                clearPollTimer();
                if (typeof refreshCart === 'function') await refreshCart();
                setLoading(false);
                setRefreshing(false);
                setVerifying(false);
                return;
              } else if (sData.paymentStatus === 'failed') {
                setVerificationStatus('failed');
                clearPollTimer();
              } else {
                setVerificationStatus('pending');
              }
            }
          } catch {
            setVerificationStatus('pending');
          }
        } else {
          setVerificationStatus('pending');
        }
      } finally {
        setVerifying(false);
      }
    } else {
      setVerificationStatus('pending');
    }

    if (!orderData && orderFetchError) {
      if (currentOrder && (currentOrder._id === resolvedOrderId || currentOrder.orderId === resolvedOrderId)) {
        setOrder(currentOrder);
      } else if (orderFetchError.status === 403 || orderFetchError.response?.status === 403) {
        setError('You are not authorized to view the details for this order.');
      } else if (orderFetchError.status === 404 || orderFetchError.response?.status === 404) {
        setError('Order not found. Please check your order reference or sign in to your account.');
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, [resolvedOrderId, urlTxRef, currentOrder, refreshCart]);

  useEffect(() => {
    loadOrderStatus(false);
  }, [loadOrderStatus]);

  const handleCopy = async (textToCopy) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  /**
   * Generates a NEW transaction reference for the same order and re-initializes Chapa
   */
  const handleRetryPayment = async () => {
    if (!order || retryingPayment) return;
    setRetryingPayment(true);
    setError('');
    setNotice('');
    try {
      const returnUrl = `${window.location.origin}/checkout/confirmation?orderId=${order._id}`;
      const initRes = await orderApi.initializePayment(order._id, {
        paymentMethod: 'Chapa',
        returnUrl,
      });

      if (initRes.success && initRes.data?.checkoutUrl) {
        window.location.href = initRes.data.checkoutUrl;
      } else {
        setError('Payment gateway currently unavailable. Please try again shortly or contact concierge.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Payment initialization retry failed.';
      setError(`Payment retry notice: ${errMsg}`);
    } finally {
      setRetryingPayment(false);
    }
  };

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResendReceipt = async () => {
    if (!order?._id || resendingReceipt || cooldownSeconds > 0) return;
    setResendingReceipt(true);
    setReceiptFeedback('');
    try {
      const res = await orderApi.resendConfirmationEmail(order._id);
      if (res.success) {
        setReceiptFeedback(`Confirmation receipt resent to ${res.targetEmail || recipientEmail}!`);
        setCooldownSeconds(60);
        setOrder((prev) => ({
          ...prev,
          confirmationEmailSent: true,
          emailDeliveryStatus: 'sent',
          emailSentAt: new Date().toISOString(),
        }));
      } else {
        throw new Error(res.message || 'Failed to resend confirmation email.');
      }
    } catch (err) {
      setReceiptFeedback(err.response?.data?.message || err.message || 'Could not resend email at this time.');
    } finally {
      setResendingReceipt(false);
    }
  };

  if (loading && !order) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '60px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '2px solid var(--border-default)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Verifying Order Status...
          </div>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '60px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '38px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Order Notice</h1>
          <p style={{ margin: '14px 0 24px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {error || 'No active order reference was found.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => go('/account/orders')}
              style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', padding: '12px 22px', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              My Orders
            </button>
            <button
              type="button"
              onClick={() => go('/shop')}
              style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', padding: '12px 22px', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  const orderNumber = order?.orderNumber || order?._id || 'N/A';
  const isPaid = Boolean(verificationStatus === 'paid' || order?.isPaid || order?.paymentStatus === 'paid');
  const isCancelled = Boolean(verificationStatus === 'cancelled' || order?.status === 'cancelled' || order?.paymentStatus === 'cancelled');
  const isFailedPayment = Boolean(!isPaid && (verificationStatus === 'failed' || order?.paymentStatus === 'failed'));
  const isCash = Boolean(order?.paymentMethod === 'Cash' || order?.paymentMethod === 'Cash on Delivery');
  const isPendingPayment = Boolean(!isPaid && !isFailedPayment && !isCancelled && !isCash);

  const orderDate = new Date(order?.createdAt || 0);
  const deliveryStart = new Date(orderDate.getTime() + 1000 * 60 * 60 * 24 * 3);
  const deliveryEnd = new Date(orderDate.getTime() + 1000 * 60 * 60 * 24 * 5);

  const displayItems = order?.orderItems || order?.items || [];
  const totalQuantity = displayItems.reduce((acc, item) => acc + (Number(item.qty) || 1), 0);
  const recipientName = order?.shippingAddress?.recipientName || order?.user?.name || 'Customer';
  const recipientEmail = order?.user?.email || order?.email || 'customer@example.com';
  const formattedPhone = formatPhoneNumber(order?.shippingAddress?.phone);

  return (
    <div className="order-conf-container">
      <style>{`
        .order-conf-container {
          min-height: 100vh;
          background: var(--bg-main);
          padding: 28px 24px 50px;
        }
        .order-conf-stepper {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: start;
          position: relative;
        }
        .order-conf-stepper-line {
          position: absolute;
          top: 18px;
          left: 8%;
          right: 8%;
          height: 1px;
          background: var(--border-subtle);
          z-index: 0;
        }
        .order-conf-grid {
          max-width: 960px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
          gap: 28px;
        }

        @media (max-width: 1023px) {
          .order-conf-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        @media (max-width: 767px) {
          .order-conf-container {
            padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px));
          }
        }

        @media (max-width: 639px) {
          .order-conf-stepper {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .order-conf-stepper-line {
            display: none;
          }
        }
      `}</style>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '18px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <button
              onClick={() => go('/')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-primary)' }}
            >
              NOVASHOP
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <span>1. BAG</span>
              <span>→</span>
              <span>2. CHECKOUT</span>
              <span>→</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--text-primary)', paddingBottom: '2px' }}>3. CONFIRMATION</span>
            </div>
          </div>
        </header>

        {/* Failed Payment Action Banner */}
        {isFailedPayment && (
          <div style={{ maxWidth: '780px', margin: '0 auto 24px', background: 'rgba(161, 74, 63, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <strong style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)', display: 'block' }}>Payment Action Needed</strong>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>The transaction was not completed. You can safely retry checkout below.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={retryingPayment}
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: retryingPayment ? 'not-allowed' : 'pointer' }}
            >
              {retryingPayment ? 'Connecting...' : 'Retry Payment →'}
            </button>
          </div>
        )}

        {/* Notice Banner */}
        {notice && (
          <div style={{ maxWidth: '780px', margin: '0 auto 20px', background: 'rgba(34, 123, 81, 0.1)', border: '1px solid var(--color-success)', borderRadius: '12px', padding: '12px 18px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)' }}>
            {notice}
          </div>
        )}

        {/* Hero Status Section */}
        <section style={{ maxWidth: '780px', margin: '0 auto 36px', textAlign: 'center' }}>
          {isPaid && (
            <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--color-success)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--color-primary-contrast)', fontSize: '32px', fontWeight: 700 }}>✓</span>
            </div>
          )}
          {isPendingPayment && (
            <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--color-warning)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#FFFFFF', fontSize: '28px' }}>⏳</span>
            </div>
          )}
          {isFailedPayment && (
            <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--color-danger)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#FFFFFF', fontSize: '28px' }}>✕</span>
            </div>
          )}
          {isCancelled && (
            <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--text-muted)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--color-primary-contrast)', fontSize: '28px' }}>✕</span>
            </div>
          )}
          {isCash && (
            <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--color-primary)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--color-primary-contrast)', fontSize: '28px' }}>📦</span>
            </div>
          )}

          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 5vw, 64px)', letterSpacing: '-0.04em', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-primary)' }}>
            {isPaid
              ? 'Payment Confirmed'
              : isPendingPayment
              ? (verifying ? 'Checking Payment...' : 'Payment Awaiting Confirmation')
              : isFailedPayment
              ? 'Payment Incomplete'
              : isCancelled
              ? 'Order Cancelled'
              : 'Order Placed (Cash on Delivery)'}
          </h1>

          <p style={{ margin: '16px auto 0', maxWidth: '560px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            {isPaid
              ? `Thank you, ${recipientName}. Your payment was verified and your order is now being processed.`
              : isPendingPayment
              ? `Thank you, ${recipientName}. Your order is secured and we are checking confirmation from Chapa. This page will update automatically.`
              : isFailedPayment
              ? `The payment transaction was not finalized. Your order details are preserved, and you can retry payment anytime.`
              : isCancelled
              ? `This order has been cancelled and any reserved inventory has been released.`
              : `Thank you, ${recipientName}. Your order has been placed. You will pay in cash upon courier delivery.`}
          </p>

          <div style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-default)', borderRadius: '999px', background: 'var(--bg-surface)', padding: '8px 16px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Order #</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{orderNumber}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(orderNumber)}
              style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '999px', padding: '8px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              {copied ? 'Copied!' : 'Copy Reference'}
            </button>
            {isPendingPayment && (
              <button
                type="button"
                onClick={() => loadOrderStatus(true)}
                disabled={refreshing || verifying}
                style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: (refreshing || verifying) ? 'not-allowed' : 'pointer' }}
              >
                {refreshing || verifying ? 'Checking...' : '↻ Check Status'}
              </button>
            )}
            {isFailedPayment && (
              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={retryingPayment}
                style={{ border: 'none', background: 'var(--color-danger)', color: '#FFFFFF', borderRadius: '999px', padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: retryingPayment ? 'not-allowed' : 'pointer' }}
              >
                {retryingPayment ? 'Connecting...' : 'Retry Payment via Chapa →'}
              </button>
            )}
          </div>

          <div style={{ marginTop: '16px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>
            {order?.emailDeliveryStatus === 'sent' && order?.emailSentAt ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span>Confirmation sent to: <strong style={{ color: 'var(--text-primary)' }}>{recipientEmail}</strong></span>
                {isPaid && (
                  <button
                    type="button"
                    onClick={handleResendReceipt}
                    disabled={resendingReceipt || cooldownSeconds > 0}
                    style={{
                      border: '1px solid var(--border-default)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: (resendingReceipt || cooldownSeconds > 0) ? 'not-allowed' : 'pointer',
                      opacity: (resendingReceipt || cooldownSeconds > 0) ? 0.6 : 1,
                    }}
                  >
                    {resendingReceipt ? 'Sending...' : cooldownSeconds > 0 ? `Resend confirmation (${cooldownSeconds}s)` : '✉ Resend confirmation'}
                  </button>
                )}
              </div>
            ) : isPaid ? (
              <div>
                <span style={{ color: 'var(--color-danger)', fontWeight: 500 }}>We could not send your confirmation yet.</span>
                <div style={{ marginTop: '4px' }}>Recipient: <strong style={{ color: 'var(--text-primary)' }}>{recipientEmail}</strong></div>
                <button
                  type="button"
                  onClick={handleResendReceipt}
                  disabled={resendingReceipt || cooldownSeconds > 0}
                  style={{
                    marginTop: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: (resendingReceipt || cooldownSeconds > 0) ? 'not-allowed' : 'pointer',
                    opacity: (resendingReceipt || cooldownSeconds > 0) ? 0.6 : 1,
                  }}
                >
                  {resendingReceipt ? 'Sending...' : cooldownSeconds > 0 ? `Resend confirmation (${cooldownSeconds}s)` : '✉ Resend confirmation'}
                </button>
              </div>
            ) : (
              <div>
                Order registered for: <strong style={{ color: 'var(--text-primary)' }}>{recipientEmail}</strong>
                <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                  (Confirmation will be sent upon payment confirmation)
                </span>
              </div>
            )}
            {receiptFeedback && (
              <div style={{ marginTop: '8px', color: 'var(--color-success)', fontWeight: 600 }}>
                {receiptFeedback}
              </div>
            )}
          </div>
        </section>

        {/* Status Stepper */}
        <section style={{ maxWidth: '960px', margin: '0 auto 28px' }}>
          <div className="order-conf-stepper">
            <div className="order-conf-stepper-line" />
            {STATUS_STEPS.map((step, idx) => {
              const currentStepIdx = isPaid || isCash ? 1 : 0;
              const isComplete = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step.key} style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', border: `1.5px solid ${isComplete || isCurrent ? 'var(--color-primary)' : 'var(--border-default)'}`, background: isComplete || isCurrent ? 'var(--color-primary)' : 'var(--bg-surface-sunken)', color: isComplete || isCurrent ? 'var(--color-primary-contrast)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>
                      {isComplete ? '✓' : idx + 1}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: isComplete || isCurrent ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 500 }}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Order Details Grid */}
        <section className="order-conf-grid">
          {/* Left Column: Items and Summary */}
          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Purchased Garments</h2>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {totalQuantity} {totalQuantity === 1 ? 'ITEM' : 'ITEMS'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {displayItems.map((item, index) => (
                  <div key={item._id || item.variant || item.product || index} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <img src={item.image || '/placeholder.jpg'} alt={item.name} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', background: 'var(--bg-surface-sunken)' }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>{item.name}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {item.color} · Size {item.size} · Qty {item.qty || 1}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {formatCurrency((item.price || 0) * (item.qty || 1))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                <span>Order Financial Summary</span>
                <span>{order?.currency || 'USD'}</span>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <span>Items Subtotal</span>
                  <strong>{formatCurrency(order?.itemsPrice || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <span>Shipping Fee</span>
                  <strong>{Number(order?.shippingPrice) > 0 ? formatCurrency(order.shippingPrice) : 'Complimentary'}</strong>
                </div>
                {Number(order?.taxPrice) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <span>Estimated Tax</span>
                    <strong>{formatCurrency(order.taxPrice)}</strong>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 14px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Authoritative Total</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '30px', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>
                    {formatCurrency(order?.totalPrice || 0)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {order?.currency || 'USD'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Method: <strong>{order?.paymentMethod || 'Chapa'}</strong></span>
                <span>·</span>
                <span>Payment Status: <strong style={{ color: isPaid ? 'var(--color-success)' : isFailedPayment ? 'var(--color-danger)' : 'var(--color-warning)', textTransform: 'uppercase' }}>{order?.paymentStatus || (isPaid ? 'paid' : 'pending')}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Delivery and Actions */}
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
              <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Delivery Address</h2>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                <div><strong style={{ color: 'var(--text-primary)' }}>{order?.shippingAddress?.recipientName || recipientName}</strong></div>
                <div>{order?.shippingAddress?.address}</div>
                {order?.shippingAddress?.address2 && <div>{order.shippingAddress.address2}</div>}
                <div>{order?.shippingAddress?.city}{order?.shippingAddress?.state ? `, ${order.shippingAddress.state}` : ''} {order?.shippingAddress?.postalCode}</div>
                <div>{order?.shippingAddress?.country || 'Ethiopia'}</div>
                {formattedPhone && <div>Tel: {formattedPhone}</div>}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px' }}>📅</span>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Estimated Fulfillment</h2>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                {formatOrderDate(deliveryStart)} – {formatOrderDate(deliveryEnd)}
              </div>
              <div style={{ marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>
                Status: {order?.status === 'delivered' ? 'Delivered' : order?.status === 'shipped' ? 'In Transit' : 'Processing in Atelier'}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <button
                type="button"
                onClick={() => go(`/account/orders/${order?._id}`)}
                style={{ width: '100%', background: 'var(--color-primary)', border: 'none', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '14px 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                View Full Order Details →
              </button>
              <button
                type="button"
                onClick={() => go('/shop')}
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: '999px', padding: '14px 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
