import { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';

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
  timeZone: 'UTC',
});

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function getStatusMeta(status) {
  const normalized = (status || 'confirmed').toLowerCase();
  const presets = {
    confirmed: { label: 'Confirmed', badge: 'CONFIRMED' },
    processing: { label: 'Processing', badge: 'PROCESSING' },
    'in-transit': { label: 'In Transit', badge: 'IN TRANSIT' },
    delivered: { label: 'Delivered', badge: 'DELIVERED' },
  };
  return presets[normalized] || presets.confirmed;
}

export default function OrderDetailsPage({ go, orderId }) {
  const { orders } = useCart();
  const [copied, setCopied] = useState(false);

  const order = useMemo(() => {
    return orders.find((entry) => (entry.orderId || entry.id) === orderId) || null;
  }, [orders, orderId]);

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: '#F9F5F0', padding: '40px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '12px' }}>Order not found</div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(38px, 5vw, 58px)', fontStyle: 'italic', color: '#1B1816', letterSpacing: '-0.04em' }}>We couldn’t find that order.</h1>
          <p style={{ margin: '16px 0 22px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#665F5B' }}>Please check your order history or continue shopping.</p>
          <button type="button" onClick={() => go('/account/orders')} style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '14px 22px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Back to Order History</button>
        </div>
      </div>
    );
  }

  const statusMeta = getStatusMeta(order.status);
  const placedAt = new Date(order.placedAt || order.createdAt || Date.now());
  const deliveryStart = new Date(order.deliveryWindow?.start || Date.now() + 1000 * 60 * 60 * 24 * 4);
  const deliveryEnd = new Date(order.deliveryWindow?.end || Date.now() + 1000 * 60 * 60 * 24 * 6);
  const shippingMethod = order.shippingMethod || 'Standard Delivery';
  const courier = order.courier || 'DHL Express Worldwide';
  const waybill = order.waybill || 'MSX29471939';
  const fullName = order.fullName || `${order.firstName || 'Elena'} ${order.lastName || 'Vasquez'}`;
  const address = order.deliveryAddress || {
    address: order.address || 'Bole Sub-City, Namibia St.',
    address2: order.address2 || 'Villa 14, Bole Diplomatic Zone',
    city: order.city || 'Addis Ababa',
    postalCode: order.postalCode || '1000',
    country: order.country || 'Ethiopia',
  };

  const statusHistory = order.statusHistory || [
    { step: 'confirmed', timestamp: placedAt.toISOString(), note: 'Payment verified' },
    { step: 'processing', timestamp: new Date(placedAt.getTime() + 86400000).toISOString(), note: 'Garment inspection' },
    { step: 'in-transit', timestamp: null, note: 'Courier handover', expected: '2026-10-28' },
    { step: 'delivered', timestamp: null, note: 'Signature required', expected: '2026-10-28–2026-10-30' },
  ];

  const timelineSteps = [
    { key: 'confirmed', label: 'Order Confirmed', note: 'Payment verified', time: statusHistory[0]?.timestamp, filled: true },
    { key: 'processing', label: 'Processing', note: statusHistory[1]?.note || 'Garment inspection', time: statusHistory[1]?.timestamp || 'Oct 25, 09:15 GMT', filled: true },
    { key: 'in-transit', label: 'In Transit', note: 'Courier handover', time: 'Expected Oct 28', filled: order.status === 'in-transit' || order.status === 'delivered' },
    { key: 'delivered', label: 'Delivered', note: 'Signature required', time: 'Est. Oct 28 – Oct 30', filled: order.status === 'delivered' },
  ];

  const handleCopyWaybill = async () => {
    try {
      await navigator.clipboard.writeText(waybill);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleInvoiceDownload = () => {
    const blob = new Blob([`Invoice ${order.orderId || orderId}\n\nOrder placed: ${placedAt.toISOString()}`], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${(order.orderId || orderId).replace(/\s+/g, '-').toLowerCase()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9F5F0', padding: '28px 24px 40px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', marginBottom: '22px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => go('/account/orders')} style={{ background: 'none', border: 'none', color: '#1B1816', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>← Back to Order History</button>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Account / Orders / #{order.orderId || orderId}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '18px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '12px' }}>Client Receipt &amp; Status</div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(42px, 5vw, 62px)', fontStyle: 'italic', color: '#1B1816', letterSpacing: '-0.04em' }}>Order Details</h1>
            <div style={{ marginTop: '10px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6D6661' }}>Order #{order.orderId || orderId} · Placed {dateTimeFormatter.format(placedAt)} GMT</div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handlePrint} style={{ border: '1px solid rgba(27,24,22,0.18)', background: 'transparent', color: '#1B1816', borderRadius: '999px', padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>🖶 Print Receipt</button>
            <button type="button" onClick={handleInvoiceDownload} style={{ border: '1px solid rgba(27,24,22,0.18)', background: 'transparent', color: '#1B1816', borderRadius: '999px', padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>⬇ Download Invoice (PDF)</button>
          </div>
        </div>

        <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>● {statusMeta.badge}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>Estimated Delivery: {dateFormatter.format(deliveryStart)} – {dateFormatter.format(deliveryEnd)}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6D6661' }}>Courier: {courier}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816' }}>
              <span>WAYBILL: {waybill}</span>
              <button type="button" onClick={handleCopyWaybill} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1B1816', fontSize: '12px' }}>{copied ? 'Copied!' : '🔗'}</button>
            </div>
            <button type="button" onClick={() => window.open('https://www.dhl.com', '_blank')} style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Track Package</button>
          </div>
        </div>

        <div style={{ maxWidth: '1000px', margin: '0 auto 26px', background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '20px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '14px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '18px', left: '8%', right: '8%', height: '1px', background: 'rgba(27,24,22,0.18)' }} />
            {timelineSteps.map((step, index) => {
              const isFilled = step.filled || index === 0;
              const isCurrent = index === 1 && !step.filled;
              return (
                <div key={step.label} style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isFilled ? '#1B1816' : '#F5F0E9', border: `1.5px solid ${isFilled ? '#1B1816' : 'rgba(27,24,22,0.2)'}`, color: isFilled ? '#FDFBF7' : '#1B1816', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>{isFilled ? '✓' : '○'}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: isFilled ? '#1B1816' : '#7A726C', fontWeight: isCurrent ? 700 : 500 }}>{step.label}</div>
                  <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6D6661' }}>{step.time}</div>
                  <div style={{ marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#7A726C' }}>{step.note}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.8fr)', gap: '28px' }}>
          <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Purchased Pieces</h2>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>{(order.items || []).length} UNIQUE ITEMS</span>
            </div>

            <div style={{ display: 'grid', gap: '18px' }}>
              {(order.items || []).map((item) => (
                <div key={`${item.id}-${item.color}-${item.size}`} style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto', gap: '14px', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(27,24,22,0.08)' }}>
                  <img src={item.image} alt={item.name} style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', background: '#EFEAE4' }} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '6px' }}>{item.collection || 'AUTUMN/WINTER 2026 ARCHIVE'}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, color: '#1B1816', lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', marginTop: '6px' }}>{item.color} · Size {item.size} · Qty: {item.qty || 1}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#7A726C', marginTop: '4px' }}>SKU: {item.sku || 'BLZ-AUT26-ESP-42'}</div>
                    <button type="button" onClick={() => go('/support')} style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '10px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1B1816', textDecoration: 'underline', cursor: 'pointer' }}>Request Size Exchange Or Return</button>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', fontWeight: 700, color: '#1B1816', whiteSpace: 'nowrap' }}>{formatMoney((item.price || 0) * (item.qty || 1))}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '18px' }}>
            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Order Summary</h2>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Subtotal</span>
                  <strong>{formatMoney(order.summary?.subtotal || order.subtotal || 0)}</strong>
                </div>
                {order.summary?.discountCode || order.appliedPromo ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>✓</span> {order.summary?.discountCode || order.appliedPromo}</span>
                    <strong>-{formatMoney(order.summary?.discountAmount || order.promoDiscount || 0)}</strong>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Shipping</span>
                  <strong>{order.shippingPrice > 0 ? formatMoney(order.shippingPrice) : 'Complimentary'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span>Tax / Duties</span>
                  <strong>Included</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(27,24,22,0.08)', margin: '16px 0 14px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: '#1B1816' }}>Total Paid</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '30px', lineHeight: 1, fontWeight: 700, color: '#1B1816' }}>{formatMoney(order.summary?.totalPaid || order.total || 0)}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>USD</span>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#7A726C', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Taxes &amp; customs prepaid</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#1B1816' }}>
                <span style={{ display: 'inline-flex', width: '22px', height: '22px', borderRadius: '6px', background: '#1B1816', color: '#FDFBF7', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>MC</span>
                <span>MASTERCARD •••• {order.cardLast4 || '8832'}</span>
                <span style={{ background: '#E6F4EB', color: '#227B51', borderRadius: '999px', padding: '4px 8px', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Paid</span>
              </div>
              <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#7A726C' }}>Settled on {dateFormatter.format(placedAt)}</div>
            </div>

            <div style={{ background: '#F8F4EE', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Delivery Address</h2>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.8, color: '#1B1816' }}>
                <div>{fullName}</div>
                <div>{address.address}</div>
                <div>{address.address2}</div>
                <div>{address.city} {address.postalCode}, {address.country}</div>
                <div>📞 {order.phone || '+251 91 123 4567'}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '960px', margin: '20px auto 0', display: 'grid', gap: '12px' }}>
          <button type="button" onClick={() => window.open('https://www.dhl.com', '_blank')} style={{ width: '100%', background: '#1B1816', border: 'none', color: '#FDFBF7', borderRadius: '999px', padding: '16px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Track Shipment →</button>
          <button type="button" onClick={() => go('/shop')} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(27,24,22,0.18)', color: '#1B1816', borderRadius: '999px', padding: '16px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Continue Shopping</button>
          <button type="button" onClick={() => go('/support')} style={{ background: 'transparent', border: 'none', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: 0, textAlign: 'center' }}>Contact Support</button>
        </div>

        <footer style={{ maxWidth: '1200px', margin: '28px auto 0', borderTop: '1px solid rgba(27,24,22,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>
          <span>© 2026 NovaShop. All rights reserved.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href="#" style={{ color: '#1B1816', textDecoration: 'none' }}>Privacy Policy</a>
            <span>·</span>
            <a href="#" style={{ color: '#1B1816', textDecoration: 'none' }}>Terms of Service</a>
            <span>·</span>
            <button type="button" onClick={() => go('/support')} style={{ background: 'transparent', border: 'none', color: '#1B1816', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Contact</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
