import { useMemo, useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-sales-analytics.css';

/* =========================================================
   MOCK DATA
========================================================= */

const KPI_STATS = [
  { label: 'Gross sales', value: '$312,400', trend: '+11.8%', tone: 'positive' },
  { label: 'Net sales', value: '$284,600', trend: '+12.4%', tone: 'positive' },
  { label: 'Refunds', value: '$9,840', trend: '+0.8%', tone: 'warning' },
  { label: 'Average order value', value: '$252.75', trend: '+3.9%', tone: 'positive' },
];

const SALES_SERIES = [
  { date: 'Sep 1', day: 'Tue', gross: 4600, net: 4100 },
  { date: 'Sep 5', day: 'Sat', gross: 7900, net: 7200 },
  { date: 'Sep 10', day: 'Thu', gross: 6100, net: 5400 },
  { date: 'Sep 15', day: 'Tue', gross: 10600, net: 9600 },
  { date: 'Sep 18', day: 'Fri', gross: 9200, net: 8400 },
  { date: 'Sep 20', day: 'Wed', gross: 13900, net: 12840, highlight: true },
  { date: 'Sep 25', day: 'Mon', gross: 11900, net: 10800 },
  { date: 'Sep 30', day: 'Sat', gross: 14600, net: 13200 },
];

const ORDERS_BY_STATUS = [
  { label: 'Delivered', value: 812 },
  { label: 'Shipped', value: 164 },
  { label: 'Processing', value: 96 },
  { label: 'Pending', value: 38 },
  { label: 'Cancelled', value: 16 },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'];

// Order volume intensity per day/time-slot, 0 (quietest) to 4 (busiest).
const SALES_HEATMAP = [
  [1, 0, 2, 3, 3, 4],
  [0, 0, 1, 2, 3, 3],
  [1, 0, 2, 3, 3, 4],
  [1, 0, 2, 3, 3, 4],
  [1, 0, 1, 3, 3, 3],
  [2, 1, 2, 3, 3, 4],
  [2, 0, 1, 2, 3, 3],
];

const SELECTED_CELL = { dayIndex: 3, slotIndex: 5 };

const PAYMENT_METHODS = [
  { label: 'Card', percent: 58 },
  { label: 'Apple Pay', percent: 19 },
  { label: 'PayPal', percent: 14 },
  { label: 'Bank transfer', percent: 9 },
];

const SALES_BY_COUNTRY = [
  { label: 'United States', revenue: 112400 },
  { label: 'United Kingdom', revenue: 54800 },
  { label: 'Germany', revenue: 32100 },
  { label: 'United Arab Emirates', revenue: 24700 },
  { label: 'Singapore', revenue: 19300 },
];

const DISCOUNT_PERFORMANCE = [
  { name: 'Autumn Sale', code: 'AUTUMN20', redemptions: 142, revenue: 41200 },
  { name: 'Free Shipping', code: 'SHIPFREE', redemptions: 389, revenue: 28600 },
  { name: 'Welcome Offer', code: 'WELCOME10', redemptions: 204, revenue: 17900 },
  { name: 'Outerwear Event', code: 'COAT15', redemptions: 87, revenue: 8700 },
];

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year'];
const CHART_GRANULARITY = ['Daily', 'Weekly', 'Monthly'];

function formatCurrency(value) {
  return `$${Number(value).toLocaleString('en-US')}`;
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
    <div className="sales-range-dropdown" ref={ref}>
      <button
        type="button"
        className="sales-range-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <AdminIcon name="calendar" size={14} />
        <span>{value}</span>
        <AdminIcon name="chevron" size={12} />
      </button>

      {isOpen && (
        <div className="sales-range-menu" role="listbox">
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
   DUAL-SERIES SALES CHART (lightweight inline SVG)
========================================================= */

function SalesChart({ series }) {
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
      grossY: height - paddingBottom - (point.gross / maxValue) * (height - paddingBottom),
      netY: height - paddingBottom - (point.net / maxValue) * (height - paddingBottom),
    }));
  }, [series]);

  const grossPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.grossY}`).join(' ');
  const netPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.netY}`).join(' ');

  const highlighted = points.find((point) => point.highlight);
  const gridValues = [0, 5000, 10000, 15000];

  return (
    <svg
      className="sales-chart-svg"
      viewBox={`0 0 ${width} ${height + 20}`}
      role="img"
      aria-label="Gross and net sales trend from September 1 to September 30"
    >
      {gridValues.map((value) => {
        const y = height - paddingBottom - (value / maxValue) * (height - paddingBottom);
        return (
          <g key={value}>
            <line x1={paddingLeft} x2={width} y1={y} y2={y} className="sales-chart-grid" />
            <text x={0} y={y + 3} className="sales-chart-axis-label">
              {value === 0 ? '$0' : `$${value / 1000}k`}
            </text>
          </g>
        );
      })}

      <path d={netPath} className="sales-chart-line sales-chart-line-net" />
      <path d={grossPath} className="sales-chart-line sales-chart-line-gross" />

      {highlighted && (
        <line
          x1={highlighted.x}
          x2={highlighted.x}
          y1={Math.min(highlighted.grossY, highlighted.netY)}
          y2={height - paddingBottom}
          className="sales-chart-guide"
        />
      )}

      {points.map(
        (point) =>
          point.highlight && (
            <g key={point.date}>
              <circle cx={point.x} cy={point.grossY} r={4} className="sales-chart-dot sales-chart-dot-gross" />
              <circle cx={point.x} cy={point.netY} r={4} className="sales-chart-dot sales-chart-dot-net" />
            </g>
          )
      )}

      {series.map((point) => {
        const matched = points.find((p) => p.date === point.date);
        return (
          <text
            key={point.date}
            x={matched.x}
            y={height + 14}
            className={`sales-chart-axis-label sales-chart-axis-label-x${
              point.highlight ? ' is-active' : ''
            }`}
          >
            {point.date}
          </text>
        );
      })}
    </svg>
  );
}

