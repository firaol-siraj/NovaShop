import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-payments.css';

const TRANSACTIONS = [
  {
    id: 'TXN-98214',
    orderId: 'NS-10482',
    customer: 'Sarah Mitchell',
    email: 'sarah.mitchell@email.com',
    method: 'card',
    label: 'Visa •••• 4242',
    methodType: 'Credit card',
    amount: 1450,
    date: 'Sep 29, 2026, 2:14 PM',
    status: 'paid',
  },
  {
    id: 'TXN-98209',
    orderId: 'NS-10475',
    customer: 'James Okafor',
    email: 'james.okafor@email.com',
    method: 'wallet',
    label: 'Apple Pay',
    methodType: 'Digital wallet',
    amount: 2340,
    date: 'Sep 29, 2026, 11:02 AM',
    status: 'paid',
  },
  {
    id: 'TXN-98191',
    orderId: 'NS-10469',
    customer: 'Amelia Chen',
    email: 'amelia.chen@email.com',
    method: 'card',
    label: 'Mastercard •••• 8821',
    methodType: 'Credit card',
    amount: 1450,
    date: 'Sep 28, 2026, 4:40 PM',
    status: 'pending',
  },
  {
    id: 'TXN-98183',
    orderId: 'NS-10461',
    customer: 'Lucas Meyer',
    email: 'lucas.meyer@email.com',
    method: 'wallet',
    label: 'PayPal',
    methodType: 'Digital wallet',
    amount: 2900,
    date: 'Sep 28, 2026, 1:15 PM',
    status: 'paid',
  },
  {
    id: 'TXN-98164',
    orderId: 'NS-10454',
    customer: 'Priya Raman',
    email: 'priya.raman@email.com',
    method: 'card',
    label: 'Visa •••• 1190',
    methodType: 'Credit card',
    amount: 1450,
    date: 'Sep 27, 2026, 9:30 AM',
    status: 'failed',
  },
  {
    id: 'TXN-98142',
    orderId: 'NS-10431',
    customer: 'Sofia Rossi',
    email: 'sofia.rossi@email.com',
    method: 'card',
    label: 'Amex •••• 3005',
    methodType: 'Credit card',
    amount: 2110,
    date: 'Sep 26, 2026, 3:05 PM',
    status: 'paid',
  },
  {
    id: 'TXN-98107',
    orderId: 'NS-10320',
    customer: 'Hannah Becker',
    email: 'hannah.becker@email.com',
    method: 'card',
    label: 'Visa •••• 6612',
    methodType: 'Credit card',
    amount: -1450,
    date: 'Sep 25, 2026, 10:20 PM',
    status: 'refunded',
  },
  {
    id: 'TXN-98071',
    orderId: 'NS-10412',
    customer: 'Daniel Kim',
    email: 'daniel.kim@email.com',
    method: 'bank',
    label: 'Bank transfer',
    methodType: 'Bank transfer',
    amount: 1120,
    date: 'Sep 24, 2026, 6:48 PM',
    status: 'paid',
  },
];

const PAYOUTS = [
  {
    id: 'PO-1042',
    amount: 18240,
    orders: 42,
    destination: 'Chase •••• 5521',
    expectedArrival: 'Oct 03, 2026',
    status: 'scheduled',
  },
  {
    id: 'PO-1041',
    amount: 21860,
    orders: 51,
    destination: 'Chase •••• 5521',
    expectedArrival: 'Sep 26, 2026',
    status: 'paid',
  },
  {
    id: 'PO-1040',
    amount: 19320,
    orders: 46,
    destination: 'Chase •••• 5521',
    expectedArrival: 'Sep 19, 2026',
    status: 'paid',
  },
  {
    id: 'PO-1039',
    amount: 24510,
    orders: 58,
    destination: 'Chase •••• 5521',
    expectedArrival: 'Sep 12, 2026',
    status: 'paid',
  },
  {
    id: 'PO-1038',
    amount: 17980,
    orders: 41,
    destination: 'Chase •••• 5521',
    expectedArrival: 'Sep 05, 2026',
    status: 'paid',
  },
];

