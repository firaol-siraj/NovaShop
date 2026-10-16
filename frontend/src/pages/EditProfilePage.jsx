import { useEffect, useMemo, useRef, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';

import { useAuth } from '../context/AuthContext';
import { userApi } from '../lib/api/userApi';

function getInitials(fullName) {
  return (fullName || 'FS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'FS';
}

function validateName(value) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]+$/.test(value.trim());
}

function validatePhone(value) {
  if (!value || !value.trim()) return true;
  return /^\+?[0-9\s\-()]{7,}$/.test(value.trim());
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfilePage({ go, currentPath }) {
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  
  const sessionUser = useMemo(() => {
    if (!user) return null;
    const nameParts = (user.name || '').split(' ');
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || '+251 91 123 4567',
      avatar: user.avatar || '',
    };
  }, [user]);

  const [form, setForm] = useState({
    firstName: sessionUser?.firstName || '',
    lastName: sessionUser?.lastName || '',
    email: sessionUser?.email || '',
    phone: sessionUser?.phone || '',
    avatar: sessionUser?.avatar || '',
  });
  
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [fileError, setFileError] = useState('');

  const initialValues = useMemo(() => ({
    firstName: sessionUser?.firstName || '',
    lastName: sessionUser?.lastName || '',
    email: sessionUser?.email || '',
    phone: sessionUser?.phone || '',
    avatar: sessionUser?.avatar || '',
  }), [sessionUser]);

  const isDirty = useMemo(() => {
    const keys = ['firstName', 'lastName', 'email', 'phone', 'avatar'];
    return keys.some((key) => form[key] !== initialValues[key]);
  }, [form, initialValues]);

  useEffect(() => {
    if (sessionUser) {
      setForm({
        firstName: sessionUser.firstName || '',
        lastName: sessionUser.lastName || '',
        email: sessionUser.email || '',
        phone: sessionUser.phone || '',
        avatar: sessionUser.avatar || '',
      });
    }
  }, [sessionUser]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 1800);
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

    if (!form.email.trim()) {
      nextErrors.email = 'Email address is required';
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (form.phone.trim() && !validatePhone(form.phone)) {
      nextErrors.phone = 'Enter a valid phone number';
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
    event.target.value = '';
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    const activeEmail = sessionUser?.email || '';
    const trimmedEmail = form.email.trim();
    const emailChanged = trimmedEmail.toLowerCase() !== activeEmail.toLowerCase();

    setIsSaving(true);
    try {
      if (user && user._id) {
        await userApi.updateUser(user._id, {
          name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          phone: form.phone.trim(),
          avatar: form.avatar || '',
          email: emailChanged ? trimmedEmail : undefined
        });
        window.dispatchEvent(new CustomEvent('novashop:user-updated'));
      }
      setToast('Profile updated');
      setTimeout(() => {
        go('/account/profile');
      }, 180);
    } catch (err) {
      setToast('Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ') || 'Firaol Siraj';
  const initials = getInitials(fullName);
  const emailNotice = form.email.trim().toLowerCase() !== (sessionUser?.email || '').toLowerCase();
  const isSaveDisabled = isSaving || !isDirty || Object.keys(validateForm()).length > 0;

  if (!sessionUser) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/profile/edit'}>
      <div className="ns-edit-profile-page" style={{ display: 'grid', gap: '24px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <button type="button" onClick={() => go('/account/profile')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Profile</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <span style={{ color: '#1B1816', fontWeight: 700 }}>Edit Profile</span>
        </div>

        <div className="ns-edit-profile-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span aria-hidden="true">←</span>
              Back to Profile
            </button>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, lineHeight: 1.05, color: '#1B1816' }}>Edit profile</h1>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>Update your personal information and contact preferences.</div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4B7A5B', background: 'rgba(87, 138, 108, 0.08)', border: '1px solid rgba(87, 138, 108, 0.20)', borderRadius: '999px', padding: '8px 10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4B7A5B', display: 'inline-block' }} />
            Account Active
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '22px' }}>
          <div className="ns-edit-card" style={{ background: '#F8F4EF', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '18px', padding: '28px 28px 26px', display: 'grid', gap: '22px' }}>
            <div className="ns-photo-panel" style={{ display: 'flex', alignItems: 'center', gap: '22px', background: '#F3EEE6', border: '1px solid rgba(27,24,22,0.10)', borderRadius: '16px', padding: '20px 18px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '82px', height: '82px', flexShrink: 0 }}>
                <div style={{ width: '82px', height: '82px', borderRadius: '50%', border: '1px solid rgba(27,24,22,0.15)', background: '#EFE7DD', boxShadow: '0 10px 24px rgba(17,14,12,0.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {form.avatar ? (
                    <img src={form.avatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#1B1816' }}>{initials}</span>
                  )}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Change profile photo" style={{ position: 'absolute', right: '-4px', bottom: '-2px', width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #F8F4EF', background: '#1B1816', color: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 18px rgba(17,14,12,0.12)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>

              <div style={{ display: 'grid', gap: '8px', flex: 1, minWidth: '220px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Profile photo</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6E6962', lineHeight: 1.6 }}>Recommended 400 x 400px. JPG, PNG or WEBP up to 5MB.</div>
                {fileError && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{fileError}</div>}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(27,24,22,0.18)', background: 'transparent', color: '#1B1816', borderRadius: '999px', padding: '10px 16px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" />
                      <path d="m7 20 5 5 5-5" />
                      <path d="M21 16v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2" />
                    </svg>
                    Change photo
                  </button>
                  {(form.avatar || sessionUser.avatar) && (
                    <button type="button" onClick={() => setForm((current) => ({ ...current, avatar: '' }))} style={{ background: 'none', border: 'none', padding: 0, color: '#6E6962', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Remove photo</button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} style={{ display: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '32px', color: '#1B1816', fontWeight: 500 }}>Personal information</h2>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>* Mandatory fields</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }} className="ns-edit-form-grid">
                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>First Name *</label>
                  <input value={form.firstName} onChange={(event) => handleFieldChange('firstName', event.target.value)} style={{ width: '100%', border: errors.firstName ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.12)', borderRadius: '10px', background: '#F4EFE8', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.firstName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.firstName}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Last Name *</label>
                  <input value={form.lastName} onChange={(event) => handleFieldChange('lastName', event.target.value)} style={{ width: '100%', border: errors.lastName ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.12)', borderRadius: '10px', background: '#F4EFE8', padding: '13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.lastName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.lastName}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Email Address *</label>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F0E7DA', color: '#5A514C', borderRadius: '999px', padding: '5px 8px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid rgba(27,24,22,0.08)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3.37 9.74 8 11 4.63-1.26 8-6 8-11V6l-8-4Z" /><path d="M9.5 12.5 11 14l3.5-4" /></svg>
                      Verification required if changed
                    </span>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input value={form.email} onChange={(event) => handleFieldChange('email', event.target.value)} style={{ width: '100%', border: errors.email ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.12)', borderRadius: '10px', background: '#F4EFE8', padding: '13px 42px 13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#7A726C' }}>
                      <path d="M4 4h16v16H4z" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </div>

                  {errors.email && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.email}</span>}
                  {emailNotice && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6E6962', lineHeight: 1.6 }}>
                      We&apos;ll send a verification link to the new address. Your current email stays active until you confirm.
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Phone Number</label>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6E6962' }}>Primary contact</span>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} style={{ width: '100%', border: errors.phone ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.12)', borderRadius: '10px', background: '#F4EFE8', padding: '13px 42px 13px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#7A726C' }}>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.34 12.34 0 0 0 .67 7.02 2 2 0 0 1 .74 9.3L3 13l7 7-3.7 3.7a2 2 0 0 1-1.28.56Z" />
                    </svg>
                  </div>
                  {errors.phone && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.phone}</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#efe6dc', border: '1px solid rgba(27,24,22,0.10)', borderRadius: '12px', padding: '14px 18px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#5D5652', fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.5 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3.37 9.74 8 11 4.63-1.26 8-6 8-11V6l-8-4Z" /><path d="M9.5 12.5 11 14l3.5-4" /></svg>
                Your personal data is encrypted and handled under NovaShop luxury privacy protocols.
              </div>
              <button type="button" onClick={() => go('/privacy-policy')} style={{ background: 'none', border: 'none', padding: 0, color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>View Policy</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', padding: 0, color: '#6E6962', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isSaveDisabled} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: isSaveDisabled ? '#B8B1A7' : '#1B1816', border: 'none', color: '#FDFBF7', borderRadius: '999px', padding: '14px 22px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: isSaveDisabled ? 'not-allowed' : 'pointer', opacity: isSaveDisabled ? 0.6 : 1 }}>
                {isSaving ? 'Saving…' : 'Save Changes'}
                {!isSaving && <span aria-hidden="true">→</span>}
              </button>
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid rgba(27,24,22,0.12)', paddingTop: '18px', color: '#6E6962', fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
          <span>Need to modify linked payment or shipping defaults?</span>
          <button type="button" onClick={() => go('/account/addresses')} style={{ background: 'none', border: 'none', padding: 0, color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>Manage Addresses</button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', right: '20px', bottom: '20px', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: '0 14px 30px rgba(17,14,12,0.18)', zIndex: 200 }}>
          {toast}
        </div>
      )}

      <style>{`
        .ns-edit-profile-page * { box-sizing: border-box; }
        .ns-edit-card,
        .ns-photo-panel,
        .ns-edit-profile-header > div {
          animation: nsEditFade 200ms ease both;
        }
        .ns-edit-card { animation-delay: 50ms; }
        .ns-photo-panel { animation-delay: 100ms; }
        @keyframes nsEditFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1023px) {
          .ns-edit-form-grid {
            grid-template-columns: 1fr !important;
          }
          .ns-edit-profile-header {
            display: grid !important;
          }
          .ns-edit-profile-header > div:last-child {
            justify-self: flex-start !important;
          }
        }
        @media (max-width: 767px) {
          .ns-edit-card {
            padding: 20px 16px 18px !important;
          }
          .ns-photo-panel {
            justify-content: center !important;
            text-align: center !important;
          }
          .ns-edit-profile-header {
            gap: 12px !important;
          }
          .ns-edit-form-grid {
            gap: 16px !important;
          }
          .ns-edit-form-grid > div {
            grid-column: 1 / -1 !important;
          }
          .ns-edit-card > div:nth-child(3) {
            justify-content: center !important;
          }
          .ns-edit-card > div:nth-child(3) button {
            width: 100%;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
