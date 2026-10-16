import { useMemo, useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-analytics-overview.css';

/* =========================================================
   MOCK DATA
========================================================= */

const KPI_STATS = [
  { label: 'Revenue', value: '$284,600', trend: '+12.4%', positive: true },
  { label: 'Orders', value: '1,126', trend: '+8.1%', positive: true },
  { label: 'Average order value', value: '$252.75', trend: '+3.9%', positive: true },
  { label: 'Conversion rate', value: '3.2%', trend: '−0.3%', positive: false },
];

const REVENUE_SERIES = [
  { date: 'Sep 1', value: 4100 },
  { date: 'Sep 5', value: 7200 },
  { date: 'Sep 10', value: 5400 },
  { date: 'Sep 15', value: 9600 },
  { date: 'Sep 18', value: 12840, orders: 54, highlight: true },
  { date: 'Sep 20', value: 8900 },
  { date: 'Sep 25', value: 11200 },
  { date: 'Sep 30', value: 13600 },
];

const FUNNEL_STEPS = [
  { label: 'Sessions', value: 48200, percent: null },
  { label: 'Added to cart', value: 6840, percent: 14.2 },
  { label: 'Checkout', value: 2310, percent: 33.8 },
  { label: 'Purchased', value: 1126, percent: 48.7 },
];

const TOP_PRODUCTS = [
  { id: 'P-01', name: 'Cashmere Overcoat', category: 'Outerwear', units: 62, revenue: 89900, share: 32, swatch: '#3C342B' },
  { id: 'P-02', name: 'Silk Slip Dress', category: 'Dresses', units: 54, revenue: 48060, share: 17, swatch: '#7C6B5C' },
  { id: 'P-03', name: 'Leather Tote Bag', category: 'Accessories', units: 33, revenue: 36960, share: 13, swatch: '#4A3F33' },
  { id: 'P-04', name: 'Merino Wool Sweater', category: 'Knitwear', units: 71, revenue: 29820, share: 10, swatch: '#9A8E7E' },
  { id: 'P-05', name: 'Suede Chelsea Boots', category: 'Footwear', units: 28, revenue: 21840, share: 8, swatch: '#5C4B3A' },
];

const SALES_BY_CATEGORY = [
  { label: 'Outerwear', revenue: 98400 },
  { label: 'Dresses', revenue: 72150 },
  { label: 'Accessories', revenue: 54300 },
  { label: 'Knitwear', revenue: 35900 },
  { label: 'Footwear', revenue: 23850 },
];

const SALES_BY_COUNTRY = [
  { label: 'United States', revenue: 112400 },
  { label: 'United Kingdom', revenue: 54800 },
  { label: 'Germany', revenue: 32100 },
  { label: 'United Arab Emirates', revenue: 24700 },
  { label: 'Singapore', revenue: 19300 },
];

const TRAFFIC_SOURCES = [
  { label: 'Direct', percent: 34 },
  { label: 'Organic search', percent: 27 },
  { label: 'Email', percent: 16 },
  { label: 'Social', percent: 14 },
  { label: 'Paid', percent: 9 },
];

const CUSTOMER_LOYALTY = {
  returning: 698,
  new: 428,
};

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year'];
const CHART_GRANULARITY = ['Daily', 'Weekly', 'Monthly'];

function formatCurrency(value) {
  return `$${Number(value).toLocaleString('en-US')}`;
}

/* =========================================================
   SMALL REUSABLE DROPDOWN (date range picker)
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
    <div className="analytics-range-dropdown" ref={ref}>
      <button
        type="button"
        className="analytics-range-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <AdminIcon name="calendar" size={14} />
        <span>{value}</span>
        <AdminIcon name="chevron" size={12} />
      </button>

      {isOpen && (
        <div className="analytics-range-menu" role="listbox">
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

/* =========================================================
   REVENUE LINE CHART (lightweight inline SVG, no dependency)
========================================================= */

function RevenueChart({ series }) {
  const width = 640;
  const height = 220;
  const paddingLeft = 36;
  const paddingBottom = 24;
  const maxValue = 15000;

  const points = useMemo(() => {
    const innerWidth = width - paddingLeft;
    const step = innerWidth / (series.length - 1);

    return series.map((point, index) => ({
      ...point,
      x: paddingLeft + step * index,
      y: height - paddingBottom - (point.value / maxValue) * (height - paddingBottom),
    }));
  }, [series]);

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');

  const areaPath = `${linePath} L${points[points.length - 1].x},${height - paddingBottom} L${points[0].x},${height - paddingBottom} Z`;

  const highlighted = points.find((point) => point.highlight);
  const gridValues = [0, 5000, 10000, 15000];

  return (
    <svg
      className="analytics-chart-svg"
      viewBox={`0 0 ${width} ${height + 20}`}
      role="img"
      aria-label="Revenue trend from September 1 to September 30"
    >
      {gridValues.map((value) => {
        const y = height - paddingBottom - (value / maxValue) * (height - paddingBottom);
        return (
          <g key={value}>
            <line
              x1={paddingLeft}
              x2={width}
              y1={y}
              y2={y}
              className="analytics-chart-grid"
            />
            <text x={0} y={y + 3} className="analytics-chart-axis-label">
              {value === 0 ? '$0' : `$${value / 1000}k`}
            </text>
          </g>
        );
      })}

      <path d={areaPath} className="analytics-chart-area" />
      <path d={linePath} className="analytics-chart-line" />

      {highlighted && (
        <line
          x1={highlighted.x}
          x2={highlighted.x}
          y1={highlighted.y}
          y2={height - paddingBottom}
          className="analytics-chart-guide"
        />
      )}

      {points.map((point) => (
        <circle
          key={point.date}
          cx={point.x}
          cy={point.y}
          r={point.highlight ? 4 : 0}
          className="analytics-chart-dot"
        />
      ))}

      {series
        .filter((_, index) => index % 2 === 0 || index === series.length - 1)
        .map((point) => {
          const matched = points.find((p) => p.date === point.date);
          return (
            <text
              key={point.date}
              x={matched.x}
              y={height + 14}
              className="analytics-chart-axis-label analytics-chart-axis-label-x"
            >
              {point.date}
            </text>
          );
        })}
    </svg>
  );
}

/* =========================================================
   CUSTOMER LOYALTY DONUT
========================================================= */

function LoyaltyDonut({ returning, newCustomers }) {
  const total = returning + newCustomers;
  const returningPercent = Math.round((returning / total) * 100);

  return (
    <div
      className="analytics-donut"
      style={{
        background: `conic-gradient(var(--admin-primary) 0% ${returningPercent}%, #EEE9E2 ${returningPercent}% 100%)`,
      }}
    >
      <div className="analytics-donut-hole">
        <strong>{returningPercent}%</strong>
        <span>RETURNING</span>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminAnalyticsOverviewPage() {
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [granularity, setGranularity] = useState('Daily');
  const [notice, setNotice] = useState('');

  const maxFunnelValue = FUNNEL_STEPS[0].value;
  const maxCategoryRevenue = Math.max(...SALES_BY_CATEGORY.map((item) => item.revenue));
  const maxCountryRevenue = Math.max(...SALES_BY_COUNTRY.map((item) => item.revenue));

  const totalCategoryRevenue = SALES_BY_CATEGORY.reduce((sum, item) => sum + item.revenue, 0);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const exportReport = () => {
    const rows = [
      ['Metric', 'Value', 'Trend'],
      ...KPI_STATS.map((stat) => [stat.label, stat.value, stat.trend]),
      [],
      ['Top products', 'Units sold', 'Revenue', 'Share'],
      ...TOP_PRODUCTS.map((product) => [
        product.name,
        product.units,
        product.revenue,
        `${product.share}%`,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novashop-analytics-overview.csv';
    link.click();
    URL.revokeObjectURL(url);

    notify('Analytics report exported');
  };

  return (
    <div className="admin-dashboard analytics-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as Inventory */}
      <section className="admin-page-heading analytics-page-heading">
        <div>
          <h1 className="admin-page-title">Analytics Overview</h1>
          <p className="admin-page-description">
            A summary of sales, products, and customers.
          </p>
        </div>

        <div className="admin-page-actions">
          <RangeDropdown value={dateRange} options={DATE_RANGES} onChange={setDateRange} />

          <button
            type="button"
            className="admin-action-button is-primary"
            onClick={exportReport}
          >
            <AdminIcon name="download" size={15} />
            Export report
          </button>
        </div>
      </section>

      <div className="analytics-kpi-label">VS PREVIOUS 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes, same as Inventory/Discounts */}
      <section className="admin-stat-grid analytics-stat-grid">
        {KPI_STATS.map((stat) => (
          <article className="admin-stat-card" key={stat.label}>
            <div className="admin-stat-heading">
              <span className="admin-stat-label">{stat.label}</span>
              <span
                className={`admin-trend-pill${stat.positive ? '' : ' is-negative'}`}
              >
                {stat.trend}
              </span>
            </div>
            <div className="admin-stat-value">{stat.value}</div>
          </article>
        ))}
      </section>

      {/* REVENUE CHART + CONVERSION FUNNEL */}
      <section className="analytics-main-grid">
        <article className="analytics-card analytics-chart-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Revenue</h2>
              <p>How are sales trending?</p>
            </div>

            <div className="analytics-chart-controls">
              <div className="analytics-segmented-control">
                {CHART_GRANULARITY.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={granularity === option ? 'is-selected' : ''}
                    onClick={() => setGranularity(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <button type="button" className="analytics-text-link">
                View sales report <span>→</span>
              </button>
            </div>
          </div>

          <div className="analytics-chart-wrap">
            <RevenueChart series={REVENUE_SERIES} />

            <div className="analytics-chart-tooltip">
              <strong>Sep 18</strong> · $12,840 · 54 orders
            </div>
          </div>
        </article>

        <article className="analytics-card analytics-funnel-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Conversion funnel</h2>
              <p>Where do we lose customers?</p>
            </div>
          </div>

          <div className="analytics-funnel-list">
            {FUNNEL_STEPS.map((step) => (
              <div className="analytics-funnel-row" key={step.label}>
                <div className="analytics-funnel-top">
                  <span>{step.label}</span>
                  <span className="analytics-funnel-values">
                    {step.percent !== null && (
                      <strong className="analytics-funnel-percent">{step.percent}%</strong>
                    )}
                    {Number(step.value).toLocaleString('en-US')}
                  </span>
                </div>

                <div className="analytics-funnel-bar">
                  <span style={{ width: `${(step.value / maxFunnelValue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="analytics-card-footer">
            <span>Overall conversion efficiency</span>
            <strong>2.33% total</strong>
          </div>
        </article>

        {/* TOP PRODUCTS + SALES BY CATEGORY */}
        <article className="analytics-card analytics-products-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Top products</h2>
              <p>What is selling best?</p>
            </div>

            <button type="button" className="analytics-text-link">
              View product report <span>→</span>
            </button>
          </div>

          <div className="analytics-products-table">
            <div className="analytics-products-row analytics-products-head">
              <span>PRODUCT</span>
              <span>UNITS SOLD</span>
              <span>REVENUE</span>
              <span>SHARE</span>
            </div>

            {TOP_PRODUCTS.map((product) => (
              <div className="analytics-products-row" key={product.id}>
                <div className="analytics-product-identity">
                  <span
                    className="analytics-product-thumb"
                    style={{ background: product.swatch }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.category}</small>
                  </div>
                </div>

                <span className="analytics-products-units">{product.units}</span>

                <span className="analytics-products-revenue">
                  {formatCurrency(product.revenue)}
                </span>

                <span className="analytics-products-share">
                  <i style={{ width: `${product.share * 2.2}px` }} />
                  {product.share}%
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-card analytics-category-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Sales by category</h2>
              <p>Which categories drive revenue?</p>
            </div>
          </div>

          <div className="analytics-bar-list">
            {SALES_BY_CATEGORY.map((item) => (
              <div className="analytics-bar-row" key={item.label}>
                <div className="analytics-bar-top">
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.revenue)}</strong>
                </div>
                <div className="analytics-bar-track">
                  <span
                    style={{ width: `${(item.revenue / maxCategoryRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="analytics-card-footer">
            <span>Total 5 categories</span>
            <strong>
              {formatCurrency(totalCategoryRevenue)} (100%)
            </strong>
          </div>
        </article>
      </section>

      {/* SALES BY COUNTRY / TRAFFIC SOURCES / CUSTOMER LOYALTY */}
      <section className="analytics-trio-grid">
        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Sales by country</h2>
              <p>Regional order contribution</p>
            </div>
          </div>

          <div className="analytics-bar-list analytics-bar-list-compact">
            {SALES_BY_COUNTRY.map((item) => (
              <div className="analytics-bar-row" key={item.label}>
                <div className="analytics-bar-top">
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.revenue)}</strong>
                </div>
                <div className="analytics-bar-track analytics-bar-track-thin">
                  <span
                    style={{ width: `${(item.revenue / maxCountryRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="analytics-note">Top 5 markets yield 85.5% volume.</p>
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Traffic sources</h2>
              <p>Channel acquisition breakdown</p>
            </div>
          </div>

          <div className="analytics-bar-list analytics-bar-list-compact">
            {TRAFFIC_SOURCES.map((item) => (
              <div className="analytics-bar-row" key={item.label}>
                <div className="analytics-bar-top">
                  <span>{item.label}</span>
                  <strong>{item.percent}%</strong>
                </div>
                <div className="analytics-bar-track analytics-bar-track-thin">
                  <span style={{ width: `${item.percent * 2.5}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p className="analytics-note">High intent direct engagement leads.</p>
        </article>

        <article className="analytics-card analytics-loyalty-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Customer loyalty</h2>
              <p>Who is buying?</p>
            </div>

            <button
              type="button"
              className="analytics-icon-link"
              aria-label="Open full customer report"
              onClick={() => notify('Opening customer analytics…')}
            >
              ↗
            </button>
          </div>

          <LoyaltyDonut
            returning={CUSTOMER_LOYALTY.returning}
            newCustomers={CUSTOMER_LOYALTY.new}
          />

          <div className="analytics-loyalty-legend">
            <div className="analytics-loyalty-legend-row">
              <span className="analytics-legend-dot is-returning" />
              Returning customers
              <strong>{CUSTOMER_LOYALTY.returning}</strong>
            </div>
            <div className="analytics-loyalty-legend-row">
              <span className="analytics-legend-dot is-new" />
              New customers
              <strong>{CUSTOMER_LOYALTY.new}</strong>
            </div>
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