const PAYMENT_METHODS = [
  {
    id: 'PM-01',
    name: 'Credit and debit cards',
    description: 'Visa, Mastercard, Amex, Discover',
    icon: 'payments',
    fees: '2.9% + 30¢',
    availableIn: 'Global (All markets)',
    status: 'active',
    enabled: true,
  },
  {
    id: 'PM-02',
    name: 'Apple Pay',
    description: 'Express checkout on Safari & iOS devices',
    icon: 'phone',
    fees: '2.9% + 30¢',
    availableIn: 'Supported Apple regions',
    status: 'active',
    enabled: false,
  },
  {
    id: 'PM-03',
    name: 'Google Pay',
    description: 'One-touch checkout on Android & Chrome',
    icon: 'phone',
    fees: '2.9% + 30¢',
    availableIn: 'Supported Google regions',
    status: 'active',
    enabled: true,
  },
  {
    id: 'PM-04',
    name: 'PayPal',
    description: 'PayPal wallet, Pay Later, and Venmo',
    icon: 'payments',
    fees: '3.49% + 49¢',
    availableIn: '200+ countries',
    status: 'active',
    enabled: true,
  },
  {
    id: 'PM-05',
    name: 'Bank transfer',
    description: 'Direct wire & SEPA manual verification',
    icon: 'document',
    fees: '0.8% (capped $5)',
    availableIn: 'EU & North America',
    status: 'active',
    enabled: true,
  },
  {
    id: 'PM-06',
    name: 'Store credit',
    description: 'Digital store balance and gift codes',
    icon: 'receipt',
    fees: '0.0%',
    availableIn: 'Global registered users',
    status: 'inactive',
    enabled: false,
  },
];

const KPI_STATS = [
  { label: 'Total received', value: '$284,600', trend: '+12.4%', tone: 'positive' },
  { label: 'Pending', value: '$12,480', trend: '+$2,100', tone: 'neutral' },
  { label: 'Failed payments', value: '23', trend: '+4 this week', tone: 'negative' },
  { label: 'Next payout', value: '$18,240', trend: 'Oct 03', tone: 'date' },
];

const TXN_STATUS_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

const METHOD_OPTIONS = [
  { id: 'all', label: 'All methods' },
  { id: 'card', label: 'Credit card' },
  { id: 'wallet', label: 'Digital wallet' },
  { id: 'bank', label: 'Bank transfer' },
];

const DATE_OPTIONS = [
  { id: '30', label: 'Last 30 days' },
  { id: '7', label: 'Last 7 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
];

const PAYOUT_STATUS_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: 'paid', label: 'Paid' },
  { id: 'scheduled', label: 'Scheduled' },
];

const TABS = [
  { id: 'transactions', label: 'Transactions', count: 1126 },
  { id: 'payouts', label: 'Payouts', count: 24 },
  { id: 'methods', label: 'Payment Methods', count: 6 },
];

const METHOD_ICON = { card: 'payments', wallet: 'phone', bank: 'document' };

const STATUS_LABEL = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
  scheduled: 'Scheduled',
};

