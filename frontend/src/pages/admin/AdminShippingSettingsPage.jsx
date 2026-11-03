import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import shippingApi from '../../lib/api/shippingApi';
import './admin-shipping.css';

export default function AdminShippingSettingsPage({ go }) {
  const [threshold, setThreshold] = useState(300);
  const [originAddress, setOriginAddress] = useState('Bole, Addis Ababa, Ethiopia');
  const [defaultHandlingDays, setDefaultHandlingDays] = useState('1–2 business days');
  const [dailyCutoffTime, setDailyCutoffTime] = useState('14:00');
  const [defaultCarrier, setDefaultCarrier] = useState('NovaShop Express Courier');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  useEffect(() => {
    shippingApi
      .getSettings()
      .then((res) => {
        const data = res.data || {};
        setThreshold(data.freeShippingThreshold ?? 300);
        setOriginAddress(data.originAddress || 'Bole, Addis Ababa, Ethiopia');
        if (data.defaultHandlingDays) setDefaultHandlingDays(data.defaultHandlingDays);
        if (data.dailyCutoffTime) setDailyCutoffTime(data.dailyCutoffTime);
        if (data.defaultCarrier) setDefaultCarrier(data.defaultCarrier);
      })
      .catch((err) => setError(err.message || 'Failed to load shipping settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await shippingApi.updateSettings({
        freeShippingThreshold: Number(threshold),
        originAddress: originAddress.trim(),
        defaultHandlingDays,
        dailyCutoffTime,
        defaultCarrier,
      });
      notify('Shipping operational settings saved successfully');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard shipping-page" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading shipping operational settings…</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard shipping-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      {notice && <div className="admin-toast">{notice}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => (go ? go('/admin/shipping') : window.history.back())}
          className="admin-action-button"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <AdminIcon name="left" size={14} />
          Back to Shipping
        </button>
        <div>
          <h1 className="admin-page-title" style={{ fontSize: '24px', margin: 0 }}>
            Shipping Settings
          </h1>
          <p className="admin-page-description" style={{ margin: '4px 0 0' }}>
            Configure operational dispatch schedules, free shipping rules, and fulfillment origin.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="ship-table-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Free Shipping Order Subtotal Threshold ($ USD)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="300"
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
              Orders with items subtotal reaching or exceeding this amount automatically receive free standard shipping. Set to 0 to disable.
            </small>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Warehouse & Fulfillment Origin Address
            </label>
            <input
              type="text"
              value={originAddress}
              onChange={(e) => setOriginAddress(e.target.value)}
              placeholder="e.g. NovaShop Logistics Hub, Bole Sub-City, Addis Ababa, Ethiopia"
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Default Handling Days
              </label>
              <input
                type="text"
                value={defaultHandlingDays}
                onChange={(e) => setDefaultHandlingDays(e.target.value)}
                placeholder="1–2 business days"
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
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Daily Dispatch Cutoff Time (EAT)
              </label>
              <input
                type="time"
                value={dailyCutoffTime}
                onChange={(e) => setDailyCutoffTime(e.target.value)}
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
                Orders placed before this time begin transit on the same business day.
              </small>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Primary Carrier Partner
            </label>
            <input
              type="text"
              value={defaultCarrier}
              onChange={(e) => setDefaultCarrier(e.target.value)}
              placeholder="e.g. NovaShop Courier Fleet or Ethio Post"
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
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => (go ? go('/admin/shipping') : window.history.back())}
              className="admin-action-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="admin-action-button is-primary"
            >
              {saving ? 'Saving…' : 'Save Shipping Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
