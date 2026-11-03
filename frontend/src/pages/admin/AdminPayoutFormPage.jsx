import { useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminPaymentApi from '../../lib/api/adminPaymentApi';
import './admin-payments.css';

export default function AdminPayoutFormPage({ go }) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('Commercial Bank of Ethiopia (•••• 1042)');
  const [ordersCount, setOrdersCount] = useState('');
  const [expectedArrival, setExpectedArrival] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [reference, setReference] = useState(() => `PO-MANUAL-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('paid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please provide a valid payout disbursement amount.');
      return;
    }
    if (!destination.trim()) {
      setError('Please specify the destination bank account or mobile wallet.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await adminPaymentApi.recordPayout({
        amount: Number(amount),
        destination: destination.trim(),
        ordersCount: Number(ordersCount) || 0,
        expectedArrival,
        reference: reference.trim(),
        notes: notes.trim(),
        status,
      });

      notify(res?.message || 'Payout disbursement record created successfully.');
      setTimeout(() => {
        if (go) go('/admin/payments?tab=payouts');
        else window.location.href = '/admin/payments?tab=payouts';
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record payout.');
    } finally {
      setLoading(false);
    }
  };

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
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Record payout</span>
          </div>

          <h1 className="admin-page-title">Record Payout</h1>
          <p className="admin-page-description">
            Log an offline or sandbox merchant payout to track store disbursements and balance.
          </p>
        </div>

        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-action-button"
            onClick={() => go ? go('/admin/payments?tab=payouts') : (window.location.href = '/admin/payments?tab=payouts')}
          >
            Cancel
          </button>
        </div>
      </section>

      {/* CHAPA SANDBOX NOTICE */}
      <div
        style={{
          background: 'var(--bg-surface-raised, rgba(215, 164, 95, 0.08))',
          border: '1px solid var(--border-default, rgba(215, 164, 95, 0.25))',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          fontSize: '13px',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ color: 'var(--color-gold, #D7A45F)', marginTop: '2px' }}>
          <AdminIcon name="alert" size={18} />
        </span>
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>
            Chapa Test Sandbox Environment Notice
          </strong>
          <span>
            Chapa test mode simulated transactions do not perform automated bank wire transfers.
            Use this form to reconcile simulated store disbursements and track merchant accounting.
          </span>
        </div>
      </div>

      {error && (
        <div className="admin-toast" style={{ background: '#7F1D1D', color: '#FEE2E2', position: 'static', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* FORM CARD */}
      <section className="pay-table-card" style={{ padding: '28px', maxWidth: '720px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Payout Amount (USD) *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 1250.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 28px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                <option value="paid">Paid (Disbursed)</option>
                <option value="scheduled">Scheduled (Pending)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Destination Bank / Account *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Commercial Bank of Ethiopia (•••• 1042)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Orders Covered Count
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 18"
                value={ordersCount}
                onChange={(e) => setOrdersCount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Expected Arrival Date
              </label>
              <input
                type="date"
                value={expectedArrival}
                onChange={(e) => setExpectedArrival(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Bank Reference Number
            </label>
            <input
              type="text"
              placeholder="e.g. CBE-TRX-9481920"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Internal Reconciliation Notes
            </label>
            <textarea
              rows={3}
              placeholder="Optional reconciliation remarks for finance records…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              className="admin-action-button"
              onClick={() => go ? go('/admin/payments?tab=payouts') : (window.location.href = '/admin/payments?tab=payouts')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="admin-action-button is-primary"
            >
              {loading ? 'Recording…' : 'Save Payout Record'}
            </button>
          </div>
        </form>
      </section>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
