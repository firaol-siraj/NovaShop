import { useState } from 'react';
import { PRODUCT_DATA } from '../../data/products';
import { AdminIcon } from '../../components/admin/AdminLayout';

const orderItems = [
  { category: 'Apparel · Suiting', name: 'Tailored Double-Breasted Blazer', variant: 'Espresso / 38R', sku: 'NS-BLZ-001', price: '$590.00', image: PRODUCT_DATA[0].primaryImage },
  { category: 'Leather Goods · Handbags', name: 'Box Leather Top Handle Bag', variant: 'Espresso / One size', sku: 'NS-BAG-008', price: '$420.00', image: PRODUCT_DATA[3].primaryImage },
  { category: 'Footwear · Loafers', name: 'Burnished Leather Penny Loafer', variant: 'Espresso / 42 EU', sku: 'NS-SHO-014', price: '$340.00', image: PRODUCT_DATA[5].primaryImage },
];

const activity = [
  { tone: 'blue', title: 'Status updated to Processing', actor: 'Elena Vasquez', details: 'Inventory reserved from SoHo hub', time: 'Oct 24, 2026 · 15:40 GMT' },
  { tone: 'green', title: 'Payment captured', actor: 'Stripe', details: '3D-Secure verified · Mastercard ending in 4242', time: 'Oct 24, 2026 · 14:33 GMT' },
  { tone: 'ink', title: 'Order placed', actor: 'Web Checkout', details: 'Order submitted from customer checkout', time: 'Oct 24, 2026 · 14:32 GMT' },
  { tone: 'gray', title: 'Confirmation email dispatched', actor: 'SendGrid', details: 'Delivered to sophia.sterling@email.com', time: 'Oct 24, 2026 · 14:32 GMT' },
];

const fulfillmentSteps = [
  { label: 'Order Placed', first: 'Oct 24, 14:32 GMT', second: 'Web Checkout', icon: 'check' },
  { label: 'Processing', first: 'Oct 24, 15:40 GMT', second: 'Allocated & Bagged', icon: 'dot' },
  { label: 'Shipped', first: 'Est. Carrier: DHL Express', second: 'Pickup scheduled 17:00', icon: 'truck' },
  { label: 'Delivered', first: 'Est. Oct 28, 2026', second: 'Signature Required', icon: 'package' },
];

function OrderStatusSelect({ status, onChange }) {
  return (
    <label className={`admin-status-pill ${status.toLowerCase()} order-detail-status`}>
      <select value={status} onChange={(event) => onChange(event.target.value)} aria-label="Change order status">
        {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((option) => <option key={option}>{option}</option>)}
      </select>
      <AdminIcon name="chevron" size={12} />
    </label>
  );
}

function DetailCard({ className = '', children }) {
  return <section className={`admin-card order-detail-card ${className}`}>{children}</section>;
}

