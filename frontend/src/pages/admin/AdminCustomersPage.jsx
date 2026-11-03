import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../lib/api/adminApi';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import AdminSendEmailModal from '../../components/admin/AdminSendEmailModal';
import { BlockCustomerModal, SafeDeleteCustomerModal } from '../../components/admin/AdminCustomerModals';
import './admin-customers.css';

const money = (amount) =>
  `$${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function CustomerStatus({ status = 'Active' }) {
  const safeStatus = String(status || 'Active');
  return (
    <span className={`customers-status-pill ${safeStatus.toLowerCase()}`}>
      <i />
      {safeStatus}
    </span>
  );
}

export default function AdminCustomersPage({ go, search: searchProp }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [kpiMetrics, setKpiMetrics] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    blockedCustomers: 0,
    newThisMonth: 0,
    repeatRate: '-',
    percentChange: '-',
  });

  const [search, setSearch] = useState(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      return sp.get('search') || sp.get('q') || '';
    } catch {
      return '';
    }
  });
  const [countryFilter, setCountryFilter] = useState('All countries');
  const [spendFilter, setSpendFilter] = useState('All spending');
  const [joinedFilter, setJoinedFilter] = useState('Any time');
  const [quickFilter, setQuickFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      return sp.get('customer') || sp.get('customerId') || '';
    } catch {
      return '';
    }
  });
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals and action menu states
  const [menuTarget, setMenuTarget] = useState(null); // { customer, triggerRef }
  const [emailTargetCustomer, setEmailTargetCustomer] = useState(null);
  const [blockTargetCustomer, setBlockTargetCustomer] = useState(null);
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState(null);

  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  useEffect(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      const cust = sp.get('customer') || sp.get('customerId') || '';
      const s = sp.get('search') || sp.get('q') || '';
      if (cust !== customerFilter) {
        setCustomerFilter(cust);
        setPage(1);
      }
      if (s !== search) {
        setSearch(s);
        setPage(1);
      }
    } catch {}
  }, [searchProp]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getCustomers({
        page,
        limit: Number(pageSize),
        search: search.trim() || undefined,
        customer: customerFilter || undefined,
        status:
          quickFilter === 'Active'
            ? 'active'
            : quickFilter === 'Blocked'
            ? 'blocked'
            : quickFilter === 'Inactive'
            ? 'inactive'
            : undefined,
      });

      const customerArray = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.customers)
        ? response.customers
        : Array.isArray(response?.data?.customers)
        ? response.data.customers
        : [];

      const list = customerArray.map((customer) => {
        const rawInitials = (customer.name || customer.email || 'U')
          .split(' ')
          .filter(Boolean)
          .map((s) => s[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const initials = rawInitials || 'U';

        const orderCount = Number(customer.paidOrdersCount || customer.ordersCount || 0);

        const statusLabel =
          customer.status === 'deactivated' || customer.status === 'blocked'
            ? 'Blocked'
            : customer.status === 'invited'
            ? 'Invited'
            : customer.status === 'unverified'
            ? 'Unverified'
            : customer.status === 'inactive'
            ? 'Inactive'
            : 'Active';

        return {
          id: customer._id || customer.id,
          name: customer.name || 'Unnamed Customer',
          email: customer.email || '—',
          initials,
          city: customer.city || '',
          country: customer.country || '',
          orders: orderCount,
          spent: Number(customer.totalSpent || 0),
          lastOrder:
            customer.lastOrderNumber ||
            (customer.lastOrderDate ? 'Paid order' : '—'),
          lastDate: customer.lastOrderDate
            ? new Date(customer.lastOrderDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'No orders yet',
          status: statusLabel,
          rawStatus: customer.status,
          isDeactivated: customer.status === 'deactivated' || customer.status === 'blocked',
          joinedAt: customer.createdAt,
          tags: customer.tags || [],
        };
      });

      const pagination = response?.pagination || response?.data?.pagination || {};
      const total = Number(pagination.total ?? customerArray.length);
      const calculatedPages = Math.max(1, Math.ceil(total / Number(pageSize)));
      const pages = Number(pagination.totalPages ?? calculatedPages);

      setCustomers(list);
      setTotalCount(total);
      setTotalPages(pages);

      // Use shared backend stats
      if (response?.stats) {
        setKpiMetrics({
          totalCustomers: Number(response.stats.totalCustomers || 0),
          activeCustomers: Number(response.stats.activeCustomers || 0),
          inactiveCustomers: Number(response.stats.inactiveCustomers || 0),
          blockedCustomers: Number(response.stats.blockedCustomers || 0),
          newThisMonth: Number(response.stats.newThisMonth || 0),
          repeatRate: response.stats.repeatRate ?? '-',
          percentChange: response.stats.percentChange ?? '-',
        });
      }

      setLoadError('');
    } catch (err) {
      setLoadError(
        err?.response?.data?.message || err.message || 'Unable to load customers.'
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, quickFilter, customerFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const countries = useMemo(() => {
    const list = new Set();
    customers.forEach((customer) => {
      if (customer.country && customer.country !== '—') list.add(customer.country);
    });
    return Array.from(list).sort();
  }, [customers]);

  const activeCustomerName = useMemo(() => {
    if (!customerFilter) return null;
    const match = customers.find((c) => c.id === customerFilter);
    return match ? `${match.name} (${match.email})` : customerFilter;
  }, [customerFilter, customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesCountry =
        countryFilter === 'All countries' || customer.country === countryFilter;
      const matchesSpend =
        spendFilter === 'All spending' ||
        (spendFilter === 'Over $10,000' && customer.spent >= 10000) ||
        (spendFilter === '$1,000–$10,000' &&
          customer.spent >= 1000 &&
          customer.spent < 10000) ||
        (spendFilter === 'Under $1,000' && customer.spent < 1000);
      const matchesJoined =
        joinedFilter === 'Any time' ||
        (joinedFilter === 'Last 30 days' &&
          new Date(customer.joinedAt) >=
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ||
        (joinedFilter === 'Last 90 days' &&
          new Date(customer.joinedAt) >=
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) ||
        (joinedFilter === 'This year' &&
          new Date(customer.joinedAt) >=
            new Date(new Date().getFullYear(), 0, 1));

      return matchesCountry && matchesSpend && matchesJoined;
    });
  }, [countryFilter, customers, joinedFilter, spendFilter]);

  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((customer) => selectedIds.includes(customer.id));

  const toggleCustomer = (id) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );

  const toggleVisible = () =>
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter(
            (id) => !filteredCustomers.some((customer) => customer.id === id)
          )
        : [
            ...current,
            ...filteredCustomers.map((customer) => customer.id),
          ]
    );

  const exportCustomers = (rows = filteredCustomers) => {
    const csvRows = [
      [
        'Name',
        'Email',
        'City',
        'Country',
        'Orders',
        'Lifetime spend',
        'Last order',
        'Status',
      ],
      ...rows.map((customer) => [
        customer.name,
        customer.email,
        customer.city,
        customer.country,
        customer.orders,
        money(customer.spent),
        customer.lastDate,
        customer.status,
      ]),
    ];
    const csv = csvRows
      .map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'novashop-customers.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmBlock = async (reason) => {
    if (!blockTargetCustomer) return;
    const isCurrentlyBlocked = blockTargetCustomer.isDeactivated;
    const nextStatus = isCurrentlyBlocked ? 'active' : 'blocked';
    try {
      await adminApi.updateCustomerStatus(blockTargetCustomer.id, nextStatus, reason);
      notify(
        isCurrentlyBlocked
          ? 'Customer unblocked and access restored.'
          : 'Customer blocked and sessions revoked.'
      );
      await loadCustomers();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Unable to change status.');
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTargetCustomer) return;
    try {
      await adminApi.deleteCustomer(deleteTargetCustomer.id);
      setSelectedIds((curr) => curr.filter((id) => id !== deleteTargetCustomer.id));
      notify('Customer record permanently deleted.');
      await loadCustomers();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Unable to delete customer.');
    }
  };

  const handleConfirmAnonymize = async () => {
    if (!deleteTargetCustomer) return;
    try {
      await adminApi.deleteCustomer(deleteTargetCustomer.id, 'anonymize');
      notify('Customer safely anonymized and deactivated. Order history preserved for accounting.');
      await loadCustomers();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Unable to anonymize customer.');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCountryFilter('All countries');
    setSpendFilter('All spending');
    setJoinedFilter('Any time');
    setQuickFilter('All');
  };

  return (
    <div className="admin-dashboard customers-page">
      <section className="admin-page-heading customers-page-heading">
        <div>
          <h1 className="admin-page-title">Customers</h1>
          <p className="admin-page-description">
            View and manage your customers, invitation links, and order history.
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            className="admin-action-button"
            type="button"
            onClick={() => exportCustomers(filteredCustomers)}
          >
            <AdminIcon name="download" size={15} /> Export
          </button>
          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => {
              if (go) go('/admin/customers/new');
            }}
          >
            <AdminIcon name="plus" size={15} /> Add Customer
          </button>
        </div>

        {customerFilter && (
          <div className="customers-active-chips" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', width: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Customer: <strong>{activeCustomerName}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setCustomerFilter('');
                  setPage(1);
                  if (go) go('/admin/customers');
                }}
                aria-label="Remove customer filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}
      </section>

      {/* Shared KPI Section */}
      <section
        className="customers-kpi-section"
        aria-label="Customer metrics summary"
      >
        <div className="customers-kpi-eyebrow">STOREFRONT CUSTOMERS</div>
        <div className="admin-stat-grid customers-stat-grid">
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Total customers</span>
              <span className="admin-trend-pill">
                {kpiMetrics.percentChange === '-'
                  ? '—'
                  : Number(kpiMetrics.percentChange) >= 0
                  ? `+${kpiMetrics.percentChange}%`
                  : `${kpiMetrics.percentChange}%`}
              </span>
            </div>
            <div className="admin-stat-value">
              {Number(kpiMetrics.totalCustomers || 0).toLocaleString('en-US')}
            </div>
          </article>

          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Active customers</span>
              <span className="admin-trend-pill">Active</span>
            </div>
            <div className="admin-stat-value">
              {Number(kpiMetrics.activeCustomers || 0).toLocaleString('en-US')}
            </div>
          </article>

          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">New this month</span>
              <span className="admin-trend-pill">New</span>
            </div>
            <div className="admin-stat-value">
              {Number(kpiMetrics.newThisMonth || 0).toLocaleString('en-US')}
            </div>
          </article>

          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Repeat customers</span>
              <span className="admin-trend-pill">
                {kpiMetrics.repeatRate === '-' ? '—' : `${kpiMetrics.repeatRate}%`}
              </span>
            </div>
            <div className="admin-stat-value">
              {kpiMetrics.repeatRate === '-' ? '—' : `${kpiMetrics.repeatRate}%`}
            </div>
          </article>
        </div>

        {customerFilter && (
          <div className="customers-active-chips" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', width: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Customer: <strong>{activeCustomerName}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setCustomerFilter('');
                  setPage(1);
                  if (go) go('/admin/customers');
                }}
                aria-label="Remove customer filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}
      </section>

      {loading && (
        <p className="customers-empty-state" role="status">
          Loading customer directory…
        </p>
      )}
      {loadError && (
        <p className="customers-empty-state" role="alert">
          {loadError}{' '}
          <button type="button" onClick={loadCustomers}>
            Retry
          </button>
        </p>
      )}

      {/* Filters and Toolbar */}
      <section
        className="customers-catalog-toolbar"
        aria-label="Customer filters"
      >
        <div className="customers-filter-row">
          <label className="products-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email"
              aria-label="Search by name or email"
            />
          </label>
          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            aria-label="Filter by country"
          >
            <option>All countries</option>
            {countries.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
          <select
            value={spendFilter}
            onChange={(event) => setSpendFilter(event.target.value)}
            aria-label="Filter by total spent"
          >
            <option>All spending</option>
            <option>Over $10,000</option>
            <option>$1,000–$10,000</option>
            <option>Under $1,000</option>
          </select>
          <select
            value={joinedFilter}
            onChange={(event) => setJoinedFilter(event.target.value)}
            aria-label="Filter by joined"
          >
            <option>Any time</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
        </div>

        {/* Quick Filter Tabs with verified count summing */}
        <div
          className="customers-quick-filters"
          role="group"
          aria-label="Customer status filters"
        >
          {[
            { key: 'All', count: kpiMetrics.totalCustomers },
            { key: 'Active', count: kpiMetrics.activeCustomers },
            { key: 'Inactive', count: kpiMetrics.inactiveCustomers },
            { key: 'Blocked', count: kpiMetrics.blockedCustomers },
          ].map(({ key, count }) => (
            <button
              type="button"
              key={key}
              className={`customers-quick-filter${
                quickFilter === key ? ' is-active' : ''
              }`}
              aria-pressed={quickFilter === key}
              onClick={() => {
                setQuickFilter(key);
                setPage(1);
              }}
            >
              {key !== 'All' && <i className={key.toLowerCase()} />}
              {key} ({count})
            </button>
          ))}
        </div>

        {customerFilter && (
          <div className="customers-active-chips" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', width: '100%' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}>
              <span>Customer: <strong>{activeCustomerName}</strong></span>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setCustomerFilter('');
                  setPage(1);
                  if (go) go('/admin/customers');
                }}
                aria-label="Remove customer filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}
      </section>

      {/* Customers Table */}
      <section
        className="customers-table-card"
        aria-label="Customer directory"
      >
        <div className="customers-table-scroll">
          <table className="customers-table">
            <thead>
              <tr>
                <th className="customers-check-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisible}
                    aria-label="Select all visible customers"
                  />
                </th>
                <th>CUSTOMER</th>
                <th>LOCATION</th>
                <th>ORDERS</th>
                <th>TOTAL SPENT</th>
                <th>LAST ORDER</th>
                <th>STATUS</th>
                <th className="customers-actions-heading">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="customers-check-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(customer.id)}
                      onChange={() => toggleCustomer(customer.id)}
                      aria-label={`Select ${customer.name}`}
                    />
                  </td>
                  <td className="customers-name-cell">
                    <div className="customers-profile-cell">
                      <span
                        className={`customers-avatar tone-${
                          ((customer.initials || 'U').charCodeAt(0) || 0) % 5
                        }`}
                      >
                        {customer.initials}
                      </span>
                      <div>
                        <strong>{customer.name}</strong>
                        <span>{customer.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {customer.city && customer.country ? (
                      <div className="customers-location-cell">
                        <strong>{customer.city}</strong>
                        <span>{customer.country}</span>
                      </div>
                    ) : customer.city || customer.country ? (
                      <div className="customers-location-cell">
                        <strong>{customer.city || customer.country}</strong>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td>{customer.orders}</td>
                  <td className="customers-spent-cell">
                    {money(customer.spent)}
                  </td>
                  <td>
                    <div className="customers-last-order">
                      <strong>{customer.lastOrder}</strong>
                      <span>{customer.lastDate}</span>
                    </div>
                  </td>
                  <td>
                    <CustomerStatus status={customer.status} />
                  </td>
                  <td className="customers-actions-cell">
                    <div className="customers-menu-anchor">
                      <button
                        className="products-row-menu-button"
                        type="button"
                        aria-label={`More actions for ${customer.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuTarget?.customer?.id === customer.id}
                        onClick={(e) => {
                          const buttonElement = e.currentTarget;
                          setMenuTarget((curr) =>
                            curr?.customer?.id === customer.id
                              ? null
                              : { customer, triggerRef: { current: buttonElement } }
                          );
                        }}
                      >
                        <AdminIcon name="more" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="customers-empty-state">
                    <strong>No customers match the current filter</strong>
                    <button type="button" onClick={clearFilters}>
                      Clear all filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <footer className="customers-pagination">
          <div>
            Showing {(page - 1) * Number(pageSize) + (filteredCustomers.length > 0 ? 1 : 0)}–
            {Math.min(page * Number(pageSize), totalCount)} of {totalCount} customers
          </div>
          <div className="customers-pagination-controls">
            <label>
              Per page:
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(event.target.value);
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </footer>
      </section>

      {/* Row Action Menu rendered in Portal */}
      <AdminRowActionMenu
        customer={menuTarget?.customer}
        isOpen={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        triggerRef={menuTarget?.triggerRef}
        onView={() => {
          if (go && menuTarget?.customer?.id) go(`/admin/customers/${menuTarget.customer.id}`);
        }}
        onEdit={() => {
          if (go && menuTarget?.customer?.id) go(`/admin/customers/${menuTarget.customer.id}/edit`);
        }}
        onViewOrders={() => {
          if (go && menuTarget?.customer?.id) go(`/admin/orders?customer=${menuTarget.customer.id}`);
        }}
        onSendEmail={() => {
          setEmailTargetCustomer(menuTarget?.customer);
        }}
        onToggleBlock={() => {
          setBlockTargetCustomer(menuTarget?.customer);
        }}
        onDelete={() => {
          setDeleteTargetCustomer(menuTarget?.customer);
        }}
      />

      {/* Send Email Modal */}
      <AdminSendEmailModal
        customer={emailTargetCustomer}
        isOpen={Boolean(emailTargetCustomer)}
        onClose={() => setEmailTargetCustomer(null)}
        onSuccess={(msg) => {
          notify(msg);
          loadCustomers();
        }}
      />

      {/* Block / Reactivate Modal */}
      <BlockCustomerModal
        customer={blockTargetCustomer}
        isOpen={Boolean(blockTargetCustomer)}
        onClose={() => setBlockTargetCustomer(null)}
        onConfirm={handleConfirmBlock}
      />

      {/* Safe Delete / Anonymize Modal */}
      <SafeDeleteCustomerModal
        customer={deleteTargetCustomer}
        isOpen={Boolean(deleteTargetCustomer)}
        onClose={() => setDeleteTargetCustomer(null)}
        onConfirmPermanentDelete={handleConfirmPermanentDelete}
        onConfirmAnonymize={handleConfirmAnonymize}
      />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}
