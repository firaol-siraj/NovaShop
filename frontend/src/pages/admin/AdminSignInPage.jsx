import { useMemo, useState } from 'react';
import AuthLayout from '../../components/admin/AuthLayout';
import TextField from '../../components/admin/TextField';
import PasswordField from '../../components/admin/PasswordField';
import PrimaryButton from '../../components/admin/PrimaryButton';
import { useAdminAuth } from '../../context/AdminAuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export default function AdminSignInPage({ go }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = useMemo(() => {
    return (values) => {
      const nextErrors = {};

      if (!values.email.trim()) {
        nextErrors.email = 'Email address is required.';
      } else if (!emailPattern.test(values.email.trim())) {
        nextErrors.email = 'Please enter a valid email address.';
      }

      if (!values.password) {
        nextErrors.password = 'Password is required.';
      }

      return nextErrors;
    };
  }, []);

  const handleBlur = (field) => {
    const nextTouched = { ...touched, [field]: true };
    setTouched(nextTouched);
    setFieldErrors((current) => ({ ...current, ...validateForm({ email, password }) }));
  };

  const { login } = useAdminAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateForm({ email, password });
    setFieldErrors(validation);
    setTouched({ email: true, password: true });

    if (Object.keys(validation).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await login({ email: email.trim(), password, rememberMe });
      const query = new URLSearchParams(window.location.search);
      const requestedTarget = query.get('redirect');
      let redirectTarget = '/admin/dashboard';
      if (requestedTarget) {
        try {
          const targetUrl = new URL(requestedTarget, window.location.origin);
          const isAdminDestination = targetUrl.origin === window.location.origin
            && targetUrl.pathname.startsWith('/admin/')
            && !['/admin/login', '/admin/forgot-password', '/admin/reset-password'].includes(targetUrl.pathname);
          if (isAdminDestination) {
            redirectTarget = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
          }
        } catch {
          redirectTarget = '/admin/dashboard';
        }
      }
      go(redirectTarget);
    } catch (error) {
      const message = error?.message || 'Something went wrong. Please try again.';

      if (/invalid email|invalid email or password/i.test(message)) {
        setSubmitError('Invalid email or password.');
      } else if (/too many attempts|429|rate limit/i.test(message)) {
        setSubmitError('Too many attempts. Try again later.');
      } else if (/network|fetch|failed to fetch|request failed/i.test(message)) {
        setSubmitError('Network error. Please try again.');
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentErrors = {
    email: touched.email ? fieldErrors.email : '',
    password: touched.password ? fieldErrors.password : '',
  };

  return (
    <AuthLayout showFooter formMaxWidth={420} className="admin-auth-shell-signin">
      <div>
        <h1 className="admin-auth-title">Sign in</h1>
        <p className="admin-auth-subtitle">Access your NovaShop admin.</p>
      </div>

      <form className="admin-auth-form admin-auth-form-signin" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <p className="admin-auth-form-error" aria-live="polite">
            {submitError}
          </p>
        )}

        <TextField
          id="admin-email"
          name="email"
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="name@company.com"
          autoComplete="username"
          leadingIcon={<MailIcon />}
          error={currentErrors.email}
        />

        <PasswordField
          id="admin-password"
          name="password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => handleBlur('password')}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={currentErrors.password}
        />

        <div className="admin-auth-remember-row">
          <label className="admin-auth-checkbox-row">
            <input
              className="admin-auth-checkbox"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Keep me signed in for 30 days</span>
          </label>

          <button type="button" onClick={() => go('/admin/forgot-password')} className="admin-auth-link">
            Forgot password?
          </button>
        </div>

        <PrimaryButton
          type="submit"
          loading={isSubmitting}
          disabled={isSubmitting}
          className="admin-auth-signin-button"
        >
          SIGN IN
        </PrimaryButton>

        <div className="admin-auth-divider" />

        <p className="admin-auth-access-message">Need access? Ask your store owner to invite you.</p>
      </form>
    </AuthLayout>
  );
}