function money(amount) {
  const sign = amount < 0 ? '−' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function FilterDropdown({ label, value, options, isOpen, onToggle, onChange }) {
  const current = options.find((option) => option.id === value);

  return (
    <div className={`pay-filter-dropdown${isOpen ? ' is-open' : ''}`}>
      <button type="button" onClick={onToggle}>
        <span>{current ? current.label : label}</span>
        <AdminIcon name="chevron" size={13} />
      </button>

      {isOpen && (
        <div className="pay-filter-menu" role="menu">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              className={option.id === value ? 'is-selected' : ''}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`pay-toggle${checked ? ' is-on' : ''}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

export default function AdminPaymentsPage({ go }) {
  const [activeTab, setActiveTab] = useState('transactions');
  const [search, setSearch] = useState('');

  const [txnStatusFilter, setTxnStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [txnDateFilter, setTxnDateFilter] = useState('30');

  const [payoutStatusFilter, setPayoutStatusFilter] = useState('all');
  const [payoutDateFilter, setPayoutDateFilter] = useState('30');

  const [openDropdown, setOpenDropdown] = useState(null);
  const [openRowMenu, setOpenRowMenu] = useState(null);
  const [pageSize, setPageSize] = useState('10');
  const [page, setPage] = useState(1);
  const [methods, setMethods] = useState(PAYMENT_METHODS);
  const [notice, setNotice] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const filterRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return TRANSACTIONS.filter((txn) => {
      const matchesSearch =
        !query ||
        txn.orderId.toLowerCase().includes(query) ||
        txn.customer.toLowerCase().includes(query) ||
        txn.label.toLowerCase().includes(query);

      const matchesStatus = txnStatusFilter === 'all' || txn.status === txnStatusFilter;
      const matchesMethod = methodFilter === 'all' || txn.method === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [search, txnStatusFilter, methodFilter]);

  const filteredPayouts = useMemo(() => {
    return PAYOUTS.filter(
      (payout) => payoutStatusFilter === 'all' || payout.status === payoutStatusFilter
    );
  }, [payoutStatusFilter]);

  const handleExport = () => {
    notify('Preparing payments export…');
  };

  const handlePaymentSettings = () => {
    if (go) {
      go('/admin/settings');
      return;
    }
    notify('Opening payment settings…');
  };

  const handleConfigureProvider = () => {
    if (go) {
      go('/admin/settings');
      return;
    }
    notify('Opening payment provider configuration…');
  };

  const handleToggleMethod = (methodId) => {
    setMethods((current) =>
      current.map((method) =>
        method.id === methodId ? { ...method, enabled: !method.enabled } : method
      )
    );
    const method = methods.find((item) => item.id === methodId);
    if (method) {
      notify(`${method.name} ${method.enabled ? 'disabled' : 'enabled'} at checkout.`);
    }
  };

  const handleTxnMenuAction = (txn, action) => {
    setOpenRowMenu(null);

    if (action === 'details') {
      setSelectedTxn(txn);
      return;
    }

    if (action === 'order') {
      if (go) {
        go(`/admin/orders/${txn.orderId}`);
        return;
      }
      notify(`Opening order #${txn.orderId}…`);
      return;
    }

    if (action === 'customer') {
      if (go) {
        go('/admin/customers');
        return;
      }
      notify(`Opening ${txn.customer}'s profile…`);
      return;
    }

    if (action === 'copy') {
      navigator.clipboard?.writeText(txn.id).catch(() => {});
      notify(`Transaction ID ${txn.id} copied.`);
    }
  };

  const handlePayoutMenuAction = (payout, action) => {
    setOpenRowMenu(null);

    if (action === 'details') {
      notify(`Opening payout ${payout.id}…`);
      return;
    }

    if (action === 'statement') {
      notify(`Downloading statement for ${payout.id}…`);
    }
  };

  const handleMethodMenuAction = (method, action) => {
    setOpenRowMenu(null);

    if (action === 'edit' || action === 'fees') {
      if (go) {
        go('/admin/settings');
        return;
      }
      notify(action === 'edit' ? `Editing ${method.name}…` : `Opening fee configuration for ${method.name}…`);
    }
  };

  return (
    <div
      className="admin-dashboard payments-page"
      onClick={() => {
        setOpenDropdown(null);
        setOpenRowMenu(null);
      }}
    >
      {/* HEADER */}
      <section className="admin-page-heading pay-heading">
        <div>
          <h1 className="admin-page-title">Payments</h1>
          <p className="admin-page-description">
            Review transactions, payouts, and checkout payment methods.
          </p>
        </div>

        <div className="admin-page-actions">
          <button type="button" className="admin-action-button" onClick={handlePaymentSettings}>
            <AdminIcon name="sliders" size={14} />
            Payment settings
          </button>

          <button type="button" className="admin-action-button is-primary" onClick={handleExport}>
            <AdminIcon name="download" size={14} />
            Export
          </button>
        </div>
      </section>

      {/* KPI STATS */}
      <div className="pay-period-label">Last 30 days</div>

      <section className="pay-stat-grid admin-stat-grid">
        {KPI_STATS.map((stat) => (
          <article className="admin-stat-card pay-stat-card" key={stat.label}>
            <span className="admin-stat-label">{stat.label}</span>

            <div className="pay-stat-row">
              <strong className="admin-stat-value">{stat.value}</strong>
              <span className={`pay-trend-pill is-${stat.tone}`}>{stat.trend}</span>
            </div>
          </article>
        ))}
      </section>

      {/* TABS */}
      <div className="pay-tabs">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`pay-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <b>{tab.count.toLocaleString()}</b>
          </button>
        ))}
      </div>

      {/* TOOLBAR — TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <section className="pay-toolbar">
          <label className="pay-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by order, customer, or last 4 digits…"
            />
          </label>

          <div
            className="pay-toolbar-filters"
            ref={filterRef}
            onClick={(event) => event.stopPropagation()}
          >
            <FilterDropdown
              label="Status"
              value={txnStatusFilter}
              options={TXN_STATUS_OPTIONS}
              isOpen={openDropdown === 'txn-status'}
              onToggle={() => setOpenDropdown(openDropdown === 'txn-status' ? null : 'txn-status')}
              onChange={(value) => {
                setTxnStatusFilter(value);
                setOpenDropdown(null);
              }}
            />

            <FilterDropdown
              label="Method"
              value={methodFilter}
              options={METHOD_OPTIONS}
              isOpen={openDropdown === 'method'}
              onToggle={() => setOpenDropdown(openDropdown === 'method' ? null : 'method')}
              onChange={(value) => {
                setMethodFilter(value);
                setOpenDropdown(null);
              }}
            />

            <FilterDropdown
              label="Date"
              value={txnDateFilter}
              options={DATE_OPTIONS}
              isOpen={openDropdown === 'txn-date'}
              onToggle={() => setOpenDropdown(openDropdown === 'txn-date' ? null : 'txn-date')}
              onChange={(value) => {
                setTxnDateFilter(value);
                setOpenDropdown(null);
              }}
            />
          </div>
        </section>
      )}

      {/* TOOLBAR — PAYOUTS */}
      {activeTab === 'payouts' && (
        <section className="pay-toolbar pay-toolbar-end">
          <div
            className="pay-toolbar-filters"
            ref={filterRef}
            onClick={(event) => event.stopPropagation()}
          >
            <FilterDropdown
              label="Status"
              value={payoutStatusFilter}
              options={PAYOUT_STATUS_OPTIONS}
              isOpen={openDropdown === 'payout-status'}
              onToggle={() =>
                setOpenDropdown(openDropdown === 'payout-status' ? null : 'payout-status')
              }
              onChange={(value) => {
                setPayoutStatusFilter(value);
                setOpenDropdown(null);
              }}
            />

            <FilterDropdown
              label="Date"
              value={payoutDateFilter}
              options={DATE_OPTIONS}
              isOpen={openDropdown === 'payout-date'}
              onToggle={() =>
                setOpenDropdown(openDropdown === 'payout-date' ? null : 'payout-date')
              }
              onChange={(value) => {
                setPayoutDateFilter(value);
                setOpenDropdown(null);
              }}
            />
          </div>
        </section>
      )}

      {/* INTRO — PAYMENT METHODS */}
      {activeTab === 'methods' && (
        <section className="pay-methods-intro">
          <p>Turn methods on or off to control what customers see at checkout.</p>
          <button type="button" className="pay-configure-link" onClick={handleConfigureProvider}>
            Configure provider
            <span aria-hidden="true">→</span>
          </button>
        </section>
      )}

      {/* TABLE CARD */}
      <section className="pay-table-card">
        <div className="pay-table-scroll">
          {/* ---------------- TRANSACTIONS ---------------- */}
          {activeTab === 'transactions' && (
            <table className="pay-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Payment method</th>
                  <th className="pay-col-amount">Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="pay-col-actions" aria-label="Row actions">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id}>
                    <td>
                      <button
                        type="button"
                        className="pay-order-link"
                        onClick={() => handleTxnMenuAction(txn, 'order')}
                      >
                        <strong>#{txn.orderId}</strong>
                        <span className="pay-type-pill">Payment</span>
                      </button>
                    </td>

                    <td>
                      <div 
                        className="pay-customer-cell"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedTxn(txn)}
                      >
                        <strong>{txn.customer}</strong>
                        <span>{txn.email}</span>
                      </div>
                    </td>

                    <td>
                      <div className="pay-method-cell">
                        <span className="pay-method-icon">
                          <AdminIcon name={METHOD_ICON[txn.method]} size={15} />
                        </span>
                        <div>
                          <strong>{txn.label}</strong>
                          <em>({txn.methodType})</em>
                        </div>
                      </div>
                    </td>

                    <td className="pay-col-amount">
                      <strong className={`pay-amount ${txn.status === 'refunded' ? 'is-refund' : ''}`}>
                        {money(txn.amount)}
                      </strong>
                    </td>

                    <td>
                      <span className="pay-date-cell">{txn.date}</span>
                    </td>

                    <td>
                      <span className={`pay-status-pill is-${txn.status}`}>
                        <i />
                        {STATUS_LABEL[txn.status]}
                      </span>
                    </td>

                    <td className="pay-actions-cell pay-col-actions">
                      <div
                        className="pay-row-menu-anchor"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="products-row-menu-button"
                          onClick={() =>
                            setOpenRowMenu(openRowMenu === txn.id ? null : txn.id)
                          }
                          aria-label={`Actions for transaction ${txn.id}`}
                        >
                          <AdminIcon name="more" size={15} />
                        </button>

                        {openRowMenu === txn.id && (
                          <div className="pay-row-menu">
                            <button type="button" onClick={() => handleTxnMenuAction(txn, 'details')}>
                              <AdminIcon name="eye" size={13} />
                              View details
                            </button>
                            <button type="button" onClick={() => handleTxnMenuAction(txn, 'order')}>
                              <AdminIcon name="document" size={13} />
                              View order
                            </button>
                            <button type="button" onClick={() => handleTxnMenuAction(txn, 'customer')}>
                              <AdminIcon name="customers" size={13} />
                              View customer
                            </button>
                            <div className="pay-row-menu-divider" />
                            <button type="button" onClick={() => handleTxnMenuAction(txn, 'copy')}>
                              <AdminIcon name="copy" size={13} />
                              Copy transaction ID
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ---------------- PAYOUTS ---------------- */}
          {activeTab === 'payouts' && (
            <table className="pay-table">
              <thead>
                <tr>
                  <th>Payout</th>
                  <th className="pay-col-amount">Amount</th>
                  <th>Orders</th>
                  <th>Destination</th>
                  <th>Expected arrival</th>
                  <th>Status</th>
                  <th className="pay-col-actions" aria-label="Row actions">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>
                      <strong>#{payout.id}</strong>
                    </td>

                    <td className="pay-col-amount">
                      <strong className="pay-amount">{money(payout.amount)}</strong>
                    </td>

                    <td>{payout.orders} orders</td>

                    <td>
                      <div className="pay-method-cell">
                        <span className="pay-method-icon">
                          <AdminIcon name="document" size={15} />
                        </span>
                        <strong>{payout.destination}</strong>
                      </div>
                    </td>

                    <td>
                      <span className="pay-date-cell">{payout.expectedArrival}</span>
                    </td>

                    <td>
                      <span className={`pay-status-pill is-${payout.status}`}>
                        <i />
                        {STATUS_LABEL[payout.status]}
                      </span>
                    </td>

                    <td className="pay-actions-cell pay-col-actions">
                      <div
                        className="pay-row-menu-anchor"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="products-row-menu-button"
                          onClick={() =>
                            setOpenRowMenu(openRowMenu === payout.id ? null : payout.id)
                          }
                          aria-label={`Actions for payout ${payout.id}`}
                        >
                          <AdminIcon name="more" size={15} />
                        </button>

                        {openRowMenu === payout.id && (
                          <div className="pay-row-menu">
                            <button
                              type="button"
                              onClick={() => handlePayoutMenuAction(payout, 'details')}
                            >
                              <AdminIcon name="eye" size={13} />
                              View details
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePayoutMenuAction(payout, 'statement')}
                            >
                              <AdminIcon name="download" size={13} />
                              Download statement
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ---------------- PAYMENT METHODS ---------------- */}
          {activeTab === 'methods' && (
            <table className="pay-table pay-methods-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Fees</th>
                  <th>Available in</th>
                  <th>Status</th>
                  <th>Toggle switch</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {methods.map((method) => (
                  <tr key={method.id}>
                    <td>
                      <div className="pay-method-name-cell">
                        <span className="pay-method-icon">
                          <AdminIcon name={method.icon} size={16} />
                        </span>
                        <div>
                          <strong>{method.name}</strong>
                          <span>{method.description}</span>
                        </div>
                      </div>
                    </td>

                    <td>{method.fees}</td>

                    <td>{method.availableIn}</td>

                    <td>
                      <span className={`pay-status-pill is-${method.status === 'active' ? 'paid' : 'inactive'}`}>
                        <i />
                        {method.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td>
                      <Toggle
                        checked={method.enabled}
                        onChange={() => handleToggleMethod(method.id)}
                        label={`Toggle ${method.name} at checkout`}
                      />
                    </td>

                    <td className="pay-actions-cell">
                      <div
                        className="pay-row-menu-anchor"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="products-row-menu-button"
                          onClick={() =>
                            setOpenRowMenu(openRowMenu === method.id ? null : method.id)
                          }
                          aria-label={`Actions for ${method.name}`}
                        >
                          <AdminIcon name="more" size={15} />
                        </button>

                        {openRowMenu === method.id && (
                          <div className="pay-row-menu">
                            <button
                              type="button"
                              onClick={() => handleMethodMenuAction(method, 'edit')}
                            >
                              <AdminIcon name="pencil" size={13} />
                              Edit method
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMethodMenuAction(method, 'fees')}
                            >
                              <AdminIcon name="sliders" size={13} />
                              Configure fees
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {activeTab === 'transactions' && (
          <div className="pay-table-footer">
            <span>
              Showing <strong>1–{filteredTransactions.length}</strong> of{' '}
              {TABS[0].count.toLocaleString()} transactions
            </span>

            <div className="pay-pagination">
              <label className="pay-page-size">
                <select value={pageSize} onChange={(event) => setPageSize(event.target.value)}>
                  <option value="10">10 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                </select>
                <AdminIcon name="chevron" size={12} />
              </label>

              <div className="pay-page-numbers">
                <button type="button" className={page === 1 ? 'is-active' : ''} onClick={() => setPage(1)}>1</button>
                <button type="button" className={page === 2 ? 'is-active' : ''} onClick={() => setPage(2)}>2</button>
                <button type="button" className={page === 3 ? 'is-active' : ''} onClick={() => setPage(3)}>3</button>
                <span>…</span>
                <button type="button" className={page === 141 ? 'is-active' : ''} onClick={() => setPage(141)}>141</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div className="pay-table-footer">
            <span>
              Showing <strong>1–{filteredPayouts.length}</strong> of {TABS[1].count} payouts
            </span>
          </div>
        )}
      </section>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}

      {selectedTxn && (
        <div className="pay-slide-over-overlay" onClick={() => setSelectedTxn(null)}>
          <div className="pay-slide-over" onClick={(e) => e.stopPropagation()}>
            <div className="pay-slide-header">
              <div className="pay-slide-title-group">
                <span>Transaction Details</span>
                <h2>{selectedTxn.id}</h2>
              </div>
              <button className="pay-slide-close" onClick={() => setSelectedTxn(null)}>
                <AdminIcon name="close" size={16} />
              </button>
            </div>

            <div className="pay-slide-content">
              <div className="pay-slide-card">
                <div className="pay-slide-card-row">
                  <div>
                    <div style={{fontSize: '11px', color: '#8A847C'}}>Charged Amount</div>
                    <div style={{fontSize: '18px', fontWeight: '600', color: '#1B1816', marginTop: '4px'}}>{money(selectedTxn.amount)}</div>
                  </div>
                  <span className={`pay-status-pill is-${selectedTxn.status}`}><i /> {STATUS_LABEL[selectedTxn.status]}</span>
                </div>
              </div>

              <div>
                <div className="pay-slide-section-title">PAYMENT BREAKDOWN</div>
                <div className="pay-slide-card">
                  <div className="pay-slide-card-row" style={{fontSize: '13px', color: '#6B6660'}}>
                    <span>Gross Amount</span>
                    <span style={{color: '#1B1816', fontWeight: '500'}}>{money(selectedTxn.amount)}</span>
                  </div>
                  <div className="pay-slide-card-row" style={{fontSize: '13px', color: '#6B6660'}}>
                    <span>Processing fee (2.9% + 30¢)</span>
                    <span style={{color: '#B23A3A'}}>{money(selectedTxn.amount > 0 ? -42.30 : 0)}</span>
                  </div>
                  <div className="pay-slide-card-divider" />
                  <div className="pay-slide-card-row" style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>
                    <span>Net amount</span>
                    <span>{money(selectedTxn.amount > 0 ? selectedTxn.amount - 42.3 : selectedTxn.amount)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="pay-slide-section-title">METHOD & DEVICE</div>
                <div className="pay-slide-card" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                    <div className="pay-method-icon"><AdminIcon name={METHOD_ICON[selectedTxn.method] || 'payments'} size={16} /></div>
                    <div>
                      <div style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>{selectedTxn.methodType}</div>
                      <div style={{fontSize: '12px', color: '#8A847C'}}>{selectedTxn.label}</div>
                    </div>
                  </div>
                  <div style={{fontSize: '11px', color: '#8A847C', display: 'flex', gap: '16px'}}>
                    <span>Risk evaluation: <strong style={{color: '#10B981'}}>Normal (0.02)</strong></span>
                    <span>3D Secure: <strong style={{color: '#1B1816'}}>Authenticated</strong></span>
                  </div>
                </div>
              </div>

              <div>
                <div className="pay-slide-section-title">ASSOCIATED ORDER</div>
                <div className="pay-slide-card" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                    <div className="pay-method-icon"><AdminIcon name="orders" size={16} /></div>
                    <div>
                      <div style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>Order #{selectedTxn.orderId}</div>
                      <div style={{fontSize: '12px', color: '#8A847C'}}>Lemaire Silk Trench - Size 38</div>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedTxn(null); handleTxnMenuAction(selectedTxn, 'order'); }} style={{background: 'none', border: 'none', fontSize: '11px', fontWeight: '700', color: '#1B1816', cursor: 'pointer'}}>VIEW</button>
                </div>
              </div>

              <div>
                <div className="pay-slide-section-title">CUSTOMER & BILLING</div>
                <div className="pay-slide-card">
                  <div style={{display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px'}}>
                    <div style={{width: '32px', height: '32px', borderRadius: '50%', background: '#E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: '#1B1816'}}>
                      {selectedTxn.customer.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>{selectedTxn.customer}</div>
                      <div style={{fontSize: '12px', color: '#8A847C'}}>{selectedTxn.email}</div>
                    </div>
                  </div>
                  <div style={{fontSize: '12px', color: '#8A847C', lineHeight: '1.5'}}>
                    <strong style={{color: '#1B1816', display: 'block', marginBottom: '2px'}}>Billing Address:</strong>
                    742 Evergreen Terrace, Apt 4B<br/>New York, NY 10012, United States
                  </div>
                </div>
              </div>
            </div>

            <div className="pay-slide-footer">
              <button className="pay-slide-btn-refund" onClick={() => { notify('Issuing refund...'); setSelectedTxn(null); }}>ISSUE REFUND</button>
              <button className="pay-slide-btn-done" onClick={() => setSelectedTxn(null)}>DONE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}