import { useMemo, useState } from 'react';
import { PRODUCT_DATA } from '../../data/products';
import { AdminIcon } from '../../components/admin/AdminLayout';

const orders = [
  { id: 'NS-2184', name: 'Elena Vasquez', email: 'elena.vasquez@email.com', initials: 'EV', item: PRODUCT_DATA[0], count: 2, total: '$880.00', status: 'Processing' },
  { id: 'NS-2183', name: 'Marcus Chen', email: 'marcus.chen@email.com', initials: 'MC', item: PRODUCT_DATA[2], count: 1, total: '$280.00', status: 'Shipped' },
  { id: 'NS-2182', name: 'Sophie Laurent', email: 'sophie.laurent@email.com', initials: 'SL', item: PRODUCT_DATA[1], count: 3, total: '$1,240.00', status: 'Delivered' },
  { id: 'NS-2181', name: 'David Kim', email: 'david.kim@email.com', initials: 'DK', item: PRODUCT_DATA[4], count: 1, total: '$320.00', status: 'Pending' },
  { id: 'NS-2180', name: 'Amara Osei', email: 'amara.osei@email.com', initials: 'AO', item: PRODUCT_DATA[5], count: 2, total: '$780.00', status: 'Delivered' },
  { id: 'NS-2179', name: 'Theo Laurent', email: 'theo.laurent@email.com', initials: 'TL', item: PRODUCT_DATA[3], count: 1, total: '$490.00', status: 'Refunded' },
];

const topProducts = [
  { product: PRODUCT_DATA[0], units: 312, price: '$440' },
  { product: PRODUCT_DATA[2], units: 284, price: '$280' },
  { product: PRODUCT_DATA[1], units: 246, price: '$520' },
  { product: PRODUCT_DATA[4], units: 198, price: '$320' },
];

const inventoryAlerts = [
  { name: 'Tailored Double-Breasted Blazer', details: 'Espresso · 38R · SKU: NS-BLZ-001', left: '4 left', lead: 'Lead time: 18 days', low: false },
  { name: 'Relaxed Linen Trench Coat', details: 'Sand · Medium · SKU: NS-TRN-014', left: '7 left', lead: 'Lead time: 12 days', low: true },
  { name: 'Ribbed Mockneck Knit Sweater', details: 'Ivory · Small · SKU: NS-KNT-028', left: '2 left', lead: 'Lead time: 21 days', low: false },
];

const chartRanges = ['7D', '30D', '90D', '12M'];

