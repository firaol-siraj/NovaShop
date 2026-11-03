import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminApi from '../../lib/api/adminApi';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import AdminCreateDiscountModal from '../../components/admin/AdminCreateDiscountModal';
import AdminDiscountUsageDrawer from '../../components/admin/AdminDiscountUsageDrawer';
import './admin-discounts.css';

const DATE_FILTERS = [
  { key: 'All', label: 'All dates' },
  { key: 'Ending soon', label: 'Ending soon' },
  { key: 'Starting soon', label: 'Starting soon' },
  { key: 'No end date', label: 'No end date' },
  { key: 'Already ended', label: 'Already ended' },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getUsagePercentage(discount) {
  if (!discount.limit || discount.limit <= 0) {
    return 0;
  }
  return Math.min((discount.used / discount.limit) * 100, 100);
}

function getUsageClass(discount) {
  if (!discount.limit) {
    return 'is-unlimited';
  }
  const percentage = getUsagePercentage(discount);
  if (percentage >= 90) {
    return 'is-warning';
  }
  return '';
}

function DiscountStatus({ status }) {
  const normalized = (status || 'active').toLowerCase();
  return (
    <span className={`discounts-status-pill ${normalized}`}>
      <i />
      {status}
    </span>
  );
}

function FilterDropdown({ label, value, options, onChange, isOpen, onToggle }) {
  const isActive = value !== 'All';

  return (
    <div className="discounts-filter-dropdown">
      <button
        type="button"
        className={`discounts-filter-button${isActive ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{isActive ? value : label}</span>
        <AdminIcon name="chevron" size={13} />
      </button>

      {isOpen && (
        <div className="discounts-filter-menu" role="listbox">
          {options.map((option) => {
            const optionKey = typeof option === 'string' ? option : option.key;
            const optionLabel = typeof option === 'string' ? option : option.label;

            return (
              <button
                key={optionKey}
                type="button"
                role="option"
                aria-selected={value === optionKey}
                className={value === optionKey ? 'is-selected' : ''}
                onClick={() => onChange(optionKey)}
              >
                {optionLabel}
                {value === optionKey && <AdminIcon name="check" size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminDiscountsPage({ go }) {
  // Query state
  const [discounts, setDiscounts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [appliesToFilter, setAppliesToFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [notice, setNotice] = useState('');

  // Auxiliary catalog data for modals
  const [categoriesList, setCategoriesList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // Statistics KPI state
  const [stats, setStats] = useState({
    activeCount: 0,
    activeTrend: '-',
    scheduledCount: 0,
    scheduledTrend: '-',
    totalRedemptions: 0,
    redemptionsTrend: '-',
    discountedRevenue: 0,
    discountedRevenueTrend: '-',
  });

  // Modal & Drawer states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [discountToEdit, setDiscountToEdit] = useState(null);
  const [usageDrawerOpen, setUsageDrawerOpen] = useState(false);
  const [usageDiscount, setUsageDiscount] = useState(null);
  const [usageRedemptions, setUsageRedemptions] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [confirmDeleteDiscount, setConfirmDeleteDiscount] = useState(null);

  // Portal row menu state
  const [menuTarget, setMenuTarget] = useState(null);
  const triggerRefs = useRef({});
  const toolbarRef = useRef(null);

  const notify = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(window.__novaDiscountToast);
    window.__novaDiscountToast = window.setTimeout(() => setNotice(''), 2400);
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories and products for applies-to picker
  useEffect(() => {
    adminApi
      .getCategories()
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setCategoriesList(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    adminApi
      .getProducts({ page: 1, limit: 100 })
      .then((res) => {
        const data = res.data?.data?.products || res.data?.products || res.data?.data || [];
        setProductsList(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  // Fetch discounts from backend
  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: parseInt(pageSize, 10) || 10,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter.toLowerCase() : undefined,
        type: typeFilter !== 'All' ? typeFilter : undefined,
        appliesTo: appliesToFilter !== 'All' ? appliesToFilter : undefined,
        dateRange: dateFilter !== 'All' ? dateFilter : undefined,
      };

      const res = await adminApi.getDiscounts(params);
      if (res && res.data) {
        const payload = res.data.data || res.data;
        setDiscounts(payload.discounts || []);
        setTotalCount(payload.total || 0);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (typeof go === 'function') go('/admin/signin');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to load discounts.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, typeFilter, appliesToFilter, dateFilter, go]);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getDiscountStats();
      if (res && res.data) {
        const payload = res.data.data || res.data;
        if (payload.stats) {
          setStats(payload.stats);
        }
      }
    } catch (err) {
      console.warn('Unable to load discount KPI stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const typeOptions = ['All', 'Percentage', 'Fixed amount', 'Free shipping'];
  const appliesToOptions = ['All', 'All products', 'Specific categories', 'Specific products'];

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setMenuTarget(null);
        setConfirmDeleteDiscount(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown((current) => (current === name ? null : name));
  };

  const allVisibleSelected =
    discounts.length > 0 &&
    discounts.every((discount) => selectedIds.includes(discount.id));

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !discounts.some((discount) => discount.id === id)
        )
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([
        ...current,
        ...discounts.map((discount) => discount.id),
      ]),
    ]);
  };

  const copyCode = async (discount) => {
    try {
      await navigator.clipboard.writeText(discount.code);
      setCopiedCode(discount.id);
      notify(`${discount.code} copied to clipboard.`);
      window.setTimeout(() => {
        setCopiedCode((current) => (current === discount.id ? null : current));
      }, 1500);
    } catch {
      notify(`Code: ${discount.code}`);
    }
  };

  const exportDiscounts = async () => {
    try {
      notify('Exporting discounts…');
      const res = await adminApi.exportDiscountsCsv();
      const url = URL.createObjectURL(
        new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'novashop-discounts.csv';
      link.click();
      URL.revokeObjectURL(url);
      notify('Discounts exported successfully.');
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Export failed');
    }
  };

  // Actions
  const handleSaveDiscount = async (payload, existingDiscount) => {
    if (existingDiscount) {
      await adminApi.updateDiscount(existingDiscount.id || existingDiscount._id, payload);
      notify(`Discount "${payload.code}" updated.`);
    } else {
      await adminApi.createDiscount(payload);
      notify(`Discount "${payload.code}" created.`);
    }
    await fetchDiscounts();
    await fetchStats();
  };

  const handleDuplicate = async (discount) => {
    try {
      const res = await adminApi.duplicateDiscount(discount.id);
      const duplicated = res.data?.data?.discount || res.data?.discount;
      notify(`Discount "${discount.code}" duplicated.`);
      await fetchDiscounts();
      await fetchStats();
      if (duplicated) {
        setDiscountToEdit(duplicated);
        setCreateModalOpen(true);
      }
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Duplicate failed');
    }
  };

  const handleToggleStatus = async (discount) => {
    try {
      const isActiveOrScheduled =
        discount.status === 'Active' || discount.status === 'Scheduled';
      if (isActiveOrScheduled) {
        await adminApi.endDiscount(discount.id);
        notify(`Discount "${discount.code}" deactivated.`);
      } else {
        await adminApi.updateDiscount(discount.id, {
          status: 'active',
          endsAt: null,
        });
        notify(`Discount "${discount.code}" activated.`);
      }
      await fetchDiscounts();
      await fetchStats();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Status update failed');
    }
  };

  const openUsageDrawer = async (discount) => {
    setUsageDiscount(discount);
    setUsageLoading(true);
    setUsageDrawerOpen(true);
    try {
      const res = await adminApi.getDiscountRedemptions(discount.id);
      const data = res.data?.data?.redemptions || res.data?.redemptions || [];
      setUsageRedemptions(Array.isArray(data) ? data : []);
    } catch (err) {
      notify('Unable to load redemptions list.');
      setUsageRedemptions([]);
    } finally {
      setUsageLoading(false);
    }
  };

  const handleDelete = async (discountId, discountName) => {
    try {
      await adminApi.deleteDiscount(discountId);
      setConfirmDeleteDiscount(null);
      notify(`Discount "${discountName || 'Item'}" deleted.`);
      await fetchDiscounts();
      await fetchStats();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Delete failed');
    }
  };

  const handleBulkAction = async (action) => {
    if (!selectedIds.length) return;

    if (action === 'delete') {
      if (!window.confirm(`Delete ${selectedIds.length} selected discount(s)?`)) return;
    }

    try {
      await adminApi.bulkUpdateDiscounts(selectedIds, action);
      setSelectedIds([]);
      notify(`Bulk action "${action}" completed.`);
      fetchDiscounts();
      fetchStats();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Bulk action failed');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setTypeFilter('All');
    setAppliesToFilter('All');
    setDateFilter('All');
    setPage(1);
  };

  const parsedPageSize = parseInt(pageSize, 10) || 10;
  const totalPages = Math.max(1, Math.ceil(totalCount / parsedPageSize));
  const startItem = totalCount === 0 ? 0 : (page - 1) * parsedPageSize + 1;
  const endItem = Math.min(page * parsedPageSize, totalCount);

  return (
    <div className="admin-dashboard discounts-page">
      {/* PAGE HEADER */}
      <section className="admin-page-heading discounts-page-heading">
        <div>
          <h1 className="admin-page-title">Discounts</h1>
          <p className="admin-page-description">
            Create and manage discount codes and automatic discounts.
          </p>
        </div>

        <div className="admin-page-actions">
          <button
            className="admin-action-button"
            type="button"
            onClick={exportDiscounts}
          >
            <AdminIcon name="download" size={15} />
            Export
          </button>

          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => {
              setDiscountToEdit(null);
              setCreateModalOpen(true);
            }}
          >
            <AdminIcon name="plus" size={15} />
            Add Discount
          </button>
        </div>
      </section>

      <div className="discounts-kpi-label">LAST 30 DAYS</div>

      {/* KPI ROW */}
      <section className="admin-stat-grid discounts-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Active discounts</span>
            <span className="admin-trend-pill">{stats.activeTrend || '-'}</span>
          </div>
          <div className="admin-stat-value">{stats.activeCount || 0}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Scheduled</span>
            <span className="admin-trend-pill">{stats.scheduledTrend || '-'}</span>
          </div>
          <div className="admin-stat-value">{stats.scheduledCount || 0}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total redemptions</span>
            <span className="admin-trend-pill">{stats.redemptionsTrend || '-'}</span>
          </div>
          <div className="admin-stat-value">{formatNumber(stats.totalRedemptions)}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Discounted revenue</span>
            <span className="admin-trend-pill">{stats.discountedRevenueTrend || '-'}</span>
          </div>
          <div className="admin-stat-value">{formatCurrency(stats.discountedRevenue)}</div>
        </article>
      </section>

      {/* SEARCH / FILTER TOOLBAR */}
      <section className="discounts-catalog-toolbar" ref={toolbarRef}>
        <div className="discounts-filter-row">
          <label className="products-search-field discounts-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or code"
              aria-label="Search by name or code"
            />
          </label>

          <FilterDropdown
            label="Type"
            value={typeFilter}
            options={typeOptions}
            onChange={(val) => {
              setTypeFilter(val);
              setOpenDropdown(null);
              setPage(1);
            }}
            isOpen={openDropdown === 'type'}
            onToggle={() => toggleDropdown('type')}
          />

          <FilterDropdown
            label="Applies to"
            value={appliesToFilter}
            options={appliesToOptions}
            onChange={(val) => {
              setAppliesToFilter(val);
              setOpenDropdown(null);
              setPage(1);
            }}
            isOpen={openDropdown === 'appliesTo'}
            onToggle={() => toggleDropdown('appliesTo')}
          />

          <FilterDropdown
            label="Dates"
            value={dateFilter}
            options={DATE_FILTERS}
            onChange={(val) => {
              setDateFilter(val);
              setOpenDropdown(null);
              setPage(1);
            }}
            isOpen={openDropdown === 'dates'}
            onToggle={() => toggleDropdown('dates')}
          />
        </div>

        <div className="discounts-quick-row">
          <div
            className="discounts-quick-filters"
            role="group"
            aria-label="Discount filters"
          >
            {['All', 'Active', 'Scheduled', 'Expired'].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`discounts-quick-filter${
                  statusFilter === filter ? ' is-active' : ''
                }`}
                onClick={() => {
                  setStatusFilter(filter);
                  setPage(1);
                }}
                aria-pressed={statusFilter === filter}
              >
                {filter !== 'All' && (
                  <i className={filter.toLowerCase()} />
                )}
                {filter}
              </button>
            ))}
          </div>

          {(typeFilter !== 'All' ||
            appliesToFilter !== 'All' ||
            dateFilter !== 'All' ||
            statusFilter !== 'All' ||
            search) && (
            <button
              type="button"
              className="discounts-clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* TABLE */}
      <section className="discounts-table-card" aria-label="Discounts">
        <div className="discounts-table-scroll">
          <table className="discounts-table">
            <thead>
              <tr>
                <th className="discounts-checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all discounts"
                  />
                </th>

                <th>DISCOUNT</th>
                <th>TYPE</th>
                <th>APPLIES TO</th>
                <th>USED</th>
                <th>DATES</th>
                <th>STATUS</th>
                <th className="discounts-actions-heading">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                // SKELETON ROWS
                [1, 2, 3, 4, 5].map((sId) => (
                  <tr key={sId}>
                    <td className="discounts-checkbox-cell">
                      <div style={{ width: 16, height: 16, background: 'var(--bg-surface-raised)', borderRadius: 4 }} />
                    </td>
                    <td className="discounts-name-cell">
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ width: 120, height: 14, background: 'var(--bg-surface-raised)', borderRadius: 3 }} />
                        <div style={{ width: 80, height: 12, background: 'var(--bg-surface-sunken)', borderRadius: 3 }} />
                      </div>
                    </td>
                    <td><div style={{ width: 80, height: 14, background: 'var(--bg-surface-raised)', borderRadius: 3 }} /></td>
                    <td><div style={{ width: 100, height: 14, background: 'var(--bg-surface-raised)', borderRadius: 3 }} /></td>
                    <td><div style={{ width: 70, height: 14, background: 'var(--bg-surface-raised)', borderRadius: 3 }} /></td>
                    <td><div style={{ width: 110, height: 14, background: 'var(--bg-surface-raised)', borderRadius: 3 }} /></td>
                    <td><div style={{ width: 65, height: 20, background: 'var(--bg-surface-raised)', borderRadius: 10 }} /></td>
                    <td className="discounts-actions-cell">
                      <div style={{ width: 24, height: 24, background: 'var(--bg-surface-raised)', borderRadius: 4 }} />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan="8" className="discounts-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>{error}</strong>
                    <button type="button" onClick={fetchDiscounts}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : discounts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="discounts-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>No discounts match these filters.</strong>
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                discounts.map((discount) => {
                  const usagePercentage = getUsagePercentage(discount);
                  const usageClass = getUsageClass(discount);

                  return (
                    <tr key={discount.id}>
                      <td className="discounts-checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(discount.id)}
                          onChange={() => toggleSelected(discount.id)}
                          aria-label={`Select ${discount.name}`}
                        />
                      </td>

                      <td className="discounts-name-cell">
                        <div className="discounts-name-content">
                          <strong>{discount.name}</strong>

                          <div
                            className="discounts-code-row"
                            title={discount.created}
                          >
                            <span className="discounts-code">
                              {discount.code}
                            </span>

                            <button
                              type="button"
                              className="discounts-copy-button"
                              onClick={() => copyCode(discount)}
                              aria-label={`Copy ${discount.code}`}
                            >
                              <AdminIcon name="copy" size={12} />
                            </button>

                            {copiedCode === discount.id && (
                              <span className="discounts-copied">Copied</span>
                            )}
                          </div>

                          <span className="discounts-description">
                            {discount.description}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="discounts-main-text">
                          {discount.type}
                        </span>
                      </td>

                      <td>
                        <div className="discounts-main-text">
                          {discount.appliesTo}
                        </div>
                        <div className="discounts-subtext">
                          {discount.requirement}
                        </div>
                      </td>

                      <td>
                        <div className="discounts-used-text">
                          {formatNumber(discount.used)}
                          {' / '}
                          {discount.limit
                            ? formatNumber(discount.limit)
                            : 'Unlimited'}
                        </div>

                        {discount.limit && (
                          <div className="discounts-progress">
                            <span
                              className={usageClass}
                              style={{ width: `${usagePercentage}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="discounts-main-text">
                          {discount.end
                            ? `${discount.start} – ${discount.end}`
                            : discount.start}
                        </div>
                        <div className="discounts-subtext">
                          {discount.relativeDate}
                        </div>
                      </td>

                      <td>
                        <DiscountStatus status={discount.status} />
                      </td>

                      <td className="discounts-actions-cell">
                        <div className="discounts-row-menu-anchor">
                          <button
                            ref={(el) => (triggerRefs.current[discount.id] = el)}
                            type="button"
                            className="products-row-menu-button"
                            onClick={() => {
                              setMenuTarget(
                                menuTarget?.discount?.id === discount.id
                                  ? null
                                  : {
                                      discount,
                                      triggerRef: { current: triggerRefs.current[discount.id] },
                                    }
                              );
                            }}
                            aria-label={`Actions for ${discount.name}`}
                            aria-expanded={menuTarget?.discount?.id === discount.id}
                          >
                            <AdminIcon name="more" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="discounts-pagination">
          <span>
            Showing {startItem}–{endItem} of {totalCount} discounts
          </span>

          <div className="discounts-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(event.target.value);
                  setPage(1);
                }}
                aria-label="Discounts per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>

            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((c) => Math.max(1, c - 1))}
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (pNum) => (
                <button
                  type="button"
                  key={pNum}
                  className={page === pNum ? 'is-active' : ''}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              )
            )}
            {totalPages > 5 && <span>…</span>}
            {totalPages > 5 && (
              <button
                type="button"
                className={page === totalPages ? 'is-active' : ''}
                onClick={() => setPage(totalPages)}
              >
                {totalPages}
              </button>
            )}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="discounts-bulk-bar">
          <strong>{selectedIds.length} selected</strong>

          <button type="button" onClick={() => handleBulkAction('duplicate')}>
            <AdminIcon name="copy" size={14} />
            Duplicate
          </button>

          <button type="button" onClick={() => handleBulkAction('end')}>
            <AdminIcon name="stop" size={14} />
            End now
          </button>

          <button
            type="button"
            className="is-danger"
            onClick={() => handleBulkAction('delete')}
          >
            <AdminIcon name="trash" size={14} />
            Delete
          </button>

          <button
            className="discounts-bulk-clear"
            type="button"
            aria-label="Clear selection"
            onClick={() => setSelectedIds([])}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
      )}

      {/* PORTAL ROW ACTION MENU */}
      <AdminRowActionMenu
        isOpen={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        triggerRef={menuTarget?.triggerRef}
        header={{
          title: menuTarget?.discount?.name,
          subtitle: `${menuTarget?.discount?.code} · ${menuTarget?.discount?.description || ''}`,
        }}
        items={[
          {
            id: 'edit',
            label: 'Edit discount',
            icon: 'edit',
            onClick: () => {
              setDiscountToEdit(menuTarget.discount);
              setCreateModalOpen(true);
            },
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: 'copy',
            onClick: () => handleDuplicate(menuTarget.discount),
          },
          {
            id: 'toggle-status',
            label:
              menuTarget?.discount?.status === 'Active' || menuTarget?.discount?.status === 'Scheduled'
                ? 'Deactivate discount'
                : 'Activate discount',
            icon:
              menuTarget?.discount?.status === 'Active' || menuTarget?.discount?.status === 'Scheduled'
                ? 'stop'
                : 'check',
            onClick: () => handleToggleStatus(menuTarget.discount),
          },
          {
            id: 'redemptions-orders',
            label: 'View redemptions in orders',
            icon: 'bag',
            onClick: () => {
              if (go && menuTarget?.discount) {
                const codeOrId = menuTarget.discount.code || menuTarget.discount.id;
                go(`/admin/orders?discount=${encodeURIComponent(codeOrId)}`);
              }
            },
          },
          {
            id: 'redemptions',
            label: 'View usage analytics',
            icon: 'receipt',
            onClick: () => openUsageDrawer(menuTarget.discount),
          },
          {
            id: 'copy-code',
            label: 'Copy discount code',
            icon: 'code',
            onClick: () => copyCode(menuTarget.discount),
          },
          {
            id: 'divider',
            isDivider: true,
          },
          {
            id: 'delete',
            label: 'Delete discount',
            icon: 'trash',
            danger: true,
            onClick: () => setConfirmDeleteDiscount(menuTarget.discount),
          },
        ]}
      />

      {/* CREATE / EDIT DISCOUNT MODAL */}
      <AdminCreateDiscountModal
        discountToEdit={discountToEdit}
        categories={categoriesList}
        products={productsList}
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setDiscountToEdit(null);
        }}
        onSave={handleSaveDiscount}
      />

      {/* USAGE & REDEMPTIONS DRAWER */}
      <AdminDiscountUsageDrawer
        discount={usageDiscount}
        redemptions={usageRedemptions}
        loading={usageLoading}
        isOpen={usageDrawerOpen}
        onClose={() => {
          setUsageDrawerOpen(false);
          setUsageDiscount(null);
          setUsageRedemptions([]);
        }}
        go={go}
      />

      {/* CONFIRM DELETE DIALOG (WITH WARNING IF REDEEMED) */}
      {confirmDeleteDiscount && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-overlay, rgba(20, 18, 16, 0.75))',
            backdropFilter: 'blur(3px)',
            padding: '16px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              color: 'var(--text-primary)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
              Delete Discount "{confirmDeleteDiscount.code}"?
            </h3>

            {confirmDeleteDiscount.used > 0 ? (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-warning-soft)',
                  border: '1px solid var(--color-warning)',
                  color: 'var(--color-warning)',
                  fontSize: '13px',
                  marginBottom: '16px',
                  lineHeight: 1.4,
                }}
              >
                <strong>Warning:</strong> This promotion has already been redeemed{' '}
                <strong>{confirmDeleteDiscount.used} time(s)</strong>. Deleting it will deactivate the code for new checkouts while preserving audit and sales history.
              </div>
            ) : (
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this discount? This action cannot be undone.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteDiscount(null)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteDiscount.id, confirmDeleteDiscount.name)}
                style={{
                  height: '36px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-danger)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete Discount
              </button>
            </div>
          </div>
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
