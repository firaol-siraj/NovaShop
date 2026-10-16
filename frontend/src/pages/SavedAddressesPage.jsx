import { useEffect, useMemo, useRef, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const DEFAULT_ADDRESS_KEY = 'novashop_default_address';
const ADDRESSES_KEY = 'novashop_saved_addresses';

const defaultSavedAddresses = [
  {
    id: 'work-office',
    label: 'Work / Office',
    type: 'work',
    firstName: 'Elena',
    lastName: 'Vasquez',
    country: 'Ethiopia',
    street: 'Kazanchis Business District',
    street2: 'Kirkos Sub-City, Niger St., Office 402',
    city: 'Addis Ababa',
    state: 'Addis Ababa',
    postalCode: '1000',
    phone: '+251 92 345 6789',
    isDefault: false,
  },
  {
    id: 'creative-studio',
    label: 'Creative Studio',
    type: 'studio',
    firstName: 'Elena',
    lastName: 'Vasquez',
    country: 'Ethiopia',
    street: 'Old Airport Road',
    street2: 'House 88, Lideta Sub-City',
    city: 'Addis Ababa',
    state: 'Addis Ababa',
    postalCode: '1000',
    phone: '+251 91 876 5432',
    isDefault: false,
  },
];

function formatLabel(str) {
  return String(str || '').toUpperCase();
}

function readStoredAddresses() {
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (error) {
    console.warn('Unable to read stored addresses', error);
  }

  return [
    {
      id: 'default-address',
      label: 'Home',
      type: 'home',
      firstName: 'Elena',
      lastName: 'Vasquez',
      country: 'Ethiopia',
      street: 'Bole Sub-City, Namibia St., Villa 14',
      street2: 'Bole Diplomatic Zone',
      city: 'Addis Ababa',
      state: 'Addis Ababa',
      postalCode: '1000',
      phone: '+251 92 123 4567',
      isDefault: true,
    },
    ...defaultSavedAddresses,
  ];
}

function writeStoredAddresses(addresses) {
  try {
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
  } catch (error) {
    console.warn('Unable to persist addresses', error);
  }
}

function buildAddressLabel(label, customLabel) {
  if (String(label || '').toLowerCase() === 'other') return customLabel || 'Other';
  if (label) return label;
  return customLabel || 'Home';
}

function copyAddress(address) {
  return {
    ...address,
    id: address.id || `addr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  };
}

function normalizePhone(value) {
  const cleaned = String(value || '').replace(/[^\d+\s-]/g, '').trim();
  return cleaned;
}

function validateAddress(form) {
  const errors = {};
  if (!form.firstName?.trim()) errors.firstName = 'First name is required';
  if (!form.lastName?.trim()) errors.lastName = 'Last name is required';
  if (!form.country?.trim()) errors.country = 'Country is required';
  if (!form.street?.trim()) errors.street = 'Street address is required';
  if (!form.city?.trim()) errors.city = 'City is required';
  if (!form.phone?.trim()) errors.phone = 'Phone number is required';
  else if (!/^(\+?[\d\s\-()]{7,})$/.test(form.phone.trim())) errors.phone = 'Enter a valid phone number';
  return errors;
}

function AddressModal({ open, mode, initialAddress, onClose, onSave, user }) {
  const [form, setForm] = useState(() => ({
    id: initialAddress?.id || `addr-${Date.now()}`,
    label: initialAddress?.label || 'Home',
    customLabel: initialAddress?.customLabel || '',
    firstName: initialAddress?.firstName || user?.firstName || '',
    lastName: initialAddress?.lastName || user?.lastName || '',
    country: initialAddress?.country || 'Ethiopia',
    street: initialAddress?.street || '',
    street2: initialAddress?.street2 || '',
    city: initialAddress?.city || '',
    state: initialAddress?.state || '',
    postalCode: initialAddress?.postalCode || '',
    phone: initialAddress?.phone || '',
    isDefault: Boolean(initialAddress?.isDefault),
  }));
  const [errors, setErrors] = useState({});
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const next = {
      id: initialAddress?.id || `addr-${Date.now()}`,
      label: initialAddress?.label || 'Home',
      customLabel: initialAddress?.customLabel || '',
      firstName: initialAddress?.firstName || user?.firstName || '',
      lastName: initialAddress?.lastName || user?.lastName || '',
      country: initialAddress?.country || 'Ethiopia',
      street: initialAddress?.street || '',
      street2: initialAddress?.street2 || '',
      city: initialAddress?.city || '',
      state: initialAddress?.state || '',
      postalCode: initialAddress?.postalCode || '',
      phone: initialAddress?.phone || '',
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

    const resolvedLabel = form.label === 'Other' ? form.customLabel : form.label;
    onSave({
      ...form,
      label: resolvedLabel,
      phone: normalizePhone(form.phone),
      fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
    });
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 14, 12, 0.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#F8F4EE',
          border: '1px solid rgba(27,24,22,0.12)',
          borderRadius: '20px',
          padding: '22px 22px 18px',
          boxShadow: '0 20px 54px rgba(17, 14, 12, 0.14)',
          transform: 'translateY(0)',
          opacity: 1,
          animation: 'nsModalIn 250ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>{mode === 'edit' ? 'Edit Address' : 'Add Address'}</div>
            <h3 style={{ margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: '30px', fontWeight: 500, color: '#1B1816' }}>{mode === 'edit' ? 'Update Address' : 'Add a New Address'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#1B1816', cursor: 'pointer', fontSize: '26px', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '18px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Address Label</span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {['Home', 'Work / Office', 'Creative Studio', 'Other'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setField('label', option)}
                    style={{
                      border: form.label === option ? '1px solid #1B1816' : '1px solid rgba(27,24,22,0.16)',
                      background: form.label === option ? '#F3EEE8' : '#FDFBF7',
                      borderRadius: '999px',
                      padding: '9px 12px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#1B1816',
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
                  placeholder="Custom label"
                  style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }}
                />
              )}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>First Name</span>
                <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} style={{ width: '100%', border: errors.firstName ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                {errors.firstName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.firstName}</span>}
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Last Name</span>
                <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} style={{ width: '100%', border: errors.lastName ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                {errors.lastName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.lastName}</span>}
              </label>
            </div>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Country / Region</span>
              <select value={form.country} onChange={(event) => setField('country', event.target.value)} style={{ width: '100%', border: errors.country ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }}>
                <option>Ethiopia</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>France</option>
                <option>Germany</option>
              </select>
              {errors.country && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.country}</span>}
            </label>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Street Address</span>
              <input value={form.street} onChange={(event) => setField('street', event.target.value)} style={{ width: '100%', border: errors.street ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
              {errors.street && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.street}</span>}
            </label>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Apartment, Suite, Unit (optional)</span>
              <input value={form.street2} onChange={(event) => setField('street2', event.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>City</span>
                <input value={form.city} onChange={(event) => setField('city', event.target.value)} style={{ width: '100%', border: errors.city ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                {errors.city && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.city}</span>}
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Region / State</span>
                <input value={form.state} onChange={(event) => setField('state', event.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Postal / ZIP</span>
                <input value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>Phone Number</span>
              <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} style={{ width: '100%', border: errors.phone ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
              {errors.phone && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.phone}</span>}
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816' }}>
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setField('isDefault', event.target.checked)} style={{ accentColor: '#1B1816', width: '16px', height: '16px' }} />
              <span>Set as my default address</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', borderTop: '1px solid rgba(27,24,22,0.12)', paddingTop: '16px' }}>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1B1816' }}>Cancel</button>
            <button type="submit" style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '12px 20px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>Save Address</button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes nsModalIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 767px) {
          .modal-sheet { width: 100% !important; max-width: 100% !important; border-radius: 18px 18px 0 0 !important; margin-top: auto !important; max-height: 92vh !important; }
        }
      `}</style>
    </div>
  );
}

