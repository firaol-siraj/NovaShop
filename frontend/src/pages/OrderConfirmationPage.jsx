import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';

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
  }).format(date);
}

function getOrderStatusSteps(order) {
  const status = order?.status || 'placed';
  const index = STATUS_STEPS.findIndex((step) => step.key === status);
  return STATUS_STEPS.map((step, i) => ({
    ...step,
    state: i < index ? 'complete' : i === index ? 'current' : 'pending',
  }));
}

export default function OrderConfirmationPage({ go }) {
  const { currentOrder, items, subtotal, promoDiscount, appliedPromo, clearCart, total, formatCurrency } = useCart();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentOrder) {
      go('/shop');
      return;
    }

    if (currentOrder.items && currentOrder.items.length === 0) {
      go('/shop');
    }
  }, [currentOrder, go]);

  if (!currentOrder) return null;

  const displayItems = currentOrder.items || items || [];
  const orderId = currentOrder.orderId || 'NS-10462';
  const firstName = currentOrder.firstName || 'Customer';
  const email = currentOrder.email || 'elena.vasquez@atelier.com';
  const shippingMethod = currentOrder.shippingMethod || 'Standard Delivery';
  const shippingPrice = currentOrder.shippingPrice || 0;
  const cardBrand = currentOrder.paymentMethod || 'Visa';
  const lastCard = currentOrder.cardLast4 || '8832';
  const orderDate = new Date(currentOrder.createdAt || Date.now());
  const deliveryWindow = currentOrder.deliveryWindow || { start: new Date(orderDate.getTime() + 1000 * 60 * 60 * 24 * 12), end: new Date(orderDate.getTime() + 1000 * 60 * 60 * 24 * 14) };

  const statusSteps = useMemo(() => getOrderStatusSteps(currentOrder), [currentOrder]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const promoLine = appliedPromo && currentOrder.appliedPromo ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#227B51' }}>✓</span>
        <span>{currentOrder.appliedPromo}</span>
      </span>
      <strong style={{ color: '#1B1816' }}>-{formatCurrency(currentOrder.promoDiscount || 0)}</strong>
    </div>
  ) : null;

  const totalPaid = currentOrder.total || total || 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F9F5F0', padding: '28px 24px 42px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid rgba(27,24,22,0.08)', paddingBottom: '18px', marginBottom: '34px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <button onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1B1816' }}>NOVASHOP</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>
              <span>1. BAG</span>
              <span>→</span>
              <span>2. CHECKOUT</span>
              <span>→</span>
              <span style={{ fontWeight: 700, color: '#1B1816', borderBottom: '1px solid #1B1816', paddingBottom: '2px' }}>3. CONFIRMATION</span>
            </div>
          </div>
        </header>

        <section style={{ maxWidth: '760px', margin: '0 auto 34px', textAlign: 'center' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#1B1816', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FDFBF7', fontSize: '36px', lineHeight: 1, fontWeight: 700 }}>✓</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 5vw, 72px)', letterSpacing: '-0.04em', fontStyle: 'italic', fontWeight: 400, color: '#1B1816' }}>Order Confirmed</h1>
          <p style={{ margin: '18px auto 0', maxWidth: '520px', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: '#685F5B' }}>
            Thank you for your order, <strong style={{ color: '#1B1816' }}>{firstName}</strong>. Your order has been successfully placed.
          </p>
          <div style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(27,24,22,0.18)', borderRadius: '999px', background: '#FDFBF7', padding: '8px 14px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Order #</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, color: '#1B1816' }}>{orderId}</span>
            </div>
            <button type="button" onClick={handleCopy} style={{ border: '1px solid rgba(27,24,22,0.18)', background: 'transparent', color: '#1B1816', borderRadius: '999px', padding: '8px 10px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ margin: '18px auto 0', maxWidth: '540px', fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.7, color: '#6E6661' }}>
            A receipt and order details have been emailed to <strong><a href={`mailto:${email}`} style={{ color: '#1B1816' }}>{email}</a></strong>.
          </p>
        </section>

        <section style={{ maxWidth: '960px', margin: '0 auto 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', alignItems: 'start', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '18px', left: '8%', right: '8%', height: '1px', background: 'rgba(27,24,22,0.14)', zIndex: 0 }} />
            {statusSteps.map((step, index) => {
              const isComplete = step.state === 'complete';
              const isCurrent = step.state === 'current';
              return (
                <div key={step.key} style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', border: `1.5px solid ${isComplete || isCurrent ? '#1B1816' : 'rgba(27,24,22,0.24)'}`, background: isComplete || isCurrent ? '#1B1816' : '#F5F0E9', color: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}> {isComplete ? '✓' : '○'} </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: isComplete || isCurrent ? '#1B1816' : '#7A726C', fontWeight: isCurrent ? 700 : 500 }}>{step.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: '28px' }}>
          <div style={{ display: 'grid', gap: '26px' }}>
            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Purchased Items</h2>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>{displayItems.length} ITEMS</span>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {displayItems.map((item) => (
                  <div key={`${item.id}-${item.color}-${item.size}`} style={{ display: 'grid', gridTemplateColumns: '78px 1fr auto', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(27,24,22,0.08)' }}>
                    <img src={item.image} alt={item.name} style={{ width: '78px', height: '78px', objectFit: 'cover', borderRadius: '10px', background: '#EFEAE4' }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 700, color: '#1B1816', lineHeight: 1.35 }}>{item.name}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', marginTop: '6px' }}>{item.color} · Size {item.size}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', marginTop: '4px' }}>Qty: {item.qty || 1}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 700, color: '#1B1816', whiteSpace: 'nowrap' }}>{formatCurrency((item.price || 0) * (item.qty || 1))}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>
                <span>Order Summary</span>
                <span>USD</span>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal || currentOrder.subtotal || 0)}</strong>
                </div>
                {promoLine}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Shipping</span>
                  <strong>{shippingPrice > 0 ? formatCurrency(shippingPrice) : 'Complimentary'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Tax / Duties</span>
                  <strong>Included</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(27,24,22,0.08)', margin: '16px 0 14px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: '#1B1816' }}>Total Paid</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '32px', fontWeight: 700, lineHeight: 1, color: '#1B1816' }}>{formatCurrency(totalPaid)}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>USD</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#1B1816' }}>
                <span style={{ fontSize: '16px' }}>💳</span>
                <span>Paid via {cardBrand} ending in •••• {lastCard}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Delivery Address</h2>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.8, color: '#1B1816' }}>
                <div><strong>{currentOrder.fullName || `${currentOrder.firstName || 'Elena'} ${currentOrder.lastName || 'Vasquez'}`}</strong></div>
                <div>{currentOrder.address || 'Bole Sub-City, Namibia St.'}</div>
                <div>{currentOrder.address2 || 'Villa 14, Bole Diplomatic Zone'}</div>
                <div>{currentOrder.city || 'Addis Ababa'} {currentOrder.postalCode || '1000'}, {currentOrder.country || 'Ethiopia'}</div>
                <div>{currentOrder.phone || '+251 91 123 4567'}</div>
              </div>
            </div>

            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Estimated Delivery</h2>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816', fontWeight: 600 }}>{formatOrderDate(deliveryWindow.start)} – {formatOrderDate(deliveryWindow.end)}</div>
              <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6F6661' }}>Shipping Tier: {shippingMethod} ({shippingPrice > 0 ? formatCurrency(shippingPrice) : 'Complimentary'})</div>
            </div>

            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816', lineHeight: 1.5 }}>Need help?</div>
              <button type="button" onClick={() => go('/support')} style={{ border: 'none', background: 'transparent', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>Contact Support →</button>
            </div>
          </div>
        </section>

        <section style={{ maxWidth: '960px', margin: '32px auto 0', display: 'grid', gap: '12px', justifyContent: 'center' }}>
          <button type="button" onClick={() => go('/account/orders/' + orderId)} style={{ width: '100%', maxWidth: '420px', margin: '0 auto', background: '#1B1816', border: 'none', color: '#FDFBF7', borderRadius: '999px', padding: '16px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>View Order Details →</button>
          <button type="button" onClick={() => go('/shop')} style={{ width: '100%', maxWidth: '420px', margin: '0 auto', background: 'transparent', border: '1px solid rgba(27,24,22,0.18)', color: '#1B1816', borderRadius: '999px', padding: '16px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Continue Shopping →</button>
          <button type="button" onClick={() => { const blob = new Blob(['Order receipt for ' + orderId], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `nova-order-${orderId}.pdf`; a.click(); URL.revokeObjectURL(url); }} style={{ width: '100%', maxWidth: '420px', margin: '0 auto', background: 'transparent', border: 'none', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Download Tax Invoice (PDF)</button>
        </section>

        <footer style={{ maxWidth: '960px', margin: '30px auto 0', borderTop: '1px solid rgba(27,24,22,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>
          <span>© 2026 NovaShop. All rights reserved.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href="#" style={{ color: '#1B1816', textDecoration: 'none' }}>Privacy Policy</a>
            <span>·</span>
            <a href="#" style={{ color: '#1B1816', textDecoration: 'none' }}>Terms of Service</a>
            <span>·</span>
            <button type="button" onClick={() => go('/support')} style={{ background: 'transparent', border: 'none', color: '#1B1816', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Contact Support</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
