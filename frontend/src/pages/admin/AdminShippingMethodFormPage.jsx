import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import shippingApi from '../../lib/api/shippingApi';
import './admin-shipping.css';

export default function AdminShippingMethodFormPage({ methodId, go }) {
  const isEdit = Boolean(methodId);
  const [zones, setZones] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('');
  const [carrier, setCarrier] = useState('Local Courier');
  const [rateStructure, setRateStructure] = useState('Flat rate');
  const [estimatedMinDays, setEstimatedMinDays] = useState(2);
  const [estimatedMaxDays, setEstimatedMaxDays] = useState(4);
  const [estimatedDeliveryNote, setEstimatedDeliveryNote] = useState('business days');
  const [rateUSD, setRateUSD] = useState(5);
  const [rateETB, setRateETB] = useState(150);
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  useEffect(() => {
    setLoading(true);
    shippingApi
      .getAdminStats()
      .then(async (res) => {
        const zonesList = res?.deliveryZones || res?.data?.deliveryZones || [];
        const methodsList = res?.shippingMethods || res?.data?.shippingMethods || [];
        setZones(zonesList);

        if (isEdit) {
          let found = null;
          try {
            found = await shippingApi.getMethodById(methodId);
          } catch {
            found = methodsList.find((m) => String(m.id || m._id) === String(methodId));
          }

          if (found) {
            setName(found.name || '');
            setDescription(found.description || '');
            setZone(found.zoneId || found.zone?._id || found.zone || (zonesList[0]?.id || ''));
            setCarrier(found.carrier || 'Local Courier');
            setRateStructure(found.rateStructure || 'Flat rate');
            setEstimatedMinDays(found.minDays ?? found.estimatedMinDays ?? 2);
            setEstimatedMaxDays(found.maxDays ?? found.estimatedMaxDays ?? 4);
            setEstimatedDeliveryNote(found.deliveryNote || found.estimatedDeliveryNote || 'business days');
            setStatus((found.status || 'active').toLowerCase());
          } else {
            setError('Shipping method not found');
          }
        } else if (zonesList.length > 0) {
          setZone(zonesList[0].id || zonesList[0]._id);
        }
      })
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [isEdit, methodId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Method name is required');
      return;
    }
    if (!zone) {
      setError('Please select a shipping zone');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      description: description.trim(),
      zone,
      carrier: carrier.trim(),
      rateStructure,
      estimatedMinDays: Number(estimatedMinDays),
      estimatedMaxDays: Number(estimatedMaxDays),
      estimatedDeliveryNote,
      status,
      rateUSD: Number(rateUSD),
      rateETB: Number(rateETB),
    };

    try {
      if (isEdit) {
        await shippingApi.updateMethod(methodId, payload);
        notify('Shipping method updated successfully');
      } else {
        await shippingApi.createMethod(payload);
        notify('Shipping method created successfully');
      }
      setTimeout(() => {
        if (go) go('/admin/shipping');
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save method');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard shipping-page" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading method details…</p>
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
            {isEdit ? `Edit Method: ${name || 'Method'}` : 'Create Shipping Method'}
          </h1>
          <p className="admin-page-description" style={{ margin: '4px 0 0' }}>
            Set carrier fulfillment, delivery estimates, and service tiers.
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
              Method Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Doorstep Courier or Express Same-Day"
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

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Reliable direct courier to your residence"
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
                Assigned Zone *
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                required
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
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({Array.isArray(z.countries) ? z.countries.join(', ') : z.countries})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Carrier / Logistics Provider
              </label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. NovaShop Fleet, Ethio Post, DHL Express"
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Min Transit Days
              </label>
              <input
                type="number"
                min="0"
                value={estimatedMinDays}
                onChange={(e) => setEstimatedMinDays(e.target.value)}
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
                Max Transit Days
              </label>
              <input
                type="number"
                min="0"
                value={estimatedMaxDays}
                onChange={(e) => setEstimatedMaxDays(e.target.value)}
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
                Delivery Note
              </label>
              <input
                type="text"
                value={estimatedDeliveryNote}
                onChange={(e) => setEstimatedDeliveryNote(e.target.value)}
                placeholder="business days"
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
          </div>

          {!isEdit && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Initial Rate ($ USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateUSD}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setRateUSD(e.target.value);
                    setRateETB(Math.round(val * 120));
                  }}
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
                  Initial Rate (ETB Birr)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={rateETB}
                  onChange={(e) => setRateETB(e.target.value)}
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
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Rate Structure
              </label>
              <select
                value={rateStructure}
                onChange={(e) => setRateStructure(e.target.value)}
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
                <option value="Flat rate">Flat rate</option>
                <option value="Free">Free</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
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
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Method'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
