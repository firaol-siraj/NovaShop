import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-discounts.css';

const INITIAL_DISCOUNTS = [
  {
    id: 'DSC-0031',
    name: 'AUTUMN20',
    code: 'AUTUMN20',
    description: '20% off',
    type: 'Percentage',
    appliesTo: 'All products',
    requirement: 'No minimum',
    used: 142,
    limit: 500,
    start: 'Sep 01',
    end: 'Oct 31, 2026',
    relativeDate: '30 days left',
    status: 'Active',
    created: 'Created Aug 20, 2026 · DSC-0031',
  },
  {
    id: 'DSC-0032',
    name: 'SHIPFREE',
    code: 'SHIPFREE',
    description: 'Free shipping',
    type: 'Free shipping',
    appliesTo: 'All products',
    requirement: 'Min. spend $300',
    used: 389,
    limit: null,
    start: 'Sep 01',
    end: 'Dec 31, 2026',
    relativeDate: '91 days left',
    status: 'Active',
    created: 'Created Aug 18, 2026 · DSC-0032',
  },
  {
    id: 'DSC-0033',
    name: 'WELCOME10',
    code: 'WELCOME10',
    description: '10% off',
    type: 'Percentage',
    appliesTo: 'All products',
    requirement: 'First order only',
    used: 1204,
    limit: null,
    start: 'Starts Jan 05, 2026',
    end: '',
    relativeDate: 'No end date',
    status: 'Active',
    created: 'Created Aug 12, 2026 · DSC-0033',
  },
  {
    id: 'DSC-0034',
    name: 'COAT15',
    code: 'COAT15',
    description: 'Outerwear Event',
    type: 'Percentage',
    appliesTo: 'Outerwear',
    requirement: 'No minimum',
    used: 87,
    limit: 200,
    start: 'Sep 15',
    end: 'Oct 15, 2026',
    relativeDate: '14 days left',
    status: 'Active',
    created: 'Created Sep 01, 2026 · DSC-0034',
  },
  {
    id: 'DSC-0035',
    name: 'HOLIDAY25',
    code: 'HOLIDAY25',
    description: 'Holiday Gift',
    type: 'Fixed amount',
    appliesTo: 'All products',
    requirement: 'Min. spend $150',
    used: 0,
    limit: 1000,
    start: 'Dec 01',
    end: 'Dec 26, 2026',
    relativeDate: 'Starts in 61 days',
    status: 'Scheduled',
    created: 'Created Sep 10, 2026 · DSC-0035',
  },
  {
    id: 'DSC-0036',
    name: 'BF30',
    code: 'BF30',
    description: 'Black Friday',
    type: 'Percentage',
    appliesTo: '2 collections',
    requirement: 'No minimum',
    used: 0,
    limit: 2000,
    start: 'Nov 27',
    end: 'Nov 30, 2026',
    relativeDate: 'Starts in 57 days',
    status: 'Scheduled',
    created: 'Created Sep 12, 2026 · DSC-0036',
  },
  {
    id: 'DSC-0025',
    name: 'Summer Sale',
    code: 'SUMMER20',
    description: '20% off',
    type: 'Percentage',
    appliesTo: 'All products',
    requirement: 'No minimum',
    used: 500,
    limit: 500,
    start: 'Jun 01',
    end: 'Aug 31, 2026',
    relativeDate: 'Ended Aug 31',
    status: 'Expired',
    created: 'Created May 20, 2026 · DSC-0025',
  },
  {
    id: 'DSC-0026',
    name: '$50 off',
    code: 'SAVE50',
    description: 'Accessories',
    type: 'Fixed amount',
    appliesTo: 'Accessories',
    requirement: 'Min. spend $250',
    used: 318,
    limit: 400,
    start: 'Mar 10',
    end: 'May 10, 2026',
    relativeDate: 'Ended May 10',
    status: 'Expired',
    created: 'Created Mar 01, 2026 · DSC-0026',
  },
];

const DATE_FILTERS = [
  { key: 'All', label: 'All dates' },
  { key: 'Ending soon', label: 'Ending soon' },
  { key: 'Starting soon', label: 'Starting soon' },
  { key: 'No end date', label: 'No end date' },
  { key: 'Already ended', label: 'Already ended' },
];

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
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

function getEditPath(discount) {
  if (discount.id === 'DSC-0031') {
    return '/admin/discounts/autumn-sale/edit';
  }

  return `/admin/discounts/${discount.id}/edit`;
}

function matchesDateFilter(discount, dateFilter) {
  if (dateFilter === 'All') return true;

  if (dateFilter === 'Ending soon') {
    return discount.relativeDate.includes('days left');
  }

  if (dateFilter === 'Starting soon') {
    return discount.relativeDate.includes('Starts in');
  }

  if (dateFilter === 'No end date') {
    return discount.relativeDate === 'No end date';
  }

  if (dateFilter === 'Already ended') {
    return discount.relativeDate.startsWith('Ended');
  }

  return true;
}