function ConfirmationModal({ open, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,14,12,0.28)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(420px, 100%)', background: '#F8F4EE', borderRadius: '18px', border: '1px solid rgba(27,24,22,0.12)', padding: '22px 20px', boxShadow: '0 18px 44px rgba(17,14,12,0.12)' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '8px' }}>Remove Address</div>
        <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#1B1816' }}>Remove this address?</h3>
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962', lineHeight: 1.7 }}>This can’t be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '18px' }}>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ background: '#1B1816', color: '#FDFBF7', border: 'none', borderRadius: '999px', padding: '12px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

export default function SavedAddressesPage({ go, currentPath }) {
  const { openWishlist } = useCart();
  const { user, isLoading, logout } = useAuth();
  const [addresses, setAddresses] = useState(() => readStoredAddresses());
  const [activeModal, setActiveModal] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/addresses');
      go('/login');
    }
  }, [isLoading, user, go]);

  useEffect(() => {
    writeStoredAddresses(addresses);
  }, [addresses]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const defaultAddress = useMemo(() => addresses.find((address) => address.isDefault) || addresses[0] || null, [addresses]);
  const savedAddresses = useMemo(() => addresses.filter((address) => !address.isDefault), [addresses]);

  const syncDefaultAddress = (nextAddresses) => {
    const withDefault = nextAddresses.map((address, index) => ({
      ...address,
      isDefault: index === 0 && nextAddresses.length > 0 ? true : Boolean(address.isDefault && address.id === nextAddresses[0]?.id),
    }));
    const defaultMatch = withDefault.find((item) => item.isDefault) || withDefault[0];
    if (defaultMatch) {
      return withDefault.map((item) => ({ ...item, isDefault: item.id === defaultMatch.id }));
    }
    return withDefault;
  };

  const handleSaveAddress = (payload) => {
    const next = [...addresses];
    const normalized = {
      ...payload,
      id: payload.id || `addr-${Date.now()}`,
      label: buildAddressLabel(payload.label, payload.customLabel),
      fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`,
      isDefault: Boolean(payload.isDefault),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: normalizePhone(payload.phone),
    };

    if (activeModal?.mode === 'edit') {
      const index = next.findIndex((item) => item.id === activeModal.address.id);
      if (index >= 0) {
        next[index] = normalized;
      }
    } else {
      next.push(normalized);
    }

    let finalList = next;
    const shouldSetDefault = normalized.isDefault || !next.some((item) => item.isDefault);
    if (shouldSetDefault) {
      finalList = next.map((item) => ({ ...item, isDefault: item.id === normalized.id }));
    }

    setAddresses(finalList);
    setActiveModal(null);
    setToast('Default address updated');
  };

  const handleSetDefault = (addressId) => {
    setAddresses((current) => {
      const next = current.map((address) => ({ ...address, isDefault: address.id === addressId }));
      return next;
    });
    setToast('Default address updated');
  };

  const handleRemove = (addressId) => {
    const target = addresses.find((item) => item.id === addressId);
    const isDefault = target?.isDefault;

    setAddresses((current) => {
      const next = current.filter((item) => item.id !== addressId);
      if (next.length === 0) return next;
      if (isDefault && next.length > 0) {
        return next.map((item, index) => ({ ...item, isDefault: index === 0 }));
      }
      return next;
    });
    setRemoveId(null);
  };

  const handleSignOut = async () => {
    await logout();
    go('/');
  };

  if (isLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <span style={{ color: '#1B1816' }}>Addresses</span>
        </div>
      </div>

      <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 3vw, 44px)', color: '#1B1816', letterSpacing: '-0.04em', fontWeight: 500 }}>Addresses</h2>
          <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>Manage your saved addresses.</div>
        </div>
        <button type="button" onClick={() => setActiveModal({ mode: 'add', address: null })} style={{ border: '1px solid #1B1816', background: 'transparent', borderRadius: '999px', padding: '11px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1B1816', cursor: 'pointer' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
          Add New Address
        </button>
      </section>

      <section style={{ display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '6px 0 0' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Default Address</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C' }}>Primary delivery location</div>
        </div>

        {defaultAddress ? (
          <div style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E7DED2', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '999px', padding: '5px 9px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1B1816', fontWeight: 700 }}>
                  <span>✓</span>
                  Default
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: '1px solid rgba(27,24,22,0.18)', borderRadius: '999px', padding: '5px 9px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1B1816', fontWeight: 600 }}>
                  {formatLabel(defaultAddress.label || 'Home')}
                </span>
              </div>
              <button type="button" onClick={() => setActiveModal({ mode: 'edit', address: defaultAddress })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1B1816', textDecoration: 'underline' }}>
                Edit
              </button>
            </div>

            <div style={{ marginTop: '18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>{defaultAddress.fullName || `${defaultAddress.firstName || user.firstName} ${defaultAddress.lastName || user.lastName}`}</div>
              <div style={{ color: '#6E6962', lineHeight: 1.8 }}>{defaultAddress.street || 'Bole Sub-City, Namibia St., Villa 14'}</div>
              {defaultAddress.street2 && <div style={{ color: '#6E6962', lineHeight: 1.8 }}>{defaultAddress.street2}</div>}
              <div style={{ color: '#6E6962', lineHeight: 1.8 }}>{defaultAddress.city || 'Addis Ababa'} {defaultAddress.postalCode ? `${defaultAddress.postalCode},` : ''} {defaultAddress.country || 'Ethiopia'}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', color: '#6E6962' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92V19a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h2.09a2 2 0 0 1 2 1.72l.4 2.16a2 2 0 0 1-1.46 2.22l-.73.23a12 12 0 0 0 6.9 6.9l.23-.73a2 2 0 0 1 2.22-1.46l2.16.4A2 2 0 0 1 22 16.92Z" />
                </svg>
                {defaultAddress.phone || '+251 92 123 4567'}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ display: 'grid', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
          Saved Addresses ({savedAddresses.length})
        </div>

        {savedAddresses.length === 0 ? (
          <div style={{ background: '#F7F2EA', border: '1px dashed rgba(27,24,22,0.22)', borderRadius: '14px', padding: '22px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962', marginBottom: '12px' }}>No other addresses saved.</div>
            <button type="button" onClick={() => setActiveModal({ mode: 'add', address: null })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816', textDecoration: 'underline' }}>Add New Address</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '24px' }}>
            {savedAddresses.map((address) => (
              <div key={address.id} style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '18px 18px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: '1px solid rgba(27,24,22,0.18)', borderRadius: '999px', padding: '5px 9px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1B1816', fontWeight: 600 }}>
                    {formatLabel(address.label || 'Work / Office')}
                  </span>
                </div>

                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700 }}>{address.fullName || `${address.firstName} ${address.lastName}`}</div>
                  <div style={{ color: '#6E6962' }}>{address.street}</div>
                  {address.street2 && <div style={{ color: '#6E6962' }}>{address.street2}</div>}
                  <div style={{ color: '#6E6962' }}>{address.city || 'Addis Ababa'} {address.postalCode ? `${address.postalCode},` : ''} {address.country || 'Ethiopia'}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', color: '#6E6962' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92V19a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h2.09a2 2 0 0 1 2 1.72l.4 2.16a2 2 0 0 1-1.46 2.22l-.73.23a12 12 0 0 0 6.9 6.9l.23-.73a2 2 0 0 1 2.22-1.46l2.16.4A2 2 0 0 1 22 16.92Z" />
                    </svg>
                    {address.phone}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#EFE5DA', marginTop: '16px', padding: '10px 12px', borderRadius: '0 0 14px 14px', marginLeft: '-18px', marginRight: '-18px' }}>
                  <button type="button" onClick={() => handleSetDefault(address.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816', textDecoration: 'underline' }}>Set as Default</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6E6962', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    <button type="button" onClick={() => setActiveModal({ mode: 'edit', address })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816' }}>Edit</button>
                    <span>/</span>
                    <button type="button" onClick={() => setRemoveId(address.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816' }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AddressModal
        open={Boolean(activeModal)}
        mode={activeModal?.mode || 'add'}
        initialAddress={activeModal?.address || null}
        user={user}
        onClose={() => setActiveModal(null)}
        onSave={handleSaveAddress}
      />

      <ConfirmationModal open={Boolean(removeId)} onClose={() => setRemoveId(null)} onConfirm={() => handleRemove(removeId)} />

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '10px 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', boxShadow: '0 20px 34px rgba(17,14,12,0.22)', zIndex: 260 }}>
          {toast}
        </div>
      )}

      <style>{`
        .ns-account-shell * { box-sizing: border-box; }
        @media (max-width: 1023px) {
          .ns-account-shell > div > div { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 767px) {
          .ns-account-shell > div {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
          section[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
