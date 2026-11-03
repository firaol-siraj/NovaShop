import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminPaymentApi from '../../lib/api/adminPaymentApi';
import { formatCurrency } from '../../lib/formatters';
import './admin-payments.css';

export default function AdminPayoutDetailPage({ payoutId, go }) {
  const [payout, setPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  useEffect(() => {
    const fetchPayout = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await adminPaymentApi.getPayoutDetail(payoutId);
        if (data) {
          setPayout(data);
        } else {
          setError('Payout record not found');
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load payout details');
      } finally {
        setLoading(false);
      }
    };

    if (payoutId) {
      fetchPayout();
    }
  }, [payoutId]);

  const handleDownloadSummary = () => {
    if (!payout) return;
    try {
      const summaryContent = [
        `NOVASHOP PAYOUT SUMMARY REPORT`,
        `Generated: ${new Date().toLocaleString()}`,
        `----------------------------------------`,
        `Payout ID: #${payout.id}`,
        `Status: ${payout.status?.toUpperCase()}`,
        `Amount: $${Number(payout.amount || 0).toFixed(2)} USD`,
        `Destination: ${payout.destination}`,
        `Orders Count: ${payout.ordersCount || payout.orders || 0}`,
        `Expected Arrival: ${payout.expectedArrivalFormatted || '-'}`,
        `Bank Reference: ${payout.reference || '-'}`,
        `Recorded By: ${payout.recordedBy?.name || 'Administrator'} (${payout.recordedBy?.email || '-'})`,
        `Created At: ${payout.createdAt ? new Date(payout.createdAt).toLocaleString() : '-'}`,
        `Notes: ${payout.notes || 'None'}`,
      ].join('\n');

      const blob = new Blob([summaryContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payout_${payout.id}_Summary.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify(`Downloaded summary statement for Payout #${payout.id}`);
    } catch {
      notify('Failed to generate summary download.');
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard payments-page">
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginBottom: '12px' }}>
            <AdminIcon name="refresh" size={24} />
          </div>
          <p>Loading payout details…</p>
        </div>
      </div>
    );
  }

  if (error || !payout) {
    return (
      <div className="admin-dashboard payments-page">
        <section className="pay-table-card" style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '580px', margin: '40px auto' }}>
          <span style={{ color: 'var(--color-gold, #D7A45F)', display: 'inline-block', marginBottom: '16px' }}>
            <AdminIcon name="alert" size={36} />
          </span>
          <h2 style={{ fontFamily: 'var(--font-serif, serif)', fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Payout Not Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
            {error || `The payout ID "${payoutId}" does not exist in store records.`}
          </p>
          <button
            type="button"
            className="admin-action-button is-primary"
            onClick={() => go ? go('/admin/payments?tab=payouts') : (window.location.href = '/admin/payments?tab=payouts')}
          >
            Back to Payouts
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-dashboard payments-page">
      {/* HEADER & BREADCRUMBS */}
      <section className="admin-page-heading pay-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <button
              type="button"
              onClick={() => go ? go('/admin/payments?tab=payouts') : (window.location.href = '/admin/payments?tab=payouts')}
              style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <AdminIcon name="arrowLeft" size={13} />
              <span>Payments</span>
            </button>
            <span>/</span>
            <span>Payouts</span>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>#{payout.id}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="admin-page-title">Payout #{payout.id}</h1>
            <span className={`pay-status-pill is-${payout.status}`}>
              <i />
              {payout.status === 'paid' ? 'Paid' : 'Scheduled'}
            </span>
          </div>
          <p className="admin-page-description">
            Merchant disbursement details and destination bank reconciliation.
          </p>
        </div>

        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-action-button"
            onClick={handleDownloadSummary}
          >
            <AdminIcon name="download" size={14} />
            Download summary
          </button>
          <button
            type="button"
            className="admin-action-button"
            onClick={() => go ? go('/admin/payments?tab=payouts') : (window.location.href = '/admin/payments?tab=payouts')}
          >
            Back to payouts
          </button>
        </div>
      </section>

      {/* DETAILS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', maxWidth: '1000px' }}>
        {/* FINANCIAL SUMMARY */}
        <section className="pay-table-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AdminIcon name="payments" size={16} />
            Disbursement Amount
          </h3>

          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amount</span>
            <div style={{ fontSize: '32px', fontFamily: 'var(--font-serif, serif)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
              ${Number(payout.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>USD</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Orders covered</span>
              <strong style={{ color: 'var(--text-primary)' }}>{payout.ordersCount || payout.orders || 0} orders</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status</span>
              <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{payout.status}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Expected arrival</span>
              <strong style={{ color: 'var(--text-primary)' }}>{payout.expectedArrivalFormatted || '-'}</strong>
            </div>
          </div>
        </section>

        {/* BANK DESTINATION & AUDIT */}
        <section className="pay-table-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AdminIcon name="document" size={16} />
            Destination & Audit
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Destination Bank / Account</span>
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{payout.destination}</strong>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Reference Number</span>
              <code style={{ fontSize: '13px', background: 'var(--bg-surface-raised)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                {payout.reference || '-'}
              </code>
            </div>

            {payout.recordedBy && (
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Recorded By</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  {payout.recordedBy.name} ({payout.recordedBy.email})
                </span>
              </div>
            )}

            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Record Created At</span>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                {payout.createdAt ? new Date(payout.createdAt).toLocaleString() : '-'}
              </span>
            </div>

            {payout.notes && (
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Reconciliation Notes</span>
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, background: 'var(--bg-surface-raised)', padding: '8px 12px', borderRadius: '6px' }}>
                  {payout.notes}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
