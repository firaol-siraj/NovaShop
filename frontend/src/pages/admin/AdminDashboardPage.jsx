import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { useChartTheme } from '../../lib/chartTheme';
import AdminDateRangePicker from '../../components/admin/AdminDateRangePicker';
import PrintablePackingSlips from '../../components/admin/PrintablePackingSlips';
import {
  useAdminSummary,
  useAdminRevenue,
  useAdminTopProducts,
  useAdminInventoryAlerts,
  useAdminFulfillmentQueue,
  useAdminOrders,
} from '../../hooks/useAdminDashboard';
import adminApi from '../../lib/api/adminApi';
import {
  formatCurrency,
  formatNumber,
  formatCompactNumber,
  formatPercentageChange,
  formatDate,
  getDefaultMonthRange,
} from '../../lib/formatters';

/**
 * Dynamic SVG Sparkline component rendering real historical points.
 */
function DynamicSparkline({ data = [], stroke = '#568A65', fill = 'rgba(61,119,86,0.08)' }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <svg className="admin-sparkline" viewBox="0 0 130 32" preserveAspectRatio="none" aria-hidden="true">
        <line x1="2" y1="16" x2="128" y2="16" stroke="#DDD6CC" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  const width = 130;
  const height = 32;
  const paddingY = 4;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = Number((2 + (idx / Math.max(1, data.length - 1)) * (width - 4)).toFixed(1));
    const normalizedY = (val - min) / range;
    const y = Number((height - paddingY - normalizedY * (height - paddingY * 2)).toFixed(1));
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaD = `${pathD} L ${points.at(-1)?.x || width} ${height} L ${points[0]?.x || 0} ${height} Z`;

  return (
    <svg className="admin-sparkline" viewBox="0 0 130 32" preserveAspectRatio="none" aria-hidden="true">
      <path d={areaD} fill={fill} />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * KPI Stat Card with loading skeleton and error states
 */
function StatCard({ label, trend, value, subtext, sparklineData, catalog, catalogCounts, isLoading, isError, onRetry }) {
  if (isLoading) {
    return (
      <article className="admin-stat-card animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-24 bg-[#EFEAE4] rounded" />
          <div className="h-5 w-12 bg-[#F2EDE5] rounded-full" />
        </div>
        <div className="mt-4 h-8 w-32 bg-[#EFEAE4] rounded" />
        <div className="mt-2.5 h-3 w-40 bg-[#F4EFEA] rounded" />
        <div className="mt-4 h-8 w-full bg-[#FAF8F5] rounded" />
      </article>
    );
  }

  if (isError) {
    return (
      <article className="admin-stat-card border-rose-200 bg-rose-50/40">
        <div className="admin-stat-heading">
          <span className="admin-stat-label text-rose-800">{label}</span>
        </div>
        <div className="mt-3 text-xs text-rose-700">Failed to load data</div>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 text-[10px] font-bold text-rose-800 underline">
            Retry
          </button>
        )}
      </article>
    );
  }

  return (
    <article className="admin-stat-card">
      <div className="admin-stat-heading">
        <span className="admin-stat-label">{label}</span>
        {catalog ? (
          catalogCounts?.needsRestockCount > 0 ? (
            <span className="admin-critical-pill">{catalogCounts.needsRestockCount} need restock</span>
          ) : (
            <span className="admin-trend-pill">Healthy</span>
          )
        ) : (
          <span className={trend && trend.startsWith('↓') ? 'admin-critical-pill' : 'admin-trend-pill'}>
            {trend}
          </span>
        )}
      </div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-subtext">{subtext}</div>
      {catalog && catalogCounts ? (
        <>
          <div
            className="admin-inventory-progress"
            aria-label={`${catalogCounts.inStock} in stock, ${catalogCounts.lowStock} low, ${catalogCounts.critical} critical`}
          >
            <span style={{ flex: Math.max(1, catalogCounts.inStock) }} title={`${catalogCounts.inStock} in stock`} />
            <span style={{ flex: Math.max(0, catalogCounts.lowStock) }} title={`${catalogCounts.lowStock} low stock`} />
            <span style={{ flex: Math.max(0, catalogCounts.critical) }} title={`${catalogCounts.critical} critical out of stock`} />
          </div>
          <div className="admin-inventory-legend">
            {catalogCounts.inStock} In Stock · {catalogCounts.lowStock} Low · {catalogCounts.critical} Critical
          </div>
        </>
      ) : (
        <DynamicSparkline data={sparklineData} />
      )}
    </article>
  );
}

