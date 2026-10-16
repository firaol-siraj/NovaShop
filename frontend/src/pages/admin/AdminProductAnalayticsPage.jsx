import { useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-product-analytics.css';

/* =========================================================
   MOCK DATA
========================================================= */

const KPI_STATS = [
  { label: 'Units sold', value: '1,480', trend: '+9.2%', tone: 'positive' },
  { label: 'Product views', value: '96,400', trend: '+14.6%', tone: 'positive' },
  { label: 'Add-to-cart rate', value: '14.2%', trend: '+0.8%', tone: 'positive' },
  { label: 'Return rate', value: '3.1%', trend: '+0.4%', tone: 'warning' },
];

const REVENUE_BY_PRODUCT = [
  { name: 'Cashmere Overcoat', revenue: 89900 },
  { name: 'Silk Slip Dress', revenue: 48060 },
  { name: 'Leather Tote Bag', revenue: 36960 },
  { name: 'Merino Wool Sweater', revenue: 29820 },
  { name: 'Suede Chelsea Boots', revenue: 21840 },
  { name: 'Silk Scarf', revenue: 18000 },
  { name: 'Tailored Wool Trousers', revenue: 15120 },
  { name: 'Linen Shirt', revenue: 9250 },
];

const RESTOCK_ALERTS = [
  { name: 'Silk Slip Dress', sku: 'NS-DR-089', status: 'low', label: '12 left', swatch: '#7C6B5C' },
  { name: 'Suede Chelsea Boots', sku: 'NS-FT-412', status: 'low', label: '9 left', swatch: '#5C4B3A' },
  { name: 'Leather Tote Bag', sku: 'NS-AC-142', status: 'critical', label: '2 left', swatch: '#4A3F33' },
  { name: 'Wool Beanie', sku: 'NS-AC-780', status: 'out', label: 'Out of stock', swatch: '#9A8E7E' },
];

const PERFORMANCE_TABS = ['Best sellers', 'Most viewed', 'Low performers'];

const PRODUCT_PERFORMANCE = [
  { name: 'Cashmere Overcoat', category: 'Outerwear', views: 14820, addToCart: 16.4, units: 62, revenue: 89900, returnRate: 2.19, status: 'In stock' },
  { name: 'Silk Slip Dress', category: 'Dresses', views: 12300, addToCart: 14.9, units: 54, revenue: 48060, returnRate: 4.8, status: 'Low stock' },
  { name: 'Leather Tote Bag', category: 'Accessories', views: 9760, addToCart: 13.2, units: 33, revenue: 36960, returnRate: 1.1, status: 'Out of stock' },
  { name: 'Merino Wool Sweater', category: 'Knitwear', views: 11240, addToCart: 12.7, units: 71, revenue: 29820, returnRate: 3.49, status: 'In stock' },
  { name: 'Suede Chelsea Boots', category: 'Footwear', views: 7480, addToCart: 11.8, units: 28, revenue: 21840, returnRate: 2.6, status: 'Low stock' },
  { name: 'Silk Scarf', category: 'Accessories', views: 6150, addToCart: 15.6, units: 75, revenue: 18000, returnRate: 1.29, status: 'In stock' },
];

const SALES_BY_CATEGORY = [
  { label: 'Outerwear', revenue: 98400 },
  { label: 'Dresses', revenue: 72150 },
  { label: 'Accessories', revenue: 54300 },
  { label: 'Knitwear', revenue: 35900 },
  { label: 'Footwear', revenue: 23850 },
];

const RETURNS_BY_REASON = [
  { label: 'Wrong size', count: 612, percent: 41 },
  { label: 'Not as described', count: 358, percent: 24 },
  { label: 'Damaged on arrival', count: 284, percent: 19 },
  { label: 'Changed mind', count: 239, percent: 16 },
];

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year'];

const STATUS_META = {
  'In stock': 'in-stock',
  'Low stock': 'low-stock',
  'Out of stock': 'out-of-stock',
};

function formatCurrency(value) {
  return `$${Number(value).toLocaleString('en-US')}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

/* =========================================================
   DATE RANGE DROPDOWN
========================================================= */

function RangeDropdown({ value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="pa-range-dropdown" ref={ref}>
      <button
        type="button"
        className="pa-range-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <AdminIcon name="calendar" size={14} />
        <span>{value}</span>
        <AdminIcon name="chevron" size={12} />
      </button>

      {isOpen && (
        <div className="pa-range-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              className={value === option ? 'is-selected' : ''}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
              {value === option && <AdminIcon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StockPill({ status, label }) {
  return <span className={`pa-stock-pill is-${status}`}>{label}</span>;
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminProductAnalyticsPage({ go }) {
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [performanceTab, setPerformanceTab] = useState('Best sellers');
  const [notice, setNotice] = useState('');

  const maxRevenue = Math.max(...REVENUE_BY_PRODUCT.map((item) => item.revenue));
  const maxCategoryRevenue = Math.max(...SALES_BY_CATEGORY.map((item) => item.revenue));
  const totalReturns = RETURNS_BY_REASON.reduce((sum, item) => sum + item.count, 0);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const goToInventory = () => {
    if (go) {
      go('/admin/inventory');
      return;
    }
    notify('Opening inventory…');
  };

  const exportReport = () => {
    const rows = [
      ['Metric', 'Value', 'Trend'],
      ...KPI_STATS.map((stat) => [stat.label, stat.value, stat.trend]),
      [],
      ['Product', 'Category', 'Views', 'Add-to-cart', 'Units sold', 'Revenue', 'Return rate', 'Status'],
      ...PRODUCT_PERFORMANCE.map((item) => [
        item.name,
        item.category,
        item.views,
        `${item.addToCart}%`,
        item.units,
        item.revenue,
        `${item.returnRate}%`,
        item.status,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novashop-product-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);

    notify('Product report exported');
  };

  return (
    <div className="admin-dashboard pa-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as Inventory/Analytics */}
      <section className="admin-page-heading pa-page-heading">
        <div>
          <h1 className="admin-page-title">Product Analytics</h1>
          <p className="admin-page-description">
            See which products sell, convert, and need attention.
          </p>
        </div>

        <div className="admin-page-actions">
          <RangeDropdown value={dateRange} options={DATE_RANGES} onChange={setDateRange} />

          <button type="button" className="admin-action-button is-primary" onClick={exportReport}>
            <AdminIcon name="download" size={15} />
            Export report
          </button>
        </div>
      </section>

      <div className="pa-kpi-label">VS PREVIOUS 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid pa-stat-grid">
        {KPI_STATS.map((stat) => (
          <article className="admin-stat-card" key={stat.label}>
            <div className="admin-stat-heading">
              <span className="admin-stat-label">{stat.label}</span>
              <span
                className={`admin-trend-pill${stat.tone === 'warning' ? ' is-warning' : ''}`}
              >
                {stat.trend}
              </span>
            </div>
            <div className="admin-stat-value">{stat.value}</div>
          </article>
        ))}
      </section>

      {/* REVENUE BY PRODUCT + NEEDS RESTOCKING */}
      <section className="pa-main-grid">
        <article className="pa-card pa-revenue-card">
          <div className="pa-card-heading">
            <div>
              <h2>Revenue by product</h2>
              <p>Which products earn the most?</p>
            </div>

            <span className="pa-eyebrow">GROSS SALES</span>
          </div>

          <div className="pa-bar-list">
            {REVENUE_BY_PRODUCT.map((product) => (
              <div className="pa-bar-row" key={product.name}>
                <span className="pa-bar-label">{product.name}</span>

                <div className="pa-bar-track">
                  <span style={{ width: `${(product.revenue / maxRevenue) * 100}%` }} />
                </div>

                <strong className="pa-bar-value">{formatCurrency(product.revenue)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="pa-card pa-restock-card">
          <div className="pa-card-heading">
            <div>
              <h2>Needs restocking</h2>
              <p>What should we reorder?</p>
            </div>

            <button type="button" className="pa-text-link" onClick={goToInventory}>
              View inventory <span>→</span>
            </button>
          </div>

          <div className="pa-restock-list">
            {RESTOCK_ALERTS.map((item) => (
              <div className="pa-restock-row" key={item.sku}>
                <span
                  className="pa-restock-thumb"
                  style={{ background: item.swatch }}
                  aria-hidden="true"
                />

                <div className="pa-restock-identity">
                  <strong>{item.name}</strong>
                  <small>SKU: {item.sku}</small>
                </div>

                <span className={`pa-restock-pill is-${item.status}`}>
                  <i />
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* PRODUCT PERFORMANCE TABLE */}
      <section className="pa-card pa-performance-card">
        <div className="pa-card-heading">
          <div>
            <h2>Product performance</h2>
            <p>How is each product doing?</p>
          </div>

          <div className="pa-segmented-control">
            {PERFORMANCE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={performanceTab === tab ? 'is-selected' : ''}
                onClick={() => setPerformanceTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pa-performance-table">
          <div className="pa-performance-row pa-performance-head">
            <span>PRODUCT</span>
            <span>VIEWS</span>
            <span>ADD-TO-CART</span>
            <span>UNITS SOLD</span>
            <span>REVENUE</span>
            <span>RETURN</span>
            <span>STATUS</span>
          </div>

          {PRODUCT_PERFORMANCE.map((product) => (
            <div className="pa-performance-row" key={product.name}>
              <div className="pa-performance-identity">
                <strong>{product.name}</strong>
                <small>{product.category}</small>
              </div>

              <span className="pa-performance-cell">{formatNumber(product.views)}</span>
              <span className="pa-performance-cell">{product.addToCart}%</span>
              <span className="pa-performance-cell">{product.units}</span>
              <span className="pa-performance-cell pa-performance-revenue">
                {formatCurrency(product.revenue)}
              </span>
              <span className="pa-performance-cell">{product.returnRate}%</span>

              <span className="pa-performance-status">
                <StockPill status={STATUS_META[product.status]} label={product.status} />
              </span>
            </div>
          ))}
        </div>

        <button type="button" className="pa-view-all">
          View all products <span>→</span>
        </button>
      </section>

      {/* SALES BY CATEGORY + RETURNS BY REASON */}
      <section className="pa-trio-grid">
        <article className="pa-card">
          <div className="pa-card-heading">
            <div>
              <h2>Sales by category</h2>
              <p>Which categories drive revenue?</p>
            </div>

            <span className="pa-eyebrow">SHARE OF SALES</span>
          </div>

          <div className="pa-category-list">
            {SALES_BY_CATEGORY.map((item) => (
              <div className="pa-category-row" key={item.label}>
                <span className="pa-category-label">{item.label}</span>

                <div className="pa-category-track">
                  <span style={{ width: `${(item.revenue / maxCategoryRevenue) * 100}%` }} />
                </div>

                <strong className="pa-category-value">{formatCurrency(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="pa-card">
          <div className="pa-card-heading">
            <div>
              <h2>Returns by reason</h2>
              <p>Why are products sent back?</p>
            </div>

            <span className="pa-eyebrow">{formatNumber(totalReturns)} RETURNS</span>
          </div>

          <div className="pa-returns-list">
            {RETURNS_BY_REASON.map((reason) => (
              <div className="pa-returns-row" key={reason.label}>
                <div className="pa-returns-copy">
                  <span>{reason.label}</span>
                  <small>{formatNumber(reason.count)} returns</small>
                </div>

                <div className="pa-returns-track">
                  <span style={{ width: `${reason.percent}%` }} />
                </div>

                <strong className="pa-returns-percent">{reason.percent}%</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}