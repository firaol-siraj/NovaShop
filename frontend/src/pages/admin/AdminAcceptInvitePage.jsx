import { useState, useMemo } from 'react';
import AuthLayout from '../../components/admin/AuthLayout';
import PasswordField from '../../components/admin/PasswordField';
import PrimaryButton from '../../components/admin/PrimaryButton';
import settingsApi from '../../lib/api/settingsApi';

export default function AdminAcceptInvitePage({ go }) {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = query.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setSubmitError('Missing invitation token. Please use the link sent to your email.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await settingsApi.acceptInvite(token, password);
      if (res.data?.success || res.status === 200) {
        setIsSuccess(true);
      } else {
        setSubmitError(res.data?.message || 'Failed to accept invitation.');
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message || 'Invitation is invalid or has expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      go={go}
      title="Accept Team Invitation"
      subtitle="Configure your password to activate your NovaShop administrative credentials."
    >
      {isSuccess ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>✓</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1B1816', marginBottom: '8px' }}>
            Account Activated
          </h3>
          <p style={{ fontSize: '14px', color: '#6B6660', marginBottom: '24px' }}>
            Your credentials have been configured. You can now log in to the administrative portal.
          </p>
          <PrimaryButton type="button" onClick={() => go('/admin/login')}>
            Continue to Admin Login →
          </PrimaryButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-auth-form" noValidate>
          {submitError && <div className="admin-auth-banner error">{submitError}</div>}

          <PasswordField
            id="admin-invite-password"
            label="Create Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />

          <PasswordField
            id="admin-invite-confirm"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />

          <div style={{ marginTop: '24px' }}>
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Activating Account...' : 'Set Password & Complete Setup'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
