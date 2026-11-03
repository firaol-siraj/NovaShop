import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminPaymentApi from '../../lib/api/adminPaymentApi';
import { formatCurrency } from '../../lib/formatters';
import './admin-payments.css';

export default function AdminPaymentDetailPage({ paymentId, go }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await adminPaymentApi.getPaymentDetail(paymentId);
      setPayment(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paymentId) {
      fetchDetail();
    }
  }, [paymentId]);

  const handleReverify = async () => {
    if (!payment?.txRef) return;
    setActionLoading(true);
    notify('Contacting Chapa gateway for live verification…');
    try {
      const res = await adminPaymentApi.reverifyTransaction(payment.txRef);
      notify(res.message || 'Transaction re-verified successfully');
      fetchDetail();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Re-verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendReceipt = async () => {
    if (!payment?.txRef) return;
    setActionLoading(true);
    notify('Dispatching payment receipt…');
    try {
      const email = payment.customerEmail || payment.order?.customerEmail;
      await adminPaymentApi.resendReceipt(payment.txRef, email);
      notify(`Payment receipt queued for ${email || 'customer'}`);
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to send receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    notify(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="admin-dashboard payments-page" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading payment details…</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="admin-dashboard payments-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
        <button
          type="button"
          onClick={() => (go ? go('/admin/payments') : window.history.back())}
          className="admin-action-button"
          style={{ marginBottom: '16px' }}
        >
          <AdminIcon name="left" size={14} /> Back to Payments
        </button>
        <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
          {error || 'Payment not found'}
        </div>
      </div>
    );
  }

  const isSuccess = payment.status === 'success' || payment.status === 'paid';
  const isFailed = payment.status === 'failed' || payment.status === 'cancelled';
  const customerName = payment.customerName || payment.user?.name || payment.order?.shippingAddress?.recipientName || 'Valued Customer';
  const customerEmail = payment.customerEmail || payment.user?.email || payment.order?.customerEmail || '-';
  const customerPhone = payment.customerPhone || payment.order?.shippingAddress?.phone || '-';

  return (
    <div className="admin-dashboard payments-page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
      {notice && <div className="admin-toast">{notice}</div>}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => (go ? go('/admin/payments') : window.history.back())}
            className="admin-action-button"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <AdminIcon name="left" size={14} />
            Back to Payments
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="admin-page-title" style={{ fontSize: '22px', margin: 0 }}>
                {payment.txRef}
              </h1>
              <span className={`pay-status-pill is-${isSuccess ? 'paid' : isFailed ? 'failed' : 'pending'}`}>
                <i />
                {isSuccess ? 'Paid' : isFailed ? 'Failed' : 'Pending'}
              </span>
            </div>
            <p className="admin-page-description" style={{ margin: '4px 0 0' }}>
              Initiated on {new Date(payment.createdAt).toLocaleString()}
              {payment.paidAt && ` · Completed on ${new Date(payment.paidAt).toLocaleString()}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleCopy(payment.txRef, 'Transaction reference')}
            className="admin-action-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <AdminIcon name="copy" size={14} />
            Copy Ref
          </button>

          {!isSuccess && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleReverify}
              className="admin-action-button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <AdminIcon name="refresh" size={14} />
              Re-verify with Chapa
            </button>
          )}

          {isSuccess && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleResendReceipt}
              className="admin-action-button is-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <AdminIcon name="mail" size={14} />
              Resend Receipt
            </button>
          )}
        </div>
      </div>

      {/* GRID OF DETAILS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* PAYMENT SUMMARY CARD */}
        <section className="pay-table-card" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AdminIcon name="payments" size={16} />
            Financial Breakdown
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Amount (USD)</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{formatCurrency(payment.amountUSD, 'USD')}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Amount (ETB)</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{formatCurrency(payment.amountETB, 'ETB')}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Payment Channel</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                {payment.label || payment.method}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Provider</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>
                {payment.provider || 'Chapa'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Gateway Reference</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>
                {payment.chapaReference || payment.txRef}
              </span>
            </div>
          </div>
        </section>

        {/* CUSTOMER CARD */}
        <section className="pay-table-card" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AdminIcon name="customers" size={16} />
            Customer & Order
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Customer</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{customerName}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Email</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{customerEmail}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Phone</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{customerPhone}</span>
            </div>

            {payment.order && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Linked Order</span>
                <button
                  type="button"
                  onClick={() => go && go(`/admin/orders/${payment.order._id || payment.order}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-gold, #D7A45F)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  #{payment.order.orderNumber || payment.order._id}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* RAW GATEWAY VERIFICATION DATA */}
      {payment.rawProviderStatus && (
        <section className="pay-table-card" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            Chapa Gateway Response Payload
          </h2>
          <pre
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg-surface-sunken)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(payment.rawProviderStatus, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
