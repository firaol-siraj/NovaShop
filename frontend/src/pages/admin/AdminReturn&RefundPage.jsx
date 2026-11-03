import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import returnApi from '../../lib/api/returnApi';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  AdminRejectReturnModal,
  AdminReceiveRestockModal,
  AdminProcessRefundModal,
  AdminPrintReturnSlipModal,
} from '../../components/admin/AdminReturnModals';
import './admin-return&refund.css';

function formatRelativeTime(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffDays === 0) {
    if (diffHour === 0) {
      if (diffMin <= 1) return 'Just now';
      return `${diffMin}m ago`;
    }
    return `${diffHour}h ago`;
  }
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

function StatusDot({ status }) {
  return <i className={`returns-status-dot ${status}`} aria-hidden="true" />;
}

function ItemPreview({ itemCount, image, name }) {
  return (
    <div className="returns-item-preview">
      <span className="returns-item-thumb" style={image ? { background: 'transparent', overflow: 'hidden' } : undefined}>
        {image ? (
          <img
            src={image}
            alt={name || 'Item'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
          />
        ) : (
          <span />
        )}
      </span>

      {itemCount > 1 && (
        <span className="returns-item-count">+{itemCount - 1}</span>
      )}
    </div>
  );
}

export default function AdminReturnsPage({ go, search: searchProp }) {
  const { adminUser } = useAdminAuth();

  // Permission check
  const canWriteReturns = useMemo(() => {
    if (!adminUser) return true;
    if (adminUser.adminRole === 'owner' || adminUser.adminRole === 'admin') return true;
    const perms = adminUser.permissions?.returns;
    if (Array.isArray(perms)) {
      return perms.includes('write') || perms.includes('manage') || perms.includes('delete');
    }
    return true;
  }, [adminUser]);

  // Read initial values from URL query string
  const getInitialParams = () => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      return {
        tab: sp.get('status') || 'all',
        q: sp.get('search') || sp.get('q') || '',
        reason: sp.get('reason') || 'all',
        resolution: sp.get('resolution') || 'all',
        date: sp.get('date') || sp.get('periodDays') || '30',
        page: parseInt(sp.get('page') || '1', 10),
        limit: parseInt(sp.get('limit') || '10', 10),
        customer: sp.get('customer') || '',
        order: sp.get('order') || '',
      };
    } catch {
      return {
        tab: 'all',
        q: '',
        reason: 'all',
        resolution: 'all',
        date: '30',
        page: 1,
        limit: 10,
        customer: '',
        order: '',
      };
    }
  };

  const init = getInitialParams();

  const [activeTab, setActiveTab] = useState(init.tab);
  const [search, setSearch] = useState(init.q);
  const [reasonFilter, setReasonFilter] = useState(init.reason);
  const [resolutionFilter, setResolutionFilter] = useState(init.resolution);
  const [dateFilter, setDateFilter] = useState(init.date);
  const [page, setPage] = useState(init.page);
  const [limit, setLimit] = useState(init.limit);
  const [customerFilter, setCustomerFilter] = useState(init.customer);
  const [orderFilter, setOrderFilter] = useState(init.order);

  const [selectedIds, setSelectedIds] = useState([]);
  const [notice, setNotice] = useState('');

  // Live Data State
  const [stats, setStats] = useState(null);
  const [returnsList, setReturnsList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Modal states for action menu & bulk
  const [activeReturnForAction, setActiveReturnForAction] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Sync state to URL params
  const updateUrlParams = useCallback((newParams) => {
    try {
      const sp = new URLSearchParams(window.location.search);
      Object.entries(newParams).forEach(([k, v]) => {
        if (!v || v === 'all' || (k === 'page' && v === 1) || (k === 'limit' && v === 10) || (k === 'date' && v === '30')) {
          sp.delete(k);
        } else {
          sp.set(k, String(v));
        }
      });
      const newQuery = sp.toString();
      const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    } catch {
      // ignore
    }
  }, []);

  // Handle browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const p = getInitialParams();
      setActiveTab(p.tab);
      setSearch(p.q);
      setReasonFilter(p.reason);
      setResolutionFilter(p.resolution);
      setDateFilter(p.date);
      setPage(p.page);
      setLimit(p.limit);
      setCustomerFilter(p.customer);
      setOrderFilter(p.order);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL whenever filter state changes
  useEffect(() => {
    updateUrlParams({
      status: activeTab,
      search,
      reason: reasonFilter,
      resolution: resolutionFilter,
      date: dateFilter,
      page,
      limit,
      customer: customerFilter,
      order: orderFilter,
    });
  }, [activeTab, search, reasonFilter, resolutionFilter, dateFilter, page, limit, customerFilter, orderFilter, updateUrlParams]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => {
      setNotice('');
    }, 2800);
  };

  // Fetch KPI Stats
  const fetchStats = async () => {
    try {
      const data = await returnApi.getAdminStats(dateFilter);
      setStats(data);
    } catch (err) {
      console.error('Failed to load return stats:', err);
    }
  };

  // Fetch Returns
  const fetchReturns = async () => {
    setLoading(true);
    try {
      const data = await returnApi.getAdminReturns({
        page,
        limit,
        status: activeTab,
        reason: reasonFilter,
        resolution: resolutionFilter,
        search,
        customer: customerFilter,
        order: orderFilter,
        periodDays: dateFilter,
      });
      setReturnsList(data.returns || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load returns list:', err);
      setReturnsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateFilter]);

  useEffect(() => {
    fetchReturns();
  }, [page, limit, activeTab, reasonFilter, resolutionFilter, dateFilter, search, customerFilter, orderFilter]);

  const statusTabs = useMemo(() => [
    { id: 'all', label: 'All', count: stats?.tabCounts?.all ?? null },
    { id: 'requested', label: 'Requested', count: stats?.tabCounts?.requested ?? null },
    { id: 'approved', label: 'Approved', count: stats?.tabCounts?.approved ?? null },
    { id: 'received', label: 'Received', count: stats?.tabCounts?.received ?? null },
    { id: 'refunded', label: 'Refunded', count: stats?.tabCounts?.refunded ?? null },
    { id: 'rejected', label: 'Rejected', count: stats?.tabCounts?.rejected ?? null },
  ], [stats]);

  const allVisibleSelected =
    returnsList.length > 0 &&
    returnsList.every((item) => selectedIds.includes(item.id));

  const toggleSelection = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !returnsList.some((item) => item.id === id)
        )
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([
        ...current,
        ...returnsList.map((item) => item.id),
      ]),
    ]);
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.length) return;
    try {
      const res = await returnApi.bulkUpdateStatus(selectedIds, 'approved');
      const updatedCount = res.updatedCount ?? selectedIds.length;
      showNotice(
        `${updatedCount} return request${updatedCount === 1 ? '' : 's'} approved`
      );
      setSelectedIds([]);
      fetchReturns();
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Failed to approve selected returns');
    }
  };

  const handleBulkReject = async () => {
    if (!selectedIds.length) return;
    try {
      const res = await returnApi.bulkUpdateStatus(selectedIds, 'rejected');
      const updatedCount = res.updatedCount ?? selectedIds.length;
      showNotice(
        `${updatedCount} return request${updatedCount === 1 ? '' : 's'} marked rejected`
      );
      setSelectedIds([]);
      fetchReturns();
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Failed to reject selected returns');
    }
  };

  const handleExport = async () => {
    showNotice('Preparing return report…');
    try {
      const blob = await returnApi.exportCsv({
        status: activeTab,
        reason: reasonFilter,
        resolution: resolutionFilter,
        search,
        customer: customerFilter,
        order: orderFilter,
        periodDays: dateFilter,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `returns-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotice('Return report exported');
    } catch (err) {
      showNotice('Failed to export return report');
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleViewReturn = (item) => {
    if (go) {
      go(`/admin/returns/${item.id}`);
      return;
    }
    showNotice(`Opened ${item.id}`);
  };

  const handleViewOrder = (item) => {
    const rawKey = item.orderRef || item.orderNumber || item.orderId || item.order;
    const orderKey = rawKey ? String(rawKey).replace(/^#/, '').trim() : '';
    if (orderKey) {
      if (go) {
        go(`/admin/orders/${orderKey}`);
      } else {
        window.location.href = `/admin/orders/${orderKey}`;
      }
    } else {
      showNotice('No linked order found for this return.');
    }
  };

  const handleViewCustomer = (item) => {
    const custKey = item.userId || item.customer;
    if (go && custKey) {
      go(`/admin/customers/${custKey}`);
    }
  };

  const handleCopyReturnNumber = async (item) => {
    try {
      await navigator.clipboard.writeText(item.id);
      showNotice(`Copied ${item.id} to clipboard`);
    } catch {
      showNotice(`Return number: ${item.id}`);
    }
  };

  const handleDirectApprove = async (item) => {
    try {
      await returnApi.approveReturn(item.rawId || item.id, { note: 'Approved from table' });
      showNotice(`Return #${item.id} approved`);
      fetchReturns();
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Failed to approve return');
    }
  };

  const handleConfirmReject = async ({ reason }) => {
    if (!activeReturnForAction) return;
    setModalSubmitting(true);
    try {
      await returnApi.rejectReturn(activeReturnForAction.rawId || activeReturnForAction.id, { reason });
      showNotice(`Return #${activeReturnForAction.id} rejected`);
      setRejectModalOpen(false);
      setActiveReturnForAction(null);
      fetchReturns();
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Failed to reject return');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmReceive = async ({ restockItems, note }) => {
    if (!activeReturnForAction) return;
    setModalSubmitting(true);
    try {
      await returnApi.receiveReturn(activeReturnForAction.rawId || activeReturnForAction.id, {
        restock: true,
        restockItems,
        note,
      });
      showNotice(`Return #${activeReturnForAction.id} marked received & restocked`);
      setReceiveModalOpen(false);
      setActiveReturnForAction(null);
      fetchReturns();
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Failed to receive return');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmRefund = async ({ amountUSD, refundMethod, includeShipping, refundReference, note }) => {
    if (!activeReturnForAction) return;
    setModalSubmitting(true);
    try {
      await returnApi.processRefund(activeReturnForAction.rawId || activeReturnForAction.id, {
        amountUSD,
        refundMethod,
        includeShipping,
        refundReference,
        note,
      });
      showNotice(`Refund of $${Number(amountUSD).toFixed(2)} completed for #${activeReturnForAction.id}`);
      setRefundModalOpen(false);
      setActiveReturnForAction(null);
      fetchReturns();
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setModalSubmitting(false);
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setActiveTab('all');
    setReasonFilter('all');
    setResolutionFilter('all');
    setCustomerFilter('');
    setOrderFilter('');
    setDateFilter('30');
    setPage(1);
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  // Stat delta renderer: enforces small badge and '-' when no previous
  const renderDeltaBadge = (kpi) => {
    const rawTrend = kpi?.trend;
    const tone = kpi?.tone;
    const trendText = rawTrend && rawTrend !== '+0 vs last period' && rawTrend !== '0.0%' ? rawTrend : '-';

    let pillClass = 'returns-warning-pill';
    if (tone === 'positive') pillClass = 'returns-success-pill';
    else if (tone === 'negative') pillClass = 'returns-danger-pill';

    return <span className={pillClass}>{trendText}</span>;
  };

  return (
    <div className="returns-page">
      <div className="returns-page-heading admin-page-heading">
        <div>
          <h1 className="admin-page-title">Returns &amp; Refunds</h1>
          <p className="admin-page-subtitle">
            Review return requests, approve resolutions, and issue customer refunds.
          </p>
        </div>

        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-action-button"
            onClick={handleExport}
          >
            <AdminIcon name="download" size={13} />
            <span>EXPORT</span>
          </button>
        </div>
      </div>

      <div className="returns-period-label">
        Last {dateFilter} days
      </div>

      <section className="returns-stat-grid admin-stat-grid">
        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              TOTAL RETURNS
            </span>
            {renderDeltaBadge(stats?.totalReturns)}
          </div>
          <strong className="admin-stat-value">{stats?.totalReturns?.count ?? '-'}</strong>
        </article>

        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              PENDING REQUESTS
            </span>
            {renderDeltaBadge(stats?.pending)}
          </div>
          <strong className="admin-stat-value">{stats?.pending?.count ?? '-'}</strong>
        </article>

        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              REFUNDED AMOUNT
            </span>
            {renderDeltaBadge(stats?.totalRefunded)}
          </div>
          <strong className="admin-stat-value">
            {stats?.totalRefunded?.amount !== undefined ? `$${Number(stats.totalRefunded.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
          </strong>
        </article>

        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              RETURN RATE
            </span>
            {renderDeltaBadge(stats?.returnRate)}
          </div>
          <strong className="admin-stat-value">
            {stats?.returnRate?.rate ?? '-'}
          </strong>
        </article>
      </section>

      {/* Removable Filter Chips for Customer & Order */}
      {(customerFilter || orderFilter) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '-4px 0 4px' }}>
          {customerFilter && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised, #FBFAF8)',
              border: '1px solid var(--border-default, #E9E3DB)',
              color: 'var(--text-primary, #1B1816)',
            }}>
              <span>Customer: <strong>{customerFilter}</strong></span>
              <button
                type="button"
                onClick={() => { setCustomerFilter(''); setPage(1); }}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted, #8A8070)', fontWeight: 'bold', padding: '0 2px' }}
                aria-label="Remove customer filter"
              >
                ×
              </button>
            </span>
          )}

          {orderFilter && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised, #FBFAF8)',
              border: '1px solid var(--border-default, #E9E3DB)',
              color: 'var(--text-primary, #1B1816)',
            }}>
              <span>Order: <strong>#{orderFilter}</strong></span>
              <button
                type="button"
                onClick={() => { setOrderFilter(''); setPage(1); }}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted, #8A8070)', fontWeight: 'bold', padding: '0 2px' }}
                aria-label="Remove order filter"
              >
                ×
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => { setCustomerFilter(''); setOrderFilter(''); setPage(1); }}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--admin-primary, #1B1816)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '2px 6px',
            }}
          >
            Clear chips
          </button>
        </div>
      )}

      <section className="returns-catalog-toolbar">
        <div className="returns-filter-row">
          <label className="returns-search-field">
            <AdminIcon name="search" size={13} />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by return, order, or customer"
            />
          </label>

          <select
            value={reasonFilter}
            onChange={(event) => {
              setReasonFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by reason"
          >
            <option value="all">Reason</option>
            <option value="Wrong size">Wrong size</option>
            <option value="Defective">Defective</option>
            <option value="Not as described">Not as described</option>
            <option value="Damaged on arrival">Damaged on arrival</option>
            <option value="Changed mind">Changed mind</option>
          </select>

          <select
            value={resolutionFilter}
            onChange={(event) => {
              setResolutionFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by resolution"
          >
            <option value="all">Resolution</option>
            <option value="Refund">Refund</option>
            <option value="Store credit">Store credit</option>
          </select>

          <select
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by date"
          >
            <option value="30">Date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        <div className="returns-status-tabs">
          {statusTabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`returns-status-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
            >
              <StatusDot status={tab.id} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <b>{tab.count}</b>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="returns-table-card">
        <div className="returns-table-scroll">
          <table className="returns-table">
            <thead>
              <tr>
                <th className="returns-checkbox-column">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all returns"
                  />
                </th>
                <th>RETURN</th>
                <th>CUSTOMER</th>
                <th>ITEMS</th>
                <th>REASON</th>
                <th>REFUND AMOUNT</th>
                <th>REQUESTED</th>
                <th className="returns-action-column">Action</th>
              </tr>
            </thead>

            <tbody>
              {returnsList.length > 0 ? (
                returnsList.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const refundFormatted = `$${Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const relativeDate = formatRelativeTime(item.createdAt);
                  const st = (item.status || 'requested').toLowerCase();

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'is-selected' : ''}
                    >
                      <td className="returns-checkbox-cell">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(item.id)}
                          aria-label={`Select ${item.id}`}
                        />
                      </td>

                      <td>
                        <div className="returns-id-cell">
                          <strong>#{item.id}</strong>
                          <span>Order</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewOrder(item);
                            }}
                            style={{
                              background: 'transparent',
                              border: 0,
                              padding: 0,
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'inherit',
                              fontFamily: 'inherit',
                            }}
                            title="View linked order"
                          >
                            <small style={{ textDecoration: 'underline' }}>#{String(item.orderNumber || item.orderId || item.order || '').replace(/^#/, '')}</small>
                          </button>
                        </div>
                      </td>

                      <td>
                        <div className="returns-customer-cell">
                          <strong>{item.customer}</strong>
                          <span>{item.email}</span>
                        </div>
                      </td>

                      <td>
                        <div className="returns-items-cell">
                          <ItemPreview
                            itemCount={item.itemsCount || item.itemCount || 1}
                            image={item.image}
                            name={item.items}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="returns-reason-cell">
                          <strong>{item.reason}</strong>
                          <span>{item.resolution || 'Refund'}</span>
                        </div>
                      </td>

                      <td>
                        <strong className="returns-refund-value">
                          {refundFormatted}
                        </strong>
                      </td>

                      <td>
                        <div className="returns-requested-cell">
                          <strong>{item.date || item.requested}</strong>
                          <span>{relativeDate}</span>
                        </div>
                      </td>

                      <td className="returns-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActionMenu
                          item={item}
                          title={item.id}
                          subtitle={`${item.customer || 'Customer'} · ${st.toUpperCase()}`}
                          width={220}
                          items={[
                            {
                              id: 'view',
                              label: 'View return',
                              icon: 'eye',
                              onClick: () => handleViewReturn(item),
                            },
                            {
                              id: 'order',
                              label: 'View order',
                              icon: 'bag',
                              onClick: () => handleViewOrder(item),
                            },
                            {
                              id: 'customer',
                              label: 'View customer',
                              icon: 'customers',
                              onClick: () => handleViewCustomer(item),
                            },
                            {
                              id: 'print',
                              label: 'Print return slip',
                              icon: 'print',
                              onClick: () => {
                                setActiveReturnForAction(item);
                                setSlipModalOpen(true);
                              },
                            },
                            { id: 'divider-1', isDivider: true },
                            {
                              id: 'approve',
                              label: 'Approve return',
                              icon: 'check',
                              hidden: st !== 'requested' || !canWriteReturns,
                              onClick: () => handleDirectApprove(item),
                            },
                            {
                              id: 'receive',
                              label: 'Mark received',
                              icon: 'package',
                              hidden: st !== 'approved' || !canWriteReturns,
                              onClick: () => {
                                setActiveReturnForAction(item);
                                setReceiveModalOpen(true);
                              },
                            },
                            {
                              id: 'refund',
                              label: 'Issue refund',
                              icon: 'credit-card',
                              hidden: st !== 'received' || !canWriteReturns,
                              onClick: () => {
                                setActiveReturnForAction(item);
                                setRefundModalOpen(true);
                              },
                            },
                            {
                              id: 'reject',
                              label: 'Reject return',
                              icon: 'x-circle',
                              danger: true,
                              hidden: st !== 'requested' || !canWriteReturns,
                              onClick: () => {
                                setActiveReturnForAction(item);
                                setRejectModalOpen(true);
                              },
                            },
                            { id: 'divider-2', isDivider: true },
                            {
                              id: 'copy',
                              label: 'Copy return number',
                              icon: 'copy',
                              onClick: () => handleCopyReturnNumber(item),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="returns-empty-state"
                  >
                    <AdminIcon name="search" size={18} />
                    <strong>{loading ? 'Loading returns…' : 'No returns found'}</strong>
                    <span>
                      {loading ? 'Connecting to live database…' : 'Try adjusting your search or filters.'}
                    </span>

                    {!loading && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="returns-pagination">
          <span>
            Showing <strong>{startRecord}–{endRecord}</strong>{' '}
            of {totalCount} returns
          </span>

          <div className="returns-pagination-controls">
            <label>
              {limit}
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
              >
                <option value="10">/ page</option>
                <option value="25">/ page</option>
                <option value="50">/ page</option>
              </select>
            </label>

            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  type="button"
                  className={page === pageNum ? 'is-active' : ''}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && (
              <>
                <span>...</span>
                <button
                  type="button"
                  className={page === totalPages ? 'is-active' : ''}
                  onClick={() => setPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div
          className="returns-bulk-bar"
          onClick={(event) => event.stopPropagation()}
        >
          <strong>
            {selectedIds.length} selected
          </strong>

          <span className="returns-bulk-divider" />

          {canWriteReturns && (
            <>
              <button
                type="button"
                onClick={handleBulkApprove}
              >
                <AdminIcon name="check-circle" size={12} />
                Approve
              </button>

              <button
                type="button"
                onClick={handleBulkReject}
              >
                <AdminIcon name="x-circle" size={12} />
                Reject
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleExport}
          >
            <AdminIcon name="download" size={12} />
            Export
          </button>

          <button
            type="button"
            className="returns-bulk-clear"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <AdminIcon name="close" size={13} />
          </button>
        </div>
      )}

      {/* Modals for Row & Bulk Actions */}
      <AdminRejectReturnModal
        isOpen={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setActiveReturnForAction(null); }}
        returnObj={activeReturnForAction}
        onConfirm={handleConfirmReject}
        isSubmitting={modalSubmitting}
      />

      <AdminReceiveRestockModal
        isOpen={receiveModalOpen}
        onClose={() => { setReceiveModalOpen(false); setActiveReturnForAction(null); }}
        returnObj={activeReturnForAction}
        onConfirm={handleConfirmReceive}
        isSubmitting={modalSubmitting}
      />

      <AdminProcessRefundModal
        isOpen={refundModalOpen}
        onClose={() => { setRefundModalOpen(false); setActiveReturnForAction(null); }}
        returnObj={activeReturnForAction}
        onConfirm={handleConfirmRefund}
        isSubmitting={modalSubmitting}
      />

      <AdminPrintReturnSlipModal
        isOpen={slipModalOpen}
        onClose={() => { setSlipModalOpen(false); setActiveReturnForAction(null); }}
        returnObj={activeReturnForAction}
      />

      {notice && (
        <div className="returns-toast">
          <span />
          {notice}
        </div>
      )}
    </div>
  );
}
