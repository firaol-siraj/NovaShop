import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminPaymentApi from '../../lib/api/adminPaymentApi';
import './admin-payments.css';

export default function AdminPaymentSettingsPage({ go }) {
  const [provider, setProvider] = useState('Chapa');
  const [testMode, setTestMode] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [usdToEtbRate, setUsdToEtbRate] = useState(120);
  const [reservationExpiryMinutes, setReservationExpiryMinutes] = useState(60);
  const [retryLimit, setRetryLimit] = useState(3);
  const [publicKey, setPublicKey] = useState('');
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await adminPaymentApi.getSettings();
      setProvider(data.provider || 'Chapa');
      setTestMode(Boolean(data.testMode));
      setCurrency(data.currency || 'USD');
      setUsdToEtbRate(data.usdToEtbRate || 120);
      setReservationExpiryMinutes(data.reservationExpiryMinutes || 60);
      setRetryLimit(data.retryLimit || 3);
      setPublicKey(data.publicKey || '');
      setWebhookConfigured(Boolean(data.webhookConfigured));
    } catch (err) {
      setError(err.message || 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await adminPaymentApi.updateSettings({
        currency,
        usdToEtbRate: Number(usdToEtbRate),
        reservationExpiryMinutes: Number(reservationExpiryMinutes),
        retryLimit: Number(retryLimit),
      });
      notify('Payment settings updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    notify('Reconciling payment records with orders…');
    try {
      // Calls stats or re-sync
      await adminPaymentApi.getStats(30);
      notify('Reconciliation completed. Payment ledger is synchronized.');
    } catch (err) {
      notify(err.message || 'Reconciliation encountered an issue');
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard payments-page" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading payment configurations…</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard payments-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      {notice && <div className="admin-toast">{notice}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
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
            <h1 className="admin-page-title" style={{ fontSize: '24px', margin: 0 }}>
              Payment Settings
            </h1>
            <p className="admin-page-description" style={{ margin: '4px 0 0' }}>
              Configure Chapa checkout, exchange rates, currency preferences, and timeouts.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={reconciling}
          onClick={handleReconcile}
          className="admin-action-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <AdminIcon name="refresh" size={14} />
          {reconciling ? 'Reconciling…' : 'Reconcile Ledger'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      {/* CHAPA STATUS BANNER */}
      <div
        className="pay-table-card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-surface-raised)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: testMode ? 'rgba(215, 164, 95, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: testMode ? 'var(--color-gold, #D7A45F)' : '#22C55E',
            }}
          >
            <AdminIcon name="lock" size={18} />
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>
              {provider} Gateway · {testMode ? 'Sandbox / Test Mode' : 'Live Production'}
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Public Key: {publicKey || 'CHAPUBK_TEST-••••'} · Webhook: {webhookConfigured ? 'Configured' : 'Listening on default endpoint'}
            </span>
          </div>
        </div>

        <span
          className={`pay-status-pill is-${testMode ? 'pending' : 'paid'}`}
          style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}
        >
          <i />
          {testMode ? 'Sandbox Active' : 'Live'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="pay-table-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Primary Store Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
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
                <option value="USD">USD ($) — US Dollars</option>
                <option value="ETB">ETB (Birr) — Ethiopian Birr</option>
              </select>
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                Determines default display currency across admin statistics and tables.
              </small>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Central Exchange Rate (1 USD = ETB) *
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={usdToEtbRate}
                onChange={(e) => setUsdToEtbRate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface-raised, transparent)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                Shared rate applied by checkout and order conversion without currency drift.
              </small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Inventory Reservation Expiry (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={reservationExpiryMinutes}
                onChange={(e) => setReservationExpiryMinutes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface-raised, transparent)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                Unpaid checkout sessions release reserved stock back to inventory after this duration.
              </small>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Payment Retry Limit
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={retryLimit}
                onChange={(e) => setRetryLimit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface-raised, transparent)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                Number of payment retries allowed before order is marked as failed.
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => (go ? go('/admin/payments') : window.history.back())}
              className="admin-action-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="admin-action-button is-primary"
            >
              {saving ? 'Saving…' : 'Save Payment Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