/* =========================================================
   SALES-BY-DAY-AND-TIME HEATMAP
========================================================= */

function SalesHeatmap({ matrix, selectedCell }) {
  return (
    <div className="sales-heatmap">
      <div className="sales-heatmap-head">
        <span />
        {TIME_SLOTS.map((slot) => (
          <span key={slot}>{slot}</span>
        ))}
      </div>

      {DAYS.map((day, dayIndex) => (
        <div className="sales-heatmap-row" key={day}>
          <span className="sales-heatmap-day">{day}</span>
          {matrix[dayIndex].map((intensity, slotIndex) => {
            const isSelected =
              selectedCell.dayIndex === dayIndex && selectedCell.slotIndex === slotIndex;
            return (
              <span
                key={slotIndex}
                className={`sales-heatmap-cell is-level-${intensity}${
                  isSelected ? ' is-selected' : ''
                }`}
                title={`${day} ${TIME_SLOTS[slotIndex]}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminSalesAnalyticsPage({ go }) {
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [granularity, setGranularity] = useState('Daily');
  const [notice, setNotice] = useState('');

  const maxStatusValue = ORDERS_BY_STATUS[0].value;
  const totalOrders = ORDERS_BY_STATUS.reduce((sum, item) => sum + item.value, 0);
  const maxCountryRevenue = Math.max(...SALES_BY_COUNTRY.map((item) => item.revenue));
  const maxPaymentPercent = Math.max(...PAYMENT_METHODS.map((item) => item.percent));
  const totalPromoRevenue = DISCOUNT_PERFORMANCE.reduce((sum, item) => sum + item.revenue, 0);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const exportReport = () => {
    const rows = [
      ['Metric', 'Value', 'Trend'],
      ...KPI_STATS.map((stat) => [stat.label, stat.value, stat.trend]),
      [],
      ['Discount', 'Code', 'Redemptions', 'Discounted revenue'],
      ...DISCOUNT_PERFORMANCE.map((item) => [
        item.name,
        item.code,
        item.redemptions,
        item.revenue,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novashop-sales-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);

    notify('Sales report exported');
  };

  return (
    <div className="admin-dashboard sales-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as Inventory/Analytics */}
      <section className="admin-page-heading sales-page-heading">
        <div>
          <h1 className="admin-page-title">Sales Analytics</h1>
          <p className="admin-page-description">
            Track revenue, orders, and refunds over time.
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

      <div className="sales-kpi-label">VS PREVIOUS 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid sales-stat-grid">
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

      {/* SALES OVER TIME + ORDERS BY STATUS */}
      <section className="sales-main-grid">
        <article className="sales-card sales-chart-card">
          <div className="sales-card-heading">
            <div>
              <h2>Sales over time</h2>
              <p>How are sales trending?</p>
            </div>

            <div className="sales-chart-controls">
              <div className="sales-chart-legend">
                <span className="sales-legend-item">
                  <i className="is-gross" /> Gross sales
                </span>
                <span className="sales-legend-item">
                  <i className="is-net" /> Net sales
                </span>
              </div>

              <div className="sales-segmented-control">
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
            </div>
          </div>

          <div className="sales-chart-wrap">
            <SalesChart series={SALES_SERIES} />

            <div className="sales-chart-tooltip">
              <div className="sales-chart-tooltip-head">
                <strong>Sep 20, 2026</strong>
                <span>Wed</span>
              </div>
              <div className="sales-chart-tooltip-row">
                <span><i className="is-gross" /> Gross sales</span>
                <strong>$13,900</strong>
              </div>
              <div className="sales-chart-tooltip-row">
                <span><i className="is-net" /> Net sales</span>
                <strong>$12,840</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="sales-card sales-status-card">
          <div className="sales-card-heading">
            <div>
              <h2>Orders by status</h2>
              <p>Where are orders in fulfillment?</p>
            </div>
          </div>

          <div className="sales-status-list">
            {ORDERS_BY_STATUS.map((status) => (
              <div className="sales-status-row" key={status.label}>
                <div className="sales-status-top">
                  <span>{status.label}</span>
                  <strong>{status.value}</strong>
                </div>
                <div className="sales-status-bar">
                  <span style={{ width: `${(status.value / maxStatusValue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="sales-card-footer">
            <span>Total orders processed</span>
            <strong>{totalOrders.toLocaleString('en-US')} orders</strong>
          </div>
        </article>
      </section>

      {/* SALES BY DAY/TIME + PAYMENT METHODS */}
      <section className="sales-main-grid">
        <article className="sales-card sales-heatmap-card">
          <div className="sales-card-heading">
            <div>
              <h2>Sales by day and time</h2>
              <p>When do customers buy?</p>
            </div>

            <span className="sales-timezone-label">CET (STORE TIME)</span>
          </div>

          <SalesHeatmap matrix={SALES_HEATMAP} selectedCell={SELECTED_CELL} />

          <div className="sales-heatmap-footer">
            <span>Order distribution volume</span>

            <div className="sales-heatmap-legend">
              <span>Fewer</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <i key={level} className={`is-level-${level}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </article>

        <article className="sales-card sales-payments-card">
          <div className="sales-card-heading">
            <div>
              <h2>Payment methods</h2>
              <p>How do customers pay?</p>
            </div>
          </div>

          <div className="sales-bar-list">
            {PAYMENT_METHODS.map((method) => (
              <div className="sales-bar-row" key={method.label}>
                <div className="sales-bar-top">
                  <span>{method.label}</span>
                  <strong>{method.percent}%</strong>
                </div>
                <div className="sales-bar-track">
                  <span
                    style={{ width: `${(method.percent / maxPaymentPercent) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="sales-card-footer">
            <span>Digital checkout share</span>
            <strong>91.0% instant</strong>
          </div>
        </article>
      </section>

      {/* SALES BY COUNTRY + DISCOUNT PERFORMANCE */}
      <section className="sales-trio-grid">
        <article className="sales-card">
          <div className="sales-card-heading">
            <div>
              <h2>Sales by country</h2>
              <p>Where are customers buying from?</p>
            </div>
          </div>

          <div className="sales-bar-list sales-bar-list-compact">
            {SALES_BY_COUNTRY.map((item) => (
              <div className="sales-bar-row" key={item.label}>
                <div className="sales-bar-top">
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.revenue)}</strong>
                </div>
                <div className="sales-bar-track sales-bar-track-thin">
                  <span
                    style={{ width: `${(item.revenue / maxCountryRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="sales-card-footer">
            <span>Top 5 global markets</span>
            <strong>85.5% of gross sales</strong>
          </div>
        </article>

        <article className="sales-card sales-discount-card">
          <div className="sales-card-heading">
            <div>
              <h2>Discount performance</h2>
              <p>Which discounts drive sales?</p>
            </div>

            <button
              type="button"
              className="sales-text-link"
              onClick={() => (go ? go('/admin/discounts') : notify('Opening discounts…'))}
            >
              Manage discounts <span>→</span>
            </button>
          </div>

          <div className="sales-discount-table">
            <div className="sales-discount-row sales-discount-head">
              <span>DISCOUNT</span>
              <span>REDEMPTIONS</span>
              <span>DISCOUNTED REVENUE</span>
            </div>

            {DISCOUNT_PERFORMANCE.map((item) => (
              <div className="sales-discount-row" key={item.code}>
                <div className="sales-discount-identity">
                  <strong>{item.name}</strong>
                  <small>{item.code}</small>
                </div>

                <span className="sales-discount-redemptions">{item.redemptions}</span>

                <span className="sales-discount-revenue">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
            ))}
          </div>

          <div className="sales-card-footer">
            <span>Total promo attributed volume</span>
            <strong>
              {formatCurrency(totalPromoRevenue)} (
              {((totalPromoRevenue / 284600) * 100).toFixed(1)}%)
            </strong>
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