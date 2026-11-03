import { useState } from 'react';
import AuthLayout from '../../components/admin/AuthLayout';
import TextField from '../../components/admin/TextField';
import PrimaryButton from '../../components/admin/PrimaryButton';
import { authApi } from '../../lib/api/authApi';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export default function AdminForgotPasswordPage({ go }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const validateEmail = (value) => {
    if (!value.trim()) return 'Email address is required.';
    if (!emailPattern.test(value.trim())) return 'Please enter a valid email address.';
    return '';
  };

  const sendResetLink = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await authApi.adminForgotPassword({ email: email.trim() });
      setIsSent(true);
    } catch (requestError) {
      setSubmitError(requestError?.response?.data?.message || requestError?.message || 'Unable to send a reset link right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateEmail(email);
    setFieldError(validationError);

    if (validationError) {
      return;
    }

    await sendResetLink();
  };

  return (
    <AuthLayout
      showFooter
      formMaxWidth={420}
      imageAlt="Editorial fashion rack display"
      className="admin-auth-shell-forgot"
    >
      <div className="admin-forgot-content">
        <button
          type="button"
          onClick={() => go('/admin/login')}
          className="admin-auth-link admin-forgot-back-link"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
            <path d="M9 12h12" />
          </svg>
          <span>Back to sign in</span>
        </button>

        <h1 className="admin-auth-title admin-forgot-title">Forgot password?</h1>
        <p className="admin-forgot-description">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {isSent ? (
          <div className="admin-forgot-success" aria-live="polite">
            <p>Check your inbox</p>
            <span>We've sent a reset link to {email.trim()}.</span>
            {submitError && <p className="admin-auth-form-error">{submitError}</p>}
            <button
              type="button"
              className="admin-forgot-resend"
              onClick={sendResetLink}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Resend link'}
            </button>
          </div>
        ) : (
          <form className="admin-auth-form admin-forgot-form" onSubmit={handleSubmit} noValidate>
            {submitError && <p className="admin-auth-form-error" role="alert">{submitError}</p>}

            <TextField
              id="admin-forgot-email"
              name="email"
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldError) setFieldError('');
              }}
              onBlur={() => setFieldError(validateEmail(email))}
              placeholder="name@company.com"
              autoComplete="email"
              leadingIcon={<MailIcon />}
              error={fieldError}
            />

            <PrimaryButton
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="admin-forgot-button"
            >
              SEND RESET LINK
            </PrimaryButton>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
