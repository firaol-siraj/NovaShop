import { useEffect, useMemo, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';

const SETTINGS_KEY = 'novashop_user_settings';

const defaultSettings = {
  language: 'English (US)',
  currency: 'USD ($)',
  notifications: {
    orderUpdates: true,
    deliveryUpdates: true,
    promotionalEmails: false,
  },
};

const languageOptions = ['English (US)', 'English (UK)', 'Amharic (አማርኛ)', 'French', 'Arabic'];
const currencyOptions = ['USD ($)', 'ETB (Br)', 'EUR (€)', 'GBP (£)'];

function readSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return { ...defaultSettings, notifications: { ...defaultSettings.notifications } };
    }

    const parsed = JSON.parse(stored);
    return {
      ...defaultSettings,
      ...parsed,
      notifications: {
        ...defaultSettings.notifications,
        ...(parsed?.notifications || {}),
      },
    };
  } catch (error) {
    console.warn('Unable to read settings', error);
    return { ...defaultSettings, notifications: { ...defaultSettings.notifications } };
  }
}

function persistSettings(nextSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    window.dispatchEvent(new CustomEvent('novashop:settings-updated', { detail: nextSettings }));
    return true;
  } catch (error) {
    console.warn('Unable to persist settings', error);
    return false;
  }
}

function getCurrencyFooterLabel(currencyValue) {
  const normalized = currencyValue || defaultSettings.currency;

  if (normalized.includes('USD')) return 'Ethiopia (USD $)';
  if (normalized.includes('ETB')) return 'Ethiopia (ETB Br)';
  if (normalized.includes('EUR')) return 'Ethiopia (EUR €)';
  if (normalized.includes('GBP')) return 'Ethiopia (GBP £)';
  return 'Ethiopia (USD $)';
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8.5c0-1.1-.9-2-2-2h-1.5c-1.1 0-2 .9-2 2s.9 2 2 2h1.5c1.1 0 2 .9 2 2s-.9 2-2 2H9c-1.1 0-2-.9-2-2" />
      <path d="M12 6.5V18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18H3l2-2v-5a7 7 0 0 1 14 0v5l2 2h-6" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4.5l8.5 15H3.5L12 4.5Z" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ direction = 'right' }) {
  const rotation = direction === 'left' ? 'rotate(180deg)' : 'rotate(0deg)';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: rotation }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function EyeToggleIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
      <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a16.7 16.7 0 0 1-3.61 5.13" />
      <path d="M6.61 6.61A16.9 16.9 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
    </svg>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '42px',
        height: '24px',
        border: 'none',
        borderRadius: '999px',
        padding: 0,
        background: checked ? '#1B1816' : '#D5CDC2',
        cursor: 'pointer',
        transition: 'background 200ms ease',
        boxShadow: checked ? 'inset 0 0 0 1px rgba(27,24,22,0.08)' : 'inset 0 0 0 1px rgba(27,24,22,0.08)',
      }}
      className="ns-toggle-switch"
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '21px' : '3px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 8px rgba(27,24,22,0.12)',
          transition: 'left 200ms ease',
          transform: 'translateZ(0)',
        }}
      />
    </button>
  );
}