/**
 * Interactive SVG Revenue Velocity Chart
 */
function RevenueChart({ currentSeries = [], previousSeries = [], peakDay, currency = 'USD', isLoading, isError, onRetry }) {
  const chartTheme = useChartTheme();
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (isLoading) {
    return (
      <div className="admin-chart-frame flex items-center justify-center animate-pulse bg-[#FAF8F5] rounded-lg">
        <span className="text-xs text-[#8A847C]">Loading revenue velocity data...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-chart-frame flex flex-col items-center justify-center bg-rose-50/30 rounded-lg p-6">
        <p className="text-xs text-rose-800">Failed to load revenue velocity chart.</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="admin-action-button mt-3 text-xs">
            Retry Loading Chart
          </button>
        )}
      </div>
    );
  }

  const width = 1000;
  const height = 250;
  const paddingLeft = 66;
  const paddingRight = 15;
  const paddingTop = 35;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute maximum revenue across both series to scale Y-axis
  const curMax = currentSeries.reduce((m, d) => Math.max(m, d.netRevenue || 0), 0);
  const prevMax = previousSeries.reduce((m, d) => Math.max(m, d.netRevenue || 0), 0);
  const rawMax = Math.max(curMax, prevMax, 100);
  // Round up to nice number
  const yMax = Math.ceil(rawMax / 100) * 100 || 100;

  // Build coordinate points
  const currentPoints = currentSeries.map((item, idx) => {
    const x = paddingLeft + (idx / Math.max(1, currentSeries.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((item.netRevenue || 0) / yMax) * chartHeight;
    return { ...item, x, y };
  });

  const prevPoints = previousSeries.map((item, idx) => {
    const x = paddingLeft + (idx / Math.max(1, previousSeries.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((item.netRevenue || 0) / yMax) * chartHeight;
    return { ...item, x, y };
  });

  const curPath = currentPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const prevPath = prevPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

  // Active hover point (or peak day if unhovered)
  const activePoint =
    hoveredIndex !== null && currentPoints[hoveredIndex]
      ? currentPoints[hoveredIndex]
      : currentPoints.find((p) => p.date === peakDay?.date) || currentPoints.at(-1);

  // Spaced X-axis labels
  const labelInterval = Math.max(1, Math.floor(currentPoints.length / 6));
  const xLabels = currentPoints.filter((_, idx) => idx % labelInterval === 0 || idx === currentPoints.length - 1);

  return (
    <div className="admin-chart-frame" onMouseLeave={() => setHoveredIndex(null)}>
      <svg
        className="admin-revenue-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenue chart"
      >
        {/* Horizontal grid lines & Y labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = paddingTop + chartHeight * (1 - pct);
          const val = yMax * pct;
          return (
            <g key={pct}>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke={chartTheme.grid} strokeWidth="1" />
              <text x="2" y={y + 3} fill={chartTheme.axisLabel}>{`${currency === 'ETB' ? 'ETB ' : '$'}${formatCompactNumber(val)}`}</text>
            </g>
          );
        })}

        {/* Previous cycle dotted line */}
        {prevPath && (
          <path
            d={prevPath}
            fill="none"
            stroke={chartTheme.grossLine}
            strokeWidth="2"
            strokeDasharray="3 6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Current cycle solid line */}
        {curPath && (
          <path
            d={curPath}
            fill="none"
            stroke={chartTheme.primary}
            strokeWidth="2.4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Active hovered indicator line and circle */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={paddingTop}
              y2={paddingTop + chartHeight}
              stroke={chartTheme.guide}
              strokeWidth="1"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="5"
              fill={chartTheme.primary}
              stroke={chartTheme.dotStroke}
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {/* X axis labels */}
        {xLabels.map((pt, i) => (
          <text
            key={pt.date + i}
            x={pt.x}
            y={height - 12}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fill={chartTheme.axisLabel}
          >
            {pt.label}
          </text>
        ))}

        {/* Invisible hit areas for interaction */}
        {currentPoints.map((pt, idx) => (
          <rect
            key={pt.date}
            x={pt.x - chartWidth / (currentPoints.length * 2)}
            y={paddingTop}
            width={chartWidth / currentPoints.length}
            height={chartHeight}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(idx)}
          />
        ))}
      </svg>

      {/* Floating Dynamic Tooltip */}
      {activePoint && (
        <div
          className="admin-chart-tooltip pointer-events-none transition-all duration-150"
          style={{
            left: `${Math.min(78, Math.max(12, (activePoint.x / width) * 100))}%`,
            top: '8%',
          }}
        >
          <div className="admin-chart-tooltip-date">
            {formatDate(activePoint.date, 'fullDate')}
          </div>
          <span className="admin-chart-tooltip-change">
            {formatPercentageChange(activePoint.changeVsPrevious)}
          </span>
          <strong>{formatCurrency(activePoint.netRevenue, currency)} Net</strong>
          <div className="admin-chart-tooltip-product">
            {activePoint.orderCount || 0} order(s) · {activePoint.topProduct || 'Standard Catalog'}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Real Order Details Modal
 */
function OrderDetailsModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="admin-order-modal-title">
        <div className="admin-modal-heading">
          <div>
            <span className="admin-modal-eyebrow">Order details</span>
            <h2 id="admin-order-modal-title">#{order.orderNumber}</h2>
          </div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close order details">
            <AdminIcon name="close" />
          </button>
        </div>

        <div className="admin-modal-detail">
          <span>Customer</span>
          <strong>{order.customerName}</strong>
          <small>{order.customerEmail}</small>
        </div>

        <div className="admin-modal-detail">
          <span>Items</span>
          <div className="col-span-1 space-y-1">
            {(order.orderItems || [order.firstItem]).filter(Boolean).map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span>
                  {item.name} {item.qty > 1 && `× ${item.qty}`}
                </span>
                <span className="font-semibold text-[#181512]">
                  {formatCurrency((item.price || 0) * (item.qty || 1), order.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-modal-detail">
          <span>Total</span>
          <strong>{formatCurrency(order.totalPrice, order.currency)}</strong>
        </div>

        <div className="admin-modal-detail">
          <span>Status</span>
          <div>
            <span className={`admin-status-pill ${(order.status || 'pending').toLowerCase()}`}>
              {order.status}
            </span>
            <span className="ml-2 text-[10px] text-[#7A726C]">
              {order.isPaid ? 'Payment Verified' : 'Awaiting Payment'}
            </span>
          </div>
        </div>

        <div className="admin-modal-detail">
          <span>Address</span>
          <p className="text-xs text-[#5F5952]">
            {order.shippingAddress?.address || 'Standard Address'}<br />
            {order.shippingAddress?.city ? `${order.shippingAddress.city}, ` : ''}
            {order.shippingAddress?.country || 'Ethiopia'}
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * Dispatch Confirmation Modal
 */
function DispatchConfirmModal({ orderCount, onConfirm, onCancel, isDispatching }) {
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="admin-order-modal max-w-sm">
        <h3 className="text-lg font-serif text-[#1B1816]">Confirm Courier Dispatch</h3>
        <p className="mt-2 text-xs leading-relaxed text-[#5F5952]">
          Are you sure you want to mark <strong>{orderCount} order(s)</strong> as Shipped?
          This updates the database status history and dispatches delivery update emails to all subscribed customers.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="admin-action-button"
            onClick={onCancel}
            disabled={isDispatching}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-action-button is-primary"
            onClick={onConfirm}
            disabled={isDispatching}
          >
            {isDispatching ? 'Dispatching...' : 'Yes, Dispatch All'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage({ go }) {
  // 1. Date Range Filter (Default: Current Month)
  const [dateRange, setDateRange] = useState(() => getDefaultMonthRange());
  const [chartInterval, setChartInterval] = useState('30D');

  // 2. Orders Table State
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // 3. Queue Action Modals
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [showPrintSlips, setShowPrintSlips] = useState(false);
  const [notice, setNotice] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(orderSearch.trim());
      setOrderPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [orderSearch]);

  // Toast notice helper
  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  // -------------------------------------------------------------
  // REAL DATA HOOKS (SWR / React Query pattern with auto-refresh)
  // -------------------------------------------------------------
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useAdminSummary({
    from: dateRange.from,
    to: dateRange.to,
  });

  const {
    data: revenueData,
    isLoading: isRevenueLoading,
    isError: isRevenueError,
    refetch: refetchRevenue,
  } = useAdminRevenue({
    from: dateRange.from,
    to: dateRange.to,
    interval: chartInterval === '12M' ? 'month' : chartInterval === '90D' ? 'week' : 'day',
  });

  const {
    data: topProductsData,
    isLoading: isTopProductsLoading,
    isError: isTopProductsError,
    refetch: refetchTopProducts,
  } = useAdminTopProducts({
    from: dateRange.from,
    to: dateRange.to,
    limit: 4,
  });

  const {
    data: alertsData,
    isLoading: isAlertsLoading,
    isError: isAlertsError,
    refetch: refetchAlerts,
  } = useAdminInventoryAlerts({ limit: 6 });

  const {
    data: queueData,
    isLoading: isQueueLoading,
    refetch: refetchQueue,
  } = useAdminFulfillmentQueue();

  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    refetch: refetchOrders,
  } = useAdminOrders({
    page: orderPage,
    limit: 6,
    search: debouncedSearch,
    status: statusFilter,
    from: dateRange.from,
    to: dateRange.to,
  });

  // Export report to CSV
  const handleExportReport = async () => {
    try {
      showNotice('Generating real report export...');
      const blob = await adminApi.exportReport({
        from: dateRange.from,
        to: dateRange.to,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novashop-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showNotice('Report downloaded successfully.');
    } catch (err) {
      console.error('Export report error:', err);
      showNotice('Failed to download report.');
    }
  };

  // Dispatch All Confirmation & Execution
  const handleConfirmDispatch = async () => {
    setIsDispatching(true);
    try {
      const res = await adminApi.dispatchOrders();
      setShowDispatchConfirm(false);
      showNotice(res.message || 'Orders dispatched successfully.');
      // Refetch queue, summary, and recent orders
      refetchQueue();
      refetchOrders();
      refetchSummary();
    } catch (err) {
      console.error('Dispatch orders error:', err);
      showNotice('Failed to dispatch orders.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Extract orders pagination
  const ordersList = ordersData?.orders || [];
  const pagination = ordersData?.pagination || { total: 0, page: 1, limit: 6, totalPages: 1 };

  return (
    <div className="admin-dashboard">
      {/* Page Heading & Controls */}
      <section className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-description">Store overview, sales performance, and inventory health.</p>
        </div>
        <div className="admin-page-actions">
          {/* Real Date Range Picker */}
          <AdminDateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Real Export Report */}
          <button className="admin-action-button" type="button" onClick={handleExportReport}>
            <AdminIcon name="download" size={15} /> Export Report
          </button>

          {/* Add Product navigation */}
          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => go('/admin/products/new')}
          >
            <AdminIcon name="plus" size={15} /> Add Product
          </button>
        </div>
      </section>

      {/* Widget 1: Real KPI Cards */}
      <section className="admin-stat-grid" aria-label="Store performance summary">
        {/* Total Net Revenue */}
        <StatCard
          label="Total Net Revenue"
          trend={formatPercentageChange(summary?.revenue?.percentageChange)}
          value={formatCurrency(summary?.revenue?.totalNetRevenue, summary?.currency)}
          subtext={
            summary?.revenue?.difference !== undefined
              ? `${summary.revenue.difference >= 0 ? '+' : ''}${formatCurrency(summary.revenue.difference)} vs previous period`
              : 'Verified paid orders only'
          }
          sparklineData={summary?.revenue?.sparkline}
          isLoading={isSummaryLoading}
          isError={isSummaryError}
          onRetry={refetchSummary}
        />

        {/* Orders Fulfilled */}
        <StatCard
          label="Orders Fulfilled"
          trend={formatPercentageChange(summary?.ordersFulfilled?.percentageChange)}
          value={formatNumber(summary?.ordersFulfilled?.totalFulfilled)}
          subtext={`${summary?.ordersFulfilled?.timelyDispatchRate ?? 100}% timely dispatch (≤48h)`}
          sparklineData={summary?.ordersFulfilled?.sparkline}
          isLoading={isSummaryLoading}
          isError={isSummaryError}
          onRetry={refetchSummary}
        />

        {/* Active Customers */}
        <StatCard
          label="Active Customers"
          trend={formatPercentageChange(summary?.activeCustomers?.percentageChange)}
          value={formatNumber(summary?.activeCustomers?.totalActiveCustomers)}
          subtext={`${summary?.activeCustomers?.repeatCustomerRate ?? 0}% repeat customer rate`}
          sparklineData={summary?.revenue?.sparkline}
          isLoading={isSummaryLoading}
          isError={isSummaryError}
          onRetry={refetchSummary}
        />

        {/* Catalog Health */}
        <StatCard
          label="Catalog Health"
          value={`${formatNumber(summary?.catalogHealth?.totalSKUs)} SKUs`}
          catalog
          catalogCounts={summary?.catalogHealth}
          isLoading={isSummaryLoading}
          isError={isSummaryError}
          onRetry={refetchSummary}
        />
      </section>

      {/* Widget 2: Revenue Velocity Chart */}
      <section className="admin-card admin-revenue-card" aria-labelledby="revenue-velocity-title">
        <div className="admin-card-heading">
          <div>
            <div className="admin-card-title-row">
              <h2 className="admin-card-title" id="revenue-velocity-title">Revenue Velocity</h2>
              <span className="admin-soft-badge">{dateRange.label}</span>
            </div>
            <div className="admin-revenue-stats">
              <span>
                <strong>{revenueData?.netSales ? formatCurrency(revenueData.netSales, revenueData?.currency) : '-'}</strong> Net Sales
              </span>
              <i>•</i>
              <span>
                <strong>{revenueData?.aov ? formatCurrency(revenueData.aov, revenueData?.currency) : '-'}</strong> AOV
              </span>
              <i>•</i>
              <span>
                <strong>{revenueData?.conversionRateLabel || 'Not tracked'}</strong> Conv. Rate
              </span>
            </div>
          </div>
          <div className="admin-revenue-controls">
            <div className="admin-segmented-control" aria-label="Chart date range">
              {['7D', '30D', '90D', '12M'].map((range) => (
                <button
                  key={range}
                  type="button"
                  className={chartInterval === range ? 'is-active' : ''}
                  aria-pressed={chartInterval === range}
                  onClick={() => setChartInterval(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-chart-legend-row">
          <div className="admin-chart-legend">
            <span><i className="admin-legend-line" />Current Cycle</span>
            <span><i className="admin-legend-line is-dotted" />Previous Cycle</span>
          </div>
          <div className="admin-peak-callout">
            {revenueData?.peakDay ? (
              `Peak day: ${revenueData.peakDay.formattedDate} (${formatCurrency(revenueData.peakDay.revenue, revenueData?.currency)})`
            ) : (
              'Peak day: No data'
            )}
          </div>
        </div>

        <RevenueChart
          currentSeries={revenueData?.currentSeries || []}
          previousSeries={revenueData?.previousSeries || []}
          peakDay={revenueData?.peakDay}
          currency={revenueData?.currency}
          isLoading={isRevenueLoading}
          isError={isRevenueError}
          onRetry={refetchRevenue}
        />
      </section>

      {/* Lower Grid: Orders & Inventory */}
      <section className="admin-lower-grid">
        <div className="admin-order-column">
          {/* Widget 3: Recent Orders Table */}
          <section className="admin-card admin-orders-card" id="recent-orders" aria-labelledby="recent-orders-title">
            <div className="admin-card-heading">
              <div className="admin-card-title-row">
                <h2 className="admin-card-title" id="recent-orders-title">Recent Orders</h2>
                <span className="admin-soft-badge">{pagination.total} Total</span>
              </div>
              <div className="admin-orders-heading-actions">
                <button
                  type="button"
                  className="admin-text-link"
                  onClick={() => go('/admin/orders')}
                >
                  View all orders <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            <div className="admin-order-toolbar">
              <label className="admin-order-search">
                <AdminIcon name="search" size={15} />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Filter by order ID, customer name, email..."
                  aria-label="Filter orders"
                />
              </label>
              <select
                className="admin-status-filter"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setOrderPage(1);
                }}
                aria-label="Filter by order status"
              >
                {[
                  'All Statuses',
                  'paid',
                  'processing',
                  'shipped',
                  'delivered',
                  'pending_payment',
                  'cancelled',
                  'refunded',
                ].map((status) => (
                  <option key={status} value={status}>
                    {status === 'All Statuses'
                      ? 'All Statuses'
                      : status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-orders-table-wrap">
              <table className="admin-orders-table">
                <thead>
                  <tr>
                    <th>ORDER ID</th>
                    <th>CUSTOMER</th>
                    <th>ITEMS</th>
                    <th>TOTAL</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isOrdersLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="6" className="py-4 px-5">
                          <div className="h-4 bg-[#F2EDE5] rounded w-full" />
                        </td>
                      </tr>
                    ))
                  ) : isOrdersError ? (
                    <tr>
                      <td colSpan="6" className="admin-empty-orders text-rose-700">
                        Failed to load orders.{' '}
                        <button type="button" onClick={refetchOrders} className="underline font-bold">
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : ordersList.length === 0 ? (
                    <tr>
                      <td className="admin-empty-orders" colSpan="6">
                        No orders match those filters.
                      </td>
                    </tr>
                  ) : (
                    ordersList.map((order, index) => (
                      <tr key={order.id}>
                        <td className="admin-order-id">#{order.orderNumber}</td>
                        <td>
                          <div className="admin-order-customer">
                            <span className={`admin-customer-avatar tone-${(index % 4) + 1}`}>
                              {order.initials}
                            </span>
                            <span>
                              <span className="admin-customer-name">
                                {order.customerName}
                                {order.extraItemsCount > 0 && (
                                  <small className="admin-order-multiple">+{order.extraItemsCount}</small>
                                )}
                              </span>
                              <small className="admin-customer-email">{order.customerEmail}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          {order.firstItem?.image ? (
                            <img
                              className="admin-order-item-image"
                              src={order.firstItem.image}
                              alt={order.firstItem.name}
                            />
                          ) : (
                            <div className="admin-order-item-image flex items-center justify-center bg-[#F2EDE5] text-[9px] text-[#8A847C]">
                              Item
                            </div>
                          )}
                        </td>
                        <td className="admin-order-total">{formatCurrency(order.totalPrice, order.currency)}</td>
                        <td>
                          <span className={`admin-status-pill ${(order.status || 'pending').toLowerCase()}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="admin-view-order"
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            aria-label={`View order ${order.orderNumber}`}
                          >
                            <AdminIcon name="eye" size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="admin-order-pagination">
              <span>
                Showing {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
              </span>
              <div className="admin-pagination-controls" aria-label="Order pages">
                <button
                  type="button"
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  aria-label="Previous page"
                >
                  <AdminIcon name="left" size={13} />
                </button>
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      type="button"
                      key={pNum}
                      className={pagination.page === pNum ? 'is-active' : ''}
                      onClick={() => setOrderPage(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}
                {pagination.totalPages > 5 && <span>…</span>}
                <button
                  type="button"
                  onClick={() => setOrderPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  aria-label="Next page"
                >
                  <AdminIcon name="chevron" size={13} />
                </button>
              </div>
            </div>
          </section>

          {/* Widget 6: Fulfillment Queue */}
          <section className="admin-fulfillment-banner" aria-label="Fulfillment queue">
            <div className="admin-fulfillment-copy">
              <span className="admin-fulfillment-icon">
                <AdminIcon name="truck" size={19} />
              </span>
              <div>
                <div className="admin-fulfillment-title">
                  Fulfillment Queue · {isQueueLoading ? '...' : (queueData?.count ?? 0)} orders awaiting dispatch{' '}
                  <span>{queueData?.readySince ? `SINCE ${formatDate(queueData.readySince, 'short').toUpperCase()}` : 'CURRENT'}</span>
                </div>
                <p className="admin-fulfillment-description">
                  {queueData?.count > 0
                    ? `${queueData.count} order(s) paid and verified for courier packaging and dispatch.`
                    : 'All ready orders have been dispatched.'}
                </p>
              </div>
            </div>
            <div className="admin-fulfillment-actions">
              <button
                className="admin-action-button"
                type="button"
                onClick={() => setShowPrintSlips(true)}
                disabled={(queueData?.count ?? 0) === 0}
              >
                <AdminIcon name="print" size={14} /> Print Slips
              </button>
              <button
                className="admin-action-button is-primary"
                type="button"
                onClick={() => setShowDispatchConfirm(true)}
                disabled={(queueData?.count ?? 0) === 0 || isDispatching}
              >
                {isDispatching ? 'Dispatching...' : 'Dispatch All'}
              </button>
            </div>
          </section>
        </div>

        <div className="admin-inventory-column">
          {/* Widget 4: Top Products by Volume */}
          <section className="admin-card admin-product-card" id="top-products" aria-labelledby="top-products-title">
            <div className="admin-card-heading">
              <div>
                <div className="admin-card-title-row">
                  <h2 className="admin-card-title" id="top-products-title">Top Products</h2>
                  <span className="admin-soft-badge">Volume</span>
                </div>
                <p className="admin-product-subtitle">Verified Paid Orders</p>
              </div>
            </div>

            <div className="admin-product-list">
              {isTopProductsLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="admin-product-row animate-pulse">
                    <div className="admin-product-thumbnail bg-[#F2EDE5]" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-[#EFEAE4] rounded w-3/4" />
                      <div className="h-2 bg-[#F7F4EF] rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : isTopProductsError ? (
                <div className="py-6 text-center text-xs text-rose-700">
                  Failed to load top products.{' '}
                  <button type="button" onClick={refetchTopProducts} className="underline font-bold">
                    Retry
                  </button>
                </div>
              ) : (topProductsData?.topProducts || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8A847C]">
                  No products sold in this period.
                </div>
              ) : (
                topProductsData.topProducts.map((item) => (
                  <article className="admin-product-row" key={item.productId || item.name}>
                    {item.image ? (
                      <img className="admin-product-thumbnail" src={item.image} alt={item.name} />
                    ) : (
                      <div className="admin-product-thumbnail flex items-center justify-center bg-[#F2EDE5] text-[9px] text-[#8A847C]">
                        Item
                      </div>
                    )}
                    <div className="admin-product-details">
                      <div className="admin-product-name" title={item.name}>{item.name}</div>
                      <div className="admin-product-category">{item.category}</div>
                    </div>
                    <div className="admin-product-sales">
                      <strong>{formatCurrency(item.price)}</strong>
                      <span>{item.unitsSold} sold</span>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="admin-product-view-all">
              <button
                className="admin-text-link"
                type="button"
                onClick={() => go('/admin/products')}
              >
                View all {topProductsData?.totalCatalogCount ?? 0} catalog items <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          {/* Widget 5: Inventory Alerts */}
          <section className="admin-card admin-inventory-card" aria-labelledby="inventory-alerts-title">
            <div className="admin-card-heading">
              <div className="admin-inventory-title-wrap">
                <i className="admin-critical-dot" />
                <h2 className="admin-card-title" id="inventory-alerts-title">Inventory Alerts</h2>
              </div>
              <span className="admin-critical-pill">
                {alertsData?.criticalCount ?? 0} critical
              </span>
            </div>

            <div className="admin-inventory-alert-list">
              {isAlertsLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="admin-inventory-alert animate-pulse">
                    <div className="h-3 bg-[#EFEAE4] rounded w-2/3" />
                    <div className="h-4 bg-[#F2EDE5] rounded w-10 justify-self-end" />
                  </div>
                ))
              ) : isAlertsError ? (
                <div className="py-6 text-center text-xs text-rose-700">
                  Failed to load inventory alerts.{' '}
                  <button type="button" onClick={refetchAlerts} className="underline font-bold">
                    Retry
                  </button>
                </div>
              ) : (alertsData?.alerts || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8A847C]">
                  All catalog variants are well stocked.
                </div>
              ) : (
                alertsData.alerts.map((alert) => (
                  <article className="admin-inventory-alert" key={alert.variantId}>
                    <div className="admin-alert-product" title={alert.productName}>
                      {alert.productName}
                    </div>
                    <span className={`admin-alert-left${alert.isLow ? ' is-low' : ''}`}>
                      {alert.unitsLeftLabel}
                    </span>
                    <div className="admin-alert-variant">{alert.details}</div>
                    <button
                      className="admin-alert-restock"
                      type="button"
                      onClick={() => go(alert.restockPath)}
                    >
                      Restock
                    </button>
                  </article>
                ))
              )}
            </div>

            <div className="admin-inventory-manage">
              <button
                className="admin-text-link"
                type="button"
                onClick={() => go('/admin/inventory')}
              >
                Manage full inventory <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </div>
      </section>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {/* Dispatch Confirmation Modal */}
      {showDispatchConfirm && (
        <DispatchConfirmModal
          orderCount={queueData?.count ?? 0}
          onConfirm={handleConfirmDispatch}
          onCancel={() => setShowDispatchConfirm(false)}
          isDispatching={isDispatching}
        />
      )}

      {/* Printable Slips Modal */}
      {showPrintSlips && (
        <PrintablePackingSlips
          orders={queueData?.orders || []}
          onClose={() => setShowPrintSlips(false)}
        />
      )}

      {/* Toast Notification */}
      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
