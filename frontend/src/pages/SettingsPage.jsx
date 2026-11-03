import { useEffect, useMemo, useState, useCallback } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../lib/api/userApi';
import { ThemeToggle } from '../context/ThemeContext';

const languageOptions = ['English (US)', 'English (UK)', 'Amharic (አማርኛ)', 'French', 'Arabic'];
const currencyOptions = ['USD ($)', 'ETB (Br)', 'EUR (€)', 'GBP (£)'];

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18v-9Z" />
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

function ToggleSwitch({ checked, onChange, label, disabled }) {
  const handleKeyDown = (event) => {
    if (disabled) return;
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
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '42px',
        height: '24px',
        border: 'none',
        borderRadius: '999px',
        padding: 0,
        background: checked ? 'var(--color-primary)' : 'var(--border-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 200ms ease',
        opacity: disabled ? 0.6 : 1,
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
          background: 'var(--bg-main)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          transition: 'left 200ms ease',
        }}
      />
    </button>
  );
}

export default function SettingsPage({ go, currentPath }) {
  const { user, isLoading, logout } = useAuth();
  const [settings, setSettings] = useState({
    language: 'English (US)',
    currency: 'USD ($)',
    notifications: {
      orderUpdates: true,
      deliveryUpdates: true,
      promotionalEmails: false,
    },
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState(null);
  const [toast, setToast] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  // Delete Account State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await userApi.getSettings();
      if (res.success && res.data) {
        setSettings({
          language: res.data.language || 'English (US)',
          currency: res.data.currency || 'USD ($)',
          notifications: {
            orderUpdates: res.data.notifications?.orderUpdates ?? true,
            deliveryUpdates: res.data.notifications?.deliveryUpdates ?? true,
            promotionalEmails: res.data.notifications?.promotionalEmails ?? false,
          },
        });
      }
    } catch (err) {
      console.warn('Unable to load settings from server:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/settings');
      go('/login');
    }
    if (user) {
      fetchSettings();
    }
  }, [go, isLoading, user, fetchSettings]);

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

  const handleSelectOption = async (key, value) => {
    const nextSettings = {
      ...settings,
      [key]: value,
    };
    setSettings(nextSettings);
    setActiveMenu(null);

    try {
      localStorage.setItem('novashop_user_settings', JSON.stringify(nextSettings));
      window.dispatchEvent(new CustomEvent('novashop:settings-updated', { detail: nextSettings }));
    } catch {
      // ignore
    }

    try {
      await userApi.updateSettings({ [key]: value });
      showToast(key === 'language' ? 'Language preference updated' : 'Currency preference updated');
    } catch (err) {
      showToast('Could not save preference to server');
    }
  };

  const handleToggleNotification = async (key) => {
    const nextVal = !settings.notifications[key];
    const nextSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: nextVal,
      },
    };

    setSettings(nextSettings);
    setUpdatingKey(key);

    try {
      await userApi.updateSettings({
        notifications: {
          ...nextSettings.notifications,
        },
      });
      showToast('Notification preference saved');
    } catch (err) {
      // Revert on error
      setSettings(settings);
      showToast('Failed to save preference');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handlePasswordSubmit = async () => {
    const nextErrors = {};
    if (!passwordForm.currentPassword.trim()) nextErrors.currentPassword = 'Current password is required.';
    if (!passwordForm.newPassword.trim()) {
      nextErrors.newPassword = 'New password is required.';
    } else if (passwordForm.newPassword.trim().length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters.';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordForm.newPassword)) {
      nextErrors.newPassword = 'Password must include uppercase, lowercase, and a number.';
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
    try {
      const res = await userApi.updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res.success) {
        setIsPasswordModalOpen(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordErrors({});
        setShowPassword({ current: false, new: false, confirm: false });
        showToast('Password updated successfully');
      } else {
        throw new Error(res.message || 'Failed to update password');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error updating password';
      setPasswordErrors({ currentPassword: msg });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm deactivation.');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError('');
    try {
      const res = await userApi.deleteAccount({ password: deletePassword });
      if (res.success) {
        setDeleteDialogOpen(false);
        setDeletePassword('');
        await logout();
        go('/login');
      } else {
        throw new Error(res.message || 'Unable to deactivate account');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to deactivate account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const sectionStyles = (delay = 0) => ({
    animation: 'nsSettingsFade 200ms ease both',
    animationDelay: `${delay}ms`,
  });

  if (isLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/settings'}>
      <div style={{ display: 'grid', gap: '18px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 8px', color: 'var(--text-subtle)' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 8px', color: 'var(--text-subtle)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Settings</span>
        </div>

        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.08 }}>Settings</h1>
          <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>Manage your preferences, appearance, and account security.</p>
        </div>
      </div>

      <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)', margin: '14px 0 20px' }} />

      {toast && (
        <div style={{ background: 'rgba(34, 123, 81, 0.1)', border: '1px solid var(--color-success)', borderRadius: '12px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-success)', marginBottom: '18px' }}>
          {toast}
        </div>
      )}

      {/* Preferences Section */}
      <section style={{ ...sectionStyles(0), display: 'grid', gap: '22px', marginBottom: '26px' }}>
        <div style={{ display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: 'var(--text-primary)', fontWeight: 500 }}>Preferences & Appearance</h2>

          <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', borderRadius: '14px', overflow: 'hidden' }}>
            {/* Theme / Appearance Segmented Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', color: 'var(--text-primary)' }}><PaletteIcon /></span>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>Interface Theme</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Choose light, dark, or system match</div>
                </div>
              </div>
              <div>
                <ThemeToggle variant="segmented" />
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => handleOptionClick('language')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: 'transparent', border: 'none', padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', color: 'var(--text-primary)' }}><GlobeIcon /></span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>Language</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>{settings.language}</span>
                  <ChevronIcon />
                </div>
              </button>

              {activeMenu === 'language' && (
                <div style={{ position: 'absolute', right: '18px', top: 'calc(100% - 8px)', zIndex: 10, width: '250px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', boxShadow: '0 16px 36px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
                  {languageOptions.map((option) => (
                    <button key={option} type="button" onClick={() => handleSelectOption('language', option)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none', background: option === settings.language ? 'var(--bg-surface-sunken)' : 'transparent', padding: '10px 14px', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                      <span>{option}</span>
                      {option === settings.language && <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', position: 'relative' }}>
              <button type="button" onClick={() => handleOptionClick('currency')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: 'transparent', border: 'none', padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', color: 'var(--text-primary)' }}><CurrencyIcon /></span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>Currency</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>{settings.currency}</span>
                  <ChevronIcon />
                </div>
              </button>

              {activeMenu === 'currency' && (
                <div style={{ position: 'absolute', right: '18px', top: 'calc(100% - 8px)', zIndex: 10, width: '220px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', boxShadow: '0 16px 36px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
                  {currencyOptions.map((option) => (
                    <button key={option} type="button" onClick={() => handleSelectOption('currency', option)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none', background: option === settings.currency ? 'var(--bg-surface-sunken)' : 'transparent', padding: '10px 14px', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                      <span>{option}</span>
                      {option === settings.currency && <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section style={{ ...sectionStyles(50), display: 'grid', gap: '14px', marginBottom: '26px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: 'var(--text-primary)', fontWeight: 500 }}>Notifications</h2>

        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', borderRadius: '14px', overflow: 'hidden' }}>
          {[
            { key: 'orderUpdates', title: 'Order updates', description: 'Receive email confirmations and receipts after successful payment.', active: settings.notifications.orderUpdates },
            { key: 'deliveryUpdates', title: 'Delivery updates', description: 'Get notifications when your shipment is dispatched and out for delivery.', active: settings.notifications.deliveryUpdates },
            { key: 'promotionalEmails', title: 'Promotional emails', description: 'Receive seasonal catalog edits and private showcase invitations.', active: settings.notifications.promotionalEmails },
          ].map((item, index) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '18px 20px', borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', color: 'var(--text-primary)' }}><BellIcon /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.description}</div>
                </div>
              </div>
              <ToggleSwitch checked={item.active} onChange={() => handleToggleNotification(item.key)} label={item.title} disabled={updatingKey === item.key} />
            </div>
          ))}
          <div style={{ padding: '14px 20px', background: 'var(--bg-surface-sunken)', borderTop: '1px solid var(--border-subtle)', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> Security notifications (such as password changes, account deactivation, and verification alerts) are always sent to protect your account regardless of notification settings.
          </div>
        </div>
      </section>

      {/* Security & Password Section */}
      <section style={{ ...sectionStyles(100), display: 'grid', gap: '14px', marginBottom: '26px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: 'var(--text-primary)', fontWeight: 500 }}>Security</h2>

        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', color: 'var(--text-primary)' }}><LockIcon /></span>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Account Password</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>Change your password to keep your account safe.</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Change Password
          </button>
        </div>
      </section>

      {/* Danger Zone: Deactivate Account */}
      <section style={{ ...sectionStyles(150), display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '21px', letterSpacing: '-0.02em', color: 'var(--color-danger)', fontWeight: 500 }}>Danger Zone</h2>

        <div style={{ border: '1px solid rgba(217, 83, 79, 0.3)', background: 'rgba(217, 83, 79, 0.05)', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(217, 83, 79, 0.15)', color: 'var(--color-danger)' }}><WarningIcon /></span>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--color-danger)' }}>Deactivate Account</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                You will be signed out and unable to log in. Your order history is kept for our records. You can reactivate by logging in again.
              </div>
            </div>
          </div>

          {user.role === 'admin' ? (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Admin accounts cannot be deactivated from the customer settings page.
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              style={{ border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', borderRadius: '999px', padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Deactivate Account
            </button>
          )}
        </div>
      </section>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setIsPasswordModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)', background: 'var(--bg-surface)', borderRadius: '20px', border: '1px solid var(--border-default)', padding: '24px', boxShadow: '0 20px 48px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '26px', color: 'var(--text-primary)', fontWeight: 500 }}>Change Password</h3>
              <button type="button" onClick={() => setIsPasswordModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-primary)', padding: 0 }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Current Password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', border: passwordErrors.currentPassword ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '12px 38px 12px 14px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    <EyeToggleIcon visible={showPassword.current} />
                  </button>
                </div>
                {passwordErrors.currentPassword && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{passwordErrors.currentPassword}</span>}
              </label>

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>New Password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', border: passwordErrors.newPassword ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '12px 38px 12px 14px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    <EyeToggleIcon visible={showPassword.new} />
                  </button>
                </div>
                {passwordErrors.newPassword && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{passwordErrors.newPassword}</span>}
                {passwordForm.newPassword && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <div style={{ flex: 1, height: '4px', background: 'var(--bg-surface-sunken)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: passwordStrength.width, background: passwordStrength.tone, transition: 'width 200ms ease' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: passwordStrength.tone, fontWeight: 600 }}>{passwordStrength.label}</span>
                  </div>
                )}
              </label>

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Confirm New Password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', border: passwordErrors.confirmPassword ? '1px solid var(--color-danger)' : '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '12px 38px 12px 14px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    <EyeToggleIcon visible={showPassword.confirm} />
                  </button>
                </div>
                {passwordErrors.confirmPassword && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-danger)' }}>{passwordErrors.confirmPassword}</span>}
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '22px' }}>
              <button type="button" onClick={() => setIsPasswordModalOpen(false)} disabled={isPasswordSaving} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Cancel</button>
              <button type="button" onClick={handlePasswordSubmit} disabled={isPasswordSaving} style={{ background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', padding: '12px 20px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: isPasswordSaving ? 'not-allowed' : 'pointer', opacity: isPasswordSaving ? 0.7 : 1 }}>
                {isPasswordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Account Modal */}
      {deleteDialogOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setDeleteDialogOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 100%)', background: 'var(--bg-surface)', borderRadius: '20px', border: '1px solid var(--border-default)', padding: '24px', boxShadow: '0 20px 48px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--color-danger)', fontWeight: 500 }}>Deactivate Account</h3>
            <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              You will be signed out and unable to log in. Your order history is kept for our records. You can reactivate by logging in again.
            </p>

            <label style={{ display: 'grid', gap: '6px', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Confirm Password</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your current password"
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '12px 14px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}
              />
            </label>

            {deleteError && (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-danger)', marginBottom: '14px', padding: '8px 12px', background: 'rgba(217, 83, 79, 0.1)', borderRadius: '8px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px' }}>
              <button type="button" onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); setDeleteError(''); }} disabled={isDeletingAccount} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Cancel</button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!deletePassword || isDeletingAccount}
                style={{
                  background: 'var(--color-danger)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 18px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: deletePassword && !isDeletingAccount ? 'pointer' : 'not-allowed',
                  opacity: deletePassword && !isDeletingAccount ? 1 : 0.5,
                }}
              >
                {isDeletingAccount ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
