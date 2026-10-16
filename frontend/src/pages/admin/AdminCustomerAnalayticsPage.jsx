import {  useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-customer-analytics.css';

/* =========================================================
   MOCK DATA
========================================================= */

const KPI_STATS = [
  { label: 'Total customers', value: '2,846', trend: '+6.2%', tone: 'positive' },
  { label: 'New customers', value: '428', trend: '+12%', tone: 'positive' },
  { label: 'Repeat purchase rate', value: '38%', trend: '−1.1%', tone: 'negative' },
  { label: 'Customer lifetime value', value: '$4,860', trend: '+5.4%', tone: 'positive' },
];

const GROWTH_SERIES = [
  { label: 'Aug 10', returning: 160, newCustomers: 70 },
  { label: 'Aug 17', returning: 150, newCustomers: 85 },
  { label: 'Aug 24', returning: 170, newCustomers: 95 },
  { label: 'Aug 31', returning: 165, newCustomers: 100 },
  { label: 'Sep 7', returning: 175, newCustomers: 90 },
  { label: 'Sep 14', returning: 168, newCustomers: 112, highlight: true },
  { label: 'Sep 21', returning: 180, newCustomers: 95 },
  { label: 'Sep 28', returning: 190, newCustomers: 100 },
];

const NEW_VS_RETURNING = { returning: 698, new: 428 };

const COHORTS = [
  { label: 'Apr', count: 312, months: [100, 38, 32, 28, 24, 22] },
  { label: 'May', count: 340, months: [100, 36, 30, 26, 21, null] },
  { label: 'Jun', count: 388, months: [100, 39, 31, 24, null, null] },
  { label: 'Jul', count: 412, months: [100, 41, 34, null, null, null] },
  { label: 'Aug', count: 445, months: [100, 43, null, null, null, null] },
  { label: 'Sep', count: 428, months: [100, null, null, null, null, null] },
];

const SELECTED_COHORT_CELL = { rowIndex: 2, monthIndex: 2 };

const ORDERS_PER_CUSTOMER = [
  { label: '1 order', percent: 62 },
  { label: '2–3 orders', percent: 27 },
  { label: '4–5 orders', percent: 8 },
  { label: '6+ orders', percent: 3 },
];

const TOP_CUSTOMERS = [
  { initials: 'AC', name: 'Amelia Chen', email: 'amelia.chen@email.com', orders: 15, spent: 21150, lastOrder: 'Sep 30, 2026', relative: '1 day ago', swatch: '#2B2723' },
  { initials: 'SM', name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com', orders: 12, spent: 14820, lastOrder: 'Sep 28, 2026', relative: '3 days ago', swatch: '#5C4B3A' },
  { initials: 'SR', name: 'Sofia Rossi', email: 'sofia.rossi@email.com', orders: 9, spent: 11480, lastOrder: 'Sep 19, 2026', relative: '12 days ago', swatch: '#7C6B5C' },
  { initials: 'JO', name: 'James Okafor', email: 'james.okafor@email.com', orders: 8, spent: 9340, lastOrder: 'Sep 24, 2026', relative: '7 days ago', swatch: '#4A3F33' },
  { initials: 'PR', name: 'Priya Raman', email: 'priya.raman@email.com', orders: 6, spent: 7260, lastOrder: 'Aug 02, 2026', relative: '2 months ago', swatch: '#9A8E7E' },
];

const CUSTOMERS_BY_COUNTRY = [
  { label: 'United States', customers: 1024 },
  { label: 'United Kingdom', customers: 512 },
  { label: 'Germany', customers: 301 },
  { label: 'United Arab Emirates', customers: 244 },
  { label: 'Singapore', customers: 198 },
];

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year'];
const CHART_GRANULARITY = ['Daily', 'Weekly', 'Monthly'];

function formatCurrency(value) {
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

function cohortLevel(percent) {
  if (percent === null || percent === undefined) return 'empty';
  if (percent >= 90) return 'level-4';
  if (percent >= 35) return 'level-3';
  if (percent >= 28) return 'level-2';
  if (percent >= 20) return 'level-1';
  return 'level-0';
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
    <div className="ca-range-dropdown" ref={ref}>
      <button
        type="button"
        className="ca-range-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <AdminIcon name="calendar" size={14} />
        <span>{value}</span>
        <AdminIcon name="chevron" size={12} />
      </button>

      {isOpen && (
        <div className="ca-range-menu" role="listbox">
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
   STACKED CUSTOMER GROWTH CHART (plain divs, no dependency)
========================================================= */

function GrowthChart({ series }) {
  const maxValue = 300;
  const gridValues = [300, 200, 100, 0];

  return (
    <div className="ca-growth-chart">
      <div className="ca-growth-grid">
        {gridValues.map((value) => (
          <div className="ca-growth-gridline" key={value}>
            <span>{value}</span>
          </div>
        ))}
      </div>

      <div className="ca-growth-bars">
        {series.map((point) => {
          const total = point.returning + point.newCustomers;
          const totalHeight = (total / maxValue) * 100;
          const returningHeight = (point.returning / total) * 100;
          const newHeight = (point.newCustomers / total) * 100;

          return (
            <div className="ca-growth-column" key={point.label}>
              {point.highlight && (
                <div className="ca-growth-tooltip">
                  <strong>Week of {point.label}</strong>
                  <span>New {point.newCustomers} · Returning {point.returning}</span>
                </div>
              )}

              <div
                className={`ca-growth-stack${point.highlight ? ' is-active' : ''}`}
                style={{ height: `${totalHeight}%` }}
              >
                <span className="is-new" style={{ height: `${newHeight}%` }} />
                <span className="is-returning" style={{ height: `${returningHeight}%` }} />
              </div>

              <small className={point.highlight ? 'is-active' : ''}>{point.label}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   NEW VS RETURNING DONUT
========================================================= */

function ReturningDonut({ returning, newCustomers }) {
  const total = returning + newCustomers;
  const returningPercent = Math.round((returning / total) * 100);

  return (
    <div
      className="ca-donut"
      style={{
        background: `conic-gradient(var(--admin-primary) 0% ${returningPercent}%, #EEE9E2 ${returningPercent}% 100%)`,
      }}
    >
      <div className="ca-donut-hole">
        <strong>{returningPercent}%</strong>
        <span>Returning</span>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminCustomerAnalyticsPage({ go }) {
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [granularity, setGranularity] = useState('Weekly');
  const [notice, setNotice] = useState('');

  const maxCountryCustomers = Math.max(...CUSTOMERS_BY_COUNTRY.map((item) => item.customers));
  const maxOrdersPercent = Math.max(...ORDERS_PER_CUSTOMER.map((item) => item.percent));

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const goToCustomers = () => {
    if (go) {
      go('/admin/customers');
      return;
    }
    notify('Opening customers…');
  };

  const exportReport = () => {
    const rows = [
      ['Metric', 'Value', 'Trend'],
      ...KPI_STATS.map((stat) => [stat.label, stat.value, stat.trend]),
      [],
      ['Customer', 'Email', 'Orders', 'Total spent', 'Last order'],
      ...TOP_CUSTOMERS.map((customer) => [
        customer.name,
        customer.email,
        customer.orders,
        customer.spent,
        customer.lastOrder,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novashop-customer-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);

    notify('Customer report exported');
  };

  return (
    <div className="admin-dashboard ca-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as Inventory/Analytics */}
      <section className="admin-page-heading ca-page-heading">
        <div>
          <h1 className="admin-page-title">Customer Analytics</h1>
          <p className="admin-page-description">
            Understand who is buying and how often they return.
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

      <div className="ca-kpi-label">VS PREVIOUS 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid ca-stat-grid">
        {KPI_STATS.map((stat) => (
          <article className="admin-stat-card" key={stat.label}>
            <div className="admin-stat-heading">
              <span className="admin-stat-label">{stat.label}</span>
              <span
                className={`admin-trend-pill${stat.tone === 'negative' ? ' is-negative' : ''}`}
              >
                {stat.trend}
              </span>
            </div>
            <div className="admin-stat-value">{stat.value}</div>
          </article>
        ))}
      </section>

      {/* CUSTOMER GROWTH + NEW VS RETURNING */}
      <section className="ca-main-grid">
        <article className="ca-card ca-growth-card">
          <div className="ca-card-heading">
            <div>
              <h2>Customer growth</h2>
              <p>Is the customer base growing?</p>
            </div>

            <div className="ca-segmented-control">
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

          <div className="ca-growth-legend">
            <span className="ca-legend-item">
              <i className="is-returning" /> Returning customers
            </span>
            <span className="ca-legend-item">
              <i className="is-new" /> New customers
            </span>
          </div>

          <GrowthChart series={GROWTH_SERIES} />
        </article>

        <article className="ca-card ca-split-card">
          <div className="ca-card-heading">
            <div>
              <h2>New vs returning customers</h2>
              <p>Who is buying?</p>
            </div>
          </div>

          <ReturningDonut
            returning={NEW_VS_RETURNING.returning}
            newCustomers={NEW_VS_RETURNING.new}
          />

          <div className="ca-split-legend">
            <div className="ca-split-legend-row">
              <span className="ca-legend-dot is-returning" />
              Returning customers
              <strong>{NEW_VS_RETURNING.returning}</strong>
            </div>
            <div className="ca-split-legend-row">
              <span className="ca-legend-dot is-new" />
              New customers
              <strong>{NEW_VS_RETURNING.new}</strong>
            </div>
          </div>
        </article>
      </section>

      {/* CUSTOMER RETENTION + ORDERS PER CUSTOMER */}
      <section className="ca-main-grid">
        <article className="ca-card ca-retention-card">
          <div className="ca-card-heading">
            <div>
              <h2>Customer retention</h2>
              <p>Do customers come back?</p>
            </div>
          </div>

          <div className="ca-cohort-table">
            <div className="ca-cohort-row ca-cohort-head">
              <span>Cohort</span>
              {['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            {COHORTS.map((cohort, rowIndex) => (
              <div className="ca-cohort-row" key={cohort.label}>
                <div className="ca-cohort-label">
                  <strong>{cohort.label}</strong>
                  <small>· {cohort.count}</small>
                </div>

                {cohort.months.map((percent, monthIndex) => {
                  const isSelected =
                    SELECTED_COHORT_CELL.rowIndex === rowIndex &&
                    SELECTED_COHORT_CELL.monthIndex === monthIndex;

                  return (
                    <span
                      key={monthIndex}
                      className={`ca-cohort-cell is-${cohortLevel(percent)}${
                        isSelected ? ' is-selected' : ''
                      }`}
                    >
                      {percent === null ? '—' : `${percent}%`}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="ca-cohort-footer">
            <span>Lower retention</span>
            <div className="ca-cohort-legend">
              {[0, 1, 2, 3, 4].map((level) => (
                <i key={level} className={`is-level-${level}`} />
              ))}
            </div>
            <span>Higher retention</span>
          </div>
        </article>

        <article className="ca-card ca-split-card">
          <div className="ca-card-heading">
            <div>
              <h2>Orders per customer</h2>
              <p>How often do customers buy?</p>
            </div>
          </div>

          <div className="ca-bar-list">
            {ORDERS_PER_CUSTOMER.map((item) => (
              <div className="ca-bar-row" key={item.label}>
                <div className="ca-bar-top">
                  <span>{item.label}</span>
                  <strong>{item.percent}%</strong>
                </div>
                <div className="ca-bar-track">
                  <span style={{ width: `${(item.percent / maxOrdersPercent) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p className="ca-note">Calculated across all historical lifetime profiles.</p>
        </article>
      </section>

      {/* TOP CUSTOMERS + CUSTOMERS BY COUNTRY */}
      <section className="ca-main-grid">
        <article className="ca-card ca-customers-card">
          <div className="ca-card-heading">
            <div>
              <h2>Top customers</h2>
              <p>Who spends the most?</p>
            </div>

            <button type="button" className="ca-text-link" onClick={goToCustomers}>
              View all customers <span>→</span>
            </button>
          </div>

          <div className="ca-customers-table">
            <div className="ca-customers-row ca-customers-head">
              <span>Customer</span>
              <span>Orders</span>
              <span>Total spent</span>
              <span>Last order</span>
            </div>

            {TOP_CUSTOMERS.map((customer) => (
              <div className="ca-customers-row" key={customer.email}>
                <div className="ca-customer-identity">
                  <span
                    className="ca-avatar"
                    style={{ background: customer.swatch }}
                  >
                    {customer.initials}
                  </span>
                  <div>
                    <strong>{customer.name}</strong>
                    <small>{customer.email}</small>
                  </div>
                </div>

                <span className="ca-customers-cell">{customer.orders}</span>
                <span className="ca-customers-cell ca-customers-spent">
                  {formatCurrency(customer.spent)}
                </span>
                <span className="ca-customers-cell ca-customers-last-order">
                  {customer.lastOrder}
                  <small>({customer.relative})</small>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="ca-card ca-split-card">
          <div className="ca-card-heading">
            <div>
              <h2>Customers by country</h2>
              <p>Where do customers live?</p>
            </div>
          </div>

          <div className="ca-bar-list ca-bar-list-compact">
            {CUSTOMERS_BY_COUNTRY.map((item) => (
              <div className="ca-bar-row" key={item.label}>
                <div className="ca-bar-top">
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.customers)} customers</strong>
                </div>
                <div className="ca-bar-track ca-bar-track-thin">
                  <span
                    style={{ width: `${(item.customers / maxCountryCustomers) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="ca-note">Based on primary shipping destination.</p>
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