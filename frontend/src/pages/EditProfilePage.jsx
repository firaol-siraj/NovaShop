import { useEffect, useMemo, useRef, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../lib/api/userApi';

function getInitials(fullName) {
  return (fullName || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
}

function validateName(value) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]+$/.test(value.trim());
}

function validatePhone(value) {
  if (!value || !value.trim()) return true;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9;
}

const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfilePage({ go, currentPath }) {
  const fileInputRef = useRef(null);
  const { user, updateUser } = useAuth();

  const sessionUser = useMemo(() => {
    if (!user) return null;
    const nameParts = (user.name || '').split(' ');
    return {
      firstName: user.firstName || nameParts[0] || '',
      lastName: user.lastName || nameParts.slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || '',
      avatar: user.avatar || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
    };
  }, [user]);

  const [form, setForm] = useState({
    firstName: sessionUser?.firstName || '',
    lastName: sessionUser?.lastName || '',
    phone: sessionUser?.phone || '',
    avatar: sessionUser?.avatar || '',
    dateOfBirth: sessionUser?.dateOfBirth || '',
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [fileError, setFileError] = useState('');

  const initialValues = useMemo(() => ({
    firstName: sessionUser?.firstName || '',
    lastName: sessionUser?.lastName || '',
    phone: sessionUser?.phone || '',
    avatar: sessionUser?.avatar || '',
    dateOfBirth: sessionUser?.dateOfBirth || '',
  }), [sessionUser]);

  const isDirty = useMemo(() => {
    const keys = ['firstName', 'lastName', 'phone', 'avatar', 'dateOfBirth'];
    return keys.some((key) => form[key] !== initialValues[key]);
  }, [form, initialValues]);

  useEffect(() => {
    if (sessionUser) {
      setForm({
        firstName: sessionUser.firstName || '',
        lastName: sessionUser.lastName || '',
        phone: sessionUser.phone || '',
        avatar: sessionUser.avatar || '',
        dateOfBirth: sessionUser.dateOfBirth || '',
      });
    }
  }, [sessionUser]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.firstName.trim()) {
      nextErrors.firstName = 'First name is required';
    } else if (!validateName(form.firstName)) {
      nextErrors.firstName = 'Letters, spaces, hyphens, and apostrophes only';
    }

    if (!form.lastName.trim()) {
      nextErrors.lastName = 'Last name is required';
    } else if (!validateName(form.lastName)) {
      nextErrors.lastName = 'Letters, spaces, hyphens, and apostrophes only';
    }

    if (form.phone && form.phone.trim() && !validatePhone(form.phone)) {
      nextErrors.phone = 'Enter a valid phone number (e.g. 0911 223 344 or +251 911 223 344)';
    }

    return nextErrors;
  };

  const handleBack = () => {
    if (!isDirty) {
      go('/account/profile');
      return;
    }

    const shouldDiscard = window.confirm('Discard your changes?');
    if (shouldDiscard) go('/account/profile');
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!VALID_FILE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFileError('File must be JPG, PNG or WEBP under 5MB');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: String(reader.result || '') }));
      setFileError('');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        avatar: form.avatar || '',
        dateOfBirth: form.dateOfBirth || null,
      };

      const res = await userApi.updateProfile(payload);
      if (res.success && res.data) {
        if (typeof updateUser === 'function') {
          updateUser(res.data);
        }
        window.dispatchEvent(new CustomEvent('novashop:user-updated'));
        setToast('Profile updated successfully');
        setTimeout(() => {
          go('/account/profile');
        }, 300);
      } else {
        throw new Error(res.message || 'Failed to update profile');
      }
    } catch (err) {
      setToast(err.response?.data?.message || err.message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ') || sessionUser?.email?.split('@')[0] || 'Customer';
  const initials = getInitials(fullName);
  const isSaveDisabled = isSaving || !isDirty || Object.keys(validateForm()).length > 0;

  if (!sessionUser) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/profile/edit'}>
      <div className="ns-edit-profile-page" style={{ display: 'grid', gap: '24px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: 'var(--text-subtle)' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 10px', color: 'var(--text-subtle)' }}>/</span>
          <button type="button" onClick={() => go('/account/profile')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Profile</button>
          <span style={{ margin: '0 10px', color: 'var(--text-subtle)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Edit Profile</span>
        </div>

        <div className="ns-edit-profile-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span aria-hidden="true">←</span>
              Back to Profile
            </button>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3.2vw, 48px)', letterSpacing: '-0.04em', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.05 }}>Edit Profile</h1>
            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Keep your contact details current for deliveries and receipts.</p>
          </div>
        </div>

        <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)' }} />

        {toast && (
          <div style={{ background: 'rgba(34, 123, 81, 0.1)', border: '1px solid var(--color-success)', borderRadius: '12px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)' }}>
            {toast}
          </div>
        )}

        <form onSubmit={handleSave} noValidate style={{ display: 'grid', gap: '24px' }}>
          {/* Avatar Section */}
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', border: '1px solid var(--border-default)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {form.avatar ? (
                <img src={form.avatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)' }}>{initials}</span>
              )}
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Change Photo
                </button>
                {form.avatar && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('avatar', '')}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG or WEBP under 5MB.</div>
              {fileError && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{fileError}</div>}
            </div>
          </section>

          {/* Form Fields */}
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '24px', display: 'grid', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }} className="ns-names-grid">
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>First Name</span>
                <input
                  value={form.firstName}
                  onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: errors.firstName ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
                {errors.firstName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.firstName}</span>}
              </label>

              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last Name</span>
                <input
                  value={form.lastName}
                  onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: errors.lastName ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
                {errors.lastName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.lastName}</span>}
              </label>
            </div>

            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Email Address</span>
              <input
                type="email"
                value={sessionUser?.email || ''}
                disabled
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-surface-sunken)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-muted)', fontSize: '14px', outline: 'none', cursor: 'not-allowed' }}
              />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>Email address cannot be changed directly here. Contact support if you need to update it.</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }} className="ns-names-grid">
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Phone Number (+251...)</span>
                <input
                  value={form.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  placeholder="0911 223 344 or +251 911 223 344"
                  style={{ width: '100%', boxSizing: 'border-box', border: errors.phone ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
                {errors.phone && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.phone}</span>}
              </label>

              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date of Birth</span>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
              </label>
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleBack}
              disabled={isSaving}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaveDisabled}
              style={{
                border: 'none',
                background: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                borderRadius: '999px',
                padding: '14px 26px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                opacity: isSaveDisabled ? 0.6 : 1,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .ns-names-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