function Sparkline({ variant = 0 }) {
  const paths = [
    'M2 26 C16 24 18 27 30 21 S48 24 60 15 S78 20 91 12 S113 16 128 5',
    'M2 25 C15 20 20 25 32 18 S48 21 61 12 S79 17 91 13 S112 9 128 4',
    'M2 26 C13 27 21 18 33 21 S48 13 60 15 S79 7 91 11 S112 7 128 2',
  ];
  return (
    <svg className="admin-sparkline" viewBox="0 0 130 32" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${paths[variant]} L128 32 L2 32 Z`} fill="rgba(61,119,86,0.08)" />
      <path d={paths[variant]} fill="none" stroke="#568A65" strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function RevenueChart() {
  return (
    <div className="admin-chart-frame">
      <svg className="admin-revenue-chart" viewBox="0 0 1000 250" preserveAspectRatio="none" role="img" aria-label="Revenue chart from October 1 through October 31">
        {[50, 91, 132, 173, 214].map((y, index) => (
          <g key={y}>
            <line x1="66" x2="985" y1={y} y2={y} stroke="#EEEAE4" strokeWidth="1" />
            <text x="2" y={y + 3}>{`$${80 - index * 20}k`}</text>
          </g>
        ))}
        <path d="M66 205 C105 201 117 193 151 194 S200 174 230 181 S280 167 312 173 S365 146 393 154 S447 139 478 145 S526 116 558 126 S605 109 638 115 S689 82 720 91 S772 70 804 78 S856 54 887 63 S941 44 985 48" fill="none" stroke="#BDB7AF" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M66 211 C103 207 120 198 151 202 S198 183 230 189 S278 172 312 180 S360 159 393 164 S444 147 478 154 S526 133 558 139 S607 120 638 128 S688 98 720 105 S769 79 804 88 S855 65 887 73 S941 55 985 59" fill="none" stroke="#181512" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1="720" x2="720" y1="91" y2="214" stroke="#9C958C" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <circle cx="720" cy="105" r="5" fill="#FFFFFF" stroke="#181512" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {[['Oct 01', 66], ['Oct 05', 190], ['Oct 10', 345], ['Oct 15', 500], ['Oct 20', 655], ['Oct 25', 810], ['Oct 31', 985]].map(([label, x]) => (
          <text key={label} x={x} y="239" textAnchor={label === 'Oct 01' ? 'start' : label === 'Oct 31' ? 'end' : 'middle'}>{label}</text>
        ))}
      </svg>
      <div className="admin-chart-tooltip">
        <div className="admin-chart-tooltip-date">THURSDAY, OCT 22</div>
        <span className="admin-chart-tooltip-change">+36.4%</span>
        <strong>$8,190.00 Net</strong>
        <div className="admin-chart-tooltip-product">38 orders · Wool Blazer</div>
      </div>
    </div>
  );
}

function StatCard({ label, trend, value, subtext, sparkline, catalog }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-heading">
        <span className="admin-stat-label">{label}</span>
        {catalog ? <span className="admin-critical-pill">6 need restock</span> : <span className="admin-trend-pill">↑ {trend}</span>}
      </div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-subtext">{subtext}</div>
      {catalog ? (
        <>
          <div className="admin-inventory-progress" aria-label="258 in stock, 56 low, 6 critical">
            <span /><span /><span />
          </div>
          <div className="admin-inventory-legend">258 In Stock · 56 Low · 6 Critical</div>
        </>
      ) : <Sparkline variant={sparkline} />}
    </article>
  );
}

function OrderDetails({ order, onClose }) {
  if (!order) return null;
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="admin-order-modal-title">
        <div className="admin-modal-heading">
          <div>
            <span className="admin-modal-eyebrow">Order details</span>
            <h2 id="admin-order-modal-title">{order.id}</h2>
          </div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close order details"><AdminIcon name="close" /></button>
        </div>
        <div className="admin-modal-detail"><span>Customer</span><strong>{order.name}</strong><small>{order.email}</small></div>
        <div className="admin-modal-detail"><span>Item</span><strong>{order.item.name}{order.count > 1 ? ` +${order.count - 1}` : ''}</strong></div>
        <div className="admin-modal-detail"><span>Total</span><strong>{order.total}</strong></div>
        <div className="admin-modal-detail"><span>Status</span><strong><span className={`admin-status-pill ${order.status.toLowerCase()}`}>{order.status}</span></strong></div>
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dateRange, setDateRange] = useState('30D');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [notice, setNotice] = useState('');
  const [dispatched, setDispatched] = useState(false);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = orderSearch.trim().toLowerCase();
    const matchesSearch = !query || `${order.id} ${order.name} ${order.email}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'All Statuses' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [orderSearch, statusFilter]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const exportReport = () => {
    const rows = [['Metric', 'Value'], ['Net revenue', '$184,920'], ['Orders fulfilled', '1,428'], ['Active customers', '892'], ['Active SKUs', '314']];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novashop-october-2026-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const changePage = (nextPage) => setPage(Math.min(238, Math.max(1, nextPage)));
  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="admin-dashboard">
      <section className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-description">Store overview, sales performance, and inventory health.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-action-button" type="button"><AdminIcon name="calendar" size={15} /> Oct 1 – Oct 31, 2026 <AdminIcon name="chevron" size={13} /></button>
          <button className="admin-action-button" type="button" onClick={exportReport}><AdminIcon name="download" size={15} /> Export Report</button>
          <button className="admin-action-button is-primary" type="button" onClick={() => setShowAddProduct(true)}><AdminIcon name="plus" size={15} /> Add Product</button>
        </div>
      </section>

      <section className="admin-stat-grid" aria-label="Store performance summary">
        <StatCard label="Total Net Revenue" trend="14.8%" value="$184,920" subtext="$24,180 above forecast" sparkline={0} />
        <StatCard label="Orders Fulfilled" trend="8.2%" value="1,428" subtext="98.4% timely dispatch" sparkline={1} />
        <StatCard label="Active Customers" trend="19.4%" value="892" subtext="41.2% repeat customer rate" sparkline={2} />
        <StatCard label="Catalog Health" value="314 SKUs" subtext="94.2% active inventory" catalog />
      </section>

      <section className="admin-card admin-revenue-card" aria-labelledby="revenue-velocity-title">
        <div className="admin-card-heading">
          <div>
            <div className="admin-card-title-row">
              <h2 className="admin-card-title" id="revenue-velocity-title">Revenue Velocity</h2>
              <span className="admin-soft-badge">October 2026</span>
            </div>
            <div className="admin-revenue-stats">
              <span><strong>$184.9k</strong> Net Sales</span><i>•</i>
              <span><strong>$438.50</strong> AOV</span><i>•</i>
              <span><strong>3.42%</strong> Conv. Rate</span>
            </div>
          </div>
          <div className="admin-revenue-controls">
            <div className="admin-segmented-control" aria-label="Chart date range">
              {chartRanges.map((range) => <button key={range} type="button" className={dateRange === range ? 'is-active' : ''} aria-pressed={dateRange === range} onClick={() => setDateRange(range)}>{range}</button>)}
            </div>
          </div>
        </div>
        <div className="admin-chart-legend-row">
          <div className="admin-chart-legend">
            <span><i className="admin-legend-line" />Current Cycle</span>
            <span><i className="admin-legend-line is-dotted" />Previous Cycle</span>
          </div>
          <div className="admin-peak-callout">Peak day: Oct 22 ($8,490.00)</div>
        </div>
        <RevenueChart />
      </section>

      <section className="admin-lower-grid">
        <div className="admin-order-column">
          <section className="admin-card admin-orders-card" id="recent-orders" aria-labelledby="recent-orders-title">
            <div className="admin-card-heading">
              <div className="admin-card-title-row">
                <h2 className="admin-card-title" id="recent-orders-title">Recent Orders</h2>
                <span className="admin-soft-badge">1,428 Total</span>
              </div>
              <div className="admin-orders-heading-actions">
                <button type="button" className="admin-text-link" onClick={() => scrollToSection('recent-orders')}>View all orders <span aria-hidden="true">→</span></button>
              </div>
            </div>
            <div className="admin-order-toolbar">
              <label className="admin-order-search">
                <AdminIcon name="search" size={15} />
                <input type="search" value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setPage(1); }} placeholder="Filter by order ID, customer name..." aria-label="Filter orders" />
              </label>
              <select className="admin-status-filter" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by order status">
                {['All Statuses', 'Processing', 'Shipped', 'Delivered', 'Pending', 'Refunded'].map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div className="admin-orders-table-wrap">
              <table className="admin-orders-table">
                <thead><tr><th>ORDER ID</th><th>CUSTOMER</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {filteredOrders.map((order, index) => (
                    <tr key={order.id}>
                      <td className="admin-order-id">{order.id}</td>
                      <td>
                        <div className="admin-order-customer">
                          <span className={`admin-customer-avatar tone-${(index % 4) + 1}`}>{order.initials}</span>
                          <span><span className="admin-customer-name">{order.name}{order.count > 1 && <small className="admin-order-multiple">+{order.count - 1}</small>}</span><small className="admin-customer-email">{order.email}</small></span>
                        </div>
                      </td>
                      <td><img className="admin-order-item-image" src={order.item.primaryImage} alt={order.item.name} /></td>
                      <td className="admin-order-total">{order.total}</td>
                      <td><span className={`admin-status-pill ${order.status.toLowerCase()}`}>{order.status}</span></td>
                      <td><button className="admin-view-order" type="button" onClick={() => setSelectedOrder(order)} aria-label={`View order ${order.id}`}><AdminIcon name="eye" size={15} /></button></td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && <tr><td className="admin-empty-orders" colSpan="6">No orders match those filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="admin-order-pagination">
              <span>Showing {filteredOrders.length ? (page - 1) * 6 + 1 : 0}–{(page - 1) * 6 + filteredOrders.length} of 1,428 orders</span>
              <div className="admin-pagination-controls" aria-label="Order pages">
                <button type="button" onClick={() => changePage(page - 1)} aria-label="Previous page"><AdminIcon name="left" size={13} /></button>
                {[1, 2, 3].map((pageNumber) => <button type="button" key={pageNumber} className={page === pageNumber ? 'is-active' : ''} onClick={() => changePage(pageNumber)}>{pageNumber}</button>)}
                <span>…</span>
                <button type="button" className={page === 238 ? 'is-active' : ''} onClick={() => changePage(238)}>238</button>
                <button type="button" onClick={() => changePage(page + 1)} aria-label="Next page"><AdminIcon name="chevron" size={13} /></button>
              </div>
            </div>
          </section>

          <section className="admin-fulfillment-banner" aria-label="Fulfillment queue">
            <div className="admin-fulfillment-copy">
              <span className="admin-fulfillment-icon"><AdminIcon name="truck" size={19} /></span>
              <div>
                <div className="admin-fulfillment-title">Fulfillment Queue · {dispatched ? '0' : '14'} orders ready <span>TODAY</span></div>
                <p className="admin-fulfillment-description">{dispatched ? 'All ready orders have been marked for courier dispatch.' : '14 orders packed and ready for courier pickup at 17:00.'}</p>
              </div>
            </div>
            <div className="admin-fulfillment-actions">
              <button className="admin-action-button" type="button" onClick={() => window.print()}><AdminIcon name="print" size={14} /> Print Slips</button>
              <button className="admin-action-button is-primary" type="button" onClick={() => { setDispatched(true); showNotice('14 orders marked for dispatch.'); }} disabled={dispatched}>{dispatched ? 'Dispatched' : 'Dispatch All'}</button>
            </div>
          </section>
        </div>

        <div className="admin-inventory-column">
          <section className="admin-card admin-product-card" id="top-products" aria-labelledby="top-products-title">
            <div className="admin-card-heading">
              <div><div className="admin-card-title-row"><h2 className="admin-card-title" id="top-products-title">Top Products</h2><span className="admin-soft-badge">Q4 2026</span></div><p className="admin-product-subtitle">By Volume</p></div>
            </div>
            <div className="admin-product-list">
              {topProducts.map(({ product, units, price }) => (
                <article className="admin-product-row" key={product.id}>
                  <img className="admin-product-thumbnail" src={product.primaryImage} alt={product.name} />
                  <div className="admin-product-details"><div className="admin-product-name">{product.name}</div><div className="admin-product-category">{product.collection}</div></div>
                  <div className="admin-product-sales"><strong>{price}</strong><span>{units} sold</span></div>
                </article>
              ))}
            </div>
            <div className="admin-product-view-all"><button className="admin-text-link" type="button" onClick={() => showNotice('Catalog overview selected.')}>View all 314 catalog items <span aria-hidden="true">→</span></button></div>
          </section>

          <section className="admin-card admin-inventory-card" aria-labelledby="inventory-alerts-title">
            <div className="admin-card-heading">
              <div className="admin-inventory-title-wrap"><i className="admin-critical-dot" /><h2 className="admin-card-title" id="inventory-alerts-title">Inventory Alerts</h2></div>
              <span className="admin-critical-pill">6 critical</span>
            </div>
            <div className="admin-inventory-alert-list">
              {inventoryAlerts.map((alert) => (
                <article className="admin-inventory-alert" key={alert.details}>
                  <div className="admin-alert-product">{alert.name}</div>
                  <span className={`admin-alert-left${alert.low ? ' is-low' : ''}`}>{alert.left}</span>
                  <div className="admin-alert-variant">{alert.details}</div>
                  <div className="admin-alert-meta">{alert.lead}</div>
                  <button className="admin-alert-restock" type="button" onClick={() => showNotice(`Restock request started for ${alert.name}.`)}>Restock</button>
                </article>
              ))}
            </div>
            <div className="admin-inventory-manage"><button className="admin-text-link" type="button" onClick={() => showNotice('Inventory management selected.')}>Manage full inventory <span aria-hidden="true">→</span></button></div>
          </section>
        </div>
      </section>

      {showAddProduct && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowAddProduct(false)}>
          <section className="admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="admin-add-product-title">
            <div className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Catalog</span><h2 id="admin-add-product-title">Add product</h2></div><button className="admin-icon-button" type="button" onClick={() => setShowAddProduct(false)} aria-label="Close add product"><AdminIcon name="close" /></button></div>
            <form className="admin-add-product-form" onSubmit={(event) => { event.preventDefault(); setShowAddProduct(false); showNotice('Product draft saved.'); }}>
              <label>Product name<input required placeholder="e.g. Merino wool coat" /></label>
              <div className="admin-add-product-row"><label>SKU<input required placeholder="NS-000-001" /></label><label>Price<input required type="number" min="0" step="0.01" placeholder="0.00" /></label></div>
              <button className="admin-action-button is-primary" type="submit"><AdminIcon name="plus" size={14} /> Save product draft</button>
            </form>
          </section>
        </div>
      )}
      {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}
