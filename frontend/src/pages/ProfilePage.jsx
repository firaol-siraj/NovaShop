import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

function validateProfile(form) {
  const nextErrors = {};

  if (!form.firstName.trim()) nextErrors.firstName = 'First name is required';
  if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required';

  if (!form.email.trim()) {
    nextErrors.email = 'Email address is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    nextErrors.email = 'Enter a valid email address';
  }

  if (form.phone && form.phone.trim()) {
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 9) {
      nextErrors.phone = 'Enter a valid phone number (e.g. 0911 223 344 or +251 911 223 344)';
    }
  }

  if (form.dateOfBirth) {
    const selected = new Date(form.dateOfBirth);
    const today = new Date();
    if (Number.isNaN(selected.getTime()) || selected >= today) {
      nextErrors.dateOfBirth = 'Date of birth must be in the past';
    }
  }

  return nextErrors;
}

function formatDateLabel(dateValue) {
  if (!dateValue) return 'Not provided';

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 'Not provided';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatPhone(value) {
  const normalized = String(value || '').trim();
  return normalized || 'Not provided';
}

export default function ProfilePage({ go, currentPath }) {
  const { user, isLoading, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    avatar: '',
  });
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await userApi.getMe();
      if (res.success && res.data) {
        setProfileData(res.data);
        const u = res.data;
        const fn = u.firstName || (u.name ? u.name.split(' ')[0] : '');
        const ln = u.lastName || (u.name ? u.name.split(' ').slice(1).join(' ') : '');
        setForm({
          firstName: fn,
          lastName: ln,
          email: u.email || '',
          phone: u.phone || '',
          dateOfBirth: u.dateOfBirth ? u.dateOfBirth.split('T')[0] : '',
          avatar: u.avatar || '',
        });
      }
    } catch {
      // Fallback to auth context
      if (user) {
        setProfileData(user);
        const fn = user.firstName || (user.name ? user.name.split(' ')[0] : '');
        const ln = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '');
        setForm({
          firstName: fn,
          lastName: ln,
          email: user.email || '',
          phone: user.phone || '',
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
          avatar: user.avatar || '',
        });
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/profile');
      go('/login');
      return;
    }
    fetchProfile();
  }, [go, isLoading, user, fetchProfile]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isEditOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsEditOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditOpen]);

  const handleFieldChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, avatar: 'Please choose an image file' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: String(reader.result || '') }));
      setErrors((current) => ({ ...current, avatar: '' }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth || null,
        avatar: form.avatar || '',
      };

      const res = await userApi.updateProfile(payload);
      if (res.success && res.data) {
        setProfileData(res.data);
        if (typeof updateUser === 'function') {
          updateUser(res.data);
        }
        window.dispatchEvent(new Event('novashop:user-updated'));
        setIsEditOpen(false);
        setToast('Profile updated successfully');
      } else {
        throw new Error(res.message || 'Failed to update profile');
      }
    } catch (err) {
      setToast(err.response?.data?.message || err.message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const activeUser = profileData || user;
  const fullName = activeUser?.name || `${form.firstName} ${form.lastName}`.trim() || activeUser?.email?.split('@')[0] || 'Customer';
  const initials = getInitials(fullName);
  const profileAvatar = form.avatar || activeUser?.avatar || '';

  if (isLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/profile'}>
      <div className="ns-profile-page" style={{ display: 'grid', gap: '28px' }}>
        <div style={{ marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: 'var(--text-subtle)' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 10px', color: 'var(--text-subtle)' }}>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Profile</span>
        </div>

        <section style={{ display: 'grid', gap: '18px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.05 }}>Profile</h1>
            <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)' }} />
          </div>
        </section>

        <section
          className="ns-profile-card"
          style={{
            display: 'grid',
            gap: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '18px',
            padding: '28px 22px 24px',
            textAlign: 'center',
            justifyItems: 'center',
            animation: 'nsProfileReveal 200ms ease both',
          }}
        >
          <div style={{ width: '82px', height: '82px', borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-surface-sunken)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profileAvatar ? (
              <img src={profileAvatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', lineHeight: 1 }}>{initials}</span>
            )}
          </div>

          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 2.4vw, 38px)', lineHeight: 1.15, color: 'var(--text-primary)', fontWeight: 500 }}>{fullName}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>{activeUser?.email}</div>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            style={{
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-primary)',
              borderRadius: '999px',
              padding: '12px 22px',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 200ms ease, color 200ms ease',
            }}
          >
            Edit Profile
          </button>
        </section>

        <section
          className="ns-profile-info-card"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '18px',
            padding: '22px 22px 18px',
            display: 'grid',
            gap: '16px',
            animation: 'nsProfileReveal 200ms ease both',
            animationDelay: '50ms',
          }}
        >
          <div style={{ display: 'grid', gap: '12px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '30px', lineHeight: 1.1, color: 'var(--text-primary)', fontWeight: 500 }}>Personal Information</h2>
            <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '22px 28px' }} className="ns-profile-fields-grid">
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Full Name</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{fullName}</div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Email Address</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{activeUser?.email || 'Not provided'}</div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Phone Number</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{formatPhone(activeUser?.phone)}</div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date of Birth</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{formatDateLabel(activeUser?.dateOfBirth)}</div>
            </div>
          </div>
        </section>
      </div>

      {isEditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
          onClick={() => setIsEditOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'nsOverlayFade 250ms ease',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(620px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 24px 52px rgba(0, 0, 0, 0.25)',
              animation: 'nsModalRise 250ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
              <div id="profile-edit-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.1 }}>Edit Profile</div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                aria-label="Close profile editor"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '28px',
                  lineHeight: 1,
                  padding: 0,
                  width: '44px',
                  height: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'grid', gap: '18px' }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: '8px' }}>
                <div style={{ width: '86px', height: '86px', borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-surface-sunken)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {form.avatar ? (
                    <img src={form.avatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)' }}>{initials}</span>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', padding: '8px 12px', minHeight: '38px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Change Photo</button>
                  {form.avatar && (
                    <button type="button" onClick={() => setForm((current) => ({ ...current, avatar: '' }))} style={{ background: 'none', border: 'none', padding: '8px 12px', minHeight: '38px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Remove Photo</button>
                  )}
                </div>
                {errors.avatar && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.avatar}</div>}
              </div>

              <div className="ns-modal-inputs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 16px' }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>First Name</label>
                  <input value={form.firstName} onChange={(event) => handleFieldChange('firstName', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.firstName ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {errors.firstName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.firstName}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last Name</label>
                  <input value={form.lastName} onChange={(event) => handleFieldChange('lastName', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.lastName ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {errors.lastName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.lastName}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Email Address (Account ID)</label>
                  <input type="email" value={form.email} disabled style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-surface-sunken)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-muted)', fontSize: '14px', outline: 'none', cursor: 'not-allowed' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>Email address is linked to your account security.</span>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Phone Number (+251...)</label>
                  <input value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} placeholder="0911 223 344" style={{ width: '100%', boxSizing: 'border-box', border: errors.phone ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {errors.phone && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.phone}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={(event) => handleFieldChange('dateOfBirth', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: errors.dateOfBirth ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {errors.dateOfBirth && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{errors.dateOfBirth}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSaving}
                  style={{
                    background: 'none',
                    border: 'none',
                    minHeight: '44px',
                    padding: '10px 16px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    background: 'var(--color-primary)',
                    border: 'none',
                    color: 'var(--color-primary-contrast)',
                    borderRadius: '999px',
                    minHeight: '44px',
                    padding: '12px 22px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', right: '22px', bottom: 'calc(22px + env(safe-area-inset-bottom, 0px))', zIndex: 250, background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)' }}>
          {toast}
        </div>
      )}

      <style>{`
        .ns-profile-page * { box-sizing: border-box; }
        .ns-profile-card,
        .ns-profile-info-card {
          animation: nsProfileReveal 200ms ease both;
        }
        @keyframes nsProfileReveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes nsOverlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes nsModalRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1023px) {
          .ns-profile-fields-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 767px) {
          .ns-profile-card {
            padding: 24px 16px 22px !important;
          }
          .ns-profile-info-card {
            padding: 18px 16px 16px !important;
          }
          .ns-profile-fields-grid {
            gap: 16px !important;
          }
          .ns-modal-inputs-grid {
            grid-template-columns: 1fr !important;
          }
          div[role="dialog"] input {
            font-size: 16px !important;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
