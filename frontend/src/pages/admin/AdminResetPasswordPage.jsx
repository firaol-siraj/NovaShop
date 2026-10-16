import { useState } from 'react';
import AuthLayout from '../../components/admin/AuthLayout';
import PasswordField from '../../components/admin/PasswordField';

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function RequirementIndicator({ met }) {
  return (
    <span className="admin-reset-requirement-indicator" aria-hidden="true">
      {met && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="m2.5 6 2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export default function AdminResetPasswordPage({ go, search = '' }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const email = new URLSearchParams(search).get('email')?.trim() || 'your account';

  const requirements = [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Upper and lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'At least one number', met: /\d/.test(password) },
  ];
  const isPasswordValid = requirements.every((requirement) => requirement.met);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmError = confirmTouched && confirmPassword && confirmPassword !== password
    ? 'Passwords do not match.'
    : '';

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;
    setIsUpdated(true);
  };

  return (
    <AuthLayout showFooter formMaxWidth={420} className="admin-auth-shell-reset">
      <div className="admin-reset-content">
        {isUpdated ? (
          <section className="admin-reset-success" aria-live="polite">
            <h2>Password updated</h2>
            <p>Your password has been updated. You can now sign in to your NovaShop admin account.</p>
            <button type="button" className="admin-reset-continue" onClick={() => go('/admin/login')}>
              Continue to sign in
            </button>
          </section>
        ) : (
          <>
            <h1 className="admin-auth-title admin-reset-title">Reset password</h1>
            <p className="admin-reset-description">
              Choose a new password for <strong>{email}</strong>.
            </p>

            <form className="admin-auth-form admin-reset-form" onSubmit={handleSubmit} noValidate>
              <PasswordField
                id="admin-reset-password"
                name="password"
                label="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
              />

              <ul className="admin-reset-requirements" aria-label="Password requirements">
                {requirements.map(({ label, met }) => (
                  <li key={label} className={`admin-reset-requirement${met ? ' is-met' : ''}`}>
                    <RequirementIndicator met={met} />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>

              <PasswordField
                id="admin-reset-confirm-password"
                name="confirmPassword"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={() => setConfirmTouched(true)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                error={confirmError}
              />

              <button className="admin-reset-submit" type="submit" disabled={!isPasswordValid || !passwordsMatch}>
                <LockIcon />
                <span>Reset password</span>
              </button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}