import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import adminPaymentApi from '../../lib/api/adminPaymentApi';
import './admin-payments.css';

const TXN_STATUS_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

const METHOD_OPTIONS = [
  { id: 'all', label: 'All methods' },
  { id: 'telebirr', label: 'Telebirr' },
  { id: 'cbebirr', label: 'CBE Birr' },
  { id: 'card', label: 'Credit card' },
  { id: 'cod', label: 'Cash on Delivery' },
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

const METHOD_ICON = {
  card: 'payments',
  telebirr: 'phone',
  cbebirr: 'document',
  wallet: 'phone',
  bank: 'document',
  cod: 'receipt',
  chapa: 'payments',
};

const STATUS_LABEL = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
  scheduled: 'Scheduled',
  active: 'Active',
  inactive: 'Inactive',
};

function money(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '-';
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
  const getInitialParams = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return {
        tab: sp.get('tab') || 'transactions',
        search: sp.get('search') || '',
        status: sp.get('status') || 'all',
        method: sp.get('method') || 'all',
        range: sp.get('range') || '30',
        customer: sp.get('customer') || '',
        order: sp.get('order') || '',
        page: parseInt(sp.get('page'), 10) || 1,
      };
    } catch {
      return {
        tab: 'transactions',
        search: '',
        status: 'all',
        method: 'all',
        range: '30',
        customer: '',
        order: '',
        page: 1,
      };
    }
  };

  const initialParams = useMemo(getInitialParams, []);
  const [activeTab, setActiveTab] = useState(initialParams.tab);
  const [search, setSearch] = useState(initialParams.search);

  const [txnStatusFilter, setTxnStatusFilter] = useState(initialParams.status);
  const [methodFilter, setMethodFilter] = useState(initialParams.method);
  const [txnDateFilter, setTxnDateFilter] = useState(initialParams.range);
  const [customerFilter, setCustomerFilter] = useState(initialParams.customer);
  const [orderFilter, setOrderFilter] = useState(initialParams.order);

  const [payoutStatusFilter, setPayoutStatusFilter] = useState('all');
  const [payoutDateFilter, setPayoutDateFilter] = useState('30');

  const [openDropdown, setOpenDropdown] = useState(null);
  const [openRowMenu, setOpenRowMenu] = useState(null);
  const [pageSize, setPageSize] = useState('10');
  const [page, setPage] = useState(initialParams.page);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTxns, setTotalTxns] = useState(0);

  // Real backend state
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const filterRef = useRef(null);

  // Synchronize state with URL search parameters
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (activeTab && activeTab !== 'transactions') sp.set('tab', activeTab);
      else sp.delete('tab');

      if (search) sp.set('search', search);
      else sp.delete('search');

      if (txnStatusFilter && txnStatusFilter !== 'all') sp.set('status', txnStatusFilter);
      else sp.delete('status');

      if (methodFilter && methodFilter !== 'all') sp.set('method', methodFilter);
      else sp.delete('method');

      if (txnDateFilter && txnDateFilter !== '30') sp.set('range', txnDateFilter);
      else sp.delete('range');

      if (customerFilter) sp.set('customer', customerFilter);
      else sp.delete('customer');

      if (orderFilter) sp.set('order', orderFilter);
      else sp.delete('order');

      if (page > 1) sp.set('page', String(page));
      else sp.delete('page');

      const newQuery = sp.toString() ? `?${sp.toString()}` : '';
      const newUrl = `${window.location.pathname}${newQuery}`;
      if (window.location.search !== newQuery) {
        window.history.replaceState(null, '', newUrl);
      }
    } catch (err) {
      console.warn('[AdminPayments] URL sync warning:', err);
    }
  }, [activeTab, search, txnStatusFilter, methodFilter, txnDateFilter, customerFilter, orderFilter, page]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        setActiveTab(sp.get('tab') || 'transactions');
        setSearch(sp.get('search') || '');
        setTxnStatusFilter(sp.get('status') || 'all');
        setMethodFilter(sp.get('method') || 'all');
        setTxnDateFilter(sp.get('range') || '30');
        setCustomerFilter(sp.get('customer') || '');
        setOrderFilter(sp.get('order') || '');
        setPage(parseInt(sp.get('page'), 10) || 1);
      } catch (err) {
        console.warn('[AdminPayments] PopState warning:', err);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    window.setTimeout(() => setNotice(''), 2500);
  };

  // Load KPI stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await adminPaymentApi.getStats(txnDateFilter);
      setStats(data);
    } catch (err) {
      console.error('[AdminPayments] Error fetching stats:', err);
    }
  }, [txnDateFilter]);

  // Load transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminPaymentApi.getTransactions({
        page,
        limit: pageSize,
        search,
        status: txnStatusFilter,
        method: methodFilter,
        periodDays: txnDateFilter,
        customer: customerFilter,
        order: orderFilter,
      });
      setTransactions(res.transactions || []);
      setTotalTxns(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('[AdminPayments] Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, txnStatusFilter, methodFilter, txnDateFilter, customerFilter, orderFilter]);

  // Load payouts
  const fetchPayouts = useCallback(async () => {
    try {
      const data = await adminPaymentApi.getPayouts({ status: payoutStatusFilter });
      setPayouts(data || []);
    } catch (err) {
      console.error('[AdminPayments] Error fetching payouts:', err);
    }
  }, [payoutStatusFilter]);

  // Load payment methods
  const fetchMethods = useCallback(async () => {
    try {
      const data = await adminPaymentApi.getMethods();
      setMethods(data || []);
    } catch (err) {
      console.error('[AdminPayments] Error fetching payment methods:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    } else if (activeTab === 'payouts') {
      fetchPayouts();
    } else if (activeTab === 'methods') {
      fetchMethods();
    }
  }, [activeTab, fetchTransactions, fetchPayouts, fetchMethods]);

  const dynamicMethodOptions = useMemo(() => {
    const list = [{ id: 'all', label: 'All methods' }];
    if (methods && methods.length > 0) {
      methods.forEach((m) => {
        if (m.methodKey !== 'cod') {
          list.push({
            id: m.methodKey || m.id?.toLowerCase(),
            label: m.name?.replace(/\s*\(Chapa\)/i, '') || m.name,
          });
        }
      });
    } else {
      list.push(
        { id: 'telebirr', label: 'Telebirr' },
        { id: 'cbebirr', label: 'CBE Birr' },
        { id: 'card', label: 'Debit / Credit Card' }
      );
    }
    return list;
  }, [methods]);

  const kpiStats = useMemo(() => {
    if (!stats) {
      return [
        { label: 'Total received', value: '$0.00', trend: '-', tone: 'neutral' },
        { label: 'Pending', value: '$0.00', trend: '-', tone: 'neutral' },
        { label: 'Failed payments', value: '0', trend: '-', tone: 'neutral' },
        { label: 'Next payout', value: '-', trend: '-', tone: 'neutral' },
      ];
    }

    return [
      {
        label: 'Total received',
        value: money(stats.totalReceived?.usd || 0),
        trend: stats.totalReceived?.trend || '-',
        tone: stats.totalReceived?.tone || 'positive',
      },
      {
        label: 'Pending',
        value: money(stats.pending?.usd || 0),
        trend: stats.pending?.trend || '-',
        tone: stats.pending?.tone || 'neutral',
      },
      {
        label: 'Failed payments',
        value: String(stats.failed?.count ?? 0),
        trend: stats.failed?.trend || '-',
        tone: stats.failed?.tone || 'neutral',
      },
      {
        label: 'Next payout',
        value: stats.nextPayout?.amount ? money(stats.nextPayout.amount) : '-',
        trend: stats.nextPayout?.trend || '-',
        tone: stats.nextPayout?.tone || 'neutral',
      },
    ];
  }, [stats]);

  const tabs = useMemo(() => {
    return [
      { id: 'transactions', label: 'Transactions', count: stats?.tabCounts?.transactions ?? totalTxns },
      { id: 'payouts', label: 'Payouts', count: stats?.tabCounts?.payouts ?? payouts.length },
      { id: 'methods', label: 'Payment Methods', count: stats?.tabCounts?.methods ?? methods.length },
    ];
  }, [stats, totalTxns, payouts.length, methods.length]);

  const handleExport = async () => {
    notify('Preparing payments export…');
    try {
      const blob = await adminPaymentApi.exportCsv({
        status: txnStatusFilter,
        method: methodFilter,
        periodDays: txnDateFilter,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `novashop_transactions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('Transactions CSV downloaded successfully.');
    } catch (err) {
      console.error('[AdminPayments] Export error:', err);
      notify('Failed to generate export file.');
    }
  };

  const handlePaymentSettings = () => {
    if (go) {
      go('/admin/payments/settings');
      return;
    }
    notify('Opening payment settings…');
  };

  const handleConfigureProvider = () => {
    if (go) {
      go('/admin/payments/settings');
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

  const handleTxnMenuAction = async (txn, action) => {
    setOpenRowMenu(null);

    if (action === 'details') {
      if (go) {
        go(`/admin/payments/${txn.id}`);
        return;
      }
      setSelectedTxn(txn);
      return;
    }

    if (action === 'order') {
      const orderIdentifier = String(txn.rawOrderId || txn.orderId || '').replace(/^#/, '');
      if (orderIdentifier) {
        if (go) {
          go(`/admin/orders/${orderIdentifier}`);
          return;
        }
        window.location.href = `/admin/orders/${orderIdentifier}`;
        return;
      }
      notify(`Opening order #${txn.orderId}…`);
      return;
    }

    if (action === 'customer') {
      const custId = txn.rawCustomerId || txn.customerId || txn.userId;
      const query = txn.email || txn.customer || '';
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      if (custId) params.set('customer', custId);
      const targetUrl = `/admin/customers${params.toString() ? `?${params.toString()}` : ''}`;
      if (go) go(targetUrl);
      else window.location.href = targetUrl;
      return;
    }

    if (action === 'copy') {
      navigator.clipboard?.writeText(txn.id).catch(() => {});
      notify(`Transaction ID ${txn.id} copied.`);
      return;
    }

    if (action === 'reverify') {
      notify('Verifying with Chapa gateway…');
      try {
        const res = await adminPaymentApi.reverifyTransaction(txn.id);
        notify(res.message || 'Transaction reverified successfully.');
        fetchTransactions();
        fetchStats();
      } catch (err) {
        notify(err.response?.data?.message || err.message || 'Re-verification failed.');
      }
      return;
    }

    if (action === 'receipt') {
      notify('Queueing receipt email…');
      try {
        await adminPaymentApi.resendReceipt(txn.id, txn.email);
        notify(`Payment receipt sent to ${txn.email}.`);
      } catch (err) {
        notify(err.response?.data?.message || err.message || 'Failed to send receipt.');
      }
      return;
    }
  };

  const handlePayoutMenuAction = (payout, action) => {
    setOpenRowMenu(null);

    if (action === 'details') {
      if (go) {
        go(`/admin/payments/payouts/${payout.id}`);
        return;
      }
      window.location.href = `/admin/payments/payouts/${payout.id}`;
      return;
    }

    if (action === 'statement') {
      try {
        const content = [
          `NOVASHOP PAYOUT SUMMARY REPORT`,
          `Generated: ${new Date().toLocaleString()}`,
          `----------------------------------------`,
          `Payout ID: #${payout.id}`,
          `Status: ${payout.status?.toUpperCase()}`,
          `Amount: $${Number(payout.amount || 0).toFixed(2)} USD`,
          `Destination: ${payout.destination}`,
          `Orders: ${payout.orders || 0}`,
          `Expected Arrival: ${payout.expectedArrival || '-'}`,
          `Reference: ${payout.reference || '-'}`,
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Payout_${payout.id}_Summary.txt`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        notify(`Payout statement for #${payout.id} downloaded.`);
      } catch {
        notify('Failed to download payout statement.');
      }
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
          {activeTab === 'payouts' && (
            <button
              type="button"
              className="admin-action-button is-primary"
              onClick={() => (go ? go('/admin/payments/payouts/new') : (window.location.href = '/admin/payments/payouts/new'))}
            >
              <AdminIcon name="plus" size={14} />
              Record payout
            </button>
          )}

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
        {kpiStats.map((stat) => (
          <article
            className="admin-stat-card pay-stat-card"
            key={stat.label}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (stat.label === 'Total received') {
                setActiveTab('transactions');
                setTxnStatusFilter('all');
              } else if (stat.label === 'Failed payments') {
                setActiveTab('transactions');
                setTxnStatusFilter('failed');
              } else if (stat.label === 'Next payout') {
                setActiveTab('payouts');
              }
            }}
            title={`Filter by ${stat.label}`}
          >
            <span className="admin-stat-label">{stat.label}</span>

            <div className="pay-stat-row">
              <strong className="admin-stat-value">{stat.value}</strong>
              <span className={`pay-trend-pill is-${stat.tone}`}>{stat.trend}</span>
            </div>
          </article>
        ))}
      </section>

      {/* Removable Filter Chips for Customer & Order */}
      {(customerFilter || orderFilter) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '-4px 0 12px' }}>
          {customerFilter && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
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
              borderRadius: '9999px',
              fontSize: '12px',
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
        </div>
      )}

      {/* TABS */}
      <div className="pay-tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`pay-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
            <b>{Number(tab.count || 0).toLocaleString()}</b>
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
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Filter by order, customer, or transaction ID…"
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
                setPage(1);
                setOpenDropdown(null);
              }}
            />

            <FilterDropdown
              label="Method"
              value={methodFilter}
              options={dynamicMethodOptions}
              isOpen={openDropdown === 'method'}
              onToggle={() => setOpenDropdown(openDropdown === 'method' ? null : 'method')}
              onChange={(value) => {
                setMethodFilter(value);
                setPage(1);
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
                setPage(1);
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
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#8A847C' }}>
                      {loading ? 'Loading transactions…' : 'No transactions found.'}
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <button
                          type="button"
                          className="pay-order-link"
                          onClick={() => handleTxnMenuAction(txn, 'order')}
                        >
                          <strong>#{txn.orderId}</strong>
                        </button>
                      </td>

                      <td>
                        <div
                          className="pay-customer-cell"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleTxnMenuAction(txn, 'customer')}
                        >
                          <strong style={{ textDecoration: 'underline' }}>{txn.customer}</strong>
                          <span>{txn.email}</span>
                        </div>
                      </td>

                      <td>
                        <div className="pay-method-cell">
                          <span className="pay-method-icon">
                            <AdminIcon name={METHOD_ICON[txn.method] || 'payments'} size={15} />
                          </span>
                          <div>
                            <strong>{txn.label}</strong>
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
                          {STATUS_LABEL[txn.status] || txn.status}
                        </span>
                      </td>

                      <td className="pay-actions-cell pay-col-actions" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActionMenu
                          item={txn}
                          title={txn.id && txn.id.length > 18 ? `${txn.id.slice(0, 8)}…${txn.id.slice(-6)}` : txn.id}
                          subtitle={`${txn.customer || 'Customer'} · ${money(txn.amount)}`}
                          items={[
                            {
                              label: 'View details',
                              icon: 'eye',
                              onClick: () => handleTxnMenuAction(txn, 'details'),
                            },
                            {
                              label: 'View order',
                              icon: 'document',
                              onClick: () => handleTxnMenuAction(txn, 'order'),
                            },
                            {
                              label: 'View customer',
                              icon: 'customers',
                              onClick: () => handleTxnMenuAction(txn, 'customer'),
                            },
                            {
                              label: 'Re-verify with Chapa',
                              icon: 'refresh',
                              onClick: () => handleTxnMenuAction(txn, 'reverify'),
                            },
                            {
                              label: 'Resend receipt email',
                              icon: 'email',
                              onClick: () => handleTxnMenuAction(txn, 'receipt'),
                            },
                            {
                              divider: true,
                            },
                            {
                              label: 'Copy transaction ID',
                              icon: 'copy',
                              onClick: () => handleTxnMenuAction(txn, 'copy'),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
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
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#8A847C' }}>
                      No payout records found.
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td>
                        <button
                          type="button"
                          className="pay-order-link"
                          onClick={() => {
                            if (go) go(`/admin/payments/payouts/${payout.id}`);
                            else window.location.href = `/admin/payments/payouts/${payout.id}`;
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
                          title="View payout details"
                        >
                          <strong style={{ textDecoration: 'underline' }}>#{payout.id}</strong>
                        </button>
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
                          {STATUS_LABEL[payout.status] || payout.status}
                        </span>
                      </td>

                      <td className="pay-actions-cell pay-col-actions" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActionMenu
                          item={payout}
                          title={payout.id}
                          subtitle={`${payout.destination || 'Bank'} · ${money(payout.amount)}`}
                          items={[
                            {
                              label: 'View details',
                              icon: 'eye',
                              onClick: () => handlePayoutMenuAction(payout, 'details'),
                            },
                            {
                              label: 'Download statement',
                              icon: 'download',
                              onClick: () => handlePayoutMenuAction(payout, 'statement'),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* ---------------- PAYMENT METHODS ---------------- */}
          {activeTab === 'methods' && (
            <>
              <div
                style={{
                  padding: '12px 16px',
                  margin: '12px 16px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AdminIcon name="lock" size={15} />
                <span>
                  <strong>Gateway Note:</strong> Active payment channels (Telebirr, CBE Birr, Card) are dynamically managed through Chapa Hosted Checkout based on merchant verification and device support.
                </span>
              </div>
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

                      <td className="pay-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActionMenu
                          item={method}
                          title={method.name}
                          subtitle={`${method.provider || 'Gateway'} · ${method.enabled ? 'Enabled' : 'Disabled'}`}
                          items={[
                            {
                              label: 'Edit method',
                              icon: 'edit',
                              onClick: () => handleMethodMenuAction(method, 'edit'),
                            },
                            {
                              label: 'Configure fees',
                              icon: 'sliders',
                              onClick: () => handleMethodMenuAction(method, 'fees'),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {activeTab === 'transactions' && (
          <div className="pay-table-footer">
            <span>
              Showing <strong>{transactions.length > 0 ? (page - 1) * Number(pageSize) + 1 : 0}–{Math.min(page * Number(pageSize), totalTxns)}</strong> of{' '}
              {totalTxns.toLocaleString()} transactions
            </span>

            <div className="pay-pagination">
              <label className="pay-page-size">
                <select value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1); }}>
                  <option value="10">10 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                </select>
                <AdminIcon name="chevron" size={12} />
              </label>

              <div className="pay-page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={page === p ? 'is-active' : ''}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
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
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div className="pay-table-footer">
            <span>
              Showing <strong>{payouts.length}</strong> of {payouts.length} payouts
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
                    <div style={{fontSize: '18px', fontWeight: '600', color: '#1B1816', marginTop: '4px'}}>
                      {money(selectedTxn.amount)} {selectedTxn.amountETB ? `(${selectedTxn.amountETB.toLocaleString()} ETB)` : ''}
                    </div>
                  </div>
                  <span className={`pay-status-pill is-${selectedTxn.status}`}>
                    <i /> {STATUS_LABEL[selectedTxn.status] || selectedTxn.status}
                  </span>
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
                    <span>Chapa Gateway Reference</span>
                    <span style={{color: '#1B1816', fontSize: '11px', fontFamily: 'monospace'}}>{selectedTxn.chapaReference || selectedTxn.id}</span>
                  </div>
                  <div className="pay-slide-card-divider" />
                  <div className="pay-slide-card-row" style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>
                    <span>Net settled</span>
                    <span>{money(selectedTxn.amount)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="pay-slide-section-title">METHOD & PROVIDER</div>
                <div className="pay-slide-card" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                    <div className="pay-method-icon"><AdminIcon name={METHOD_ICON[selectedTxn.method] || 'payments'} size={16} /></div>
                    <div>
                      <div style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>{selectedTxn.methodType}</div>
                      <div style={{fontSize: '12px', color: '#8A847C'}}>{selectedTxn.label}</div>
                    </div>
                  </div>
                  <div style={{fontSize: '11px', color: '#8A847C', display: 'flex', gap: '16px'}}>
                    <span>Gateway: <strong style={{color: '#10B981'}}>Chapa Ethiopia</strong></span>
                    <span>Status: <strong style={{color: '#1B1816'}}>{selectedTxn.status?.toUpperCase()}</strong></span>
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
                      <div style={{fontSize: '12px', color: '#8A847C'}}>
                        {selectedTxn.orderItems?.length > 0
                          ? selectedTxn.orderItems.map((item) => `${item.name} (${item.size || 'OS'})`).join(', ')
                          : 'NovaShop Garment Order'}
                      </div>
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
                      {selectedTxn.customer?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'C'}
                    </div>
                    <div>
                      <div style={{fontSize: '14px', fontWeight: '600', color: '#1B1816'}}>{selectedTxn.customer}</div>
                      <div style={{fontSize: '12px', color: '#8A847C'}}>{selectedTxn.email}</div>
                    </div>
                  </div>
                  <div style={{fontSize: '12px', color: '#8A847C', lineHeight: '1.5'}}>
                    <strong style={{color: '#1B1816', display: 'block', marginBottom: '2px'}}>Billing / Delivery Destination:</strong>
                    {selectedTxn.shippingAddress ? (
                      <>
                        {selectedTxn.shippingAddress.address}, {selectedTxn.shippingAddress.city}<br/>
                        {selectedTxn.shippingAddress.country} · {selectedTxn.shippingAddress.phone || selectedTxn.phone || ''}
                      </>
                    ) : (
                      'Addis Ababa, Ethiopia'
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pay-slide-footer">
              <button
                className="pay-slide-btn-refund"
                onClick={() => {
                  if (go) {
                    go('/admin/returns');
                  } else {
                    notify('Redirecting to returns & refunds…');
                  }
                  setSelectedTxn(null);
                }}
              >
                VIEW RETURNS & REFUNDS
              </button>
              <button className="pay-slide-btn-done" onClick={() => setSelectedTxn(null)}>DONE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
