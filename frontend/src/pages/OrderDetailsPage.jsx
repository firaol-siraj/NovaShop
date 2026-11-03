import { useMemo, useState, useEffect, useCallback } from 'react';
import { orderApi } from '../lib/api/orderApi';
import { returnApi } from '../lib/api/returnApi';
import { useAuth } from '../context/AuthContext';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function getStatusMeta(status) {
  const normalized = (status || 'processing').toLowerCase();
  const presets = {
    confirmed: { label: 'Confirmed', badge: 'CONFIRMED' },
    processing: { label: 'Processing', badge: 'PROCESSING' },
    placed: { label: 'Placed', badge: 'PLACED' },
    shipped: { label: 'Shipped', badge: 'SHIPPED' },
    'in-transit': { label: 'In Transit', badge: 'IN TRANSIT' },
    delivered: { label: 'Delivered', badge: 'DELIVERED' },
    cancelled: { label: 'Cancelled', badge: 'CANCELLED' },
  };
  return presets[normalized] || { label: String(status).toUpperCase(), badge: String(status).toUpperCase() };
}

export default function OrderDetailsPage({ go, orderId }) {
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // 403 | 404 | 'generic' | null
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Return Flow States
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('Wrong size');
  const [returnResolution, setReturnResolution] = useState('Refund');
  const [customerNote, setCustomerNote] = useState('');
  const [selectedReturnItems, setSelectedReturnItems] = useState({});
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage('');
    try {
      const res = await orderApi.getMyOrder(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        throw new Error(res.message || 'Order could not be loaded');
      }
    } catch (err) {
      const status = err.status || err.response?.status;
      if (status === 403) {
        setErrorStatus(403);
        setErrorMessage('You are not authorized to view this order.');
      } else if (status === 404) {
        setErrorStatus(404);
        setErrorMessage('We could not find that order.');
      } else {
        setErrorStatus('generic');
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to load order details.');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', `/account/orders/${orderId}`);
      go('/login');
      return;
    }
    if (user && orderId) {
      fetchOrder();
    }
  }, [authLoading, user, orderId, fetchOrder, go]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResendReceipt = async () => {
    if (resendingEmail || cooldownSeconds > 0 || !order?._id) return;
    setResendingEmail(true);
    setEmailNotice('');
    try {
      const res = await orderApi.resendConfirmationEmail(order._id);
      if (res.success) {
        setEmailNotice(`Receipt successfully sent to ${res.targetEmail || 'your email'}!`);
        setCooldownSeconds(60);
      } else {
        throw new Error(res.message || 'Failed to resend email');
      }
    } catch (err) {
      setEmailNotice(err.response?.data?.message || err.message || 'Could not send confirmation email right now.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleCopyWaybill = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleInvoiceDownload = () => {
    if (!order) return;
    const content = `========================================================\nNOVASHOP OFFICIAL CLIENT RECEIPT\nOrder Reference: ${order.orderNumber || order._id}\nPlaced: ${new Date(order.createdAt).toISOString()}\nPayment Reference: ${order.paymentReference || order.chapaReference || 'N/A'}\nPayment Status: ${order.paymentStatus || (order.isPaid ? 'PAID' : 'PENDING')}\nTotal USD: $${order.totalPrice}\nTotal ETB: ${order.totalPriceETB ? order.totalPriceETB + ' ETB' : 'N/A'}\nRecipient: ${order.shippingAddress?.recipientName || order.user?.name}\nDelivery: ${order.shippingAddress?.address}, ${order.shippingAddress?.city}, ${order.shippingAddress?.country}\n========================================================\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NovaShop-Receipt-${order.orderNumber || order._id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenReturnModal = () => {
    const initialSelection = {};
    (order.orderItems || []).forEach((item, idx) => {
      initialSelection[idx] = { selected: true, qty: item.qty || 1 };
    });
    setSelectedReturnItems(initialSelection);
    setReturnReason('Wrong size');
    setReturnResolution('Refund');
    setCustomerNote('');
    setReturnError('');
    setReturnModalOpen(true);
  };

  const handleSubmitReturn = async () => {
    setReturnError('');
    const itemsToSubmit = [];
    (order.orderItems || []).forEach((item, idx) => {
      const state = selectedReturnItems[idx];
      if (state && state.selected) {
        itemsToSubmit.push({
          orderItemIndex: idx,
          qty: Math.min(Number(state.qty || 1), item.qty || 1),
          reason: returnReason,
        });
      }
    });

    if (itemsToSubmit.length === 0) {
      setReturnError('Please select at least one item to return.');
      return;
    }

    setSubmittingReturn(true);
    try {
      await returnApi.submitRequest({
        orderId: order._id,
        items: itemsToSubmit,
        customerNote: customerNote.trim(),
        resolution: returnResolution,
      });
      setReturnSuccess('Return request submitted successfully. Our courier will contact you.');
      setReturnModalOpen(false);
      setOrder((prev) => ({ ...prev, returnRequested: true }));
    } catch (err) {
      setReturnError(err.response?.data?.message || err.message || 'Failed to submit return request.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '2px solid var(--border-default)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Loading Order Details...</p>
      </div>
    );
  }

  if (errorStatus || !order) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '60px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            {errorStatus === 403 ? '🔒' : '⚠️'}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {errorStatus === 403 ? 'Access Restricted' : 'Order Notice'}
          </div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            {errorStatus === 403 ? 'Not Authorized' : 'Order Not Found'}
          </h1>
          <p style={{ margin: '16px 0 24px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {errorMessage || 'We were unable to locate this order record.'}
          </p>
          <button type="button" onClick={() => go('/account/orders')} style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '14px 24px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const statusMeta = getStatusMeta(order.status);
  const placedAt = new Date(order.createdAt || Date.now());
  const courier = order.courier || 'NovaShop Priority Courier';
  const waybill = order.waybill || order.chapaReference || order.paymentReference || `NS-${String(order._id).slice(-8).toUpperCase()}`;
  const address = order.shippingAddress || {};
  const recipientName = address.recipientName || order.user?.name || 'Customer';
  const phone = address.phone || order.user?.phone || '';
  const isPaid = Boolean(order.isPaid || order.paymentStatus === 'paid');

  const isDelivered = Boolean(order.isDelivered || order.status === 'delivered');
  const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt) : (isDelivered ? new Date(order.updatedAt || order.createdAt) : null);
  const isWithinReturnWindow = deliveredDate ? ((Date.now() - deliveredDate.getTime()) <= 14 * 24 * 60 * 60 * 1000) : false;
  const isEligibleForReturn = isDelivered && isWithinReturnWindow && !order.returnRequested;
  const isShipped = order.status === 'shipped' || isDelivered;
  const isProcessing = order.status === 'processing' || isShipped;

  const timelineSteps = [
    { key: 'placed', label: 'Order Placed', note: 'Order registered', time: dateTimeFormatter.format(placedAt), filled: true },
    { key: 'processing', label: 'Processing', note: 'Atelier tailoring & quality check', time: isProcessing ? 'In progress' : 'Pending', filled: isProcessing },
    { key: 'shipped', label: 'Shipped', note: 'Courier handover', time: isShipped ? (order.deliveredAt ? 'Dispatched' : 'In transit') : 'Pending', filled: isShipped },
    { key: 'delivered', label: 'Delivered', note: 'Delivered to address', time: isDelivered ? (order.deliveredAt ? dateTimeFormatter.format(new Date(order.deliveredAt)) : 'Completed') : 'Pending', filled: isDelivered },
  ];

  const orderItems = order.orderItems || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '28px 24px 48px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', marginBottom: '22px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => go('/account/orders')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            ← Back to Order History
          </button>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Account / Orders / #{order.orderNumber || order._id}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '18px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Client Receipt &amp; Status</div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4.5vw, 54px)', fontStyle: 'italic', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>Order Details</h1>
            <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Order #{order.orderNumber || order._id} · Placed {dateTimeFormatter.format(placedAt)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {isEligibleForReturn && (
              <button
                type="button"
                onClick={handleOpenReturnModal}
                style={{
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  borderRadius: '999px',
                  padding: '10px 18px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ↩ Request Return
              </button>
            )}
            {order.returnRequested && (
              <span
                style={{
                  border: '1px solid rgba(212, 166, 98, 0.35)',
                  background: 'rgba(212, 166, 98, 0.15)',
                  color: 'var(--color-warning)',
                  borderRadius: '999px',
                  padding: '10px 18px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Return In Progress
              </span>
            )}
            <button type="button" onClick={handlePrint} style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              🖶 Print Receipt
            </button>
            <button type="button" onClick={handleInvoiceDownload} style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              ⬇ Download Receipt
            </button>
          </div>
        </div>

        {/* Return Success Notice */}
        {returnSuccess && (
          <div style={{ background: 'rgba(34, 123, 81, 0.1)', border: '1px solid var(--color-success)', borderRadius: '12px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)', marginBottom: '16px' }}>
            ✓ {returnSuccess}
          </div>
        )}

        {/* Email Notice Feedback */}
        {emailNotice && (
          <div style={{ background: 'rgba(34, 123, 81, 0.1)', border: '1px solid var(--color-success)', borderRadius: '12px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)', marginBottom: '16px' }}>
            {emailNotice}
          </div>
        )}

        {/* Status Bar */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
              ● {statusMeta.badge}
            </div>
            <div style={{ background: isPaid ? 'rgba(46, 125, 50, 0.15)' : 'rgba(212, 166, 98, 0.15)', color: isPaid ? 'var(--color-success)' : 'var(--color-warning)', border: `1px solid ${isPaid ? 'rgba(46, 125, 50, 0.35)' : 'rgba(212, 166, 98, 0.35)'}`, borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
              {isPaid ? 'Payment Paid' : 'Payment Pending'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Courier: {courier}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)' }}>
              <span>REF: {waybill}</span>
              <button type="button" onClick={() => handleCopyWaybill(waybill)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '12px' }}>
                {copied ? '✓' : '🔗'}
              </button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ maxWidth: '1000px', margin: '0 auto 26px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '14px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '18px', left: '8%', right: '8%', height: '1px', background: 'var(--border-subtle)' }} />
            {timelineSteps.map((step, index) => {
              const isFilled = step.filled || index === 0;
              return (
                <div key={step.label} style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isFilled ? 'var(--color-primary)' : 'var(--bg-surface-sunken)', border: `1.5px solid ${isFilled ? 'var(--color-primary)' : 'var(--border-default)'}`, color: isFilled ? 'var(--color-primary-contrast)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                      {isFilled ? '✓' : '○'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: isFilled ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {step.label}
                  </div>
                  <div style={{ marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {step.time}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: '26px' }}>
          {/* Purchased Items List */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '24px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Purchased Pieces
              </h2>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {orderItems.length} DISTINCT ITEM{orderItems.length === 1 ? '' : 'S'}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {orderItems.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto', gap: '16px', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <img
                    src={item.image || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=500&q=80'}
                    alt={item.name}
                    style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', background: 'var(--bg-surface-sunken)' }}
                  />
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {item.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {item.color ? `${item.color} · ` : ''}{item.size ? `Size ${item.size} · ` : ''}Qty: {item.qty}
                    </div>
                    {item.sku && (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        SKU: {item.sku}
                      </div>
                    )}
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)', marginTop: '6px' }}>
                      {formatMoney(item.price)} each
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {formatMoney(Number(item.price) * Number(item.qty))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Summary & Address */}
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Order Summary</h2>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <span>Items Subtotal</span>
                  <strong>{formatMoney(order.itemsPrice || order.totalPrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <span>Shipping</span>
                  <strong>{Number(order.shippingPrice) > 0 ? formatMoney(order.shippingPrice) : 'Complimentary'}</strong>
                </div>
                {Number(order.taxPrice) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <span>Estimated Tax</span>
                    <strong>{formatMoney(order.taxPrice)}</strong>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 14px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Total Amount</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', lineHeight: 1, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatMoney(order.totalPrice)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>USD</span>
                </div>
              </div>

              {order.totalPriceETB && (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Local Ethiopian Currency: <strong>~{Number(order.totalPriceETB).toLocaleString()} ETB</strong>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'grid', gap: '6px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }}>
                  Payment Method: <strong>{order.paymentMethod || 'Chapa'}</strong>
                </div>
                {order.chapaReference && (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Chapa Gateway Ref: {order.chapaReference}
                  </div>
                )}
              </div>

              {/* Resend Receipt Button */}
              {isPaid && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <button
                    type="button"
                    onClick={handleResendReceipt}
                    disabled={resendingEmail || cooldownSeconds > 0}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: '999px',
                      padding: '10px 16px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      cursor: (resendingEmail || cooldownSeconds > 0) ? 'not-allowed' : 'pointer',
                      color: 'var(--text-primary)',
                      opacity: (resendingEmail || cooldownSeconds > 0) ? 0.6 : 1,
                    }}
                  >
                    {resendingEmail ? 'Sending...' : cooldownSeconds > 0 ? `Resend Receipt (${cooldownSeconds}s)` : '✉ Resend Email Receipt'}
                  </button>
                </div>
              )}
            </div>

            {/* Delivery Address Card */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
              <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Delivery Address</h2>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.8, color: 'var(--text-primary)' }}>
                <div style={{ fontWeight: 700 }}>{recipientName}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{address.address}</div>
                {address.address2 && <div style={{ color: 'var(--text-secondary)' }}>{address.address2}</div>}
                <div style={{ color: 'var(--text-secondary)' }}>{address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{address.country || 'Ethiopia'}</div>
                {phone && <div style={{ marginTop: '6px', color: 'var(--text-muted)' }}>📞 {phone}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return Request Modal */}
      {returnModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !submittingReturn && setReturnModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Return Request</span>
                <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                  Return Pieces
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                disabled={submittingReturn}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Select the pieces you wish to return within our 14-day policy window. Our courier team will schedule a complimentary pickup from your delivery address.
            </p>

            {returnError && (
              <div style={{ background: 'rgba(217, 83, 79, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '10px', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-danger)', marginBottom: '16px' }}>
                {returnError}
              </div>
            )}

            {/* Items selection */}
            <div style={{ marginBottom: '20px', display: 'grid', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 600 }}>Select Pieces</span>
              {orderItems.map((item, idx) => {
                const state = selectedReturnItems[idx] || { selected: false, qty: 1 };
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${state.selected ? 'var(--color-primary)' : 'var(--border-default)'}`,
                      background: state.selected ? 'var(--bg-surface-raised)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={state.selected}
                      onChange={(e) => {
                        setSelectedReturnItems((prev) => ({
                          ...prev,
                          [idx]: { ...state, selected: e.target.checked },
                        }));
                      }}
                      style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                    />
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=120&q=80'}
                      alt={item.name}
                      style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', background: 'var(--bg-surface-sunken)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatMoney(item.price)} each {item.size ? `· Size ${item.size}` : ''}
                      </div>
                    </div>
                    {state.selected && item.qty > 1 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Qty:
                        <select
                          value={state.qty}
                          onChange={(e) => {
                            setSelectedReturnItems((prev) => ({
                              ...prev,
                              [idx]: { ...state, qty: Number(e.target.value) },
                            }));
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        >
                          {Array.from({ length: item.qty }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reason selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Primary Reason
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)' }}
              >
                <option value="Wrong size">Wrong size</option>
                <option value="Defective">Defective</option>
                <option value="Not as described">Not as described</option>
                <option value="Damaged on arrival">Damaged on arrival</option>
                <option value="Changed mind">Changed mind</option>
              </select>
            </div>

            {/* Resolution selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Preferred Resolution
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${returnResolution === 'Refund' ? 'var(--color-primary)' : 'var(--border-default)'}`, background: returnResolution === 'Refund' ? 'var(--bg-surface-raised)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }}>
                  <input type="radio" name="res" checked={returnResolution === 'Refund'} onChange={() => setReturnResolution('Refund')} style={{ accentColor: 'var(--color-primary)' }} />
                  Refund to Account
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${returnResolution === 'Store credit' ? 'var(--color-primary)' : 'var(--border-default)'}`, background: returnResolution === 'Store credit' ? 'var(--bg-surface-raised)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }}>
                  <input type="radio" name="res" checked={returnResolution === 'Store credit'} onChange={() => setReturnResolution('Store credit')} style={{ accentColor: 'var(--color-primary)' }} />
                  Store Credit
                </label>
              </div>
            </div>

            {/* Customer statement */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Additional Notes
              </label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Please describe any issues or tailoring fit details…"
                rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                disabled={submittingReturn}
                style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '999px', padding: '12px 22px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReturn}
                disabled={submittingReturn}
                style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 24px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: submittingReturn ? 'not-allowed' : 'pointer', fontWeight: 700 }}
              >
                {submittingReturn ? 'Submitting…' : 'Submit Return Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
