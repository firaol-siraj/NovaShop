import { useMemo, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-return&refund.css';

const RETURN_DATA = [
  {
    id: 'RT-2041',
    order: 'NS-10431',
    customer: 'Amelia Chen',
    email: 'amelia.chen@email.com',
    itemCount: 1,
    reason: 'Wrong size',
    resolution: 'Refund',
    refund: '$890.00',
    requested: 'Sep 30, 2026',
    relativeDate: '1 day ago',
    status: 'requested',
    tracking: 'Prepaid label · Tracking pending',
  },
  {
    id: 'RT-2040',
    order: 'NS-10412',
    customer: 'James Okafor',
    email: 'james.okafor@email.com',
    itemCount: 1,
    reason: 'Not as described',
    resolution: 'Refund',
    refund: '$1,120.00',
    requested: 'Sep 29, 2026',
    relativeDate: '2 days ago',
    status: 'requested',
    tracking: 'Prepaid label · Tracking pending',
  },
  {
    id: 'RT-2038',
    order: 'NS-10398',
    customer: 'Lucas Meyer',
    email: 'lucas.meyer@email.com',
    itemCount: 1,
    reason: 'Defective',
    resolution: 'Refund',
    refund: '$420.00',
    requested: 'Sep 27, 2026',
    relativeDate: '4 days ago',
    status: 'approved',
    tracking: 'Return label issued',
  },
  {
    id: 'RT-2036',
    order: 'NS-10377',
    customer: 'Priya Raman',
    email: 'priya.raman@email.com',
    itemCount: 1,
    reason: 'Damaged on arrival',
    resolution: 'Refund',
    refund: '$240.00',
    requested: 'Sep 24, 2026',
    relativeDate: '1 week ago',
    status: 'approved',
    tracking: 'Return received',
  },
  {
    id: 'RT-2033',
    order: 'NS-10351',
    customer: 'Sofia Rossi',
    email: 'sofia.rossi@email.com',
    itemCount: 2,
    reason: 'Wrong size',
    resolution: 'Store credit',
    refund: '$1,020.00',
    requested: 'Sep 20, 2026',
    relativeDate: '11 days ago',
    status: 'received',
    tracking: '2 items received',
  },
  {
    id: 'RT-2029',
    order: 'NS-10320',
    customer: 'Hannah Becker',
    email: 'hannah.becker@email.com',
    itemCount: 1,
    reason: 'Changed mind',
    resolution: 'Refund',
    refund: '$1,450.00',
    requested: 'Sep 14, 2026',
    relativeDate: '2 weeks ago',
    status: 'refunded',
    tracking: 'Refund completed',
  },
  {
    id: 'RT-2025',
    order: 'NS-10294',
    customer: 'Oliver Grant',
    email: 'oliver.grant@email.com',
    itemCount: 1,
    reason: 'Wrong size',
    resolution: 'Refund',
    refund: '$540.00',
    requested: 'Sep 08, 2026',
    relativeDate: '3 weeks ago',
    status: 'refunded',
    tracking: 'Refund completed',
  },
  {
    id: 'RT-2021',
    order: 'NS-10260',
    customer: 'Noah Williams',
    email: 'noah.williams@email.com',
    itemCount: 1,
    reason: 'Changed mind',
    resolution: 'Refund',
    refund: '$1,120.00',
    requested: 'Aug 30, 2026',
    relativeDate: '1 month ago',
    status: 'rejected',
    tracking: 'Return rejected',
  },
];

const STATUS_TABS = [
  { id: 'all', label: 'All', count: null },
  { id: 'requested', label: 'Requested', count: 18 },
  { id: 'approved', label: 'Approved', count: null },
  { id: 'received', label: 'Received', count: null },
  { id: 'refunded', label: 'Refunded', count: null },
  { id: 'rejected', label: 'Rejected', count: null },
];

function StatusDot({ status }) {
  return <i className={`returns-status-dot ${status}`} aria-hidden="true" />;
}

function ItemPreview({ itemCount }) {
  return (
    <div className="returns-item-preview">
      <span className="returns-item-thumb">
        <span />
      </span>

      {itemCount > 1 && (
        <span className="returns-item-count">+{itemCount - 1}</span>
      )}
    </div>
  );
}

export default function AdminReturnsPage({ go }) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [resolutionFilter, setResolutionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('30');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(['RT-2041', 'RT-2040']);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [notice, setNotice] = useState('');

  const filteredReturns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return RETURN_DATA.filter((item) => {
      const matchesTab =
        activeTab === 'all' || item.status === activeTab;

      const matchesSearch =
        !query ||
        item.id.toLowerCase().includes(query) ||
        item.order.toLowerCase().includes(query) ||
        item.customer.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query);

      const matchesReason =
        reasonFilter === 'all' || item.reason === reasonFilter;

      const matchesResolution =
        resolutionFilter === 'all' ||
        item.resolution === resolutionFilter;

      return (
        matchesTab &&
        matchesSearch &&
        matchesReason &&
        matchesResolution
      );
    });
  }, [
    activeTab,
    search,
    reasonFilter,
    resolutionFilter,
  ]);

  const allVisibleSelected =
    filteredReturns.length > 0 &&
    filteredReturns.every((item) => selectedIds.includes(item.id));

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
          (id) => !filteredReturns.some((item) => item.id === id)
        )
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([
        ...current,
        ...filteredReturns.map((item) => item.id),
      ]),
    ]);
  };

  const showNotice = (message) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice('');
    }, 2200);
  };

  const handleApprove = () => {
    if (!selectedIds.length) return;

    showNotice(
      `${selectedIds.length} return request${
        selectedIds.length === 1 ? '' : 's'
      } approved`
    );
  };

  const handleReject = () => {
    if (!selectedIds.length) return;

    showNotice(
      `${selectedIds.length} return request${
        selectedIds.length === 1 ? '' : 's'
      } marked for rejection`
    );
  };

  const handleExport = () => {
    showNotice('Return report exported');
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleViewReturn = (item) => {
    setOpenMenuId(null);

    if (go) {
      go(`/admin/returns/${item.id}`);
      return;
    }

    showNotice(`Opened ${item.id}`);
  };

  return (
    <div
      className="returns-page"
      onClick={() => setOpenMenuId(null)}
    >
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
        Last 30 days
      </div>

      <section className="returns-stat-grid admin-stat-grid">
        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              TOTAL RETURNS
            </span>

            <span className="returns-warning-pill">
              +12 this month
            </span>
          </div>

          <strong className="admin-stat-value">142</strong>
        </article>

        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              PENDING REQUESTS
            </span>

            <span className="returns-warning-pill">
              +5 this week
            </span>
          </div>

          <strong className="admin-stat-value">18</strong>
        </article>

        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              REFUNDED AMOUNT
            </span>

            <span className="returns-danger-pill">
              +$4,200
            </span>
          </div>

          <strong className="admin-stat-value">
            $38,640
          </strong>
        </article>

        <article className="admin-stat-card returns-stat-card">
          <div className="admin-stat-topline">
            <span className="admin-stat-label">
              RETURN RATE
            </span>

            <span className="returns-danger-pill">
              +0.4%
            </span>
          </div>

          <strong className="admin-stat-value">
            3.1%
          </strong>
        </article>
      </section>

      <section className="returns-catalog-toolbar">
        <div className="returns-filter-row">
          <label className="returns-search-field">
            <AdminIcon name="search" size={13} />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by return, order, or customer"
            />
          </label>

          <select
            value={reasonFilter}
            onChange={(event) =>
              setReasonFilter(event.target.value)
            }
            aria-label="Filter by reason"
          >
            <option value="all">Reason</option>
            <option value="Wrong size">Wrong size</option>
            <option value="Defective">Defective</option>
            <option value="Not as described">
              Not as described
            </option>
            <option value="Damaged on arrival">
              Damaged on arrival
            </option>
            <option value="Changed mind">Changed mind</option>
          </select>

          <select
            value={resolutionFilter}
            onChange={(event) =>
              setResolutionFilter(event.target.value)
            }
            aria-label="Filter by resolution"
          >
            <option value="all">Resolution</option>
            <option value="Refund">Refund</option>
            <option value="Store credit">Store credit</option>
          </select>

          <select
            value={dateFilter}
            onChange={(event) =>
              setDateFilter(event.target.value)
            }
            aria-label="Filter by date"
          >
            <option value="30">Date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        <div className="returns-status-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`returns-status-tab ${
                activeTab === tab.id ? 'is-active' : ''
              }`}
              onClick={() => setActiveTab(tab.id)}
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
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredReturns.length > 0 ? (
                filteredReturns.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'is-selected' : ''}
                    >
                      <td className="returns-checkbox-cell">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleSelection(item.id)
                          }
                          aria-label={`Select ${item.id}`}
                        />
                      </td>

                      <td>
                        <div className="returns-id-cell">
                          <strong>#{item.id}</strong>

                          <span>Order</span>

                          <small>#{item.order}</small>
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
                            itemCount={item.itemCount}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="returns-reason-cell">
                          <strong>{item.reason}</strong>
                          <span>{item.resolution}</span>
                        </div>
                      </td>

                      <td>
                        <strong className="returns-refund-value">
                          {item.refund}
                        </strong>
                      </td>

                      <td>
                        <div className="returns-requested-cell">
                          <strong>{item.requested}</strong>
                          <span>{item.relativeDate}</span>
                        </div>
                      </td>

                      <td className="returns-actions-cell">
                        <div
                          className="returns-row-menu-anchor"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <button
                            type="button"
                            className="returns-more-button"
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === item.id
                                  ? null
                                  : item.id
                              )
                            }
                            aria-label={`Actions for ${item.id}`}
                          >
                            <AdminIcon
                              name="more"
                              size={15}
                            />
                          </button>

                          {openMenuId === item.id && (
                            <div className="returns-row-menu">
                              <div className="returns-row-menu-tooltip">
                                {item.tracking}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleViewReturn(item)}
                              >
                                <AdminIcon
                                  name="eye"
                                  size={12}
                                />
                                View return
                              </button>

                              <button
                                type="button"
                                onClick={() => handleViewReturn(item)}
                              >
                                <AdminIcon
                                  name="credit-card"
                                  size={12}
                                />
                                Manage refund
                              </button>
                            </div>
                          )}
                        </div>
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

                    <strong>No returns found</strong>

                    <span>
                      Try adjusting your search or filters.
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setActiveTab('all');
                        setReasonFilter('all');
                        setResolutionFilter('all');
                      }}
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="returns-pagination">
          <span>
            Showing <strong>1–{filteredReturns.length}</strong>{' '}
            of 142 returns
          </span>

          <div className="returns-pagination-controls">
            <label>
              10
              <select defaultValue="10" aria-label="Rows per page">
                <option value="10">/ page</option>
                <option value="25">/ page</option>
                <option value="50">/ page</option>
              </select>
            </label>

            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              Previous
            </button>

            <button
              type="button"
              className={page === 1 ? 'is-active' : ''}
              onClick={() => setPage(1)}
            >
              1
            </button>

            <button type="button" className={page === 2 ? 'is-active' : ''} onClick={() => setPage(2)}>2</button>
            <button type="button" className={page === 3 ? 'is-active' : ''} onClick={() => setPage(3)}>3</button>

            <span>...</span>

            <button type="button" className={page === 15 ? 'is-active' : ''} onClick={() => setPage(15)}>15</button>

            <button
              type="button"
              disabled={page === 15}
              onClick={() => setPage(p => Math.min(15, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div
          className="returns-bulk-bar"
          onClick={(event) => event.stopPropagation()}
        >
          <strong>
            {selectedIds.length} selected
          </strong>

          <span className="returns-bulk-divider" />

          <button
            type="button"
            onClick={handleApprove}
          >
            <AdminIcon name="check-circle" size={12} />
            Approve
          </button>

          <button
            type="button"
            onClick={handleReject}
          >
            <AdminIcon name="x-circle" size={12} />
            Reject
          </button>

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

      {notice && (
        <div className="returns-toast">
          <span />
          {notice}
        </div>
      )}
    </div>
  );
}