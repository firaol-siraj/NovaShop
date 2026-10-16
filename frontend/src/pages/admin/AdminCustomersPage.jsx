import { useMemo, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { loadDirectoryCustomers } from './adminCustomerData';
import './admin-customers.css';

const money = (amount) => `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CustomerStatus({ status }) {
  return <span className={`customers-status-pill ${status.toLowerCase()}`}><i />{status}</span>;
}

export default function AdminCustomersPage({ go }) {
  const [customers, setCustomers] = useState(() => loadDirectoryCustomers());
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('All countries');
  const [spendFilter, setSpendFilter] = useState('All spending');
  const [joinedFilter, setJoinedFilter] = useState('Any time');
  const [quickFilter, setQuickFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState(['CUS-1042', 'CUS-1043', 'CUS-1044']);
  const [openMenu, setOpenMenu] = useState(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2300);
  };
  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${customer.name} ${customer.email}`.toLowerCase().includes(query);
    const matchesCountry = countryFilter === 'All countries' || customer.country === countryFilter;
    const matchesSpend = spendFilter === 'All spending' || (spendFilter === 'Over $10,000' && customer.spent >= 10000) || (spendFilter === '$1,000–$10,000' && customer.spent >= 1000 && customer.spent < 10000) || (spendFilter === 'Under $1,000' && customer.spent < 1000);
    const matchesJoined = joinedFilter === 'Any time' || (joinedFilter === 'Last 30 days' && customer.joinedAt >= '2026-09-04') || (joinedFilter === 'Last 90 days' && customer.joinedAt >= '2026-07-06') || (joinedFilter === 'This year' && customer.joinedAt >= '2026-01-01');
    const matchesStatus = quickFilter === 'All' || (quickFilter === 'Active' && customer.status === 'Active') || (quickFilter === 'Inactive' && customer.status === 'Inactive') || (quickFilter === 'Blocked' && customer.status === 'Blocked');
    return matchesSearch && matchesCountry && matchesSpend && matchesJoined && matchesStatus;
  }), [countryFilter, customers, joinedFilter, quickFilter, search, spendFilter]);
  const allVisibleSelected = filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedIds.includes(customer.id));
  const toggleCustomer = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !filteredCustomers.some((customer) => customer.id === id)) : [...new Set([...current, ...filteredCustomers.map((customer) => customer.id)])]);
  const exportCustomers = (rows = customers) => {
    const csvRows = [['Customer', 'Email', 'City', 'Country', 'Orders', 'Lifetime spend', 'Last order', 'Status'], ...rows.map((customer) => [customer.name, customer.email, customer.city, customer.country, customer.orders, money(customer.spent), customer.lastDate, customer.status])];
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'novashop-customers.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const runRowAction = (action, customer) => {
    setOpenMenu(null);
    if (action === 'View customer') go(`/admin/customers/${customer.id}`);
    else if (action === 'Edit customer') go(`/admin/customers/${customer.id}/edit`);
    else if (action === 'View orders') notify(`${customer.orders} orders for ${customer.name}.`);
    else if (action === 'Send email') notify(`Email composer opened for ${customer.email}.`);
    else if (action === 'Block customer') {
      setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, status: item.status === 'Blocked' ? 'Active' : 'Blocked' } : item));
      notify(customer.status === 'Blocked' ? 'Customer unblocked.' : 'Customer blocked.');
    } else {
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setSelectedIds((current) => current.filter((id) => id !== customer.id));
      notify('Customer removed from the directory.');
    }
  };
  const updateSelected = (updates) => setCustomers((current) => current.map((customer) => selectedIds.includes(customer.id) ? { ...customer, ...updates } : customer));
  const bulkDelete = () => {
    setCustomers((current) => current.filter((customer) => !selectedIds.includes(customer.id)));
    setSelectedIds([]);
    notify('Selected customers removed from the directory.');
  };
  const clearFilters = () => { setSearch(''); setCountryFilter('All countries'); setSpendFilter('All spending'); setJoinedFilter('Any time'); setQuickFilter('All'); };

  return (
    <div className="admin-dashboard customers-page">
      <section className="admin-page-heading customers-page-heading"><div><h1 className="admin-page-title">Customers</h1><p className="admin-page-description">View and manage your customers and their order history.</p></div><div className="admin-page-actions"><button className="admin-action-button" type="button" onClick={() => exportCustomers(filteredCustomers)}><AdminIcon name="download" size={15} /> Export</button><button className="admin-action-button is-primary" type="button" onClick={() => go('/admin/customers/new')}><AdminIcon name="plus" size={15} /> Add Customer</button></div></section>

      <section className="customers-kpi-section" aria-label="Last 30 days customer metrics"><div className="customers-kpi-eyebrow">LAST 30 DAYS</div><div className="admin-stat-grid customers-stat-grid"><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Total customers</span><span className="admin-trend-pill">+6.2%</span></div><div className="admin-stat-value">2,846</div></article><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Active customers</span><span className="admin-trend-pill">+4.8%</span></div><div className="admin-stat-value">2,391</div></article><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">New this month</span><span className="admin-trend-pill">+12%</span></div><div className="admin-stat-value">184</div></article><article className="admin-stat-card"><div className="admin-stat-heading"><span className="admin-stat-label">Repeat customers</span><span className="customers-negative-trend">−1.1%</span></div><div className="admin-stat-value">38%</div></article></div></section>

      <section className="customers-catalog-toolbar" aria-label="Customer filters"><div className="customers-filter-row"><label className="products-search-field"><AdminIcon name="search" size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" aria-label="Search by name or email" /></label><select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} aria-label="Filter by country"><option>All countries</option>{[...new Set(customers.map((customer) => customer.country))].sort().map((country) => <option key={country}>{country}</option>)}</select><select value={spendFilter} onChange={(event) => setSpendFilter(event.target.value)} aria-label="Filter by total spent"><option>All spending</option><option>Over $10,000</option><option>$1,000–$10,000</option><option>Under $1,000</option></select><select value={joinedFilter} onChange={(event) => setJoinedFilter(event.target.value)} aria-label="Filter by joined"><option>Any time</option><option>Last 30 days</option><option>Last 90 days</option><option>This year</option></select></div><div className="customers-quick-filters" role="group" aria-label="Customer status filters">{['All', 'Active', 'Inactive', 'Blocked'].map((filter) => <button type="button" key={filter} className={`customers-quick-filter${quickFilter === filter ? ' is-active' : ''}`} aria-pressed={quickFilter === filter} onClick={() => setQuickFilter(filter)}>{filter !== 'All' && <i className={filter.toLowerCase()} />}{filter}</button>)}</div></section>

      <section className="customers-table-card" aria-label="Customer directory"><div className="customers-table-scroll"><table className="customers-table"><thead><tr><th className="customers-check-cell"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select all visible customers" /></th><th>CUSTOMER</th><th>LOCATION</th><th>ORDERS</th><th>TOTAL SPENT</th><th>LAST ORDER</th><th>STATUS</th><th className="customers-actions-heading">ACTIONS</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><td className="customers-check-cell"><input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} aria-label={`Select ${customer.name}`} /></td><td className="customers-name-cell"><div className="customers-profile-cell"><span className={`customers-avatar tone-${customer.initials.charCodeAt(0) % 5}`}>{customer.initials}</span><div><strong>{customer.name}</strong><span>{customer.email}</span></div></div></td><td><div className="customers-location-cell"><strong>{customer.city}</strong><span>{customer.country}</span></div></td><td>{customer.orders}</td><td className="customers-spent-cell">{money(customer.spent)}</td><td><div className="customers-last-order"><strong>{customer.lastOrder}</strong><span>{customer.lastDate}</span></div></td><td><CustomerStatus status={customer.status} /></td><td className="customers-actions-cell"><div className="customers-menu-anchor"><button className="products-row-menu-button" type="button" aria-label={`More actions for ${customer.name}`} aria-expanded={openMenu === customer.id} onClick={() => setOpenMenu((current) => current === customer.id ? null : customer.id)}><AdminIcon name="more" size={16} /></button>{openMenu === customer.id && <div className="products-row-menu customers-row-menu">{['View customer', 'Edit customer', 'View orders', 'Send email'].map((action) => <button key={action} type="button" onClick={() => runRowAction(action, customer)}>{action}</button>)}<i />{['Block customer', 'Delete customer'].map((action) => <button key={action} type="button" className="is-danger" onClick={() => runRowAction(action, customer)}>{action}</button>)}</div>}</div></td></tr>)}{filteredCustomers.length === 0 && <tr><td colSpan="8" className="customers-empty-state"><AdminIcon name="searchSlash" size={20} /><strong>No customers match these filters.</strong><button type="button" onClick={clearFilters}>Reset filters</button></td></tr>}</tbody></table></div>
        <div className="customers-pagination"><span>Showing 1–{Math.min(Number(pageSize), filteredCustomers.length)} of {search || countryFilter !== 'All countries' || spendFilter !== 'All spending' || joinedFilter !== 'Any time' || quickFilter !== 'All' ? filteredCustomers.length.toLocaleString('en-US') : '2,846'} customers</span><div className="customers-pagination-controls"><label><select value={pageSize} onChange={(event) => setPageSize(event.target.value)} aria-label="Customers per page"><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option></select><AdminIcon name="chevron" size={12} /></label><button type="button" disabled={page === 1} aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>{[1, 2, 3].map((pageNumber) => <button type="button" key={pageNumber} className={page === pageNumber ? 'is-active' : ''} aria-current={page === pageNumber ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<span>…</span><button type="button" onClick={() => setPage(285)} className={page === 285 ? 'is-active' : ''}>285</button><button type="button" disabled={page === 285} aria-label="Next page" onClick={() => setPage((current) => Math.min(285, current + 1))}>Next</button></div></div>
      </section>

      {selectedIds.length > 0 && <div className="customers-bulk-bar"><strong>{selectedIds.length} selected</strong><button type="button" onClick={() => notify(`Email composer opened for ${selectedIds.length} customers.`)}><AdminIcon name="document" size={14} /> Send email</button><div className="customers-tag-menu"><button type="button" aria-expanded={tagMenuOpen} onClick={() => setTagMenuOpen((open) => !open)}><AdminIcon name="categories" size={14} /> Add tag</button>{tagMenuOpen && <div>{['VIP', 'Repeat customer', 'Newsletter'].map((tag) => <button key={tag} type="button" onClick={() => { updateSelected({ tags: [...new Set(customers.filter((customer) => selectedIds.includes(customer.id)).flatMap((customer) => customer.tags || [])), tag] }); setTagMenuOpen(false); notify(`Tag “${tag}” added to selected customers.`); }}>{tag}</button>)}</div>}</div><button type="button" onClick={() => exportCustomers(customers.filter((customer) => selectedIds.includes(customer.id)))}><AdminIcon name="download" size={14} /> Export</button><i className="customers-bulk-divider" /><button className="customers-bulk-delete" type="button" onClick={bulkDelete}><AdminIcon name="warning" size={14} /> Delete</button><button className="customers-bulk-clear" type="button" aria-label="Clear customer selection" onClick={() => setSelectedIds([])}><AdminIcon name="close" size={16} /></button></div>}

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}