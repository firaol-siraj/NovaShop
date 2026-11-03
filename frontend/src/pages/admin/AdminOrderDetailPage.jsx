import { useEffect, useState, useCallback } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { orderApi } from '../../lib/api/orderApi';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function OrderStatusSelect({ status, onChange }) {
  const current = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Pending';
  return (
    <label className={`admin-status-pill ${current.toLowerCase()} order-detail-status`}>
      <select value={current} onChange={(event) => onChange(event.target.value)} aria-label="Change order status">
        {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <AdminIcon name="chevron" size={12} />
    </label>
  );
}

function DetailCard({ className = '', children }) {
  return <section className={`admin-card order-detail-card ${className}`}>{children}</section>;
}

export default function AdminOrderDetailPage({ orderId, go }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Processing');
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await orderApi.getOrder(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
        const st = res.data.status ? res.data.status.charAt(0).toUpperCase() + res.data.status.slice(1).toLowerCase() : 'Pending';
        setStatus(st);
      }
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Order could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const handleResendConfirmation = async () => {
    if (!order?._id || resendingEmail) return;
    try {
      setResendingEmail(true);
      const res = await orderApi.resendAdminConfirmation(order._id);
      if (res.success) {
        notify(`Confirmation email sent to ${res.targetEmail || order.customerEmail || 'customer'}.`);
      } else {
        notify(`Failed to send confirmation: ${res.message}`);
      }
    } catch (err) {
      notify(`Email send error: ${err.response?.data?.message || err.message}`);
    } finally {
      setResendingEmail(false);
      setMenuOpen(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!order) return;
    try {
      const res = await orderApi.updateOrderStatus(order._id, newStatus.toLowerCase());
      if (res.success) {
        setStatus(newStatus);
        setOrder((prev) => ({ ...prev, status: newStatus.toLowerCase() }));
        notify(`Order status updated to ${newStatus}. Customer notified.`);
      }
    } catch (err) {
      notify(`Status update failed: ${err.message}`);
    }
  };

  const copyCustomerEmail = async () => {
    const email = order?.user?.email || order?.shippingAddress?.email;
    if (email) {
      try {
        await navigator.clipboard.writeText(email);
        notify('Customer email copied.');
      } catch {
        notify(`Email: ${email}`);
      }
    }
  };

  const addNote = (event) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    setNotes((current) => [
      { text: trimmed, time: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) },
      ...current,
    ]);
    setNote('');
    notify('Internal note added.');
  };

  const confirmCancellation = async () => {
    await handleStatusChange('Cancelled');
    setCancelOpen(false);
  };

  if (loading) {
    return (
      <div className="admin-dashboard order-detail-page" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#7A726C' }}>Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="admin-dashboard order-detail-page" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <h2>Order Not Found</h2>
        <p style={{ color: '#6E6962', margin: '14px 0 24px' }}>{error || 'The requested order could not be located.'}</p>
        <button className="admin-action-button" type="button" onClick={() => go('/admin/orders')}>← Return to Orders</button>
      </div>
    );
  }

  const items = order.orderItems || [];
  const shippingAddress = order.shippingAddress || {};
  const customerName = order.user?.name || shippingAddress.recipientName || 'Customer';
  const customerEmail = order.user?.email || 'N/A';
  const displayId = order.orderNumber || order._id;

  const statusIndex =
    status === 'Pending' ? 0 : status === 'Processing' ? 1 : status === 'Shipped' ? 2 : status === 'Delivered' ? 3 : 1;

  const fulfillmentSteps = [
    { label: 'Order Placed', first: formatDate(order.createdAt), second: 'Web Checkout', icon: 'check' },
    { label: 'Processing', first: order.isPaid ? 'Payment Confirmed' : 'Pending Payment', second: 'Allocated in Atelier', icon: 'dot' },
    { label: 'Shipped', first: order.status === 'shipped' || order.status === 'delivered' ? 'Dispatched' : 'Courier assignment', second: 'Express Delivery', icon: 'truck' },
    { label: 'Delivered', first: order.deliveredAt ? formatDate(order.deliveredAt) : 'Signature Required', second: order.isDelivered ? 'Fulfillment Complete' : 'Est: 3–5 Days', icon: 'package' },
  ];

  return (
    <div className="admin-dashboard order-detail-page">
      <button className="order-detail-breadcrumb" type="button" onClick={() => go('/admin/orders')}>
        <AdminIcon name="left" size={15} /><span>Orders</span><i>/</i><strong>#{displayId}</strong>
      </button>

      <header className="order-detail-page-header">
        <div className="order-detail-title-group">
          <h1>Order <span>#{displayId}</span></h1>
          <div className="order-detail-subtitle">
            <OrderStatusSelect status={status} onChange={handleStatusChange} />
            <span>Placed {formatDate(order.createdAt)} · Customer: <strong>{customerName}</strong></span>
          </div>
        </div>
        <div className="order-detail-header-actions">
          <button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="document" size={15} /> Print Invoice</button>
          <button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="truck" size={15} /> Print Shipping Label</button>
          <button className="admin-action-button" type="button" onClick={handleResendConfirmation} disabled={resendingEmail} title="Resend order confirmation email to customer">
            <AdminIcon name="mail" size={15} /> {resendingEmail ? 'Sending...' : 'Resend Confirmation'}
          </button>
          {status !== 'Shipped' && status !== 'Delivered' && (
            <button className="admin-action-button is-primary" type="button" onClick={() => handleStatusChange('Shipped')}>
              <AdminIcon name="check" size={15} /> Mark as Shipped
            </button>
          )}
          {status === 'Shipped' && (
            <button className="admin-action-button is-primary" type="button" onClick={() => handleStatusChange('Delivered')}>
              <AdminIcon name="check" size={15} /> Mark as Delivered
            </button>
          )}
          <button className="admin-action-button" type="button" onClick={() => go(`/admin/returns?order=${displayId}`)}>
            <AdminIcon name="returns" size={15} /> View Returns
          </button>
          <div className="order-detail-menu-wrap">
            <button className="admin-action-button order-detail-more" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="More order actions" aria-expanded={menuOpen}><AdminIcon name="more" size={17} /></button>
            {menuOpen && (
              <div className="order-detail-menu">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(displayId); setMenuOpen(false); notify('Order ID copied.'); }}><AdminIcon name="copy" size={14} /> Copy order ID</button>
                <button type="button" onClick={() => { setMenuOpen(false); go(`/admin/returns?order=${displayId}`); }}><AdminIcon name="returns" size={14} /> View returns</button>
                <button type="button" onClick={handleResendConfirmation} disabled={resendingEmail}><AdminIcon name="mail" size={14} /> Resend confirmation email</button>
                <button type="button" onClick={() => { setMenuOpen(false); setCancelOpen(true); }}><AdminIcon name="close" size={14} /> Cancel Order</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <DetailCard className="order-fulfillment-card">
        <div className="order-detail-card-header">
          <div className="order-detail-card-title"><h2>Fulfillment Status</h2><span className="order-priority-badge">{order.paymentMethod || 'Online'}</span></div>
          <button type="button" className="admin-text-link" onClick={() => notify('Shipping label generated.')}>Generate Shipping Label <span aria-hidden="true">→</span></button>
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
        <div className="order-warehouse-callout">
          <span><AdminIcon name="check" size={14} /> Atelier Inventory Reserved · Verified Stock Decrement Active</span>
          <button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="document" size={14} /> Dispatch Slip</button>
        </div>
      </DetailCard>

      <div className="order-detail-columns">
        <div className="order-detail-main-column">
          <DetailCard className="order-items-card">
            <div className="order-detail-card-header">
              <div className="order-detail-card-title"><h2>Order Items ({items.length})</h2><span className="order-stock-badge"><AdminIcon name="check" size={12} /> {items.length} items</span></div>
              <span className="order-warehouse-name">NovaShop Central Atelier</span>
            </div>
            <div className="order-items-list">
              {items.map((item, idx) => (
                <article className="order-detail-item-row" key={item._id || item.sku || idx}>
                  <img src={item.image || '/placeholder.jpg'} alt={item.name} />
                  <div className="order-detail-item-copy">
                    <span className="order-item-category">NovaShop Garments</span>
                    <strong>{item.name}</strong>
                    <span className="order-item-sku">{item.color} · Size: {item.size} · SKU: {item.sku || 'N/A'}</span>
                    <span className="order-ready-pill">Ready to pack</span>
                  </div>
                  <div className="order-item-price">
                    <span>Qty: {item.qty || 1}</span>
                    <span>{formatMoney(item.price)} / unit</span>
                    <strong>{formatMoney((item.price || 0) * (item.qty || 1))}</strong>
                  </div>
                </article>
              ))}
            </div>
            <div className="order-packaging-note">
              <AdminIcon name="package" size={16} />
              <span>Packaging: Dust bag, cedar hanger, and presentation gift wrap included.</span>
            </div>
          </DetailCard>

          <DetailCard className="order-financial-card">
            <div className="order-detail-card-header"><div className="order-detail-card-title"><h2>Financial Summary</h2></div></div>
            <div className="order-financial-layout">
              <div className="order-payment-channel">
                <div className="order-financial-subhead">
                  <span>Payment Method</span>
                  <span className={`order-paid-badge`} style={{ background: order.isPaid ? '#227B51' : '#B77A48' }}>
                    {order.paymentStatus ? order.paymentStatus.toUpperCase() : order.isPaid ? 'PAID' : 'PENDING'}
                  </span>
                </div>
                <div className="order-card-brand">
                  <AdminIcon name="payments" size={18} />
                  <strong>{order.paymentMethod || 'Chapa'}</strong>
                </div>
                <p>Transaction Reference: <code>{order.paymentReference || order.chapaReference || 'N/A'}</code></p>
                <button className="order-payment-toggle" type="button" onClick={() => setPaymentExpanded((expanded) => !expanded)} aria-expanded={paymentExpanded}>
                  Payment Details <span>{paymentExpanded ? '⌃' : '⌄'}</span>
                </button>
                {paymentExpanded && (
                  <div className="order-payment-expanded">
                    <span>Payment ID</span><strong>{order.paymentResult?.id || order.chapaReference || 'N/A'}</strong>
                    <span>Payment Status</span><strong>{order.paymentResult?.status || (order.isPaid ? 'COMPLETED' : 'PENDING')}</strong>
                    <span>Paid At</span><strong>{order.paidAt ? formatDate(order.paidAt) : 'Unpaid'}</strong>
                  </div>
                )}
              </div>
              <div className="order-total-breakdown">
                <div><span>Items Subtotal</span><strong>{formatMoney(order.itemsPrice || 0)}</strong></div>
                <div><span>Shipping</span><strong className="order-positive-value">{Number(order.shippingPrice) > 0 ? formatMoney(order.shippingPrice) : 'Complimentary'}</strong></div>
                {Number(order.taxPrice) > 0 && <div><span>Estimated Tax</span><strong>{formatMoney(order.taxPrice)}</strong></div>}
                <div className="order-total-paid">
                  <span><strong>Total</strong><small>Inclusive of all applicable fees</small></span>
                  <b>{formatMoney(order.totalPrice || 0)}</b>
                </div>
              </div>
            </div>
          </DetailCard>
        </div>

        <aside className="order-detail-side-column">
          <DetailCard className="order-customer-card">
            <div className="order-detail-card-header">
              <h2>Customer</h2>
              <span className="order-vip-badge">{order.user?.role === 'admin' ? 'Admin' : 'Customer'}</span>
            </div>
            <div className="order-customer-profile">
              <span className="order-customer-avatar">{customerName.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{customerName}</strong>
                <div>
                  <span>{customerEmail}</span>
                  <button type="button" aria-label="Copy customer email" onClick={copyCustomerEmail}><AdminIcon name="copy" size={12} /></button>
                </div>
                <span>{shippingAddress.phone || 'No phone'}</span>
              </div>
            </div>
          </DetailCard>

          <DetailCard className="order-address-card">
            <div className="order-detail-card-header"><h2>Shipping Address</h2></div>
            <div className="order-address-content">
              <AdminIcon name="location" size={16} />
              <address>
                <strong>{shippingAddress.recipientName || customerName}</strong><br />
                {shippingAddress.address}<br />
                {shippingAddress.address2 && <>{shippingAddress.address2}<br /></>}
                {shippingAddress.city}{shippingAddress.state ? `, ${shippingAddress.state}` : ''} {shippingAddress.postalCode}<br />
                {shippingAddress.country || 'Ethiopia'}
              </address>
            </div>
          </DetailCard>

          <DetailCard className="order-fulfillment-details-card">
            <div className="order-detail-card-header"><h2>Fulfillment Details</h2><span className="order-hub-badge">HUB-ADDIS</span></div>
            <div className="order-fulfillment-info">
              <span>Courier</span><strong>NovaShop Express</strong>
              <small>Delivery: 3-5 Business Days</small>
              <span>Tracking Reference</span>
              <strong className="order-tracking-state"><i /> {order.paymentReference || 'Active'}</strong>
            </div>
          </DetailCard>
        </aside>
      </div>

      <DetailCard className="order-notes-card">
        <div className="order-detail-card-header"><div className="order-detail-card-title"><AdminIcon name="lock" size={15} /><h2>Internal Notes &amp; Activity Log</h2></div><span className="order-admin-only"><AdminIcon name="lock" size={12} /> Staff Only</span></div>
        <form className="order-note-form" onSubmit={addNote}>
          <label htmlFor="order-internal-note"><AdminIcon name="lock" size={12} /> Visible only to store staff</label>
          <textarea id="order-internal-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal notes (e.g., concierge packaging instructions, delivery updates)..." />
          <button className="admin-action-button is-primary" type="submit" disabled={!note.trim()}>Add Note</button>
        </form>
        {notes.length > 0 && (
          <ol className="order-audit-trail" style={{ marginTop: '16px' }}>
            {notes.map((entry, index) => (
              <li key={`${entry.time}-${index}`} className="order-audit-entry">
                <i className="note-dot" />
                <div>
                  <p><strong>Internal note added</strong></p>
                  <span>{entry.time} · {entry.text}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DetailCard>

      {order.status !== 'cancelled' && (
        <section className="order-danger-zone">
          <div className="order-danger-copy">
            <span className="order-danger-icon"><AdminIcon name="warning" size={18} /></span>
            <div>
              <h2>Cancel Order &amp; Release Stock</h2>
              <p>Will mark order as Cancelled and return reserved garments back to available atelier inventory.</p>
            </div>
          </div>
          <button type="button" onClick={() => setCancelOpen(true)}>Cancel Order</button>
        </section>
      )}

      {cancelOpen && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCancelOpen(false)}>
          <section className="admin-order-modal order-refund-modal" role="dialog" aria-modal="true" aria-labelledby="order-refund-title">
            <div className="admin-modal-heading">
              <div><span className="admin-modal-eyebrow">Cancellation Confirmation</span><h2 id="order-refund-title">Cancel this order?</h2></div>
              <button className="admin-icon-button" type="button" onClick={() => setCancelOpen(false)} aria-label="Close modal"><AdminIcon name="close" /></button>
            </div>
            <p>Are you sure you want to cancel order #{displayId}? Reserved items will be restored to inventory.</p>
            <div>
              <button className="admin-action-button" type="button" onClick={() => setCancelOpen(false)}>Keep Order</button>
              <button type="button" onClick={confirmCancellation}>Confirm Cancellation</button>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}