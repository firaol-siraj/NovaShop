import { useMemo, useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { useChartTheme } from '../../lib/chartTheme';
import {
  useAdminSalesAnalytics,
  useAnalyticsUrlState,
  resolveDateRangeBounds,
} from '../../hooks/useAdminAnalytics';
import adminApi from '../../lib/api/adminApi';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import './admin-sales-analytics.css';

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'This year'];
const CHART_GRANULARITY = ['Daily', 'Weekly', 'Monthly'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'];

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

function SalesChart({ series = [], onHoverPoint, activeIndex }) {
  const chartTheme = useChartTheme();
  const width = 640;
  const height = 220;
  const paddingLeft = 36;
  const paddingBottom = 24;

  const maxVal = useMemo(() => {
    const max = Math.max(...series.map((p) => Math.max(p.gross || 0, p.net || 0)), 0);
    return max > 0 ? Math.ceil((max * 1.15) / 1000) * 1000 : 1000;
  }, [series]);

  const points = useMemo(() => {
    if (!series || series.length === 0) return [];
    const innerWidth = width - paddingLeft;
    const step = series.length > 1 ? innerWidth / (series.length - 1) : innerWidth;

    return series.map((point, index) => ({
      ...point,
      x: paddingLeft + step * index,
      grossY: height - paddingBottom - ((point.gross || 0) / maxVal) * (height - paddingBottom),
      netY: height - paddingBottom - ((point.net || 0) / maxVal) * (height - paddingBottom),
    }));
  }, [series, maxVal]);

  if (!series || series.length === 0) {
    return (
      <div className="sales-empty-chart flex items-center justify-center h-[220px] text-[#8A847C] text-xs">
        No sales in this period
      </div>
    );
  }

  const grossPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.grossY}`).join(' ');
  const netPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.netY}`).join(' ');

  const netAreaPath = points.length > 0
    ? `${netPath} L${points[points.length - 1].x},${height - paddingBottom} L${points[0].x},${height - paddingBottom} Z`
    : '';

  const highlighted =
    activeIndex !== null && points[activeIndex]
      ? points[activeIndex]
      : points.find((point) => point.highlight) || points[points.length - 1];

  const gridValues = [0, Math.round(maxVal / 3), Math.round((maxVal * 2) / 3), maxVal];

  return (
    <svg
      className="sales-chart-svg"
      viewBox={`0 0 ${width} ${height + 20}`}
      role="img"
      aria-label="Gross and net sales trend"
    >
      {gridValues.map((value) => {
        const y = height - paddingBottom - (value / maxVal) * (height - paddingBottom);
        return (
          <g key={value}>
            <line x1={paddingLeft} x2={width} y1={y} y2={y} className="sales-chart-grid" />
            <text x={0} y={y + 3} className="sales-chart-axis-label">
              {value === 0 ? '$0' : value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`}
            </text>
          </g>
        );
      })}

      {netAreaPath && <path d={netAreaPath} className="sales-chart-area sales-chart-area-net" />}
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

      {points.map((point, index) => {
        const isPointActive = highlighted && highlighted.date === point.date;
        return (
          <g
            key={point.date || index}
            className="cursor-pointer"
            onMouseEnter={() => onHoverPoint && onHoverPoint(index)}
          >
            <circle
              cx={point.x}
              cy={point.grossY}
              r={isPointActive ? 4 : 0}
              className="sales-chart-dot sales-chart-dot-gross"
            />
            <circle
              cx={point.x}
              cy={point.netY}
              r={isPointActive ? 4 : 0}
              className="sales-chart-dot sales-chart-dot-net"
            />
          </g>
        );
      })}

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
              className={`sales-chart-axis-label sales-chart-axis-label-x${
                highlighted && highlighted.date === point.date ? ' is-active' : ''
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

function SalesHeatmap({ matrix = [], selectedCell = { dayIndex: 0, slotIndex: 0 }, onCellClick }) {
  const safeMatrix = matrix.length === 7 ? matrix : Array.from({ length: 7 }, () => Array(6).fill(0));

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
          {safeMatrix[dayIndex].map((intensity, slotIndex) => {
            const isSelected =
              selectedCell?.dayIndex === dayIndex && selectedCell?.slotIndex === slotIndex;
            return (
              <span
                key={slotIndex}
                className={`sales-heatmap-cell is-level-${intensity}${
                  isSelected ? ' is-selected' : ''
                }`}
                title={`${day} ${TIME_SLOTS[slotIndex]}`}
                onClick={() => onCellClick && onCellClick({ dayIndex, slotIndex })}
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
  const { dateRange, setDateRange, granularity, setGranularity } = useAnalyticsUrlState(
    'Last 30 days',
    'Daily'
  );

  const { from, to } = useMemo(() => resolveDateRangeBounds(dateRange), [dateRange]);
  const interval = granularity === 'Monthly' ? 'month' : granularity === 'Weekly' ? 'week' : 'day';

  const { data, isLoading, isError, error, refetch } = useAdminSalesAnalytics({
    from,
    to,
    interval,
  });

  const [notice, setNotice] = useState('');
  const [hoveredChartIndex, setHoveredChartIndex] = useState(null);
  const [activeCell, setActiveCell] = useState(null);

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

  // Derive series and tooltips
  const series = data?.salesSeries || [];
  const activeTooltipPoint = useMemo(() => {
    if (hoveredChartIndex !== null && series[hoveredChartIndex]) {
      return series[hoveredChartIndex];
    }
    const peak = series.find((p) => p.highlight);
    if (peak) return peak;
    return series[series.length - 1] || null;
  }, [series, hoveredChartIndex]);

  // Orders by status
  const ordersByStatus = data?.ordersByStatus || [];
  const maxStatusValue = Math.max(1, ...ordersByStatus.map((item) => item.value || 0));
  const totalOrders = data?.totalOrdersProcessed || ordersByStatus.reduce((sum, item) => sum + item.value, 0);

  // Countries
  const salesByCountry = data?.salesByCountry || [];
  const maxCountryRevenue = Math.max(1, ...salesByCountry.map((item) => item.revenue || 0));

  // Payment methods
  const paymentMethods = data?.paymentMethods || [];
  const maxPaymentPercent = Math.max(1, ...paymentMethods.map((item) => item.percent || 0));

  // Discounts
  const discountPerformance = data?.discountPerformance || [];
  const totalPromoRevenue = data?.totalPromoRevenue || discountPerformance.reduce((sum, item) => sum + item.revenue, 0);
  const promoShareOfGross = data?.promoShareOfGross || 0;

  // Selected cell for heatmap
  const selectedHeatmapCell = activeCell || data?.heatmap?.selectedCell || { dayIndex: 0, slotIndex: 3 };

  // Export report
  const exportReport = async () => {
    try {
      notify('Exporting sales report…');
      const blob = await adminApi.exportAnalyticsCsv({ page: 'sales', from, to });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novashop-sales-analytics-${dateRange.toLowerCase().replace(/\s+/g, '-')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Sales report exported');
    } catch {
      notify('Failed to export CSV report');
    }
  };

  const kpiStats = [
    {
      label: 'Gross sales',
      value: isLoading ? '...' : data?.kpis?.grossSales?.formatted || '$0',
      trend: data?.kpis?.grossSales?.formattedTrend || '-',
      tone: 'positive',
    },
    {
      label: 'Net sales',
      value: isLoading ? '...' : data?.kpis?.netSales?.formatted || '$0',
      trend: data?.kpis?.netSales?.formattedTrend || '-',
      tone: 'positive',
    },
    {
      label: 'Refunds',
      value: isLoading ? '...' : data?.kpis?.refunds?.formatted || '$0',
      trend: data?.kpis?.refunds?.formattedTrend || '-',
      tone: 'warning',
    },
    {
      label: 'Average order value',
      value: isLoading ? '...' : data?.kpis?.aov?.formatted || '-',
      trend: data?.kpis?.aov?.formattedTrend || '-',
      tone: 'positive',
    },
  ];

  return (
    <div className="admin-dashboard sales-page">
      {/* PAGE HEADER */}
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

      <div className="sales-kpi-label">
        VS PREVIOUS {data?.durationDays || 30} DAYS
      </div>

      {/* KPI ROW */}
      <section className="admin-stat-grid sales-stat-grid">
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
            <SalesChart
              series={series}
              onHoverPoint={setHoveredChartIndex}
              activeIndex={hoveredChartIndex}
            />

            {activeTooltipPoint && (
              <div className="sales-chart-tooltip">
                <div className="sales-chart-tooltip-head">
                  <strong>{activeTooltipPoint.date}</strong>
                  <span>{activeTooltipPoint.day}</span>
                </div>
                <div className="sales-chart-tooltip-row">
                  <span><i className="is-gross" /> Gross sales</span>
                  <strong>{formatCurrency(activeTooltipPoint.gross)}</strong>
                </div>
                <div className="sales-chart-tooltip-row">
                  <span><i className="is-net" /> Net sales</span>
                  <strong>{formatCurrency(activeTooltipPoint.net)}</strong>
                </div>
              </div>
            )}
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
            {ordersByStatus.map((status) => (
              <div className="sales-status-row" key={status.label}>
                <div className="sales-status-top">
                  <span>{status.label}</span>
                  <strong>{status.value}</strong>
                </div>
                <div className="sales-status-bar">
                  <span
                    style={{
                      width: `${maxStatusValue > 0 ? (status.value / maxStatusValue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="sales-card-footer">
            <span>Total orders processed</span>
            <strong>{formatNumber(totalOrders)} orders</strong>
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

            <span className="sales-timezone-label">
              {data?.timezoneLabel || 'EAT (STORE TIME)'}
            </span>
          </div>

          <SalesHeatmap
            matrix={data?.heatmap?.matrix}
            selectedCell={selectedHeatmapCell}
            onCellClick={setActiveCell}
          />

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
            {paymentMethods.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No payment transactions recorded in this period
              </div>
            ) : (
              paymentMethods.map((method) => (
                <div className="sales-bar-row" key={method.label}>
                  <div className="sales-bar-top">
                    <span>{method.label}</span>
                    <strong>{method.percent}%</strong>
                  </div>
                  <div className="sales-bar-track">
                    <span
                      style={{
                        width: `${maxPaymentPercent > 0 ? (method.percent / maxPaymentPercent) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sales-card-footer">
            <span>Digital checkout share</span>
            <strong>{data?.digitalShare?.formatted || '-'}</strong>
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
            {salesByCountry.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No regional data in this period
              </div>
            ) : (
              salesByCountry.map((item) => (
                <div className="sales-bar-row" key={item.label}>
                  <div className="sales-bar-top">
                    <span>{item.label}</span>
                    <strong>{formatCurrency(item.revenue)}</strong>
                  </div>
                  <div className="sales-bar-track sales-bar-track-thin">
                    <span
                      style={{
                        width: `${maxCountryRevenue > 0 ? (item.revenue / maxCountryRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sales-card-footer">
            <span>Top {salesByCountry.length} global markets</span>
            <strong>
              {salesByCountry.length > 0 ? 'Primary market concentration' : '-'}
            </strong>
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
              onClick={() => navigateTo('/admin/discounts')}
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

            {discountPerformance.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8A847C]">
                No discount redemptions in this period
              </div>
            ) : (
              discountPerformance.map((item) => (
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
              ))
            )}
          </div>

          <div className="sales-card-footer">
            <span>Total promo attributed volume</span>
            <strong>
              {formatCurrency(totalPromoRevenue)} ({promoShareOfGross}%)
            </strong>
          </div>
        </article>
      </section>

      {isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center justify-between">
          <span>{error || 'Failed to load sales analytics'}</span>
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