export default function SettingsPage({ go, currentPath }) {
  const { user, isLoading, logout } = useAuth();
  const [settings, setSettings] = useState(() => readSettings());
  const [toast, setToast] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/settings');
      go('/login');
    }
  }, [go, isLoading, user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveMenu(null);
        setIsPasswordModalOpen(false);
        setDeleteDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const passwordStrength = useMemo(() => {
    const value = passwordForm.newPassword || '';
    if (!value) return { label: 'Password strength', tone: '#C7BDB2', width: '0%' };
    if (value.length < 8) return { label: 'Too short', tone: '#D45A4A', width: '33%' };
    if (value.length >= 10 && /[A-Z]/.test(value) && /\d/.test(value)) return { label: 'Strong', tone: '#2D7A52', width: '100%' };
    if (value.length >= 8) return { label: 'Fair', tone: '#B98535', width: '66%' };
    return { label: 'Weak', tone: '#D45A4A', width: '50%' };
  }, [passwordForm.newPassword]);

  const showToast = (message) => {
    setToast(message);
  };

  const handleOptionClick = (type) => {
    setActiveMenu((current) => (current === type ? null : type));
  };

  const handleSelectOption = (key, value) => {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);
    const saved = persistSettings(nextSettings);
    if (!saved) {
      showToast('Could not save preference');
      return;
    }

    setActiveMenu(null);
    showToast(key === 'language' ? 'Language updated' : 'Currency updated');
  };

  const handleToggleNotification = (key) => {
    const nextSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    };

    setSettings(nextSettings);

    const didPersist = persistSettings(nextSettings);
    if (!didPersist) {
      setSettings(settings);
      showToast('Preferences could not be saved');
      return;
    }

    showToast('Preferences saved');
  };

  const handlePasswordSubmit = () => {
    const nextErrors = {};
    if (!passwordForm.currentPassword.trim()) nextErrors.currentPassword = 'Current password is required.';
    if (!passwordForm.newPassword.trim()) {
      nextErrors.newPassword = 'New password is required.';
    } else if (passwordForm.newPassword.trim().length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters.';
    } else if (passwordForm.newPassword === passwordForm.currentPassword && passwordForm.currentPassword.trim()) {
      nextErrors.newPassword = 'Choose a new password that differs from your current one.';
    }

    if (!passwordForm.confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm your new password.';
    } else if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsPasswordSaving(true);
    setTimeout(() => {
      setIsPasswordSaving(false);
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      setShowPassword({ current: false, new: false, confirm: false });
      showToast('Password updated');
    }, 500);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeletingAccount(true);
    setTimeout(() => {
      try {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem('novashop_wishlist');
        localStorage.removeItem('novashop_cart');
        localStorage.removeItem('novashop_orders');
        localStorage.removeItem('novashop_current_order');
        localStorage.removeItem('novashop_default_address');
      } catch (error) {
        console.warn('Unable to clear account data', error);
      }

      setIsDeletingAccount(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
      window.dispatchEvent(new CustomEvent('novashop:user-updated', { detail: null }));
      showToast('Your account has been deleted');
      go('/');
    }, 500);
  };

  const handleSignOut = async () => {
    await logout();
    go('/');
  };

  const sectionStyles = (delay = 0) => ({
    animation: 'nsSettingsFade 200ms ease both',
    animationDelay: `${delay}ms`,
  });

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/settings'}>
      <div style={{ display: 'grid', gap: '18px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 8px', color: '#B9B1AB' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 8px', color: '#B9B1AB' }}>/</span>
          <span style={{ color: '#1B1816', fontWeight: 700 }}>Settings</span>
        </div>

        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: '#1B1816', lineHeight: 1.08 }}>Settings</h1>
          <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962', lineHeight: 1.65 }}>Manage your preferences and account settings.</p>
        </div>
      </div>

      <section style={{ ...sectionStyles(0), display: 'grid', gap: '22px' }}>
        <div style={{ display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: '#1B1816', fontWeight: 500 }}>Preferences</h2>

          <div style={{ border: '1px solid rgba(27,24,22,0.12)', background: '#FDFBF7', boxShadow: '0 4px 18px rgba(17, 14, 12, 0.03)', overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => handleOptionClick('language')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: 'transparent', border: 'none', padding: '18px 18px 18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'background 180ms ease', fontFamily: 'inherit' }} onMouseEnter={(event) => { event.currentTarget.style.background = '#F4EFE9'; }} onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#F2E9DF', color: '#1B1816' }}><GlobeIcon /></span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1B1816', fontWeight: 500 }}>Language</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6E6962' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962' }}>{settings.language}</span>
                  <ChevronIcon />
                </div>
              </button>

              {activeMenu === 'language' && (
                <div style={{ position: 'absolute', right: '18px', top: 'calc(100% - 8px)', zIndex: 5, width: '250px', background: '#FDFBF7', border: '1px solid rgba(27,24,22,0.12)', boxShadow: '0 16px 36px rgba(17,14,12,0.08)', overflow: 'hidden' }} className="ns-settings-menu">
                  {languageOptions.map((option) => (
                    <button key={option} type="button" onClick={() => handleSelectOption('language', option)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none', background: option === settings.language ? '#F2E9DF' : 'transparent', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                      <span>{option}</span>
                      {option === settings.language && <span style={{ color: '#1B1816', fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(27,24,22,0.10)' }}>
              <button type="button" onClick={() => handleOptionClick('currency')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: 'transparent', border: 'none', padding: '18px 18px 18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'background 180ms ease', fontFamily: 'inherit' }} onMouseEnter={(event) => { event.currentTarget.style.background = '#F4EFE9'; }} onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#F2E9DF', color: '#1B1816' }}><CurrencyIcon /></span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1B1816', fontWeight: 500 }}>Currency</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6E6962' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962' }}>{settings.currency}</span>
                  <ChevronIcon />
                </div>
              </button>

              {activeMenu === 'currency' && (
                <div style={{ position: 'absolute', right: '18px', top: 'calc(100% - 8px)', zIndex: 5, width: '220px', background: '#FDFBF7', border: '1px solid rgba(27,24,22,0.12)', boxShadow: '0 16px 36px rgba(17,14,12,0.08)', overflow: 'hidden' }} className="ns-settings-menu">
                  {currencyOptions.map((option) => (
                    <button key={option} type="button" onClick={() => handleSelectOption('currency', option)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none', background: option === settings.currency ? '#F2E9DF' : 'transparent', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                      <span>{option}</span>
                      {option === settings.currency && <span style={{ color: '#1B1816', fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyles(50), display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: '#1B1816', fontWeight: 500 }}>Notifications</h2>

        <div style={{ border: '1px solid rgba(27,24,22,0.12)', background: '#FDFBF7', boxShadow: '0 4px 18px rgba(17, 14, 12, 0.03)', overflow: 'hidden' }}>
          {[
            { key: 'orderUpdates', title: 'Order updates', description: 'Receive updates about your purchases.', active: settings.notifications.orderUpdates },
            { key: 'deliveryUpdates', title: 'Delivery updates', description: 'Get tracking and shipping notifications.', active: settings.notifications.deliveryUpdates },
            { key: 'promotionalEmails', title: 'Promotional emails', description: 'Receive news about new collections and seasonal edits.', active: settings.notifications.promotionalEmails },
          ].map((item, index) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '18px 18px 18px 20px', borderTop: index === 0 ? 'none' : '1px solid rgba(27,24,22,0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#F2E9DF', color: '#1B1816' }}><BellIcon /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: '#1B1816' }}>{item.title}</div>
                  <div style={{ marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6E6962', lineHeight: 1.5 }}>{item.description}</div>
                </div>
              </div>
              <ToggleSwitch checked={item.active} onChange={() => handleToggleNotification(item.key)} label={item.title} />
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyles(100), display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: '#1B1816', fontWeight: 500 }}>Security</h2>

        <div style={{ border: '1px solid rgba(27,24,22,0.12)', background: '#FDFBF7', boxShadow: '0 4px 18px rgba(17, 14, 12, 0.03)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '18px 18px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#F2E9DF', color: '#1B1816' }}><LockIcon /></span>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: '#1B1816' }}>Password</div>
                <div style={{ marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6E6962', lineHeight: 1.5 }}>Change your password and manage account credentials.</div>
              </div>
            </div>

            <button type="button" onClick={() => setIsPasswordModalOpen(true)} style={{ background: 'transparent', border: 'none', padding: 0, color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>Update <ChevronIcon direction="right" /></button>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyles(150), display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: '#1B1816', fontWeight: 500 }}>Account</h2>

        <div style={{ border: '1px solid rgba(27,24,22,0.12)', background: '#FDFBF7', boxShadow: '0 4px 18px rgba(17, 14, 12, 0.03)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 18px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#FBE7E4', color: '#B7413F' }}><WarningIcon /></span>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: '#1B1816' }}>Delete account</div>
                <div style={{ marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6E6962', lineHeight: 1.5 }}>Permanently delete your account and all associated data. This action is irreversible.</div>
              </div>
            </div>

            <button type="button" onClick={() => setDeleteDialogOpen(true)} style={{ background: '#FCE7E7', border: '1px solid rgba(183,65,63,0.20)', color: '#B7413F', borderRadius: '999px', padding: '12px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, transition: 'background 180ms ease' }} onMouseEnter={(event) => { event.currentTarget.style.background = '#F9DCDC'; }} onMouseLeave={(event) => { event.currentTarget.style.background = '#FCE7E7'; }}>Delete account</button>
          </div>
        </div>
      </section>

      {toast && (
        <div style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 120, background: '#1B1816', color: '#FDFBF7', padding: '12px 16px', borderRadius: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', boxShadow: '0 18px 40px rgba(17,14,12,0.16)' }}>
          {toast}
        </div>
      )}

      {isPasswordModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,14,12,0.42)', display: 'grid', placeItems: 'center', zIndex: 100 }} onClick={() => setIsPasswordModalOpen(false)}>
          <div style={{ width: 'min(520px, calc(100vw - 24px))', background: '#FDFBF7', border: '1px solid rgba(27,24,22,0.12)', boxShadow: '0 28px 60px rgba(17,14,12,0.20)', padding: '22px 22px 18px', position: 'relative', animation: 'nsModalSlide 250ms ease both' }} onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close password modal" onClick={() => setIsPasswordModalOpen(false)} style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: '#5F5853', cursor: 'pointer', fontSize: '20px', lineHeight: 1, width: '28px', height: '28px', display: 'grid', placeItems: 'center' }}>×</button>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', marginBottom: '18px', color: '#1B1816' }}>Update password</div>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#4C4743', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Current password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword.current ? 'text' : 'password'} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} style={{ width: '100%', border: passwordErrors.currentPassword ? '1px solid #C95D52' : '1px solid rgba(27,24,22,0.14)', background: '#F7F2EA', color: '#1B1816', borderRadius: '10px', padding: '14px 42px 14px 14px', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <button type="button" onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#5F5853', cursor: 'pointer' }} aria-label="Toggle current password visibility"><EyeToggleIcon visible={showPassword.current} /></button>
                </div>
                {passwordErrors.currentPassword && <div style={{ marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B7413F' }}>{passwordErrors.currentPassword}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#4C4743', letterSpacing: '0.08em', textTransform: 'uppercase' }}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword.new ? 'text' : 'password'} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} style={{ width: '100%', border: passwordErrors.newPassword ? '1px solid #C95D52' : '1px solid rgba(27,24,22,0.14)', background: '#F7F2EA', color: '#1B1816', borderRadius: '10px', padding: '14px 42px 14px 14px', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <button type="button" onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#5F5853', cursor: 'pointer' }} aria-label="Toggle new password visibility"><EyeToggleIcon visible={showPassword.new} /></button>
                </div>
                <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6E6962' }}>
                    <span>Password strength</span>
                    <span style={{ color: passwordStrength.tone }}>{passwordStrength.label}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', background: '#E5DDD2', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: passwordStrength.width, background: passwordStrength.tone, transition: 'width 200ms ease' }} />
                  </div>
                </div>
                {passwordErrors.newPassword && <div style={{ marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B7413F' }}>{passwordErrors.newPassword}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#4C4743', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Confirm new password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword.confirm ? 'text' : 'password'} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} style={{ width: '100%', border: passwordErrors.confirmPassword ? '1px solid #C95D52' : '1px solid rgba(27,24,22,0.14)', background: '#F7F2EA', color: '#1B1816', borderRadius: '10px', padding: '14px 42px 14px 14px', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <button type="button" onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#5F5853', cursor: 'pointer' }} aria-label="Toggle confirm password visibility"><EyeToggleIcon visible={showPassword.confirm} /></button>
                </div>
                {passwordErrors.confirmPassword && <div style={{ marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B7413F' }}>{passwordErrors.confirmPassword}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={() => setIsPasswordModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#1B1816', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '12px 8px' }}>Cancel</button>
              <button type="button" onClick={handlePasswordSubmit} disabled={isPasswordSaving} style={{ background: '#1B1816', color: '#FDFBF7', border: 'none', borderRadius: '999px', padding: '14px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', minWidth: '180px', opacity: isPasswordSaving ? 0.75 : 1 }}>
                {isPasswordSaving ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDialogOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,14,12,0.46)', display: 'grid', placeItems: 'center', zIndex: 110 }} onClick={() => setDeleteDialogOpen(false)}>
          <div style={{ width: 'min(540px, calc(100vw - 24px))', background: '#FDFBF7', border: '1px solid rgba(27,24,22,0.12)', boxShadow: '0 28px 60px rgba(17,14,12,0.2)', padding: '22px 22px 18px', animation: 'nsModalSlide 250ms ease both' }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#1B1816' }}>Delete your account?</div>
              <button type="button" onClick={() => setDeleteDialogOpen(false)} style={{ background: 'transparent', border: 'none', color: '#5F5853', fontSize: '20px', cursor: 'pointer', width: '28px', height: '28px', display: 'grid', placeItems: 'center' }} aria-label="Close delete account modal">×</button>
            </div>

            <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#5F5853' }}>
              This will permanently remove your orders history, saved addresses, wishlist, and profile data. This action cannot be undone.
            </p>

            <label style={{ display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#4C4743', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Type DELETE to confirm</label>
            <input type="text" value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} style={{ width: '100%', border: '1px solid rgba(27,24,22,0.14)', background: '#F7F2EA', color: '#1B1816', borderRadius: '10px', padding: '14px', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: '18px' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }} style={{ background: 'transparent', border: 'none', color: '#1B1816', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '12px 8px' }}>Cancel</button>
              <button type="button" disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount} onClick={handleDeleteAccount} style={{ background: deleteConfirmText === 'DELETE' && !isDeletingAccount ? '#B7413F' : '#E6C2C0', color: deleteConfirmText === 'DELETE' && !isDeletingAccount ? '#FDFBF7' : '#9E6F6D', border: 'none', borderRadius: '999px', padding: '14px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: deleteConfirmText === 'DELETE' && !isDeletingAccount ? 'pointer' : 'not-allowed', minWidth: '180px' }}>
                {isDeletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ns-toggle-switch:focus-visible,
        .ns-settings-menu button:focus-visible,
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid rgba(27,24,22,0.7);
          outline-offset: 2px;
        }

        @keyframes nsSettingsFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes nsModalSlide {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1023px) {
          .ns-settings-menu {
            left: 14px !important;
            right: 14px !important;
            width: auto !important;
            top: auto !important;
            bottom: 14px !important;
          }
        }

        @media (max-width: 767px) {
          .ns-settings-menu {
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            bottom: 12px !important;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
