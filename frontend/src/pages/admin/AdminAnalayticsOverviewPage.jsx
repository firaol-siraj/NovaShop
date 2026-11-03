import { useMemo, useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { useChartTheme } from '../../lib/chartTheme';
import {
  useAdminAnalyticsOverview,
  useAnalyticsUrlState,
  resolveDateRangeBounds,
} from '../../hooks/useAdminAnalytics';
import adminApi from '../../lib/api/adminApi';
import { formatCurrency, formatNumber, formatPercentageChange } from '../../lib/formatters';
import './admin-analytics-overview.css';

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'This year'];
const CHART_GRANULARITY = ['Daily', 'Weekly', 'Monthly'];

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

function RevenueChart({ series = [], onHoverPoint, activeIndex }) {
  const chartTheme = useChartTheme();
  const width = 640;
  const height = 220;
  const paddingLeft = 36;
  const paddingBottom = 24;

  const maxVal = useMemo(() => {
    const max = Math.max(...series.map((p) => p.value || 0), 0);
    return max > 0 ? Math.ceil((max * 1.15) / 1000) * 1000 : 1000;
  }, [series]);

  const points = useMemo(() => {
    if (!series || series.length === 0) return [];
    const innerWidth = width - paddingLeft;
    const step = series.length > 1 ? innerWidth / (series.length - 1) : innerWidth;

    return series.map((point, index) => ({
      ...point,
      x: paddingLeft + step * index,
      y: height - paddingBottom - ((point.value || 0) / maxVal) * (height - paddingBottom),
    }));
  }, [series, maxVal]);

  if (!series || series.length === 0) {
    return (
      <div className="analytics-empty-chart flex items-center justify-center h-[220px] text-[#8A847C] text-xs">
        No sales in this period
      </div>
    );
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');

  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1].x},${height - paddingBottom} L${points[0].x},${height - paddingBottom} Z`
    : '';

  const highlighted =
    activeIndex !== null && points[activeIndex]
      ? points[activeIndex]
      : points.find((point) => point.highlight) || points[points.length - 1];

  const gridValues = [0, Math.round(maxVal / 3), Math.round((maxVal * 2) / 3), maxVal];

  return (
    <svg
      className="analytics-chart-svg"
      viewBox={`0 0 ${width} ${height + 20}`}
      role="img"
      aria-label="Revenue trend"
    >
      {gridValues.map((value) => {
        const y = height - paddingBottom - (value / maxVal) * (height - paddingBottom);
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
              {value === 0 ? '$0' : value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`}
            </text>
          </g>
        );
      })}

      {areaPath && <path d={areaPath} className="analytics-chart-area" />}
      {linePath && <path d={linePath} className="analytics-chart-line" />}

      {highlighted && (
        <line
          x1={highlighted.x}
          x2={highlighted.x}
          y1={highlighted.y}
          y2={height - paddingBottom}
          className="analytics-chart-guide"
        />
      )}

      {points.map((point, index) => (
        <circle
          key={point.date || index}
          cx={point.x}
          cy={point.y}
          r={highlighted && highlighted.date === point.date ? 4 : 0}
          className="analytics-chart-dot cursor-pointer"
          onMouseEnter={() => onHoverPoint && onHoverPoint(index)}
        />
      ))}

      {series
        .filter((_, index) => index % Math.max(1, Math.floor(series.length / 5)) === 0 || index === series.length - 1)
        .map((point) => {
          const matched = points.find((p) => p.date === point.date);
          if (!matched) return null;
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

function LoyaltyDonut({ returning = 0, newCustomers = 0 }) {
  const total = returning + newCustomers;
  const returningPercent = total > 0 ? Math.round((returning / total) * 100) : 0;

  return (
    <div
      className="analytics-donut"
      style={{
        background: `conic-gradient(var(--admin-primary) 0% ${returningPercent}%, var(--chart-track, #EEE9E2) ${returningPercent}% 100%)`,
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

export default function AdminAnalyticsOverviewPage({ go }) {
  const { dateRange, setDateRange, granularity, setGranularity } = useAnalyticsUrlState(
    'Last 30 days',
    'Daily'
  );

  const { from, to } = useMemo(() => resolveDateRangeBounds(dateRange), [dateRange]);
  const interval = granularity === 'Monthly' ? 'month' : granularity === 'Weekly' ? 'week' : 'day';

  const { data, isLoading, isError, error, refetch } = useAdminAnalyticsOverview({
    from,
    to,
    interval,
  });

  const [notice, setNotice] = useState('');
  const [hoveredChartIndex, setHoveredChartIndex] = useState(null);

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

  // Derive active series & hovered/peak point
  const series = data?.revenueSeries || [];
  const activeTooltipPoint = useMemo(() => {
    if (hoveredChartIndex !== null && series[hoveredChartIndex]) {
      return series[hoveredChartIndex];
    }
    const peak = series.find((p) => p.highlight);
    if (peak) return peak;
    return series[series.length - 1] || null;
  }, [series, hoveredChartIndex]);

  // Funnel calculations
  const funnelSteps = data?.funnel?.steps || [
    { label: 'Sessions', value: 0, percent: null },
    { label: 'Added to cart', value: 0, percent: null },
    { label: 'Checkout', value: 0, percent: null },
    { label: 'Purchased', value: 0, percent: null },
  ];
  const maxFunnelValue = Math.max(1, funnelSteps[0]?.value || 1);

  // Categories & Countries
  const salesByCategory = data?.salesByCategory || [];
  const maxCategoryRevenue = Math.max(1, ...salesByCategory.map((item) => item.revenue || 0));
  const totalCategoryRevenue = data?.totalCategoryRevenue || salesByCategory.reduce((sum, item) => sum + item.revenue, 0);

  const salesByCountry = data?.salesByCountry || [];
  const maxCountryRevenue = Math.max(1, ...salesByCountry.map((item) => item.revenue || 0));

  const trafficSources = data?.trafficSources || [
    { label: 'Direct', percent: null },
    { label: 'Organic search', percent: null },
    { label: 'Email', percent: null },
    { label: 'Social', percent: null },
    { label: 'Paid', percent: null },
  ];

  const topProducts = data?.topProducts || [];

  // Export report
  const exportReport = async () => {
    try {
      notify('Exporting analytics report…');
      const blob = await adminApi.exportAnalyticsCsv({ page: 'overview', from, to });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novashop-analytics-overview-${dateRange.toLowerCase().replace(/\s+/g, '-')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Analytics report exported');
    } catch {
      notify('Failed to export CSV report');
    }
  };

  const kpis = [
    {
      label: 'Revenue',
      value: isLoading ? '...' : data?.kpis?.revenue?.formatted || '$0',
      trend: data?.kpis?.revenue?.formattedTrend || '-',
      positive: data?.kpis?.revenue?.positive ?? true,
    },
    {
      label: 'Orders',
      value: isLoading ? '...' : data?.kpis?.orders?.formatted || '0',
      trend: data?.kpis?.orders?.formattedTrend || '-',
      positive: data?.kpis?.orders?.positive ?? true,
    },
    {
      label: 'Average order value',
      value: isLoading ? '...' : data?.kpis?.aov?.formatted || '-',
      trend: data?.kpis?.aov?.formattedTrend || '-',
      positive: data?.kpis?.aov?.positive ?? true,
    },
    {
      label: 'Conversion rate',
      value: isLoading ? '...' : data?.kpis?.conversionRate?.formatted || '-',
      trend: data?.kpis?.conversionRate?.formattedTrend || '-',
      positive: data?.kpis?.conversionRate?.positive ?? true,
    },
  ];

  return (
    <div className="admin-dashboard analytics-page">
      {/* PAGE HEADER — shared admin-page-* classes */}
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

      <div className="analytics-kpi-label">
        VS PREVIOUS {data?.durationDays || 30} DAYS
      </div>

      {/* KPI ROW */}
      <section className="admin-stat-grid analytics-stat-grid">
        {kpis.map((stat) => (
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

              <button
                type="button"
                className="analytics-text-link"
                onClick={() => navigateTo('/admin/analytics/sales')}
              >
                View sales report <span>→</span>
              </button>
            </div>
          </div>

          <div className="analytics-chart-wrap">
            <RevenueChart
              series={series}
              onHoverPoint={setHoveredChartIndex}
              activeIndex={hoveredChartIndex}
            />

            {activeTooltipPoint && (
              <div className="analytics-chart-tooltip">
                <strong>{activeTooltipPoint.date}</strong> · {formatCurrency(activeTooltipPoint.value)} · {activeTooltipPoint.orders} orders
              </div>
            )}
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
            {funnelSteps.map((step) => (
              <div className="analytics-funnel-row" key={step.label}>
                <div className="analytics-funnel-top">
                  <span>{step.label}</span>
                  <span className="analytics-funnel-values">
                    {step.percent !== null && (
                      <strong className="analytics-funnel-percent">{step.percent}%</strong>
                    )}
                    {step.value > 0 || data?.funnel?.hasTracking
                      ? formatNumber(step.value)
                      : '-'}
                  </span>
                </div>

                <div className="analytics-funnel-bar">
                  <span
                    style={{
                      width: `${step.value > 0 ? (step.value / maxFunnelValue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="analytics-card-footer">
            <span>Overall conversion efficiency</span>
            <strong>
              {data?.funnel?.overallEfficiency !== null && data?.funnel?.overallEfficiency !== undefined
                ? `${data.funnel.overallEfficiency}% total`
                : '-'}
            </strong>
          </div>
        </article>

        {/* TOP PRODUCTS + SALES BY CATEGORY */}
        <article className="analytics-card analytics-products-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Top products</h2>
              <p>What is selling best?</p>
            </div>

            <button
              type="button"
              className="analytics-text-link"
              onClick={() => navigateTo('/admin/analytics/products')}
            >
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

            {topProducts.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No product sales recorded in this period
              </div>
            ) : (
              topProducts.map((product) => (
                <div className="analytics-products-row" key={product.id}>
                  <div className="analytics-product-identity">
                    <span
                      className="analytics-product-thumb"
                      style={{ background: product.swatch || '#3C342B' }}
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
                    <i style={{ width: `${Math.min(100, (product.share || 0) * 2.2)}px` }} />
                    {product.share}%
                  </span>
                </div>
              ))
            )}
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
            {salesByCategory.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No category sales recorded in this period
              </div>
            ) : (
              salesByCategory.map((item) => (
                <div className="analytics-bar-row" key={item.label}>
                  <div className="analytics-bar-top">
                    <span>{item.label}</span>
                    <strong>{formatCurrency(item.revenue)}</strong>
                  </div>
                  <div className="analytics-bar-track">
                    <span
                      style={{
                        width: `${Math.min(100, (item.revenue / maxCategoryRevenue) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="analytics-card-footer">
            <span>Total {salesByCategory.length} categories</span>
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
            {salesByCountry.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No regional data in this period
              </div>
            ) : (
              salesByCountry.map((item) => (
                <div className="analytics-bar-row" key={item.label}>
                  <div className="analytics-bar-top">
                    <span>{item.label}</span>
                    <strong>{formatCurrency(item.revenue)}</strong>
                  </div>
                  <div className="analytics-bar-track analytics-bar-track-thin">
                    <span
                      style={{
                        width: `${Math.min(100, (item.revenue / maxCountryRevenue) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="analytics-note">
            {salesByCountry.length > 0
              ? `Top ${salesByCountry.length} markets represent primary geographic volume.`
              : 'Based on verified paid shipping destinations.'}
          </p>
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Traffic sources</h2>
              <p>Channel acquisition breakdown</p>
            </div>
          </div>

          <div className="analytics-bar-list analytics-bar-list-compact">
            {trafficSources.map((item) => (
              <div className="analytics-bar-row" key={item.label}>
                <div className="analytics-bar-top">
                  <span>{item.label}</span>
                  <strong>{item.percent !== null ? `${item.percent}%` : '-'}</strong>
                </div>
                <div className="analytics-bar-track analytics-bar-track-thin">
                  <span
                    style={{
                      width: `${item.percent !== null ? Math.min(100, item.percent * 2.5) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="analytics-note">
            {data?.hasTrafficTracking
              ? 'Derived from verified visitor telemetry and UTM attribution.'
              : 'Tracking active for new sessions. Historical visits before tracking unavailable.'}
          </p>
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
              onClick={() => navigateTo('/admin/analytics/customers')}
            >
              ↗
            </button>
          </div>

          <LoyaltyDonut
            returning={data?.loyalty?.returning || 0}
            newCustomers={data?.loyalty?.newCustomers || 0}
          />

          <div className="analytics-loyalty-legend">
            <div className="analytics-loyalty-legend-row">
              <span className="analytics-legend-dot is-returning" />
              Returning customers
              <strong>{data?.loyalty?.returning || 0}</strong>
            </div>
            <div className="analytics-loyalty-legend-row">
              <span className="analytics-legend-dot is-new" />
              New customers
              <strong>{data?.loyalty?.newCustomers || 0}</strong>
            </div>
          </div>
        </article>
      </section>

      {isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center justify-between">
          <span>{error || 'Failed to load analytics data'}</span>
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