export default function AdminOrderDetailPage({ orderId = 'NS-8924', go }) {
  const [status, setStatus] = useState('Processing');
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const statusIndex = status === 'Pending' ? 0 : status === 'Processing' ? 1 : status === 'Shipped' ? 2 : status === 'Delivered' ? 3 : 1;
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText('sophia.sterling@email.com');
      notify('Customer email copied.');
    } catch {
      notify('Customer email: sophia.sterling@email.com');
    }
  };

  const addNote = (event) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    setNotes((current) => [{ text: trimmed, time: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) }, ...current]);
    setNote('');
    notify('Internal note added.');
  };

  const confirmCancellation = () => {
    setStatus('Cancelled');
    setCancelOpen(false);
    notify('Order cancelled and refund initiated.');
  };

  return (
    <div className="admin-dashboard order-detail-page">
      <button className="order-detail-breadcrumb" type="button" onClick={() => go('/admin/orders')}>
        <AdminIcon name="left" size={15} /><span>Orders</span><i>/</i><strong>#{orderId}</strong>
      </button>

      <header className="order-detail-page-header">
        <div className="order-detail-title-group">
          <h1>Order <span>#{orderId}</span></h1>
          <div className="order-detail-subtitle"><OrderStatusSelect status={status} onChange={setStatus} /><span>Placed Oct 24, 2026 at 14:32 GMT · Customer: <button type="button" onClick={() => notify('Customer profile selected.')}>Sophia Sterling</button></span></div>
        </div>
        <div className="order-detail-header-actions">
          <button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="document" size={15} /> Print Invoice</button>
          <button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="truck" size={15} /> Print Shipping Label</button>
          <button className="admin-action-button is-primary" type="button" onClick={() => setStatus('Shipped')}><AdminIcon name="check" size={15} /> Mark as Shipped</button>
          <div className="order-detail-menu-wrap">
            <button className="admin-action-button order-detail-more" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="More order actions" aria-expanded={menuOpen}><AdminIcon name="more" size={17} /></button>
            {menuOpen && <div className="order-detail-menu"><button type="button" onClick={() => { navigator.clipboard?.writeText(orderId); setMenuOpen(false); notify('Order ID copied.'); }}><AdminIcon name="copy" size={14} /> Copy order ID</button><button type="button" onClick={() => { setMenuOpen(false); notify('Order flagged for review.'); }}><AdminIcon name="warning" size={14} /> Flag for review</button></div>}
          </div>
        </div>
      </header>

      <DetailCard className="order-fulfillment-card">
        <div className="order-detail-card-header">
          <div className="order-detail-card-title"><h2>Fulfillment Status</h2><span className="order-priority-badge">Priority</span></div>
          <button type="button" className="admin-text-link" onClick={() => notify('Shipping label generated for DHL Express.')}>Generate Shipping Label <span aria-hidden="true">→</span></button>
        </div>
        <ol className="order-progress-track">
          {fulfillmentSteps.map((step, index) => {
            const complete = index < statusIndex;
            const active = index === statusIndex;
            return (
              <li key={step.label} className={`order-progress-step${complete ? ' is-complete' : ''}${active ? ' is-current' : ''}`}>
                <div className="order-progress-marker">
                  {step.icon === 'dot' ? <i /> : <AdminIcon name={step.icon} size={15} />}
                </div>
                {index < fulfillmentSteps.length - 1 && <span className="order-progress-connector" />}
                <div className="order-progress-label">{step.label}{active && <small>Active</small>}</div>
                <div className="order-progress-meta">{step.first}<span>{step.second}</span></div>
              </li>
            );
          })}
        </ol>
        <div className="order-warehouse-callout"><span><AdminIcon name="check" size={14} /> Warehouse Hub SoHo (Bin 14-B) · Quality audit passed</span><button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="document" size={14} /> Dispatch Slip</button></div>
      </DetailCard>

      <div className="order-detail-columns">
        <div className="order-detail-main-column">
          <DetailCard className="order-items-card">
            <div className="order-detail-card-header"><div className="order-detail-card-title"><h2>Order Items (3)</h2><span className="order-stock-badge"><AdminIcon name="check" size={12} /> 3 items · In stock</span></div><span className="order-warehouse-name">New York Warehouse</span></div>
            <div className="order-items-list">
              {orderItems.map((item) => (
                <article className="order-detail-item-row" key={item.sku}>
                  <img src={item.image} alt={item.name} />
                  <div className="order-detail-item-copy"><span className="order-item-category">{item.category}</span><strong>{item.name}</strong><span className="order-item-sku">{item.variant} · SKU: {item.sku}</span><span className="order-ready-pill">Ready to pack</span></div>
                  <div className="order-item-price"><span>Qty: 1</span><span>{item.price} / unit</span><strong>{item.price}</strong></div>
                </article>
              ))}
            </div>
            <div className="order-packaging-note"><AdminIcon name="package" size={16} /><span>Packaging: Dust bag, cedar shoehorn, and luxury gift wrap included across this order.</span></div>
          </DetailCard>

          <DetailCard className="order-financial-card">
            <div className="order-detail-card-header"><div className="order-detail-card-title"><h2>Financial Summary</h2></div></div>
            <div className="order-financial-layout">
              <div className="order-payment-channel">
                <div className="order-financial-subhead"><span>Payment Channel</span><span className="order-paid-badge">Paid</span></div>
                <div className="order-card-brand"><AdminIcon name="payments" size={18} /><strong>Mastercard ending in 4242</strong></div>
                <p>Expires 08/29 · Cardholder: Sophia Sterling</p>
                <button className="order-payment-toggle" type="button" onClick={() => setPaymentExpanded((expanded) => !expanded)} aria-expanded={paymentExpanded}>Payment Details <span>{paymentExpanded ? '⌃' : '⌄'}</span></button>
                {paymentExpanded && <div className="order-payment-expanded"><span>Transaction ID</span><strong>ch_3Q8N2X5K · Stripe</strong><span>Authorization</span><strong>3D-Secure verified</strong></div>}
              </div>
              <div className="order-total-breakdown">
                <div><span>Subtotal (3 items)</span><strong>$1,350.00</strong></div>
                <div><span>Shipping (DHL Express 24h)</span><strong className="order-positive-value">Complimentary</strong></div>
                <div><span>Promotional Code <i>AUTUMN26</i></span><strong className="order-discount-value">−$120.00</strong></div>
                <div><span>Estimated Tax (NY State 8.875%)</span><strong>$50.00</strong></div>
                <div className="order-total-paid"><span><strong>Total Paid</strong><small>Inclusive of state &amp; local luxury tax</small></span><b>$1,280.00</b></div>
              </div>
            </div>
          </DetailCard>
        </div>

        <aside className="order-detail-side-column">
          <DetailCard className="order-customer-card">
            <div className="order-detail-card-header"><h2>Customer</h2><span className="order-vip-badge">VIP Tier 1</span><button className="admin-text-link" type="button" onClick={() => notify('Customer profile selected.')}>Profile</button></div>
            <div className="order-customer-profile"><span className="order-customer-avatar">SS</span><div><strong>Sophia Sterling</strong><div><span>sophia.sterling@email.com</span><button type="button" aria-label="Copy customer email" onClick={copyEmail}><AdminIcon name="copy" size={12} /></button></div><span>+1 (212) 555-0148</span></div></div>
            <div className="order-customer-stats"><div><strong>12</strong><span>Total Orders</span></div><div><strong>$8.2k</strong><span>Lifetime Value</span></div><div><strong>2.1y</strong><span>Since 2024</span></div></div>
          </DetailCard>

          <DetailCard className="order-address-card">
            <div className="order-detail-card-header"><h2>Shipping Address</h2><button className="admin-text-link" type="button" onClick={() => notify('Address editor opened.')}>Edit Address</button></div>
            <div className="order-address-content"><AdminIcon name="location" size={16} /><address>Sophia Sterling<br />148 Mercer Street, Apt 4B<br />New York, NY 10012<br />United States</address></div>
            <p className="order-address-note"><strong>Note:</strong> Leave with front desk / concierge if unavailable.</p>
          </DetailCard>

          <DetailCard className="order-address-card">
            <div className="order-detail-card-header"><h2>Billing Address</h2><span className="order-verified-badge"><AdminIcon name="check" size={11} /> Verified</span></div>
            <p className="order-same-address">Same as shipping address</p>
            <address className="order-billing-address">Sophia Sterling<br />148 Mercer Street, Apt 4B<br />New York, NY 10012<br />United States</address>
          </DetailCard>

          <DetailCard className="order-fulfillment-details-card">
            <div className="order-detail-card-header"><h2>Fulfillment Details</h2><span className="order-hub-badge">HUB-NYC</span></div>
            <div className="order-fulfillment-info"><span>Courier</span><strong>DHL Global Express</strong><small>Est: Tomorrow morning</small><span>Tracking State</span><strong className="order-tracking-state"><i /> Ready for label</strong></div>
          </DetailCard>

          <DetailCard className="order-risk-card">
            <div className="order-detail-card-header"><h2>Risk Assessment</h2><span className="order-low-risk-badge"><i /> Low Risk (0.02)</span></div>
            <p>Trusted customer · 24mo clean history.</p>
          </DetailCard>
        </aside>
      </div>

      <DetailCard className="order-notes-card">
        <div className="order-detail-card-header"><div className="order-detail-card-title"><AdminIcon name="lock" size={15} /><h2>Internal Notes &amp; Activity Log</h2></div><span className="order-admin-only"><AdminIcon name="lock" size={12} /> Admin Access Only</span></div>
        <form className="order-note-form" onSubmit={addNote}><label htmlFor="order-internal-note"><AdminIcon name="lock" size={12} /> Visible only to store staff</label><textarea id="order-internal-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an internal note for staff (e.g. packaging instructions, concierge callbacks)..." /><button className="admin-action-button is-primary" type="submit" disabled={!note.trim()}>Add Note</button></form>
        <h3 className="order-audit-heading">Historical Audit Trail</h3>
        <ol className="order-audit-trail">
          {notes.map((entry, index) => <li key={`${entry.time}-${index}`} className="order-audit-entry"><i className="note-dot" /><div><p><strong>Internal note added</strong> by Elena Vasquez</p><span>{entry.time} · {entry.text}</span></div></li>)}
          {activity.map((entry) => <li key={entry.title} className={`order-audit-entry ${entry.tone}`}><i className="note-dot" /><div><p><strong>{entry.title}</strong> by {entry.actor}</p><span>{entry.time} · {entry.details}</span></div></li>)}
        </ol>
      </DetailCard>

      <section className="order-danger-zone">
        <div className="order-danger-copy"><span className="order-danger-icon"><AdminIcon name="warning" size={18} /></span><div><h2>Cancel Order &amp; Issue Full Refund</h2><p>Refunds cannot be undone. Will automatically credit <strong>$1,280.00</strong> back to Mastercard ending in 4242 and return 3 items to warehouse inventory.</p></div></div>
        <button type="button" onClick={() => setCancelOpen(true)}>Cancel &amp; Refund</button>
      </section>

      {cancelOpen && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCancelOpen(false)}><section className="admin-order-modal order-refund-modal" role="dialog" aria-modal="true" aria-labelledby="order-refund-title"><div className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Refund confirmation</span><h2 id="order-refund-title">Cancel this order?</h2></div><button className="admin-icon-button" type="button" onClick={() => setCancelOpen(false)} aria-label="Close refund confirmation"><AdminIcon name="close" /></button></div><p>Refund $1,280.00 to Mastercard ending in 4242 and return all 3 items to warehouse inventory.</p><div><button className="admin-action-button" type="button" onClick={() => setCancelOpen(false)}>Keep Order</button><button type="button" onClick={confirmCancellation}>Confirm Cancel &amp; Refund</button></div></section></div>}
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}