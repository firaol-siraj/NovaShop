import { useRef, useState, useEffect, useMemo } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import {
  useAdminProductAnalytics,
  useAnalyticsUrlState,
  resolveDateRangeBounds,
} from '../../hooks/useAdminAnalytics';
import adminApi from '../../lib/api/adminApi';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import './admin-product-analytics.css';

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'This year'];
const PERFORMANCE_TABS = ['Best sellers', 'Most viewed', 'Low performers'];

const STATUS_META = {
  'In stock': 'in-stock',
  'Low stock': 'low-stock',
  'Out of stock': 'out-of-stock',
};

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

function StockPill({ status = 'in-stock', label = 'In stock' }) {
  return <span className={`pa-stock-pill is-${status}`}>{label}</span>;
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminProductAnalyticsPage({ go }) {
  const { dateRange, setDateRange } = useAnalyticsUrlState('Last 30 days', 'Daily');
  const [performanceTab, setPerformanceTab] = useState('Best sellers');
  const [notice, setNotice] = useState('');

  const { from, to } = useMemo(() => resolveDateRangeBounds(dateRange), [dateRange]);

  const { data, isLoading, isError, error, refetch } = useAdminProductAnalytics({
    from,
    to,
    tab: performanceTab,
  });

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
  };

  const navigateTo = (targetPath) => {
    if (go) {
      go(targetPath);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetPath;
    }
  };

  // Revenue by product
  const revenueByProduct = data?.revenueByProduct || [];
  const maxRevenue = Math.max(1, ...revenueByProduct.map((item) => item.revenue || 0));

  // Restock alerts
  const restockAlerts = data?.restockAlerts || [];

  // Product performance
  const productPerformance = data?.productPerformance || [];

  // Sales by category
  const salesByCategory = data?.salesByCategory || [];
  const maxCategoryRevenue = Math.max(1, ...salesByCategory.map((item) => item.revenue || 0));

  // Returns
  const returnsByReason = data?.returnsByReason?.reasons || [
    { label: 'Wrong size', count: 0, percent: null },
    { label: 'Not as described', count: 0, percent: null },
    { label: 'Damaged on arrival', count: 0, percent: null },
    { label: 'Changed mind', count: 0, percent: null },
  ];
  const totalReturns = data?.returnsByReason?.totalReturns || 0;

  // Export report
  const exportReport = async () => {
    try {
      notify('Exporting product report…');
      const blob = await adminApi.exportAnalyticsCsv({ page: 'products', from, to });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novashop-product-analytics-${dateRange.toLowerCase().replace(/\s+/g, '-')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Product report exported');
    } catch {
      notify('Failed to export CSV report');
    }
  };

  const kpiStats = [
    {
      label: 'Units sold',
      value: isLoading ? '...' : data?.kpis?.unitsSold?.formatted || '0',
      trend: data?.kpis?.unitsSold?.formattedTrend || '-',
      tone: 'positive',
    },
    {
      label: 'Product views',
      value: isLoading ? '...' : data?.kpis?.productViews?.formatted || '-',
      trend: data?.kpis?.productViews?.formattedTrend || '-',
      tone: 'positive',
    },
    {
      label: 'Add-to-cart rate',
      value: isLoading ? '...' : data?.kpis?.addToCartRate?.formatted || '-',
      trend: data?.kpis?.addToCartRate?.formattedTrend || '-',
      tone: 'positive',
    },
    {
      label: 'Return rate',
      value: isLoading ? '...' : data?.kpis?.returnRate?.formatted || '0.0%',
      trend: data?.kpis?.returnRate?.formattedTrend || '-',
      tone: 'warning',
    },
  ];

  return (
    <div className="admin-dashboard pa-page">
      {/* PAGE HEADER */}
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

      <div className="pa-kpi-label">
        VS PREVIOUS {data?.durationDays || 30} DAYS
      </div>

      {/* KPI ROW */}
      <section className="admin-stat-grid pa-stat-grid">
        {kpiStats.map((stat) => (
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
            {revenueByProduct.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No product sales recorded in this period
              </div>
            ) : (
              revenueByProduct.map((product) => (
                <div className="pa-bar-row" key={product.name}>
                  <span className="pa-bar-label">{product.name}</span>

                  <div className="pa-bar-track">
                    <span
                      style={{
                        width: `${maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <strong className="pa-bar-value">{formatCurrency(product.revenue)}</strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="pa-card pa-restock-card">
          <div className="pa-card-heading">
            <div>
              <h2>Needs restocking</h2>
              <p>What should we reorder?</p>
            </div>

            <button type="button" className="pa-text-link" onClick={() => navigateTo('/admin/inventory')}>
              View inventory <span>→</span>
            </button>
          </div>

          <div className="pa-restock-list">
            {restockAlerts.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                All product variants are sufficiently stocked
              </div>
            ) : (
              restockAlerts.map((item) => (
                <div className="pa-restock-row" key={item.sku}>
                  <span
                    className="pa-restock-thumb"
                    style={{ background: item.swatch || '#7C6B5C' }}
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
              ))
            )}
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

          {productPerformance.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8A847C]">
              No product performance data in this period
            </div>
          ) : (
            productPerformance.map((product) => (
              <div className="pa-performance-row" key={product.name}>
                <div className="pa-performance-identity">
                  <strong>{product.name}</strong>
                  <small>{product.category}</small>
                </div>

                <span className="pa-performance-cell">
                  {product.views !== null ? formatNumber(product.views) : '-'}
                </span>
                <span className="pa-performance-cell">
                  {product.addToCart !== null ? `${product.addToCart}%` : '-'}
                </span>
                <span className="pa-performance-cell">{product.units}</span>
                <span className="pa-performance-cell pa-performance-revenue">
                  {formatCurrency(product.revenue)}
                </span>
                <span className="pa-performance-cell">
                  {product.returnRate !== null ? `${product.returnRate}%` : '-'}
                </span>

                <span className="pa-performance-status">
                  <StockPill
                    status={STATUS_META[product.status] || 'in-stock'}
                    label={product.status || 'In stock'}
                  />
                </span>
              </div>
            ))
          )}
        </div>

        <button type="button" className="pa-view-all" onClick={() => navigateTo('/admin/products')}>
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
            {salesByCategory.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No category sales recorded in this period
              </div>
            ) : (
              salesByCategory.map((item) => (
                <div className="pa-category-row" key={item.label}>
                  <span className="pa-category-label">{item.label}</span>

                  <div className="pa-category-track">
                    <span
                      style={{
                        width: `${maxCategoryRevenue > 0 ? (item.revenue / maxCategoryRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <strong className="pa-category-value">{formatCurrency(item.revenue)}</strong>
                </div>
              ))
            )}
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
            {returnsByReason.map((reason) => (
              <div className="pa-returns-row" key={reason.label}>
                <div className="pa-returns-copy">
                  <span>{reason.label}</span>
                  <small>{formatNumber(reason.count)} returns</small>
                </div>

                <div className="pa-returns-track">
                  <span style={{ width: `${reason.percent !== null ? reason.percent : 0}%` }} />
                </div>

                <strong className="pa-returns-percent">
                  {reason.percent !== null ? `${reason.percent}%` : '-'}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      {isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center justify-between">
          <span>{error || 'Failed to load product analytics'}</span>
          <button
            type="button"
            className="underline font-semibold ml-4"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
