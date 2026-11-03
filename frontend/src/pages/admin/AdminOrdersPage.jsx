import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import { orderApi } from '../../lib/api/orderApi';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getInitials(name) {
  if (!name) return 'CU';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const items = order.orderItems || [];
  const address = order.shippingAddress || {};

  return (
    <aside className="orders-detail-panel" aria-label={`Details for order ${order.id}`}>
      <header className="orders-detail-header">
        <div className="orders-detail-heading">
          <h2>Order #{order.id}</h2>
          <label className={`admin-status-pill ${(status || 'pending').toLowerCase()} orders-detail-status`}>
            <select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Change order status">
              {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <AdminIcon name="chevron" size={12} />
          </label>
        </div>
        <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close order details"><AdminIcon name="close" /></button>
      </header>

      <div className="orders-detail-scroll">
        <section className="orders-detail-section">
          <div className="orders-section-heading"><h3>Customer</h3><span className="orders-vip-badge">{order.paymentMethod || 'Online'}</span></div>
          <div className="orders-customer-summary">
            <span className="orders-detail-avatar">{order.initials}</span>
            <div>
              <strong>{order.name}</strong>
              <a href={`mailto:${order.email}`}>{order.email}</a>
              <span>{address.phone || 'No phone provided'}</span>
            </div>
          </div>
          <div className="orders-address">
            <AdminIcon name="location" size={16} />
            <p>
              {address.address || 'Address N/A'}<br />
              {address.city ? `${address.city}, ` : ''}{address.postalCode || ''}<br />
              {address.country || 'Ethiopia'}
            </p>
          </div>
        </section>

        <section className="orders-detail-section">
          <div className="orders-section-heading">
            <h3>Order Items ({items.length})</h3>
            <span className="orders-verified"><AdminIcon name="check" size={12} /> Verified</span>
          </div>
          <div className="orders-detail-items">
            {items.map((item, idx) => (
              <article className="orders-detail-item" key={item._id || item.sku || idx}>
                <img src={item.image || '/placeholder.jpg'} alt={item.name} />
                <div className="orders-detail-item-info">
                  <strong>{item.name}</strong>
                  <span>{item.color} / {item.size}</span>
                  <small>Qty: {item.qty || 1}</small>
                </div>
                <b>{formatMoney((item.price || 0) * (item.qty || 1))}</b>
              </article>
            ))}
          </div>
        </section>

        <section className="orders-detail-section">
          <h3 className="orders-payment-title">Payment &amp; Breakdown</h3>
          <div className="orders-payment-card">
            <div><span>Subtotal</span><b>{formatMoney(order.itemsPrice || 0)}</b></div>
            <div><span>Shipping</span><b className="orders-complimentary">{Number(order.shippingPrice) > 0 ? formatMoney(order.shippingPrice) : 'Complimentary'}</b></div>
            {Number(order.taxPrice) > 0 && <div><span>Estimated Tax</span><b>{formatMoney(order.taxPrice)}</b></div>}
            <div className="orders-payment-total"><strong>Total</strong><b>{formatMoney(order.totalPrice || 0)}</b></div>
          </div>
        </section>

        <div className="orders-detail-actions">
          <button className="orders-ship-button" type="button" onClick={onShipped}><AdminIcon name="truck" size={16} /> Mark as Shipped</button>
          <div>
            <button type="button" onClick={() => window.print()}><AdminIcon name="print" size={15} /> Print Label</button>
            <button type="button" onClick={() => window.print()}><AdminIcon name="document" size={15} /> Print Invoice</button>
          </div>
          <button className="orders-cancel-link" type="button" onClick={onCancel}>Cancel Order &amp; Release Stock</button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminOrdersPage({ go, search: searchProp }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState(() => {
    try {
      const params = new URLSearchParams(searchProp || window.location.search);
      return params.get('search') || params.get('q') || params.get('order') || '';
    } catch {
      return '';
    }
  });
  const [customerFilter, setCustomerFilter] = useState(() => {
    try {
      const params = new URLSearchParams(searchProp || window.location.search);
      return params.get('customer') || '';
    } catch {
      return '';
    }
  });
  const [discountFilter, setDiscountFilter] = useState(() => {
    try {
      const params = new URLSearchParams(searchProp || window.location.search);
      return params.get('discount') || '';
    } catch {
      return '';
    }
  });
  const [sortOrder, setSortOrder] = useState('newest');
  const [channel, setChannel] = useState('All channels');
  const [period, setPeriod] = useState('All time');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    try {
      const params = new URLSearchParams(searchProp || window.location.search);
      return params.get('order') || params.get('id') || null;
    } catch {
      return null;
    }
  });
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(searchProp || window.location.search);
      const cust = params.get('customer') || '';
      if (cust !== customerFilter) {
        setCustomerFilter(cust);
      }
      const disc = params.get('discount') || '';
      if (disc !== discountFilter) {
        setDiscountFilter(disc);
      }
    } catch {}
  }, [searchProp]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orderApi.getAdminOrders();
      if (res.success && Array.isArray(res.data)) {
        const formatted = res.data.map((order) => {
          const id = order.orderNumber || order._id;
          const name = order.user?.name || order.shippingAddress?.recipientName || 'Customer';
          const email = order.user?.email || 'N/A';
          const totalQty = (order.orderItems || []).reduce((acc, i) => acc + (Number(i.qty) || 1), 0);
          const firstItem = order.orderItems?.[0] || { name: 'Garment', image: '/placeholder.jpg' };
          const statusCapitalized = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending';

          return {
            rawId: order._id,
            id,
            orderNumber: order.orderNumber,
            userId: order.user?._id || order.user || '',
            name,
            email,
            initials: getInitials(name),
            date: formatDate(order.createdAt),
            item: { name: firstItem.name, image: firstItem.image || '/placeholder.jpg' },
            itemCount: totalQty,
            total: formatMoney(order.totalPrice),
            totalPrice: order.totalPrice,
            itemsPrice: order.itemsPrice,
            shippingPrice: order.shippingPrice,
            taxPrice: order.taxPrice,
            status: statusCapitalized,
            paymentStatus: order.paymentStatus || 'pending',
            paymentMethod: order.paymentMethod || 'Chapa',
            channel: order.paymentMethod === 'Cash' || order.paymentMethod === 'Cash on Delivery' ? 'Cash on Delivery' : 'Online Store',
            discountCode: order.discountCode || '',
            discountId: order.discountId || '',
            orderItems: order.orderItems || [],
            shippingAddress: order.shippingAddress || {},
            createdAt: order.createdAt,
          };
        });
        setOrders(formatted);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlSearch = params.get('search') || params.get('q') || '';
        if (urlSearch && urlSearch !== search) {
          setSearch(urlSearch);
        }
        const targetOrder = params.get('order') || params.get('id');
        if (targetOrder) {
          setSelectedOrderId(targetOrder);
        }
      } catch {}
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [search]);

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

  const counts = useMemo(() => {
    const all = orders.length;
    const pending = orders.filter((o) => o.status.toLowerCase() === 'pending').length;
    const processing = orders.filter((o) => o.status.toLowerCase() === 'processing').length;
    const shipped = orders.filter((o) => o.status.toLowerCase() === 'shipped').length;
    const delivered = orders.filter((o) => o.status.toLowerCase() === 'delivered').length;
    const cancelled = orders.filter((o) => o.status.toLowerCase() === 'cancelled').length;
    return { all, pending, processing, shipped, delivered, cancelled };
  }, [orders]);

  const statuses = useMemo(() => [
    { label: 'All', count: String(counts.all), value: 'All', color: '' },
    { label: 'Pending', count: String(counts.pending), value: 'Pending', color: 'pending' },
    { label: 'Processing', count: String(counts.processing), value: 'Processing', color: 'processing' },
    { label: 'Shipped', count: String(counts.shipped), value: 'Shipped', color: 'shipped' },
    { label: 'Delivered', count: String(counts.delivered), value: 'Delivered', color: 'delivered' },
    { label: 'Cancelled', count: String(counts.cancelled), value: 'Cancelled', color: 'cancelled' },
  ], [counts]);

  const filteredOrders = useMemo(() => {
    const rawQuery = (search || '').trim().toLowerCase();
    const cleanQuery = rawQuery.replace(/^#/, '');
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);

    const matching = orders.filter((order) => {
      const matchesStatus = activeStatus === 'All' || order.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesChannel = channel === 'All channels' || order.channel === channel;

      if (!matchesStatus || !matchesChannel) return false;

      if (customerFilter) {
        const orderUserId = String(order.userId || '');
        const orderEmail = String(order.email || '').toLowerCase();
        const target = String(customerFilter).toLowerCase();
        if (orderUserId !== target && orderEmail !== target) {
          return false;
        }
      }

      if (discountFilter) {
        const orderDisc = String(order.discountCode || '').toLowerCase();
        const orderDiscId = String(order.discountId || '').toLowerCase();
        const targetDisc = String(discountFilter).toLowerCase();
        if (orderDisc !== targetDisc && orderDiscId !== targetDisc) {
          return false;
        }
      }

      if (!rawQuery) return true;

      // Extract all searchable strings from this order
      const itemNames = (order.orderItems || []).map((i) => `${i.name || ''} ${i.sku || ''} ${i.size || ''} ${i.color || ''}`).join(' ');
      const address = order.shippingAddress || {};
      const addressString = `${address.recipientName || ''} ${address.phone || ''} ${address.address || ''} ${address.city || ''} ${address.postalCode || ''} ${address.country || ''}`;

      const corpus = [
        String(order.id || ''),
        `#${order.id || ''}`,
        String(order.rawId || ''),
        String(order.orderNumber || ''),
        `#${order.orderNumber || ''}`,
        String(order.name || ''),
        String(order.email || ''),
        String(order.channel || ''),
        String(order.paymentMethod || ''),
        String(order.paymentStatus || ''),
        String(order.status || ''),
        String(order.total || ''),
        String(order.totalPrice || ''),
        itemNames,
        addressString,
      ].filter(Boolean).join(' ').toLowerCase();

      // Check full match or clean match (without #)
      if (corpus.includes(rawQuery) || corpus.includes(cleanQuery)) {
        return true;
      }

      // Check token match (every token must be found in the corpus)
      return tokens.length > 0 && tokens.every((token) => corpus.includes(token));
    });

    return matching.sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sortOrder === 'highest') return (b.totalPrice || 0) - (a.totalPrice || 0);
      if (sortOrder === 'lowest') return (a.totalPrice || 0) - (b.totalPrice || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [activeStatus, channel, customerFilter, orders, search, sortOrder]);

  const activeCustomerInfo = useMemo(() => {
    if (!customerFilter) return null;
    const match = orders.find(
      (o) => String(o.userId) === String(customerFilter) || String(o.email).toLowerCase() === String(customerFilter).toLowerCase()
    );
    return match ? (match.name && match.name !== 'Customer' ? `${match.name} (${match.email})` : match.email) : customerFilter;
  }, [customerFilter, orders]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId || order.rawId === selectedOrderId);
  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedIds.includes(order.id));

  const toggleOrder = (orderId) => {
    setSelectedIds((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]);
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !filteredOrders.some((order) => order.id === id))
      : [...new Set([...current, ...filteredOrders.map((order) => order.id)])]);
  };

  const updateStatus = async (orderId, status) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.rawId === orderId);
    if (!targetOrder) return;

    try {
      await orderApi.updateOrderStatus(targetOrder.rawId, status.toLowerCase());
      const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
      setOrders((current) => current.map((order) => (order.id === orderId || order.rawId === orderId) ? { ...order, status: capitalized } : order));
    } catch {
      // Error handled
    }
  };

  const updateSelectedStatus = async (status) => {
    for (const orderId of selectedIds) {
      await updateStatus(orderId, status);
    }
    setSelectedIds([]);
  };

  const resetFilters = () => {
    setActiveStatus('All');
    setSearch('');
    setChannel('All channels');
    setPeriod('All time');
    setSortOrder('newest');
  };

  const visibleSelectedCount = filteredOrders.filter((order) => selectedIds.includes(order.id)).length;

  return (
    <div className="admin-dashboard orders-page">
      <section className="admin-page-heading orders-page-heading">
        <div><h1 className="admin-page-title">Orders</h1><p className="admin-page-description">Manage and fulfill customer orders across all channels.</p></div>
        <div className="admin-page-actions">
          <button className="admin-action-button" type="button" onClick={() => downloadOrders(filteredOrders, 'novashop-orders.csv')}><AdminIcon name="download" size={15} /> Export Orders</button>
        </div>
      </section>

      <section className="admin-stat-grid orders-stat-grid" aria-label="Order performance">
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Total Orders</span><span className="admin-trend-pill">Live</span></div><div className="admin-stat-value">{orders.length}</div><div className="admin-stat-subtext">Database registered orders</div><Sparkline /></article>
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Pending Fulfillment</span><span className="orders-action-pill">{counts.pending > 0 ? 'Needs Action' : 'Cleared'}</span></div><div className="admin-stat-value">{counts.pending}</div><div className="orders-stat-action-row"><span><AdminIcon name="truck" size={13} /> {counts.processing} in processing</span><button type="button" onClick={() => setActiveStatus('Pending')}>Filter <span aria-hidden="true">→</span></button></div></article>
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Delivered Orders</span><span className="admin-trend-pill">Completed</span></div><div className="admin-stat-value">{counts.delivered}</div><div className="admin-stat-subtext">Fulfillment complete</div><Sparkline variant={1} /></article>
        <article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Dispatched (Shipped)</span><span className="admin-trend-pill">In Transit</span></div><div className="admin-stat-value">{counts.shipped}</div><div className="admin-stat-subtext orders-today-subtext"><span>Courier handover complete</span></div></article>
      </section>

      <section className="orders-filter-toolbar" aria-label="Filter and sort orders">
        <div className="orders-status-chips" role="group" aria-label="Order status">
          {statuses.map((status) => (
            <button key={status.value} type="button" className={`orders-status-chip${activeStatus === status.value ? ' is-active' : ''}`} onClick={() => setActiveStatus(status.value)} aria-pressed={activeStatus === status.value}>
              {status.color && <i className={`orders-status-dot ${status.color}`} />}{status.label} ({status.count})
            </button>
          ))}
        </div>

        {activeCustomerInfo && (
          <div className="orders-customer-chip-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', width: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Customer: <strong>{activeCustomerInfo}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setCustomerFilter('');
                  if (go) go('/admin/orders');
                }}
                aria-label="Remove customer filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {discountFilter && (
          <div className="orders-discount-chip-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', width: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Discount: <strong>{discountFilter}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setDiscountFilter('');
                  if (go) go('/admin/orders');
                }}
                aria-label="Remove discount filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}
        <div className="orders-filter-actions">
          <label className="orders-search-field">
            <AdminIcon name="search" size={15} />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearch('');
                  searchRef.current?.blur();
                }
              }}
              placeholder="Search orders by ID, name, email, item, address…"
              aria-label="Search orders"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '11px',
                }}
              >
                ✕
              </button>
            ) : (
              <kbd>{typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘F' : 'Ctrl+F'}</kbd>
            )}
          </label>
          <div className="orders-filter-menu-wrap">
            <button type="button" className={`orders-filter-button${filtersOpen ? ' is-open' : ''}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><AdminIcon name="filter" size={15} /> Filters <AdminIcon name="chevron" size={13} /></button>
            {filtersOpen && <div className="orders-filter-popover"><label>Sales channel<select value={channel} onChange={(event) => setChannel(event.target.value)}><option>All channels</option><option>Online Store</option><option>Cash on Delivery</option></select></label><button type="button" onClick={resetFilters}>Reset filters</button></div>}
          </div>
          <label className="orders-sort-field"><span>Sort:</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort orders"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest total</option><option value="lowest">Lowest total</option></select><AdminIcon name="chevron" size={12} /></label>
        </div>
      </section>

      {visibleSelectedCount > 0 && (
        <section className="orders-bulk-bar" aria-label="Bulk order actions">
          <div className="orders-bulk-selection"><strong>{visibleSelectedCount} orders selected</strong><button type="button" onClick={() => setSelectedIds([])}>Deselect All</button></div>
          <div className="orders-bulk-actions">
            <button type="button" onClick={() => updateSelectedStatus('Shipped')}><AdminIcon name="truck" size={15} /> Mark as Shipped</button>
            <button type="button" onClick={() => updateSelectedStatus('Delivered')}><AdminIcon name="check" size={15} /> Mark as Delivered</button>
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
                    <td>
                      <AdminRowActionMenu
                        item={order}
                        title={order.id}
                        subtitle={`${order.name} · ${order.total}`}
                        items={[
                          {
                            label: 'View details',
                            icon: 'eye',
                            onClick: () => go(`/admin/orders/${order.rawId}`),
                          },
                          {
                            label: 'Mark as processing',
                            icon: 'refresh',
                            hidden: order.status === 'Processing' || order.status === 'Delivered' || order.status === 'Cancelled',
                            onClick: () => updateStatus(order.id, 'Processing'),
                          },
                          {
                            label: 'Mark as shipped',
                            icon: 'truck',
                            hidden: order.status === 'Shipped' || order.status === 'Delivered' || order.status === 'Cancelled',
                            onClick: () => updateStatus(order.id, 'Shipped'),
                          },
                          {
                            divider: true,
                            hidden: order.status === 'Cancelled',
                          },
                          {
                            label: 'Cancel order',
                            icon: 'trash',
                            danger: true,
                            hidden: order.status === 'Cancelled',
                            onClick: () => updateStatus(order.id, 'Cancelled'),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && !loading && <tr><td colSpan="8" className="orders-empty-cell"><AdminIcon name="searchSlash" size={21} /><span>No orders match selected filter.</span><button type="button" onClick={resetFilters}>Reset all filters</button></td></tr>}
                {loading && <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading authoritative orders...</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredOrders.length > 0 && <div className="orders-table-footer"><span>Showing {filteredOrders.length} of {orders.length} orders</span></div>}
        </div>

        {selectedOrder && (
          <OrderDetailPanel
            order={selectedOrder}
            status={selectedOrder.status}
            onStatusChange={(status) => updateStatus(selectedOrder.id, status)}
            onClose={() => setSelectedOrderId(null)}
            onCancel={() => updateStatus(selectedOrder.id, 'Cancelled')}
            onShipped={() => updateStatus(selectedOrder.id, 'Shipped')}
          />
        )}
      </section>
    </div>
  );
}