function DiscountStatus({ status }) {
  return (
    <span className={`discounts-status-pill ${status.toLowerCase()}`}>
      <i />
      {status}
    </span>
  );
}

/*
 * A small reusable filter dropdown — a button that shows the current
 * selection and toggles a floating option list. Used for Type,
 * Applies to, and Dates so each one actually filters the table
 * instead of being a decorative button.
 */
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
            const optionKey =
              typeof option === 'string' ? option : option.key;
            const optionLabel =
              typeof option === 'string' ? option : option.label;

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
                {value === optionKey && (
                  <AdminIcon name="check" size={12} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminDiscountsPage({ go }) {
  const [discounts] = useState(INITIAL_DISCOUNTS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [appliesToFilter, setAppliesToFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [pageSize, setPageSize] = useState('10');
  const [notice, setNotice] = useState('');
  const toolbarRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaDiscountToast);
    window.__novaDiscountToast = window.setTimeout(() => setNotice(''), 2300);
  };

  const typeOptions = useMemo(
    () => ['All', ...new Set(discounts.map((discount) => discount.type))],
    [discounts],
  );

  const appliesToOptions = useMemo(
    () => [
      'All',
      ...new Set(discounts.map((discount) => discount.appliesTo)),
    ],
    [discounts],
  );

  // Close any open dropdown when clicking outside the toolbar.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () =>
      document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown((current) => (current === name ? null : name));
  };

  const filteredDiscounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return discounts.filter((discount) => {
      const matchesSearch =
        !query ||
        discount.name.toLowerCase().includes(query) ||
        discount.code.toLowerCase().includes(query) ||
        discount.description.toLowerCase().includes(query) ||
        discount.appliesTo.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'All' || discount.status === statusFilter;

      const matchesType =
        typeFilter === 'All' || discount.type === typeFilter;

      const matchesAppliesTo =
        appliesToFilter === 'All' || discount.appliesTo === appliesToFilter;

      const matchesDate = matchesDateFilter(discount, dateFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesAppliesTo &&
        matchesDate
      );
    });
  }, [
    discounts,
    search,
    statusFilter,
    typeFilter,
    appliesToFilter,
    dateFilter,
  ]);

  const allVisibleSelected =
    filteredDiscounts.length > 0 &&
    filteredDiscounts.every((discount) => selectedIds.includes(discount.id));

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !filteredDiscounts.some((discount) => discount.id === id),
        ),
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([
        ...current,
        ...filteredDiscounts.map((discount) => discount.id),
      ]),
    ]);
  };

  const copyCode = async (discount) => {
    try {
      await navigator.clipboard.writeText(discount.code);
      setCopiedCode(discount.id);
      notify(`${discount.code} copied`);
      window.setTimeout(() => {
        setCopiedCode((current) => (current === discount.id ? null : current));
      }, 1500);
    } catch {
      notify(`Code: ${discount.code}`);
    }
  };

  const exportDiscounts = () => {
    if (filteredDiscounts.length === 0) {
      notify('No discounts to export');
      return;
    }

    const rows = filteredDiscounts.map((discount) => ({
      name: discount.name,
      code: discount.code,
      type: discount.type,
      appliesTo: discount.appliesTo,
      requirement: discount.requirement,
      used: discount.used,
      limit: discount.limit ?? 'Unlimited',
      status: discount.status,
    }));

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((key) => `"${String(row[key]).replaceAll('"', '""')}"`)
          .join(','),
      ),
    ].join('\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    );

    const link = document.createElement('a');
    link.href = url;
    link.download = 'novashop-discounts.csv';
    link.click();

    URL.revokeObjectURL(url);
    notify('Discounts exported');
  };

  const handleAddDiscount = () => {
    if (go) {
      go('/admin/discounts/new ');
      return;
    }

    notify('Add discount');
  };

  const handleMenuAction = (action, discount) => {
    setOpenMenu(null);

    switch (action) {
      case 'edit':
        go(getEditPath(discount));
        break;
      case 'duplicate':
        notify(`${discount.name} duplicated`);
        break;
      case 'copy':
        copyCode(discount);
        break;
      case 'orders':
        notify(`Viewing orders for ${discount.code}`);
        break;
      case 'end':
        notify(`${discount.name} ended`);
        break;
      case 'delete':
        notify(`${discount.name} deleted`);
        break;
      default:
        break;
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setTypeFilter('All');
    setAppliesToFilter('All');
    setDateFilter('All');
  };

  return (
    <div className="admin-dashboard discounts-page">
      {/* PAGE HEADER — shared admin-page-* classes, same as Inventory */}
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
            onClick={handleAddDiscount}
          >
            <AdminIcon name="plus" size={15} />
            Add Discount
          </button>
        </div>
      </section>

      <div className="discounts-kpi-label">LAST 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes, same as Inventory */}
      <section className="admin-stat-grid discounts-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Active discounts</span>
            <span className="admin-trend-pill">+2 this month</span>
          </div>
          <div className="admin-stat-value">12</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Scheduled</span>
            <span className="admin-trend-pill">+1 this month</span>
          </div>
          <div className="admin-stat-value">4</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total redemptions</span>
            <span className="admin-trend-pill">+9.6%</span>
          </div>
          <div className="admin-stat-value">4,820</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Discounted revenue</span>
            <span className="admin-trend-pill">+14.2%</span>
          </div>
          <div className="admin-stat-value">$96,400</div>
        </article>
      </section>

      {/* SEARCH / FILTER TOOLBAR — Type / Applies to / Dates now filter the table */}
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
            onChange={(value) => {
              setTypeFilter(value);
              setOpenDropdown(null);
            }}
            isOpen={openDropdown === 'type'}
            onToggle={() => toggleDropdown('type')}
          />

          <FilterDropdown
            label="Applies to"
            value={appliesToFilter}
            options={appliesToOptions}
            onChange={(value) => {
              setAppliesToFilter(value);
              setOpenDropdown(null);
            }}
            isOpen={openDropdown === 'appliesTo'}
            onToggle={() => toggleDropdown('appliesTo')}
          />

          <FilterDropdown
            label="Dates"
            value={dateFilter}
            options={DATE_FILTERS}
            onChange={(value) => {
              setDateFilter(value);
              setOpenDropdown(null);
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
                onClick={() => setStatusFilter(filter)}
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
              {filteredDiscounts.map((discount) => {
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

                          <span className="discounts-created-tooltip">
                            {discount.created}
                          </span>
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
                          type="button"
                          className="products-row-menu-button"
                          onClick={() =>
                            setOpenMenu((current) =>
                              current === discount.id ? null : discount.id,
                            )
                          }
                          aria-label={`Actions for ${discount.name}`}
                          aria-expanded={openMenu === discount.id}
                        >
                          <AdminIcon name="more" size={16} />
                        </button>

                        {openMenu === discount.id && (
                          <div className="products-row-menu discounts-row-menu">
                            <button
                              type="button"
                              onClick={() => handleMenuAction('edit', discount)}
                            >
                              <AdminIcon name="pencil" size={14} />
                              Edit discount
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleMenuAction('duplicate', discount)
                              }
                            >
                              <AdminIcon name="copy" size={14} />
                              Duplicate
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMenuAction('copy', discount)}
                            >
                              <AdminIcon name="code" size={14} />
                              Copy code
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleMenuAction('orders', discount)
                              }
                            >
                              <AdminIcon name="receipt" size={14} />
                              View orders
                            </button>

                            {(discount.status === 'Active' ||
                              discount.status === 'Scheduled') && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleMenuAction('end', discount)
                                }
                              >
                                <AdminIcon name="stop" size={14} />
                                End now
                              </button>
                            )}

                            <div className="discounts-menu-divider" />

                            <button
                              type="button"
                              className="is-danger"
                              onClick={() =>
                                handleMenuAction('delete', discount)
                              }
                            >
                              <AdminIcon name="trash" size={14} />
                              Delete discount
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredDiscounts.length === 0 && (
                <tr>
                  <td colSpan="8" className="discounts-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>No discounts match these filters.</strong>
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="discounts-pagination">
          <span>
            Showing{' '}
            {filteredDiscounts.length > 0
              ? `1–${filteredDiscounts.length}`
              : '0'}{' '}
            of {discounts.length} discounts
          </span>

          <div className="discounts-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value)}
                aria-label="Discounts per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>

            <button type="button" disabled>
              Previous
            </button>

            <button type="button" className="is-active">
              1
            </button>
            <button type="button">2</button>
            <button type="button">3</button>
            <button type="button">4</button>

            <button type="button">Next</button>
          </div>
        </div>
      </section>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="discounts-bulk-bar">
          <strong>{selectedIds.length} selected</strong>

          <button
            type="button"
            onClick={() => notify('Discounts duplicated')}
          >
            <AdminIcon name="copy" size={14} />
            Duplicate
          </button>

          <button type="button" onClick={() => notify('Discounts ended')}>
            <AdminIcon name="stop" size={14} />
            End now
          </button>

          <button type="button" onClick={exportDiscounts}>
            <AdminIcon name="download" size={14} />
            Export
          </button>

          <button
            type="button"
            className="is-danger"
            onClick={() => notify('Selected discounts deleted')}
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

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}