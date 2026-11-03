import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import shippingApi from '../../lib/api/shippingApi';
import { formatCurrency } from '../../lib/formatters';
import './admin-shipping.css';

export default function AdminShippingZoneRatesPage({ zoneId, go }) {
  const [zone, setZone] = useState(null);
  const [methods, setMethods] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editingRate, setEditingRate] = useState(null);
  const [rateForm, setRateForm] = useState({
    method: '',
    amountUSD: 5,
    amountETB: 150,
    rateType: 'Flat rate',
    freeOverThresholdUSD: '',
  });

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await shippingApi.getAdminStats();
      const zonesList = res?.deliveryZones || res?.data?.deliveryZones || [];
      const methodsList = res?.shippingMethods || res?.data?.shippingMethods || [];
      const ratesList = res?.shippingRates || res?.data?.shippingRates || [];

      const currentZone = zonesList.find((z) => String(z.id || z._id) === String(zoneId));
      if (!currentZone) {
        setError('Zone not found');
      } else {
        setZone(currentZone);
        setMethods(methodsList.filter((m) => String(m.zoneId || m.zone?._id || m.zone) === String(zoneId)));
        setRates(ratesList.filter((r) => String(r.zoneId || r.zone?._id || r.zone) === String(zoneId)));
      }
    } catch (err) {
      setError(err.message || 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [zoneId]);

  const handleOpenAddRate = () => {
    setEditingRate(null);
    setRateForm({
      method: methods[0]?.id || '',
      amountUSD: 5,
      amountETB: 150,
      rateType: 'Flat rate',
      freeOverThresholdUSD: zone?.freeOverThresholdUSD || 300,
    });
  };

  const handleEditRate = (rate) => {
    setEditingRate(rate);
    setRateForm({
      method: rate.methodId || rate.method,
      amountUSD: rate.amountUSD,
      amountETB: rate.amountETB,
      rateType: rate.rateType || 'Flat rate',
      freeOverThresholdUSD: rate.freeOverThresholdUSD || '',
    });
  };

  const handleSaveRate = async (e) => {
    e.preventDefault();
    try {
      if (editingRate) {
        await shippingApi.updateRate(editingRate.id, {
          amountUSD: Number(rateForm.amountUSD),
          amountETB: Number(rateForm.amountETB),
          rateType: rateForm.rateType,
          freeOverThresholdUSD: rateForm.freeOverThresholdUSD ? Number(rateForm.freeOverThresholdUSD) : null,
        });
        notify('Shipping rate updated successfully');
      } else {
        await shippingApi.createRate({
          zone: zoneId,
          method: rateForm.method,
          amountUSD: Number(rateForm.amountUSD),
          amountETB: Number(rateForm.amountETB),
          rateType: rateForm.rateType,
          freeOverThresholdUSD: rateForm.freeOverThresholdUSD ? Number(rateForm.freeOverThresholdUSD) : null,
        });
        notify('Shipping rate created successfully');
      }
      setEditingRate(null);
      loadData();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to save rate');
    }
  };

  const handleDeleteRate = async (rateId) => {
    if (!window.confirm('Are you sure you want to delete this shipping rate?')) return;
    try {
      await shippingApi.deleteRate(rateId);
      notify('Shipping rate deleted');
      loadData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete rate');
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard shipping-page" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading zone rates…</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard shipping-page" style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      {notice && <div className="admin-toast">{notice}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              Rates for: {zone?.name}
            </h1>
            <p className="admin-page-description" style={{ margin: '4px 0 0' }}>
              Covering: {Array.isArray(zone?.countries) ? zone.countries.join(', ') : zone?.countries || 'Ethiopia'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddRate}
          className="admin-action-button is-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <AdminIcon name="plus" size={14} />
          Add Rate
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      {/* RATE FORM MODAL / PANEL */}
      {(editingRate !== null || rateForm.method) && (
        <div className="ship-table-card" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--color-gold)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {editingRate ? 'Edit Shipping Rate' : 'New Shipping Rate'}
          </h3>
          <form onSubmit={handleSaveRate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Shipping Method *
                </label>
                <select
                  disabled={Boolean(editingRate)}
                  value={rateForm.method}
                  onChange={(e) => setRateForm({ ...rateForm, method: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                  required
                >
                  <option value="">Select a method</option>
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.carrier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Rate Type
                </label>
                <select
                  value={rateForm.rateType}
                  onChange={(e) => setRateForm({ ...rateForm, rateType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="Flat rate">Flat rate</option>
                  <option value="Free">Free</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Amount in USD ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateForm.amountUSD}
                  onChange={(e) => {
                    const usd = Number(e.target.value) || 0;
                    setRateForm({
                      ...rateForm,
                      amountUSD: e.target.value,
                      amountETB: Math.round(usd * 120),
                    });
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface-raised)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Amount in ETB (Birr) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={rateForm.amountETB}
                  onChange={(e) => setRateForm({ ...rateForm, amountETB: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface-raised)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingRate(null);
                  setRateForm({ method: '', amountUSD: 5, amountETB: 150, rateType: 'Flat rate', freeOverThresholdUSD: '' });
                }}
                className="admin-action-button"
              >
                Cancel
              </button>
              <button type="submit" className="admin-action-button is-primary">
                Save Rate
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RATES TABLE */}
      <section className="ship-table-card">
        <div className="ship-table-scroll">
          <table className="ship-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Carrier</th>
                <th>USD Rate</th>
                <th>ETB Rate</th>
                <th>Condition</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No rates configured for this delivery zone.
                  </td>
                </tr>
              ) : (
                rates.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.methodName}</strong>
                    </td>
                    <td>
                      <span className="ship-carrier-tag">{r.carrier}</span>
                    </td>
                    <td>
                      <strong>{formatCurrency(r.amountUSD, 'USD')}</strong>
                    </td>
                    <td>
                      <strong>{formatCurrency(r.amountETB, 'ETB')}</strong>
                    </td>
                    <td>{r.condition || 'All orders'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleEditRate(r)}
                          className="admin-action-button"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          <AdminIcon name="edit" size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRate(r.id)}
                          className="admin-action-button"
                          style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }}
                        >
                          <AdminIcon name="trash" size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
