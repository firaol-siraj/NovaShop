import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import shippingApi from '../../lib/api/shippingApi';
import './admin-shipping.css';

const ETHIOPIA_REGIONS = [
  'Addis Ababa',
  'Oromia',
  'Amhara',
  'Sidama',
  'SNNPR',
  'Tigray',
  'Dire Dawa',
  'Harari',
  'Somali',
  'Afar',
  'Benishangul-Gumuz',
  'Gambela',
  'South West Ethiopia',
];

export default function AdminShippingZoneFormPage({ zoneId, go }) {
  const isEdit = Boolean(zoneId);
  const [name, setName] = useState('');
  const [countriesText, setCountriesText] = useState('Ethiopia');
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [allRegions, setAllRegions] = useState(false);
  const [status, setStatus] = useState('active');
  const [freeOverThresholdUSD, setFreeOverThresholdUSD] = useState(300);
  const [handlingTime, setHandlingTime] = useState('1–2 business days');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      const loadZone = async () => {
        try {
          let found = null;
          try {
            found = await shippingApi.getZoneById(zoneId);
          } catch (apiErr) {
            const stats = await shippingApi.getAdminStats();
            const zones = stats?.deliveryZones || stats?.data?.deliveryZones || [];
            found = zones.find((z) => String(z.id || z._id) === String(zoneId));
          }

          if (found) {
            setName(found.name || '');
            const cList = Array.isArray(found.countries) ? found.countries.join(', ') : found.countries || 'Ethiopia';
            setCountriesText(cList);
            setSelectedRegions(found.regions || []);
            setAllRegions(!found.regions || found.regions.length === 0);
            setStatus((found.status || 'active').toLowerCase());
            setFreeOverThresholdUSD(found.freeOverThresholdUSD || 300);
            setHandlingTime(found.handlingTime || '1–2 business days');
          } else {
            setError('Zone not found');
          }
        } catch (err) {
          setError(err.message || 'Failed to load zone');
        } finally {
          setLoading(false);
        }
      };

      loadZone();
    }
  }, [isEdit, zoneId]);

  const toggleRegion = (region) => {
    setAllRegions(false);
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const handleSelectAllRegions = () => {
    if (allRegions) {
      setAllRegions(false);
      setSelectedRegions([]);
    } else {
      setAllRegions(true);
      setSelectedRegions([...ETHIOPIA_REGIONS]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Zone name is required');
      return;
    }

    const countries = countriesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (countries.length === 0) {
      setError('At least one country is required');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      countries,
      regions: allRegions ? [] : selectedRegions,
      status,
      freeOverThresholdUSD: Number(freeOverThresholdUSD) || 0,
      handlingTime,
    };

    try {
      if (isEdit) {
        await shippingApi.updateZone(zoneId, payload);
        notify('Shipping zone updated successfully');
      } else {
        await shippingApi.createZone(payload);
        notify('Shipping zone created successfully');
      }
      setTimeout(() => {
        if (go) go('/admin/shipping');
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save zone');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard shipping-page" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading shipping zone details…</p>
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
            {isEdit ? `Edit Zone: ${name || 'Zone'}` : 'Create Delivery Zone'}
          </h1>
          <p className="admin-page-description" style={{ margin: '4px 0 0' }}>
            Configure regional coverage, postal jurisdictions, and handling requirements.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: 'var(--color-danger-soft, rgba(239, 68, 68, 0.1))',
            color: 'var(--color-danger, #EF4444)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="ship-table-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Zone Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Addis Ababa Metro or Regional Ethiopia"
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

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Handling Time
              </label>
              <input
                type="text"
                value={handlingTime}
                onChange={(e) => setHandlingTime(e.target.value)}
                placeholder="e.g. 1 business day"
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

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Covered Countries (comma-separated) *
            </label>
            <input
              type="text"
              value={countriesText}
              onChange={(e) => setCountriesText(e.target.value)}
              placeholder="Ethiopia"
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
              Domestic store operations typically serve Ethiopia.
            </small>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Covered Regions / Sub-divisions
              </label>
              <button
                type="button"
                onClick={handleSelectAllRegions}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-gold, #D7A45F)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {allRegions ? 'Clear selection' : 'Cover all regions in country'}
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-sunken)',
              }}
            >
              {ETHIOPIA_REGIONS.map((reg) => {
                const isChecked = allRegions || selectedRegions.includes(reg);
                return (
                  <label
                    key={reg}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRegion(reg)}
                    />
                    {reg}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Free Shipping Order Subtotal Threshold ($ USD)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={freeOverThresholdUSD}
              onChange={(e) => setFreeOverThresholdUSD(e.target.value)}
              placeholder="300"
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
              Standard orders exceeding this amount qualify for zero-cost delivery.
            </small>
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
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Zone'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
