import { useEffect, useState, useRef } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminApi from '../../lib/api/adminApi';
import { formatCurrency, formatRelativeTime } from '../../lib/formatters';
import AdminSendEmailModal from '../../components/admin/AdminSendEmailModal';
import { BlockCustomerModal, SafeDeleteCustomerModal } from '../../components/admin/AdminCustomerModals';
import './admin-customer-detail.css';

function CustomerCard({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`admin-card cd-card ${className}`}>
      <header className="cd-card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export default function AdminCustomerDetailPage({ customerId, go }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modals state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState(null);

  const notify = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const loadCustomer = () => {
    if (!customerId) return;
    setLoading(true);
    setError('');

    adminApi
      .getCustomer(customerId)
      .then((res) => {
        if (res.data) {
          setCustomer(res.data);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || 'Customer account not found.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const handleBlockConfirm = async (reason) => {
    if (!customer) return;
    const isCurrentlyBlocked =
      customer.status === 'blocked' || customer.status === 'deactivated' || customer.isDeactivated;
    const nextStatus = isCurrentlyBlocked ? 'active' : 'blocked';

    try {
      await adminApi.updateCustomerStatus(customer._id, nextStatus, reason);
      notify(`Customer account ${isCurrentlyBlocked ? 'reactivated' : 'blocked'}.`);
      loadCustomer();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to update customer status.');
    }
  };

  const handlePermanentDelete = async () => {
    if (!customer) return;
    try {
      await adminApi.deleteCustomer(customer._id);
      notify('Customer account permanently deleted.');
      window.setTimeout(() => go('/admin/customers'), 500);
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to delete customer.');
    }
  };

  const handleAnonymize = async () => {
    if (!customer) return;
    try {
      await adminApi.deleteCustomer(customer._id, 'anonymize');
      notify('Customer data scrubbed and account deactivated. Order records preserved for accounting.');
      loadCustomer();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to anonymize customer.');
    }
  };

  const [resendingInvite, setResendingInvite] = useState(false);

  const handleResendInviteOrVerification = async () => {
    if (!customer || resendingInvite) return;
    setResendingInvite(true);
    try {
      if (customer.status === 'invited') {
        const res = await adminApi.resendCustomerInvite(customer._id);
        notify(res.message || 'Account invitation email resent.');
      } else {
        const res = await adminApi.resendCustomerVerification(customer._id);
        notify(res.message || 'Verification email dispatched.');
      }
      await loadCustomer();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to send email.');
    } finally {
      setResendingInvite(false);
    }
  };

  const handleRetryEmail = async (logId) => {
    if (!customer) return;
    setRetryingLogId(logId);
    try {
      const res = await adminApi.retryCustomerEmail(customer._id, logId);
      notify(res.message || 'Email resent successfully.');
      loadCustomer();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to retry email delivery.');
    } finally {
      setRetryingLogId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard p-12 text-center text-xs text-[var(--text-muted)]">
        Loading customer record from database…
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="admin-dashboard p-12 text-center">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Customer Not Found</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">{error || 'This customer profile does not exist.'}</p>
        <button
          className="admin-action-button is-primary mt-4 inline-flex"
          type="button"
          onClick={() => go('/admin/customers')}
        >
          Back to Customers
        </button>
      </div>
    );
  }

  const metrics = customer.metrics || {
    totalOrders: 0,
    paidOrdersCount: 0,
    totalSpent: 0,
    aov: 0,
    lastOrderDate: null,
  };

  const addresses = customer.addresses || [];
  const orders = customer.orders || [];
  const emailLogs = customer.emailLogs || [];

  const rawInitials = (customer.name || customer.email || 'Customer')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const initials = rawInitials || 'CU';
  const customerStatus = customer.status || 'active';
  const isBlocked = customerStatus === 'blocked' || customerStatus === 'deactivated';

  return (
    <div className="admin-dashboard cd-page">
      {/* Header */}
      <section className="admin-page-heading cd-header">
        <div className="cd-title-area">
          <button className="pe-breadcrumb" type="button" onClick={() => go('/admin/customers')}>
            ← Customers
          </button>
          <div className="flex items-center gap-3 mt-1">
            <span className="w-10 h-10 rounded-full bg-[var(--bg-surface-raised)] border border-[var(--border-default)] text-[var(--text-primary)] flex items-center justify-center text-sm font-bold font-mono">
              {initials}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="admin-page-title text-[var(--text-primary)]">{customer.name}</h1>
                <span className={`customers-status-pill ${customerStatus.toLowerCase()}`}>
                  <i />
                  {customerStatus.charAt(0).toUpperCase() + customerStatus.slice(1)}
                </span>
                {customer.isVerified ? (
                  <span className="rounded bg-[var(--color-success-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-success)]">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="rounded bg-[var(--color-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-warning)]">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {customer.email} {customer.phone ? `· ${customer.phone}` : ''} · Joined {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="admin-page-actions flex items-center gap-2 flex-wrap">
          {(!customer.isVerified || customerStatus === 'invited') && (
            <button
              className="admin-action-button"
              type="button"
              disabled={resendingInvite}
              onClick={handleResendInviteOrVerification}
            >
              {resendingInvite
                ? 'Resending…'
                : customerStatus === 'invited'
                ? 'Resend Invite'
                : 'Resend Verification'}
            </button>
          )}

          <button
            className="admin-action-button"
            type="button"
            onClick={() => go(`/admin/orders?customer=${customer._id}`)}
          >
            <AdminIcon name="bag" size={14} /> View Orders
          </button>

          <button
            className="admin-action-button"
            type="button"
            onClick={() => go(`/admin/returns?customer=${customer._id}`)}
          >
            <AdminIcon name="returns" size={14} /> View Returns
          </button>

          <button
            className="admin-action-button"
            type="button"
            onClick={() => setEmailModalOpen(true)}
            disabled={isBlocked}
          >
            <AdminIcon name="mail" size={14} /> Send Email
          </button>

          <button
            className="admin-action-button"
            type="button"
            onClick={() => go(`/admin/customers/${customer._id}/edit`)}
          >
            <AdminIcon name="edit" size={14} /> Edit Customer
          </button>

          <button
            className={`admin-action-button ${isBlocked ? 'is-primary' : 'is-danger'}`}
            type="button"
            onClick={() => setBlockModalOpen(true)}
          >
            {isBlocked ? 'Reactivate Account' : 'Block Account'}
          </button>

          <button
            className="admin-action-button is-danger"
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            aria-label="Delete or anonymize customer"
          >
            <AdminIcon name="trash" size={14} />
          </button>
        </div>
      </section>

      {/* KPI Stats */}
      <section className="admin-stat-grid cd-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Lifetime Paid Spend</span>
          </div>
          <div className="admin-stat-value text-[var(--text-primary)]">{formatCurrency(metrics.totalSpent)}</div>
          <span className="text-[11px] text-[var(--text-muted)]">Paid orders total</span>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total Orders</span>
          </div>
          <div className="admin-stat-value text-[var(--text-primary)]">{metrics.totalOrders}</div>
          <span className="text-[11px] text-[var(--text-muted)]">{metrics.paidOrdersCount} paid / completed</span>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Average Order Value</span>
          </div>
          <div className="admin-stat-value text-[var(--text-primary)]">{formatCurrency(metrics.aov)}</div>
          <span className="text-[11px] text-[var(--text-muted)]">Revenue per paid order</span>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Last Order Date</span>
          </div>
          <div className="admin-stat-value text-sm font-semibold text-[var(--text-primary)]">
            {metrics.lastOrderDate ? new Date(metrics.lastOrderDate).toLocaleDateString() : 'None yet'}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {metrics.lastOrderDate ? formatRelativeTime(metrics.lastOrderDate) : 'No order history'}
          </span>
        </article>
      </section>

      {/* Layout Grid */}
      <div className="cd-grid">
        {/* Left Column: Orders & Email Logs */}
        <div className="cd-main-column space-y-6">
          {/* Order History */}
          <CustomerCard
            title="Order History"
            subtitle={`${orders.length} total order(s) placed by this customer`}
          >
            {orders.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">No orders placed yet.</p>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="py-2.5 px-3">Order Number</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Items Count</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {orders.map((o) => (
                      <tr
                        key={o._id}
                        className="hover:bg-[var(--bg-hover)] cursor-pointer"
                        onClick={() => go(`/admin/orders/${o._id}`)}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-[var(--text-primary)]">
                          #{o.orderNumber || o._id.slice(-6)}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                          {(o.orderItems || []).reduce((acc, it) => acc + (it.qty || 1), 0)} items
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                          {formatCurrency(o.totalPrice)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.isPaid || o.paymentStatus === 'paid'
                                ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                                : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                            }`}
                          >
                            {o.isPaid || o.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`products-status-pill text-[10px] ${(o.status || 'pending').toLowerCase()}`}>
                            <i />
                            {o.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CustomerCard>

          {/* Email Communication Log */}
          <CustomerCard
            title="Email Communication Log"
            subtitle="Authoritative log of transactional notices, invoices, and customer communications"
            right={
              <button
                type="button"
                className="admin-action-button"
                onClick={() => setEmailModalOpen(true)}
                disabled={isBlocked}
                style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
              >
                <AdminIcon name="plus" size={13} /> Compose Email
              </button>
            }
          >
            {emailLogs.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">No emails logged for this customer.</p>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date Dispatched</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {emailLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-[var(--bg-hover)]">
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)] truncate max-w-xs">
                          {log.subject}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                          {log.type}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            title={log.bounceReason || log.error || (log.status === 'sent' ? 'Delivered successfully via SMTP' : '')}
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'sent'
                                ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                                : log.status === 'bounced'
                                ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                                : log.status === 'queued'
                                ? 'bg-[var(--color-info-soft)] text-[var(--color-info)]'
                                : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                            }`}
                          >
                            {log.status ? log.status.toUpperCase() : 'UNKNOWN'}
                          </span>
                          {(log.bounceReason || log.error) && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px] mt-0.5" title={log.bounceReason || log.error}>
                              {log.bounceReason || log.error}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-muted)]">
                          {formatRelativeTime(log.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {(log.status === 'failed' || log.status === 'bounced') && (
                            <button
                              type="button"
                              className="admin-action-button is-primary"
                              disabled={retryingLogId === log._id}
                              onClick={() => handleRetryEmail(log._id)}
                              style={{ minHeight: '26px', padding: '0 8px', fontSize: '10px' }}
                            >
                              {retryingLogId === log._id ? 'Retrying…' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CustomerCard>
        </div>

        {/* Right Column: Profile & Addresses */}
        <div className="cd-side-column space-y-6">
          {/* Profile Card */}
          <CustomerCard title="Customer Profile">
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Full Name</span>
                <span className="font-semibold text-[var(--text-primary)]">{customer.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Email Address</span>
                <span className="font-medium text-[var(--text-primary)]">{customer.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Phone Number</span>
                <span className="font-mono text-[var(--text-primary)]">{customer.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Account Status</span>
                <span className="capitalize font-bold text-[var(--text-primary)]">{customer.status}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Member Since</span>
                <span className="text-[var(--text-primary)]">{new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CustomerCard>

          {/* Saved Addresses */}
          <CustomerCard
            title="Saved Addresses"
            subtitle={`${addresses.length} address${addresses.length === 1 ? '' : 'es'} on file`}
          >
            {addresses.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No saved addresses on file.</p>
            ) : (
              <div className="space-y-3 mt-2">
                {addresses.map((addr) => (
                  <div
                    key={addr._id}
                    className="p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-[var(--text-primary)]">{addr.label || 'Home'}</strong>
                      {addr.isDefault && (
                        <span className="rounded bg-[var(--color-success-soft)] text-[var(--color-success)] text-[9px] font-bold px-1.5 py-0.5">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)]">
                      {addr.firstName} {addr.lastName} {addr.phone ? `· ${addr.phone}` : ''}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      {addr.street} {addr.street2 ? `, ${addr.street2}` : ''}
                    </p>
                    <p className="text-[var(--text-muted)]">
                      {addr.city}, {addr.state || ''} {addr.postalCode} · {addr.country}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CustomerCard>
        </div>
      </div>

      {/* Send Email Modal */}
      <AdminSendEmailModal
        customer={customer}
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSuccess={(msg) => {
          notify(msg);
          loadCustomer();
        }}
      />

      {/* Block / Reactivate Modal */}
      <BlockCustomerModal
        customer={customer}
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onConfirm={handleBlockConfirm}
      />

      {/* Safe Delete / Anonymize Modal */}
      <SafeDeleteCustomerModal
        customer={customer}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmPermanentDelete={handlePermanentDelete}
        onConfirmAnonymize={handleAnonymize}
      />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}
