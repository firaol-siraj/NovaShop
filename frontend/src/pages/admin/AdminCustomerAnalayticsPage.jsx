import { useRef, useState, useEffect, useMemo } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import {
  useAdminCustomerAnalytics,
  useAnalyticsUrlState,
  resolveDateRangeBounds,
} from '../../hooks/useAdminAnalytics';
import adminApi from '../../lib/api/adminApi';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import './admin-customer-analytics.css';

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'This year'];
const CHART_GRANULARITY = ['Daily', 'Weekly', 'Monthly'];

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

function GrowthChart({ series = [] }) {
  const maxVal = useMemo(() => {
    const max = Math.max(...series.map((p) => (p.returning || 0) + (p.newCustomers || 0)), 0);
    return max > 0 ? Math.ceil((max * 1.2) / 10) * 10 : 100;
  }, [series]);

  const gridValues = [maxVal, Math.round((maxVal * 2) / 3), Math.round(maxVal / 3), 0];

  if (!series || series.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-[#8A847C] text-xs">
        No customer activity in this period
      </div>
    );
  }

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
          const total = (point.returning || 0) + (point.newCustomers || 0);
          const totalHeight = total > 0 ? (total / maxVal) * 100 : 0;
          const returningHeight = total > 0 ? ((point.returning || 0) / total) * 100 : 0;
          const newHeight = total > 0 ? ((point.newCustomers || 0) / total) * 100 : 0;

          return (
            <div className="ca-growth-column" key={point.label}>
              {point.highlight && total > 0 && (
                <div className="ca-growth-tooltip">
                  <strong>{point.label}</strong>
                  <span>New {point.newCustomers || 0} · Returning {point.returning || 0}</span>
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

function ReturningDonut({ returning = 0, newCustomers = 0 }) {
  const total = returning + newCustomers;
  const returningPercent = total > 0 ? Math.round((returning / total) * 100) : 0;

  return (
    <div
      className="ca-donut"
      style={{
        background: `conic-gradient(var(--chart-net, var(--admin-primary)) 0% ${returningPercent}%, var(--chart-track, #EEE9E2) ${returningPercent}% 100%)`,
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
  const { dateRange, setDateRange, granularity, setGranularity } = useAnalyticsUrlState(
    'Last 30 days',
    'Weekly'
  );

  const { from, to } = useMemo(() => resolveDateRangeBounds(dateRange), [dateRange]);
  const interval = granularity === 'Monthly' ? 'month' : granularity === 'Weekly' ? 'week' : 'day';

  const { data, isLoading, isError, error, refetch } = useAdminCustomerAnalytics({
    from,
    to,
    interval,
  });

  const [notice, setNotice] = useState('');
  const [selectedCohort, setSelectedCohort] = useState(null);

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

  // Customers by country
  const customersByCountry = data?.customersByCountry || [];
  const maxCountryCustomers = Math.max(1, ...customersByCountry.map((item) => item.customers || 0));

  // Orders per customer
  const ordersPerCustomer = data?.ordersPerCustomer || [
    { label: '1 order', percent: 0 },
    { label: '2–3 orders', percent: 0 },
    { label: '4–5 orders', percent: 0 },
    { label: '6+ orders', percent: 0 },
  ];
  const maxOrdersPercent = Math.max(1, ...ordersPerCustomer.map((item) => item.percent || 0));

  // Cohorts
  const cohorts = data?.cohorts || [];
  const selectedCohortCell = selectedCohort || data?.selectedCohortCell || { rowIndex: 0, monthIndex: 1 };

  // Top customers
  const topCustomers = data?.topCustomers || [];

  // Export report
  const exportReport = async () => {
    try {
      notify('Exporting customer report…');
      const blob = await adminApi.exportAnalyticsCsv({ page: 'customers', from, to });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novashop-customer-analytics-${dateRange.toLowerCase().replace(/\s+/g, '-')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Customer report exported');
    } catch {
      notify('Failed to export CSV report');
    }
  };

  const kpiStats = [
    {
      label: 'Total customers',
      value: isLoading ? '...' : data?.kpis?.totalCustomers?.formatted || '0',
      trend: data?.kpis?.totalCustomers?.formattedTrend || '-',
      tone: 'positive',
    },
    {
      label: 'New customers',
      value: isLoading ? '...' : data?.kpis?.newCustomers?.formatted || '0',
      trend: data?.kpis?.newCustomers?.positive ? '+' : '-',
      tone: 'positive',
    },
    {
      label: 'Repeat purchase rate',
      value: isLoading ? '...' : data?.kpis?.repeatPurchaseRate?.formatted || '0.0%',
      trend: data?.kpis?.repeatPurchaseRate?.positive ? '+' : '-',
      tone: data?.kpis?.repeatPurchaseRate?.positive ? 'positive' : 'negative',
    },
    {
      label: 'Customer lifetime value',
      value: isLoading ? '...' : data?.kpis?.customerLifetimeValue?.formatted || '$0.00',
      trend: data?.kpis?.customerLifetimeValue?.positive ? '+' : '-',
      tone: 'positive',
    },
  ];

  return (
    <div className="admin-dashboard ca-page">
      {/* PAGE HEADER */}
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

      <div className="ca-kpi-label">
        VS PREVIOUS {data?.durationDays || 30} DAYS
      </div>

      {/* KPI ROW */}
      <section className="admin-stat-grid ca-stat-grid">
        {kpiStats.map((stat) => (
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

          <GrowthChart series={data?.growthSeries || []} />
        </article>

        <article className="ca-card ca-split-card">
          <div className="ca-card-heading">
            <div>
              <h2>New vs returning customers</h2>
              <p>Who is buying?</p>
            </div>
          </div>

          <ReturningDonut
            returning={data?.loyalty?.returning || 0}
            newCustomers={data?.loyalty?.newCustomers || 0}
          />

          <div className="ca-split-legend">
            <div className="ca-split-legend-row">
              <span className="ca-legend-dot is-returning" />
              Returning customers
              <strong>{data?.loyalty?.returning || 0}</strong>
            </div>
            <div className="ca-split-legend-row">
              <span className="ca-legend-dot is-new" />
              New customers
              <strong>{data?.loyalty?.newCustomers || 0}</strong>
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

            {cohorts.map((cohort, rowIndex) => (
              <div className="ca-cohort-row" key={cohort.label}>
                <div className="ca-cohort-label">
                  <strong>{cohort.label}</strong>
                  <small>· {cohort.count}</small>
                </div>

                {cohort.months.map((percent, monthIndex) => {
                  const isSelected =
                    selectedCohortCell.rowIndex === rowIndex &&
                    selectedCohortCell.monthIndex === monthIndex;

                  return (
                    <span
                      key={monthIndex}
                      className={`ca-cohort-cell is-${cohortLevel(percent)}${
                        isSelected ? ' is-selected' : ''
                      }`}
                      onClick={() => setSelectedCohort({ rowIndex, monthIndex })}
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
            {ordersPerCustomer.map((item) => (
              <div className="ca-bar-row" key={item.label}>
                <div className="ca-bar-top">
                  <span>{item.label}</span>
                  <strong>{item.percent}%</strong>
                </div>
                <div className="ca-bar-track">
                  <span
                    style={{
                      width: `${maxOrdersPercent > 0 ? (item.percent / maxOrdersPercent) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="ca-note">Calculated across verified order histories.</p>
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

            <button type="button" className="ca-text-link" onClick={() => navigateTo('/admin/customers')}>
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

            {topCustomers.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No customer orders recorded yet
              </div>
            ) : (
              topCustomers.map((customer) => (
                <div className="ca-customers-row" key={customer.email}>
                  <div className="ca-customer-identity">
                    <span
                      className="ca-avatar"
                      style={{ background: customer.swatch || '#2B2723' }}
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
                    {customer.relative && <small>({customer.relative})</small>}
                  </span>
                </div>
              ))
            )}
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
            {customersByCountry.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No regional customer distribution in this period
              </div>
            ) : (
              customersByCountry.map((item) => (
                <div className="ca-bar-row" key={item.label}>
                  <div className="ca-bar-top">
                    <span>{item.label}</span>
                    <strong>{formatNumber(item.customers)} customers</strong>
                  </div>
                  <div className="ca-bar-track ca-bar-track-thin">
                    <span
                      style={{
                        width: `${maxCountryCustomers > 0 ? (item.customers / maxCountryCustomers) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="ca-note">Based on primary shipping destination.</p>
        </article>
      </section>

      {isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center justify-between">
          <span>{error || 'Failed to load customer analytics'}</span>
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
