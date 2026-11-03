import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';
import { addressApi } from '../lib/api/addressApi';

function formatLabel(str) {
  return String(str || '').toUpperCase();
}

function normalizePhone(value) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return `+251${digits.slice(1, 10)}`;
  }
  if (digits.length === 9) {
    return `+251${digits}`;
  }
  return value.trim();
}

function validateAddress(form) {
  const errors = {};
  if (!form.firstName?.trim()) errors.firstName = 'First name is required';
  if (!form.lastName?.trim()) errors.lastName = 'Last name is required';
  if (!form.country?.trim()) errors.country = 'Country is required';
  if (!form.street?.trim()) errors.street = 'Street address is required';
  if (!form.city?.trim()) errors.city = 'City is required';
  if (!form.phone?.trim()) {
    errors.phone = 'Phone number is required';
  } else {
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 9) {
      errors.phone = 'Enter a valid phone number (e.g. 0911223344 or +251911223344)';
    }
  }
  return errors;
}

function AddressModal({ open, mode, initialAddress, onClose, onSave, isSaving }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    label: initialAddress?.label || 'Home',
    customLabel: initialAddress?.label && !['Home', 'Work / Office', 'Creative Studio'].includes(initialAddress.label) ? initialAddress.label : '',
    firstName: initialAddress?.firstName || user?.firstName || user?.name?.split(' ')[0] || '',
    lastName: initialAddress?.lastName || user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
    country: initialAddress?.country || 'Ethiopia',
    street: initialAddress?.street || '',
    street2: initialAddress?.street2 || '',
    city: initialAddress?.city || 'Addis Ababa',
    state: initialAddress?.state || 'Addis Ababa',
    postalCode: initialAddress?.postalCode || '1000',
    phone: initialAddress?.phone || user?.phone || '',
    isDefault: Boolean(initialAddress?.isDefault),
  }));
  const [errors, setErrors] = useState({});
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const isCustom = initialAddress?.label && !['Home', 'Work / Office', 'Creative Studio'].includes(initialAddress.label);
    const next = {
      label: isCustom ? 'Other' : (initialAddress?.label || 'Home'),
      customLabel: isCustom ? initialAddress.label : '',
      firstName: initialAddress?.firstName || user?.firstName || user?.name?.split(' ')[0] || '',
      lastName: initialAddress?.lastName || user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
      country: initialAddress?.country || 'Ethiopia',
      street: initialAddress?.street || '',
      street2: initialAddress?.street2 || '',
      city: initialAddress?.city || 'Addis Ababa',
      state: initialAddress?.state || 'Addis Ababa',
      postalCode: initialAddress?.postalCode || '1000',
      phone: initialAddress?.phone || user?.phone || '',
      isDefault: Boolean(initialAddress?.isDefault),
    };
    setForm(next);
    setErrors({});
  }, [open, initialAddress, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateAddress(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const resolvedLabel = form.label === 'Other' ? (form.customLabel.trim() || 'Other') : form.label;
    onSave({
      label: resolvedLabel,
      type: resolvedLabel.toLowerCase().includes('work') ? 'work' : resolvedLabel.toLowerCase().includes('studio') ? 'studio' : 'home',
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: normalizePhone(form.phone),
      street: form.street.trim(),
      street2: form.street2.trim(),
      city: form.city.trim(),
      state: form.state.trim() || form.city.trim(),
      postalCode: form.postalCode.trim() || '1000',
      country: form.country.trim(),
      isDefault: Boolean(form.isDefault),
    });
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '20px',
          padding: '24px 24px 20px',
          boxShadow: '0 20px 54px rgba(0, 0, 0, 0.25)',
          animation: 'nsModalIn 250ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{mode === 'edit' ? 'Edit Address' : 'Add Address'}</div>
            <h3 style={{ margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: '30px', fontWeight: 500, color: 'var(--text-primary)' }}>{mode === 'edit' ? 'Update Address' : 'Add a New Address'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '26px', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '18px' }}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Address Label</span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {['Home', 'Work / Office', 'Creative Studio', 'Other'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setField('label', option)}
                    style={{
                      border: form.label === option ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
                      background: form.label === option ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
                      borderRadius: '999px',
                      padding: '9px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {form.label === 'Other' && (
                <input
                  value={form.customLabel || ''}
                  onChange={(event) => setField('customLabel', event.target.value)}
                  placeholder="Custom label (e.g. Vacation Home, Warehouse)"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
              )}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>First Name</span>
                <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.firstName ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                {errors.firstName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.firstName}</span>}
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last Name</span>
                <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.lastName ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                {errors.lastName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.lastName}</span>}
              </label>
            </div>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Country / Region</span>
              <select value={form.country} onChange={(event) => setField('country', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.country ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}>
                <option value="Ethiopia">Ethiopia</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Kenya">Kenya</option>
                <option value="Djibouti">Djibouti</option>
              </select>
              {errors.country && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.country}</span>}
            </label>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Street Address</span>
              <input value={form.street} onChange={(event) => setField('street', event.target.value)} placeholder="e.g. Bole Sub-City, Namibia St., Villa 14" style={{ width: '100%', boxSizing: 'border-box', border: errors.street ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              {errors.street && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.street}</span>}
            </label>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Apartment, Suite, Unit (optional)</span>
              <input value={form.street2} onChange={(event) => setField('street2', event.target.value)} placeholder="e.g. Apt 4B / Floor 2" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>City</span>
                <input value={form.city} onChange={(event) => setField('city', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.city ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                {errors.city && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.city}</span>}
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Region / State</span>
                <input value={form.state} onChange={(event) => setField('state', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Postal / ZIP</span>
                <input value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Phone Number (Ethiopian format +251...)</span>
              <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="0911 223 344 or +251 911 223 344" style={{ width: '100%', boxSizing: 'border-box', border: errors.phone ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              {errors.phone && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.phone}</span>}
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', marginTop: '4px' }}>
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setField('isDefault', event.target.checked)} style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }} />
              <span>Set as my default delivery address</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <button type="button" onClick={onClose} disabled={isSaving} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Cancel</button>
            <button type="submit" disabled={isSaving} style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 22px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}>
              {isSaving ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes nsModalIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function ConfirmationModal({ open, onClose, onConfirm, isDeleting }) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(420px, 100%)', background: 'var(--bg-surface)', borderRadius: '18px', border: '1px solid var(--border-default)', padding: '24px 22px', boxShadow: '0 18px 44px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Remove Address</div>
        <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-serif)', fontSize: '26px', color: 'var(--text-primary)', fontWeight: 500 }}>Remove this address?</h3>
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>This address will be removed from your saved account addresses.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '22px' }}>
          <button type="button" onClick={onClose} disabled={isDeleting} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={isDeleting} style={{ background: 'var(--color-danger)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', padding: '12px 18px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: isDeleting ? 0.7 : 1 }}>
            {isDeleting ? 'Removing...' : 'Remove Address'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SavedAddressesPage({ go, currentPath }) {
  const { user, isLoading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // { mode: 'add' | 'edit', address: object }
  const [removeId, setRemoveId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState('');

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await addressApi.getAddresses();
      if (res.success && Array.isArray(res.data)) {
        setAddresses(res.data);
      } else {
        throw new Error(res.message || 'Unable to retrieve addresses');
      }
    } catch (err) {
      if (err.status === 401 || err.response?.status === 401) {
        sessionStorage.setItem('novashop_redirect_after_login', '/account/addresses');
        go('/login');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to load saved addresses.');
    } finally {
      setLoading(false);
    }
  }, [go]);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/addresses');
      go('/login');
      return;
    }
    if (user) {
      fetchAddresses();
    }
  }, [authLoading, user, go, fetchAddresses]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const defaultAddress = useMemo(() => addresses.find((a) => a.isDefault) || addresses[0] || null, [addresses]);
  const otherAddresses = useMemo(() => addresses.filter((a) => a._id !== defaultAddress?._id), [addresses, defaultAddress]);

  const handleSaveAddress = async (payload) => {
    setIsSaving(true);
    try {
      if (activeModal?.mode === 'edit' && activeModal.address?._id) {
        const res = await addressApi.updateAddress(activeModal.address._id, payload);
        if (res.success) {
          setToast('Address updated successfully');
        }
      } else {
        const res = await addressApi.createAddress(payload);
        if (res.success) {
          setToast('New address saved');
        }
      }
      setActiveModal(null);
      await fetchAddresses();
    } catch (err) {
      setToast(err.response?.data?.message || err.message || 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const res = await addressApi.setDefaultAddress(addressId);
      if (res.success) {
        setToast('Default address updated');
        await fetchAddresses();
      }
    } catch (err) {
      setToast(err.response?.data?.message || err.message || 'Failed to update default address.');
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeId) return;
    setIsDeleting(true);
    try {
      const res = await addressApi.deleteAddress(removeId);
      if (res.success) {
        setToast('Address removed');
        setRemoveId(null);
        await fetchAddresses();
      }
    } catch (err) {
      setToast(err.response?.data?.message || err.message || 'Failed to remove address.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/addresses'}>
      <div style={{ display: 'grid', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Delivery &amp; Billing</div>
            <h1 style={{ margin: '6px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3.5vw, 48px)', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>Saved Addresses</h1>
            <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>Manage your delivery locations for fast, seamless checkout.</p>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal({ mode: 'add', address: null })}
            style={{
              border: 'none',
              background: 'var(--color-primary)',
              color: 'var(--color-primary-contrast)',
              borderRadius: '999px',
              padding: '12px 22px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>+ Add New Address</span>
          </button>
        </div>

        <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)' }} />

        {toast && (
          <div style={{ background: 'rgba(34, 123, 81, 0.1)', border: '1px solid var(--color-success)', borderRadius: '12px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)' }}>
            {toast}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(217, 83, 79, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)' }}>{error}</span>
            <button
              type="button"
              onClick={fetchAddresses}
              style={{ border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
            <div style={{ height: '220px', background: 'var(--skeleton-base)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '220px', background: 'var(--skeleton-base)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
          </div>
        ) : addresses.length === 0 ? (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              📍
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>No Addresses Saved</h3>
            <p style={{ margin: '0 0 20px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', marginInline: 'auto' }}>
              Save your shipping address now to enable automatic checkout autofill and track courier packages easily.
            </p>
            <button
              type="button"
              onClick={() => setActiveModal({ mode: 'add', address: null })}
              style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 24px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              + Add Address
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
            {/* Default Address Card First */}
            {defaultAddress && (
              <div
                key={defaultAddress._id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--color-primary)',
                  borderRadius: '16px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  position: 'relative',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {defaultAddress.label || 'Home'}
                    </span>
                    <span style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
                      Default Address
                    </span>
                  </div>

                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {defaultAddress.firstName} {defaultAddress.lastName}
                  </div>

                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <div>{defaultAddress.street}</div>
                    {defaultAddress.street2 && <div>{defaultAddress.street2}</div>}
                    <div>{defaultAddress.city}, {defaultAddress.state || defaultAddress.city} {defaultAddress.postalCode}</div>
                    <div>{defaultAddress.country}</div>
                    <div style={{ marginTop: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>{defaultAddress.phone}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal({ mode: 'edit', address: defaultAddress })}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-primary)', textDecoration: 'underline' }}
                  >
                    Edit
                  </button>

                  {addresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRemoveId(defaultAddress._id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-danger)' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Other Saved Addresses */}
            {otherAddresses.map((addr) => (
              <div
                key={addr._id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '16px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {addr.label || 'Saved Location'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr._id)}
                      style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '999px', padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--text-primary)' }}
                    >
                      Set as Default
                    </button>
                  </div>

                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {addr.firstName} {addr.lastName}
                  </div>

                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <div>{addr.street}</div>
                    {addr.street2 && <div>{addr.street2}</div>}
                    <div>{addr.city}, {addr.state || addr.city} {addr.postalCode}</div>
                    <div>{addr.country}</div>
                    <div style={{ marginTop: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>{addr.phone}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveModal({ mode: 'edit', address: addr })}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-primary)', textDecoration: 'underline' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveId(addr._id)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-danger)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddressModal
        open={Boolean(activeModal)}
        mode={activeModal?.mode || 'add'}
        initialAddress={activeModal?.address}
        onClose={() => setActiveModal(null)}
        onSave={handleSaveAddress}
        isSaving={isSaving}
      />

      <ConfirmationModal
        open={Boolean(removeId)}
        onClose={() => setRemoveId(null)}
        onConfirm={handleConfirmRemove}
        isDeleting={isDeleting}
      />
    </AccountLayout>
  );
}
