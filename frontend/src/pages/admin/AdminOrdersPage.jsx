import { useEffect, useMemo, useRef, useState } from 'react';
import { PRODUCT_DATA } from '../../data/products';
import { AdminIcon } from '../../components/admin/AdminLayout';

const detailItems = [
  { name: 'Burnished Leather Penny Loafer', variant: 'Espresso / 42 EU', quantity: 1, price: '$340.00', image: PRODUCT_DATA[5].primaryImage },
  { name: 'Tailored Double-Breasted Blazer', variant: 'Espresso / 38R', quantity: 1, price: '$690.00', image: PRODUCT_DATA[0].primaryImage },
  { name: 'Box Leather Top Handle Bag', variant: 'Espresso / One size', quantity: 1, price: '$320.00', image: PRODUCT_DATA[3].primaryImage },
];

const initialOrders = [
  { id: 'NS-8924', name: 'Sophia Sterling', email: 'sophia.sterling@email.com', initials: 'SS', date: 'Today, 15:40', item: detailItems[0], itemCount: 3, total: '$1,280.00', status: 'Processing', channel: 'Online Store' },
  { id: 'NS-8923', name: 'Oliver James', email: 'oliver.james@email.com', initials: 'OJ', date: 'Today, 14:12', item: { name: PRODUCT_DATA[0].name, image: PRODUCT_DATA[0].primaryImage }, itemCount: 1, total: '$690.00', status: 'Pending', channel: 'Online Store' },
  { id: 'NS-8922', name: 'Amelia Clarke', email: 'amelia.clarke@email.com', initials: 'AC', date: 'Yesterday, 19:20', item: { name: PRODUCT_DATA[1].name, image: PRODUCT_DATA[1].primaryImage }, itemCount: 2, total: '$1,040.00', status: 'Shipped', channel: 'Instagram' },
  { id: 'NS-8921', name: 'Noah Williams', email: 'noah.williams@email.com', initials: 'NW', date: 'Yesterday, 16:08', item: { name: PRODUCT_DATA[2].name, image: PRODUCT_DATA[2].primaryImage }, itemCount: 1, total: '$280.00', status: 'Delivered', channel: 'Online Store' },
  { id: 'NS-8920', name: 'Isabella Moore', email: 'isabella.moore@email.com', initials: 'IM', date: 'Oct 29, 09:40', item: { name: PRODUCT_DATA[4].name, image: PRODUCT_DATA[4].primaryImage }, itemCount: 2, total: '$640.00', status: 'Delivered', channel: 'Retail POS' },
  { id: 'NS-8919', name: 'Ethan Parker', email: 'ethan.parker@email.com', initials: 'EP', date: 'Oct 28, 18:55', item: { name: PRODUCT_DATA[3].name, image: PRODUCT_DATA[3].primaryImage }, itemCount: 1, total: '$490.00', status: 'Cancelled', channel: 'Online Store' },
  { id: 'NS-8918', name: 'Maya Thompson', email: 'maya.thompson@email.com', initials: 'MT', date: 'Oct 28, 14:21', item: { name: PRODUCT_DATA[5].name, image: PRODUCT_DATA[5].primaryImage }, itemCount: 1, total: '$340.00', status: 'Processing', channel: 'Instagram' },
];

const statuses = [
  { label: 'All', count: '1,428', value: 'All', color: '' },
  { label: 'Pending', count: '24', value: 'Pending', color: 'pending' },
  { label: 'Processing', count: '112', value: 'Processing', color: 'processing' },
  { label: 'Shipped', count: '340', value: 'Shipped', color: 'shipped' },
  { label: 'Delivered', count: '940', value: 'Delivered', color: 'delivered' },
  { label: 'Cancelled', count: '12', value: 'Cancelled', color: 'cancelled' },
];

