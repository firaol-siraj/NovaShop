import { useEffect, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { hydrateCustomer, initialCustomers } from './adminCustomerData';
import { PRODUCT_DATA } from '../../data/products';
import './admin-customer-detail.css';

const orderHistory = [
  { id: 'NS-10482', date: 'Sep 28, 2026', items: 'Cashmere Overcoat', count: 1, image: PRODUCT_DATA[1].primaryImage, status: 'Delivered', total: '$1,450.00' },
  { id: 'NS-10431', date: 'Sep 09, 2026', items: 'Silk Slip Dress', count: 2, image: PRODUCT_DATA[6].primaryImage, status: 'Delivered', total: '$2,110.00' },
  { id: 'NS-10388', date: 'Aug 21, 2026', items: 'Leather Tote Bag', count: 1, image: PRODUCT_DATA[3].primaryImage, status: 'Delivered', total: '$1,120.00' },
  { id: 'NS-10342', date: 'Jul 30, 2026', items: 'Merino Wool Sweater', count: 3, image: PRODUCT_DATA[7].primaryImage, status: 'Delivered', total: '$1,260.00' },
  { id: 'NS-10297', date: 'Jul 04, 2026', items: 'Silk Scarf', count: 1, image: PRODUCT_DATA[10].primaryImage, status: 'Cancelled', total: '$240.00' },
  { id: 'NS-10251', date: 'Jun 11, 2026', items: 'Suede Chelsea Boots', count: 1, image: PRODUCT_DATA[5].primaryImage, status: 'Delivered', total: '$780.00' },
];

const activityFeed = [
  { text: <>Placed order <strong>#NS-10482</strong></>, date: 'Sep 28, 2026' },
  { text: <>Order <strong>#NS-10431</strong> was delivered</>, date: 'Sep 14, 2026' },
  { text: <>Left a 5-star review on <strong>Silk Slip Dress</strong></>, date: 'Sep 12, 2026' },
  { text: <>Updated shipping address</>, date: 'Aug 29, 2026' },
  { text: <>Subscribed to email marketing</>, date: 'Aug 14, 2026' },
];

const seededNotes = [
  { id: 'note-1', author: 'Elena Vasquez', initials: 'EV', relative: '2 weeks ago', date: 'Aug 14, 2026', text: 'Prefers express shipping. Has requested gift wrapping on past orders.' },
  { id: 'note-2', author: 'Elena Vasquez', initials: 'EV', relative: 'Aug 14, 2026', date: 'Aug 14, 2026', text: 'VIP client concierge consultation conducted via direct support thread.' },
];

function CustomerCard({ title, subtitle, right, children, className = '' }) {
  return <section className={`admin-card cd-card ${className}`}><header className="cd-card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{right}</header>{children}</section>;
}

function OrderStatus({ status }) {
  return <span className={`cd-order-status ${status.toLowerCase()}`}>{status}</span>;
}

function EmailModal({ customer, onClose }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="admin-order-modal cd-email-modal" role="dialog" aria-modal="true" aria-labelledby="cd-email-title"><header className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Customer communication</span><h2 id="cd-email-title">Email {customer.name}</h2></div><button className="admin-icon-button" type="button" aria-label="Close email composer" onClick={onClose}><AdminIcon name="close" /></button></header>{sent ? <p className="cd-email-sent">Email queued for {customer.email}.</p> : <form onSubmit={(event) => { event.preventDefault(); setSent(true); }}><label>To<input value={customer.email} readOnly /></label><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" /></label><label>Message<textarea rows="5" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message to your customer" /></label><button className="admin-action-button is-primary" type="submit" disabled={!subject.trim() || !message.trim()}><AdminIcon name="document" size={14} /> Send email</button></form>}</section></div>;
}

function money(amount) {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminCustomerDetailPage({ customerId, go }) {
  const hydrated = hydrateCustomer(customerId) || hydrateCustomer('CUS-1042');
  const [customer, setCustomer] = useState(hydrated);
  const [notes, setNotes] = useState(() => {
    if (hydrated.internalNotes) return [{ id: 'note-created', author: 'Elena Vasquez', initials: 'EV', relative: 'Just now', date: 'Oct 4, 2026', text: hydrated.internalNotes }];
    return initialCustomers.some((item) => item.id === hydrated.id) ? seededNotes : [];
  });
  const [noteInput, setNoteInput] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    const next = hydrateCustomer(customerId);
    if (next) setCustomer(next);
    try {
      const flash = window.sessionStorage.getItem('novashop-customer-flash');
      if (flash) {
        window.sessionStorage.removeItem('novashop-customer-flash');
        setNotice(flash);
        window.setTimeout(() => setNotice(''), 2300);
      }
    } catch {
      return undefined;
    }
    return undefined;
  }, [customerId]);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2300);
  };
  const addNote = (event) => {
    event.preventDefault();
    const text = noteInput.trim();
    if (!text) return;
    setNotes((current) => [{ id: `note-${Date.now()}`, author: 'Elena Vasquez', initials: 'EV', relative: 'Just now', date: 'Oct 4, 2026', text }, ...current]);
    setNoteInput('');
    notify('Internal note added.');
  };
  const exportOrderHistory = () => {
    const rows = [['Order', 'Date', 'Items', 'Status', 'Total'], ...orderHistory.map((order) => [order.id, order.date, order.items, order.status, order.total])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${customer.name.toLowerCase().replaceAll(' ', '-')}-order-history.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const isNewProfile = !initialCustomers.some((item) => item.id === customer.id);
  const lifetimeSpent = customer.spent ?? 0;
  const lifetimeOrders = customer.orders ?? 0;
  const averageOrder = lifetimeOrders ? lifetimeSpent / lifetimeOrders : 0;
  const visibleOrders = isNewProfile ? [] : orderHistory;
  const visibleActivity = isNewProfile ? [] : activityFeed;

  return (
    <div className="admin-dashboard cd-page">
      <header className="cd-page-header"><button className="pe-breadcrumb" type="button" onClick={() => go('/admin/customers')}><AdminIcon name="left" size={14} /> Customers</button><div className="cd-identity-actions"><div className="cd-identity"><span className="cd-avatar">{customer.initials}</span><div><div className="cd-identity-name"><h1>{customer.name}</h1><span className={`customers-status-pill ${customer.status.toLowerCase()}`}><i />{customer.status}</span></div><p><a href={`mailto:${customer.email}`}>{customer.email}</a><span> · {customer.city}, {customer.country}</span></p></div></div><div className="cd-header-actions"><div className="cd-menu-wrap"><button className="admin-action-button cd-overflow-button" type="button" aria-label="More customer actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><AdminIcon name="more" size={17} /></button>{menuOpen && <div className="cd-overflow-menu"><button type="button" onClick={() => { setMenuOpen(false); notify('Customer storefront view opened.'); }}>View as customer</button><button type="button" onClick={() => { setMenuOpen(false); exportOrderHistory(); }}>Export order history</button><button type="button" className="is-danger" onClick={() => { setCustomer((current) => ({ ...current, status: current.status === 'Blocked' ? 'Active' : 'Blocked' })); setMenuOpen(false); notify(customer.status === 'Blocked' ? 'Customer unblocked.' : 'Customer blocked.'); }}>{customer.status === 'Blocked' ? 'Unblock customer' : 'Block customer'}</button></div>}</div><button className="admin-action-button" type="button" onClick={() => setEmailOpen(true)}><AdminIcon name="document" size={14} /> Send email</button><button className="admin-action-button is-primary" type="button" onClick={() => go(`/admin/customers/${customer.id}/edit`)}><span>✎</span> Edit customer</button></div></div></header>

      <section className="cd-lifetime-section"><div className="cd-lifetime-label">LIFETIME</div><div className="admin-stat-grid cd-lifetime-grid"><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Total spent</span>{lifetimeOrders > 0 && <span className="admin-trend-pill">+8.4%</span>}</div><div className="admin-stat-value">{money(lifetimeSpent)}</div></article><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Total orders</span>{lifetimeOrders > 0 && <span className="admin-trend-pill">+2</span>}</div><div className="admin-stat-value">{lifetimeOrders}</div></article><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Average order value</span>{lifetimeOrders > 0 && <span className="admin-trend-pill">+3.1%</span>}</div><div className="admin-stat-value">{money(averageOrder)}</div></article><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Last order</span><span className="cd-last-order-tag">{customer.lastOrder || '—'}</span></div><div className="admin-stat-value">{lifetimeOrders ? (customer.lastDate || '—') : '—'}</div></article></div></section>

      <div className="cd-columns"><div className="cd-main-column"><CustomerCard title="Order history" right={<button className="admin-text-link" type="button" onClick={() => notify(lifetimeOrders ? 'Showing all customer orders.' : 'This storefront account has no orders yet.')}>View all orders <span>→</span></button>} className="cd-orders-card"><div className="cd-order-table-scroll"><table className="cd-order-table"><colgroup><col /><col /><col /><col /></colgroup><thead><tr><th>ORDER</th><th>ITEMS</th><th>STATUS</th><th>TOTAL</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id}><td><div className="cd-order-id"><strong>#{order.id}</strong><span>{order.date}</span></div></td><td><div className="cd-order-item"><img src={order.image} alt="" /><strong>{order.items}</strong>{order.count > 1 && <span>+{order.count - 1}</span>}</div></td><td><OrderStatus status={order.status} /></td><td className="cd-order-total">{order.total}</td></tr>)}{visibleOrders.length === 0 && <tr><td colSpan="4" className="cd-empty-row">No orders yet · $0.00 lifetime spend</td></tr>}</tbody></table></div></CustomerCard>

        <CustomerCard title="Recent activity" className="cd-activity-card"><ol className="cd-activity-list">{visibleActivity.map((activity, index) => <li key={`${activity.date}-${index}`}><i /><p>{activity.text}</p><time>{activity.date}</time></li>)}{visibleActivity.length === 0 && <li className="cd-empty-activity"><i /><p>No storefront activity yet.</p></li>}</ol></CustomerCard></div>

        <aside className="cd-side-column"><CustomerCard title="Contact" right={<button className="admin-text-link" type="button" onClick={() => setEmailOpen(true)}>Send email</button>} className="cd-contact-card"><div className="cd-labeled-value"><span>Email address</span><a href={`mailto:${customer.email}`}>{customer.email}</a></div><div className="cd-labeled-value"><span>Phone</span><a href={`tel:${customer.phone}`}>{customer.phone}</a></div></CustomerCard>

        <CustomerCard title="Addresses" className="cd-address-card"><div className="cd-address-block"><span>SHIPPING ADDRESS</span><address>{customer.name}{customer.address ? <><br />{customer.address}</> : null}{customer.city || customer.postal ? <><br />{[customer.city, customer.postal].filter(Boolean).join(', ')}</> : null}{customer.country ? <><br />{customer.country}</> : null}{!customer.address && !customer.city && !customer.country && <><br />No shipping address on file</>}</address></div><div className="cd-address-block billing"><span>BILLING ADDRESS</span><p>{customer.billingAddress || 'Same as shipping address'}</p></div>{(customer.extraAddresses || []).map((address, index) => <div className="cd-address-block billing" key={`extra-${index}`}><span>ADDRESS {index + 2}</span><address>{[address.line1, address.line2].filter(Boolean).join(', ')}<br />{[address.city, address.region, address.postal].filter(Boolean).join(', ')}<br />{address.country}</address></div>)}</CustomerCard>

        <CustomerCard title="Internal Notes" subtitle="Only visible to your team." className="cd-notes-card"><form className="cd-note-form" onSubmit={addNote}><textarea rows="3" value={noteInput} onChange={(event) => setNoteInput(event.target.value)} placeholder="Add a note about this customer…" /><button className="admin-action-button is-primary" type="submit" disabled={!noteInput.trim()}>Add note</button></form><div className="cd-note-list">{notes.map((note) => <article className="cd-note" key={note.id}><span className="cd-note-avatar">{note.initials}</span><div><header><strong>{note.author}</strong><span>{note.relative} · {note.date}</span></header><p>{note.text}</p></div></article>)}</div></CustomerCard>

        <CustomerCard title="Organization" className="cd-organization-card"><span className="cd-field-label">Tags</span><div className="cd-tags">{(customer.tags || []).map((tag) => <span className="cd-tag" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag} tag`} onClick={() => setCustomer((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))}>×</button></span>)}<input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && tagInput.trim()) { event.preventDefault(); setCustomer((current) => ({ ...current, tags: [...(current.tags || []), tagInput.trim()] })); setTagInput(''); } }} placeholder="Add tag…" /></div><div className="cd-marketing"><span>Email marketing</span><strong className={customer.emailSubscribed ? 'is-subscribed' : ''}><i />{customer.emailSubscribed ? 'Subscribed' : 'Unsubscribed'}</strong></div></CustomerCard>

        <CustomerCard title="Details" className="cd-details-card"><button className="pe-accordion-trigger pe-details-trigger" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}><span>Customer record and acquisition details.</span><AdminIcon name="chevron" size={14} /></button>{detailsOpen && <dl className="cd-details-list"><div><dt>Customer ID</dt><dd>{customer.id}</dd></div><div><dt>Account created</dt><dd>{customer.joinedAt || 'Apr 12, 2024'}</dd></div><div><dt>Acquisition source</dt><dd>Online storefront</dd></div></dl>}</CustomerCard></aside></div>

      {notice && <div className="admin-toast" role="status">{notice}</div>}
      {emailOpen && <EmailModal customer={customer} onClose={() => setEmailOpen(false)} />}
    </div>
  );
}