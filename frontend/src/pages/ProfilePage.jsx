import { useEffect, useMemo, useRef, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';

function getInitials(fullName) {
  return (fullName || 'FS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'FS';
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

  if (!form.phone.trim()) {
    nextErrors.phone = 'Phone number is required';
  } else if (!/^\+?[0-9\s\-()]{7,}$/.test(form.phone.trim())) {
    nextErrors.phone = 'Enter a valid phone number';
  }

  if (!form.dateOfBirth) {
    nextErrors.dateOfBirth = 'Date of birth is required';
  } else {
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
  const [userVersion, setUserVersion] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState(() => ({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    avatar: '',
  }));
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/profile');
      go('/login');
      return;
    }

    setForm({
      firstName: user.name?.split(' ')[0] || '',
      lastName: user.name?.split(' ').slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || '',
      dateOfBirth: user.dateOfBirth || '',
      avatar: user.avatar || '',
    });
  }, [go, isLoading, user, userVersion]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 1800);
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

  useEffect(() => {
    const onUserUpdated = () => setUserVersion((value) => value + 1);
    window.addEventListener('novashop:user-updated', onUserUpdated);
    return () => window.removeEventListener('novashop:user-updated', onUserUpdated);
  }, []);

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

  const handleSave = (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    const nextUser = {
      ...user,
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      dateOfBirth: form.dateOfBirth,
      avatar: form.avatar || '',
    };

    updateUser(nextUser);
    setIsEditOpen(false);
    setToast('Profile updated');
    setUserVersion((value) => value + 1);
  };

  const fullName = user.name || 'Firaol Siraj';
  const initials = getInitials(fullName);
  const profileValue = form.avatar || user.avatar || '';

  if (isLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/profile'}>
      <div className="ns-profile-page" style={{ display: 'grid', gap: '28px' }}>
        <div style={{ marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <span style={{ color: '#1B1816' }}>Profile</span>
        </div>

        <section style={{ display: 'grid', gap: '18px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: '#1B1816', lineHeight: 1.05 }}>Profile</h1>
            <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)' }} />
          </div>
        </section>

        <section
          className="ns-profile-card"
          style={{
            display: 'grid',
            gap: '14px',
            background: '#F7F2EA',
            border: '1px solid rgba(27,24,22,0.12)',
            borderRadius: '18px',
            padding: '28px 22px 24px',
            textAlign: 'center',
            justifyItems: 'center',
            animation: 'nsProfileReveal 200ms ease both',
          }}
        >
          <div style={{ width: '82px', height: '82px', borderRadius: '50%', border: '1px solid rgba(27,24,22,0.15)', background: '#EFE5DA', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profileValue ? (
              <img src={profileValue} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#1B1816', lineHeight: 1 }}>{initials}</span>
            )}
          </div>

          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 2.4vw, 38px)', lineHeight: 1.15, color: '#1B1816', fontWeight: 500 }}>{fullName}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>{user.email}</div>
          <button
            type="button"
            onClick={() => go('/account/profile/edit')}
            style={{
              border: '1px solid #1B1816',
              background: 'transparent',
              color: '#1B1816',
              borderRadius: '999px',
              padding: '12px 18px',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 200ms ease, color 200ms ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = '#1B1816';
              event.currentTarget.style.color = '#FDFBF7';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = '#1B1816';
            }}
          >
            Edit Profile
          </button>
        </section>

        <section
          className="ns-profile-info-card"
          style={{
            background: '#F7F2EA',
            border: '1px solid rgba(27,24,22,0.12)',
            borderRadius: '18px',
            padding: '22px 22px 18px',
            display: 'grid',
            gap: '16px',
            animation: 'nsProfileReveal 200ms ease both',
            animationDelay: '50ms',
          }}
        >
          <div style={{ display: 'grid', gap: '12px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '30px', lineHeight: 1.1, color: '#1B1816', fontWeight: 500 }}>Personal information</h2>
            <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '22px 28px' }} className="ns-profile-fields-grid">
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7A726C' }}>Full Name</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1B1816', lineHeight: 1.5 }}>{fullName || 'Not provided'}</div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7A726C' }}>Email Address</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1B1816', lineHeight: 1.5 }}>{user.email || 'Not provided'}</div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7A726C' }}>Phone Number</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1B1816', lineHeight: 1.5 }}>{formatPhone(user.phone)}</div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7A726C' }}>Date of Birth</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1B1816', lineHeight: 1.5 }}>{formatDateLabel(user.dateOfBirth)}</div>
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
            background: 'rgba(17, 14, 12, 0.42)',
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
              background: '#F8F4EE',
              border: '1px solid rgba(27,24,22,0.12)',
              borderRadius: '20px',
              padding: '22px 22px 20px',
              boxShadow: '0 24px 52px rgba(17, 14, 12, 0.14)',
              transform: 'translateY(0)',
              animation: 'nsModalRise 250ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
              <div id="profile-edit-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: '#1B1816', fontWeight: 500, lineHeight: 1.1 }}>Edit profile</div>
              <button type="button" onClick={() => setIsEditOpen(false)} aria-label="Close profile editor" style={{ background: 'none', border: 'none', color: '#1B1816', cursor: 'pointer', fontSize: '26px', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'grid', gap: '18px' }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: '8px' }}>
                <div style={{ width: '86px', height: '86px', borderRadius: '50%', border: '1px solid rgba(27,24,22,0.15)', background: '#EFE5DA', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {form.avatar ? (
                    <img src={form.avatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#1B1816' }}>{getInitials(fullName)}</span>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', padding: 0, color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Change Photo</button>
                  {(form.avatar || user.avatar) && (
                    <button type="button" onClick={() => setForm((current) => ({ ...current, avatar: '' }))} style={{ background: 'none', border: 'none', padding: 0, color: '#6E6962', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Remove Photo</button>
                  )}
                </div>
                {errors.avatar && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.avatar}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 16px' }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>First Name</label>
                  <input value={form.firstName} onChange={(event) => handleFieldChange('firstName', event.target.value)} style={{ width: '100%', border: errors.firstName ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.firstName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.firstName}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Last Name</label>
                  <input value={form.lastName} onChange={(event) => handleFieldChange('lastName', event.target.value)} style={{ width: '100%', border: errors.lastName ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.lastName && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.lastName}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px', gridColumn: '1 / -1' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Email Address</label>
                  <input type="email" value={form.email} onChange={(event) => handleFieldChange('email', event.target.value)} style={{ width: '100%', border: errors.email ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.email && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.email}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Phone Number</label>
                  <input value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} style={{ width: '100%', border: errors.phone ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.phone && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.phone}</span>}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={(event) => handleFieldChange('dateOfBirth', event.target.value)} style={{ width: '100%', border: errors.dateOfBirth ? '1px solid #A14A3F' : '1px solid rgba(27,24,22,0.14)', borderRadius: '10px', background: '#FDFBF7', padding: '12px 14px', fontFamily: 'var(--font-sans)', color: '#1B1816', fontSize: '14px', outline: 'none' }} />
                  {errors.dateOfBirth && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#A14A3F' }}>{errors.dateOfBirth}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '18px', marginTop: '4px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} style={{ background: 'none', border: 'none', padding: 0, color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#1B1816', border: 'none', color: '#FDFBF7', borderRadius: '999px', padding: '14px 20px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', right: '22px', bottom: '22px', zIndex: 250, background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: '0 16px 36px rgba(17, 14, 12, 0.18)' }}>
          {toast}
        </div>
      )}

      <style>{`
        .ns-profile-page * { box-sizing: border-box; }
        .ns-profile-card,
        .ns-profile-info-card {
          opacity: 0;
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
          .ns-profile-page > div:first-child {
            letter-spacing: 0.12em !important;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