function Sparkline({ variant = 0 }) {
  const paths = [
    'M2 25 C15 22 19 27 31 19 S48 24 61 14 S79 18 93 10 S111 14 128 4',
    'M2 24 C16 21 20 23 32 18 S49 19 62 13 S80 16 95 9 S113 12 128 5',
  ];
  return (
    <svg className="admin-sparkline orders-sparkline" viewBox="0 0 130 32" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${paths[variant]} L128 32 L2 32 Z`} fill="rgba(61,119,86,0.08)" />
      <path d={paths[variant]} fill="none" stroke="#568A65" strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function downloadOrders(rows, filename) {
  const csvRows = [
    ['Order ID', 'Customer', 'Date', 'Total', 'Status', 'Channel'],
    ...rows.map((order) => [order.id, order.name, order.date, order.total, order.status, order.channel]),
  ];
  const csv = csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function OrderDetailPanel({ order, status, onStatusChange, onClose, onCancel, onShipped }) {
  return (
    <aside className="orders-detail-panel" aria-label={`Details for order ${order.id}`}>
      <header className="orders-detail-header">
        <div className="orders-detail-heading">
          <h2>Order #{order.id}</h2>
          <label className={`admin-status-pill ${status.toLowerCase()} orders-detail-status`}>
            <select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Change order status">
              {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((option) => <option key={option}>{option}</option>)}
            </select>
            <AdminIcon name="chevron" size={12} />
          </label>
        </div>
        <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close order details"><AdminIcon name="close" /></button>
      </header>

      <div className="orders-detail-scroll">
        <section className="orders-detail-section">
          <div className="orders-section-heading"><h3>Customer</h3><span className="orders-vip-badge">VIP Tier 1</span></div>
          <div className="orders-customer-summary">
            <span className="orders-detail-avatar">SS</span>
            <div><strong>{order.name}</strong><a href={`mailto:${order.email}`}>{order.email}</a><span>+1 (212) 555-0148</span></div>
          </div>
          <div className="orders-address"><AdminIcon name="location" size={16} /><p>148 Mercer Street, Apt 4B<br />New York, NY 10012<br />United States</p></div>
        </section>

        <section className="orders-detail-section">
          <div className="orders-section-heading">
            <h3>Order Items (3)</h3>
            <span className="orders-verified"><AdminIcon name="check" size={12} /> Verified</span>
          </div>
          <div className="orders-detail-items">
            {detailItems.map((item) => (
              <article className="orders-detail-item" key={item.name}>
                <img src={item.image} alt={item.name} />
                <div className="orders-detail-item-info"><strong>{item.name}</strong><span>{item.variant}</span><small>Qty: {item.quantity}</small></div>
                <b>{item.price}</b>
              </article>
            ))}
          </div>
        </section>

        <section className="orders-detail-section">
          <h3 className="orders-payment-title">Payment &amp; Breakdown</h3>
          <div className="orders-payment-card">
            <div><span>Subtotal</span><b>$1,350.00</b></div>
            <div><span>Shipping</span><b className="orders-complimentary">Complimentary</b></div>
            <div><span>Promo Code <i>AUTUMN26</i></span><b className="orders-discount">−$120.00</b></div>
            <div><span>Estimated Tax</span><b>$50.00</b></div>
            <div className="orders-payment-total"><strong>Total</strong><b>$1,280.00</b></div>
          </div>
        </section>

        <div className="orders-detail-actions">
          <button className="orders-ship-button" type="button" onClick={onShipped}><AdminIcon name="truck" size={16} /> Mark as Shipped</button>
          <div>
            <button type="button" onClick={() => window.print()}><AdminIcon name="print" size={15} /> Print Label</button>
            <button type="button" onClick={() => window.print()}><AdminIcon name="document" size={15} /> Print Invoice</button>
          </div>
          <button className="orders-cancel-link" type="button" onClick={onCancel}>Cancel Order &amp; Issue Full Refund</button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminOrdersPage({ go }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [channel, setChannel] = useState('All channels');
  const [period, setPeriod] = useState('October 2026');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(['NS-8924', 'NS-8923', 'NS-8922']);
  const [selectedOrderId, setSelectedOrderId] = useState('NS-8924');
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = orders.filter((order) => {
      const matchesStatus = activeStatus === 'All' || order.status === activeStatus;
      const matchesSearch = !query || `${order.id} ${order.name} ${order.email} ${order.channel}`.toLowerCase().includes(query);
      const matchesChannel = channel === 'All channels' || order.channel === channel;
      return matchesStatus && matchesSearch && matchesChannel;
    });
    return matching.sort((a, b) => {
      if (sortOrder === 'oldest') return a.id.localeCompare(b.id);
      if (sortOrder === 'highest') return Number(b.total.replace(/[^\d.]/g, '')) - Number(a.total.replace(/[^\d.]/g, ''));
      if (sortOrder === 'lowest') return Number(a.total.replace(/[^\d.]/g, '')) - Number(b.total.replace(/[^\d.]/g, ''));
      return b.id.localeCompare(a.id);
    });
  }, [activeStatus, channel, orders, search, sortOrder]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedIds.includes(order.id));

  const toggleOrder = (orderId) => {
    setSelectedIds((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]);
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !filteredOrders.some((order) => order.id === id))
      : [...new Set([...current, ...filteredOrders.map((order) => order.id)])]);
  };

  const updateStatus = (orderId, status) => {
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
  };

  const updateSelectedStatus = (status) => {
    setOrders((current) => current.map((order) => selectedIds.includes(order.id) ? { ...order, status } : order));
  };

  const resetFilters = () => {
    setActiveStatus('All');
    setSearch('');
    setChannel('All channels');
    setPeriod('October 2026');
    setSortOrder('newest');
  };

  const visibleSelectedCount = filteredOrders.filter((order) => selectedIds.includes(order.id)).length;

  return (
    <div className="admin-dashboard orders-page">
      <section className="admin-page-heading orders-page-heading">
        <div><h1 className="admin-page-title">Orders</h1><p className="admin-page-description">Manage and fulfill customer orders across all channels.</p></div>
        <div className="admin-page-actions">
          <button className="admin-action-button" type="button" onClick={() => downloadOrders(filteredOrders, 'novashop-orders.csv')}><AdminIcon name="download" size={15} /> Export Orders</button>
          <button className="admin-action-button is-primary" type="button" onClick={() => setCreateOpen(true)}><AdminIcon name="plus" size={15} /> Create Order</button>
        </div>
      </section>

      <section className="admin-stat-grid orders-stat-grid" aria-label="Order performance">
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Total Orders</span><span className="admin-trend-pill">↑ 12.4%</span></div><div className="admin-stat-value">1,428</div><div className="admin-stat-subtext">vs. last month</div><Sparkline /></article>
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Pending Fulfillment</span><span className="orders-action-pill">Needs Action</span></div><div className="admin-stat-value">21</div><div className="orders-stat-action-row"><span><AdminIcon name="truck" size={13} /> 6 priority dispatches</span><button type="button" onClick={() => setActiveStatus('Pending')}>Filter <span aria-hidden="true">→</span></button></div></article>
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Avg. Order Value</span><span className="admin-trend-pill">↑ 3.8%</span></div><div className="admin-stat-value">$138.50</div><div className="admin-stat-subtext">30-day baseline</div><Sparkline variant={1} /></article>
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Orders Today</span><span className="admin-trend-pill">↑ 15%</span></div><div className="admin-stat-value">38 orders</div><div className="admin-stat-subtext orders-today-subtext"><span>vs. last Tuesday</span><strong>$8,490.00 volume</strong></div></article>
      </section>

      <section className="orders-filter-toolbar" aria-label="Filter and sort orders">
        <div className="orders-status-chips" role="group" aria-label="Order status">
          {statuses.map((status) => (
            <button key={status.value} type="button" className={`orders-status-chip${activeStatus === status.value ? ' is-active' : ''}`} onClick={() => setActiveStatus(status.value)} aria-pressed={activeStatus === status.value}>
              {status.color && <i className={`orders-status-dot ${status.color}`} />}{status.label} ({status.count})
            </button>
          ))}
        </div>
        <div className="orders-filter-actions">
          <label className="orders-search-field"><AdminIcon name="search" size={15} /><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders..." aria-label="Search orders" /><kbd>⌘F</kbd></label>
          <div className="orders-filter-menu-wrap">
            <button type="button" className={`orders-filter-button${filtersOpen ? ' is-open' : ''}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><AdminIcon name="filter" size={15} /> Filters <b>2</b><AdminIcon name="chevron" size={13} /></button>
            {filtersOpen && <div className="orders-filter-popover"><label>Date range<select value={period} onChange={(event) => setPeriod(event.target.value)}><option>October 2026</option><option>Last 30 days</option><option>Last 90 days</option><option>All time</option></select></label><label>Sales channel<select value={channel} onChange={(event) => setChannel(event.target.value)}><option>All channels</option><option>Online Store</option><option>Instagram</option><option>Retail POS</option></select></label><button type="button" onClick={resetFilters}>Reset filters</button></div>}
          </div>
          <label className="orders-sort-field"><span>Sort:</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort orders"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest total</option><option value="lowest">Lowest total</option></select><AdminIcon name="chevron" size={12} /></label>
        </div>
      </section>

      {visibleSelectedCount > 0 && (
        <section className="orders-bulk-bar" aria-label="Bulk order actions">
          <div className="orders-bulk-selection"><strong>{visibleSelectedCount} orders selected</strong><button type="button" onClick={() => setSelectedIds([])}>Deselect All</button></div>
          <div className="orders-bulk-actions">
            <button type="button" onClick={() => updateSelectedStatus('Shipped')}><AdminIcon name="truck" size={15} /> Mark as Shipped</button>
            <button type="button" onClick={() => window.print()}><AdminIcon name="print" size={15} /> Print Shipping Labels</button>
            <button type="button" onClick={() => downloadOrders(orders.filter((order) => selectedIds.includes(order.id)), 'novashop-selected-orders.csv')}><AdminIcon name="download" size={15} /> Export Selected</button>
            <button className="orders-bulk-danger" type="button" onClick={() => updateSelectedStatus('Cancelled')}><AdminIcon name="close" size={15} /> Cancel Orders</button>
          </div>
        </section>
      )}

      <section className={`orders-workspace${selectedOrder ? ' has-detail' : ''}`}>
        <div className="orders-table-card">
          <div className="orders-table-scroll">
            <table className="admin-orders-table orders-table">
              <thead><tr><th className="orders-checkbox-cell"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible orders" /></th><th>ORDER ID</th><th>CUSTOMER</th><th>DATE</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {filteredOrders.map((order, index) => (
                  <tr key={order.id} className={`${selectedIds.includes(order.id) ? 'is-selected ' : ''}${selectedOrderId === order.id ? 'is-focused' : ''}`} onClick={() => setSelectedOrderId(order.id)}>
                    <td className="orders-checkbox-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleOrder(order.id)} aria-label={`Select order ${order.id}`} /></td>
                    <td className="admin-order-id">#{order.id}</td>
                    <td><div className="admin-order-customer"><span className={`admin-customer-avatar tone-${(index % 4) + 1}`}>{order.initials}</span><span><span className="admin-customer-name">{order.name}</span><small className="admin-customer-email">{order.email}</small></span></div></td>
                    <td className="orders-date-cell">{order.date}<small>{order.channel}</small></td>
                    <td><div className="orders-items-cell"><img className="admin-order-item-image" src={order.item.image} alt="" /><span>{order.item.name}{order.itemCount > 1 && <small>+{order.itemCount - 1} items</small>}</span></div></td>
                    <td className="admin-order-total">{order.total}</td>
                    <td><span className={`admin-status-pill ${order.status.toLowerCase()}`}>{order.status}</span></td>
                    <td><button className="admin-view-order" type="button" onClick={(event) => { event.stopPropagation(); go(`/admin/orders/${order.id}`); }} aria-label={`Open full order ${order.id}`}><AdminIcon name="eye" size={15} /></button></td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && <tr><td colSpan="8" className="orders-empty-cell"><AdminIcon name="searchSlash" size={21} /><span>No orders match selected filter.</span><button type="button" onClick={resetFilters}>Reset all filters</button></td></tr>}
              </tbody>
            </table>
          </div>
          {filteredOrders.length > 0 && <div className="orders-table-footer"><span>Showing {filteredOrders.length} of 1,428 orders</span><div><button type="button" aria-label="Previous page"><AdminIcon name="left" size={13} /></button><button className="is-active" type="button">1</button><button type="button">2</button><button type="button">3</button><span>…</span><button type="button">238</button><button type="button" aria-label="Next page"><AdminIcon name="chevron" size={13} /></button></div></div>}
        </div>

        {selectedOrder && <OrderDetailPanel order={selectedOrder} status={selectedOrder.status} onStatusChange={(status) => updateStatus(selectedOrder.id, status)} onClose={() => setSelectedOrderId(null)} onCancel={() => updateStatus(selectedOrder.id, 'Cancelled')} onShipped={() => updateStatus(selectedOrder.id, 'Shipped')} />}
      </section>

      {createOpen && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}><section className="admin-order-modal orders-create-modal" role="dialog" aria-modal="true" aria-labelledby="orders-create-title"><div className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Commerce</span><h2 id="orders-create-title">Create order</h2></div><button className="admin-icon-button" type="button" onClick={() => setCreateOpen(false)} aria-label="Close create order"><AdminIcon name="close" /></button></div><form onSubmit={(event) => { event.preventDefault(); setCreateOpen(false); }}><label>Customer email<input type="email" required placeholder="customer@email.com" /></label><label>Fulfillment channel<select><option>Online Store</option><option>Retail POS</option><option>Instagram</option></select></label><button className="admin-action-button is-primary" type="submit"><AdminIcon name="plus" size={14} /> Create Order</button></form></section></div>}
    </div>
  );
}