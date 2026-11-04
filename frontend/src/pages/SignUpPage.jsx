import { useMemo, useState } from 'react';
import { getPostLoginRedirect, startGoogleSignIn } from '../lib/googleIdentity';
import { useAuth } from '../context/AuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}

function EyeIcon({ visible }) {
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

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.99h5.57c-.24 1.33-1.58 3.9-5.57 3.9-3.35 0-6.08-2.77-6.08-6.19s2.73-6.19 6.08-6.19c1.91 0 3.2.81 3.94 1.5l2.68-2.6C16.96 2.74 14.76 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c5.77 0 9.57-4.05 9.57-9.75 0-.66-.07-1.15-.16-1.65H12Z" />
      <path fill="#34A853" d="M3.9 7.5l3.45 2.52c.93-1.77 2.87-3.02 4.65-3.02 1.91 0 3.2.81 3.94 1.5l2.68-2.6C16.96 2.74 14.76 2 12 2 8.31 2 5.17 4.28 3.9 7.5Z" />
      <path fill="#FBBC05" d="M3.9 16.5A10 10 0 0 1 2 12c0-1.31.3-2.55.84-3.67l3.81 2.81c-.2.49-.31 1.04-.31 1.62 0 .88.19 1.72.56 2.49l-3.9 2.75Z" />
      <path fill="#4285F4" d="M12 22c2.7 0 4.96-.89 6.62-2.4l-3.08-2.66c-.82.56-1.91.91-3.54.91-2.67 0-4.91-1.8-5.71-4.22l-3.29 2.53A10 10 0 0 0 12 22Z" />
    </svg>
  );
}

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function SignUpPage({ go }) {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');

  const inputBaseStyle = useMemo(
    () => ({
      width: '100%',
      border: '1px solid var(--border-default)',
      background: 'var(--bg-input)',
      color: 'var(--text-primary)',
      borderRadius: '12px',
      padding: '16px 18px',
      fontSize: '14px',
      fontFamily: 'var(--font-sans)',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 180ms ease, box-shadow 180ms ease',
    }),
    []
  );

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    if (field === 'password' || field === 'confirmPassword') {
      setErrors((current) => ({ ...current, confirmPassword: '' }));
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!emailPattern.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }
    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.confirmPassword !== formData.password) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const { register } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSuccessMessage('');
    setGoogleNotice('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      password: formData.password,
    };

    try {
      await register(payload);
      const redirectTarget = getPostLoginRedirect();
      setSuccessMessage('Account created successfully. Redirecting...');
      setTimeout(() => {
        go(redirectTarget);
      }, 700);
    } catch (err) {
      setErrors({ email: err.message || 'Registration failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = () => {
    setGoogleNotice('');
    startGoogleSignIn({
      onSuccess: () => {
        setGoogleNotice('Google sign-in requires backend credential verification.');
      },
      onError: setGoogleNotice,
    });
  };

  return (
    <>
      <style>{`
        @media (max-width: 1024px) {
          .signup-shell {
            display: block !important;
          }
          .signup-visual {
            display: none !important;
          }
          .signup-form-panel {
            width: 100% !important;
            flex: 1 1 auto !important;
            min-height: auto !important;
            padding: 28px 18px 32px !important;
          }
        }

        @media (max-width: 640px) {
          .signup-name-grid {
            grid-template-columns: 1fr !important;
          }
          .signup-footer {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .signup-form-panel input {
            font-size: 16px !important;
          }
          .signup-form-panel button[type="submit"] {
            min-height: 48px !important;
          }
        }
      `}</style>
      <div
        className="signup-shell"
        style={{
          display: 'flex',
          flex: 1,
          minHeight: '100dvh',
          background: 'var(--bg-main)',
        }}
      >
        <aside
          className="signup-visual"
          style={{
            position: 'relative',
            flex: '0 0 46%',
            minHeight: '560px',
            backgroundImage:
              'linear-gradient(180deg, rgba(15, 12, 10, 0.18) 0%, rgba(15, 12, 10, 0.5) 100%), url("https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '28px 36px 34px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.42) 100%)',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '100%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <span
                style={{
                  border: '1px solid rgba(255,255,255,0.5)',
                  borderRadius: '999px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '9px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  background: 'rgba(17, 14, 12, 0.12)',
                }}
              >
                ● Autumn/Winter 2026 Archive
              </span>
            </div>

            <div style={{ maxWidth: '520px' }}>
              <div
                style={{
                  width: '58px',
                  height: '1px',
                  background: 'rgba(255,255,255,0.58)',
                  marginBottom: '20px',
                }}
              />
              <h2
                style={{
                  margin: 0,
                  color: '#F5F1EC',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(24px, 2.4vw, 30px)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.03em',
                  fontWeight: 400,
                }}
              >
                Modern silhouettes, made to last.
              </h2>
              <p
                style={{
                  margin: '14px 0 0',
                  color: 'rgba(255,255,255,0.78)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  maxWidth: '420px',
                }}
              >
                Thoughtful tailoring crafted with enduring materials and clean proportions.
              </p>
            </div>
          </div>
        </aside>

        <main
          className="signup-form-panel"
          style={{
            flex: 1,
            background: 'var(--bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '42px 30px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '560px' }}>
            <div
              style={{
                marginBottom: '18px',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 'clamp(38px, 4vw, 56px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.05em',
                  color: 'var(--text-primary)',
                }}
              >
                Create your account
              </h1>

              <p
                style={{
                  margin: '12px 0 0',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  maxWidth: '500px',
                }}
              >
                Create your NovaShop account to save favorites, manage orders, and check out faster.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '18px' }}>
              <div className="signup-name-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="signup-first-name"
                    style={{
                      display: 'block',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      marginBottom: '10px',
                    }}
                  >
                    First Name
                  </label>
                  <input
                    id="signup-first-name"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    placeholder="Eleanor"
                    aria-label="First name"
                    autoComplete="given-name"
                    style={{
                      ...inputBaseStyle,
                      borderColor: errors.firstName ? 'var(--color-danger)' : 'var(--border-default)',
                      boxShadow: errors.firstName ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                    }}
                  />
                  {errors.firstName && (
                    <div role="alert" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '12px', marginTop: '8px' }}>
                      {errors.firstName}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="signup-last-name"
                    style={{
                      display: 'block',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      marginBottom: '10px',
                    }}
                  >
                    Last Name
                  </label>
                  <input
                    id="signup-last-name"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    placeholder="Vance"
                    aria-label="Last name"
                    autoComplete="family-name"
                    style={{
                      ...inputBaseStyle,
                      borderColor: errors.lastName ? 'var(--color-danger)' : 'var(--border-default)',
                      boxShadow: errors.lastName ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                    }}
                  />
                  {errors.lastName && (
                    <div role="alert" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '12px', marginTop: '8px' }}>
                      {errors.lastName}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  style={{
                    display: 'block',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginBottom: '10px',
                  }}
                >
                  Email Address
                </label>

                <div style={{ position: 'relative' }}>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="atelier@novashop.com"
                    aria-label="Email address"
                    autoComplete="email"
                    style={{
                      ...inputBaseStyle,
                      paddingRight: '46px',
                      borderColor: errors.email ? 'var(--color-danger)' : 'var(--border-default)',
                      boxShadow: errors.email ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MailIcon />
                  </div>
                </div>
                {errors.email && (
                  <div role="alert" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '12px', marginTop: '8px' }}>
                    {errors.email}
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                    gap: '12px',
                  }}
                >
                  <label
                    htmlFor="signup-password"
                    style={{
                      display: 'block',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    Password
                  </label>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Min. 8 characters
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    id="signup-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="••••••••"
                    aria-label="Password"
                    autoComplete="new-password"
                    style={{
                      ...inputBaseStyle,
                      paddingRight: '48px',
                      borderColor: errors.password ? 'var(--color-danger)' : 'var(--border-default)',
                      boxShadow: errors.password ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                    }}
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '44px',
                      padding: 0,
                    }}
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <div role="alert" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '12px', marginTop: '8px' }}>
                    {errors.password}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-confirm-password"
                  style={{
                    display: 'block',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginBottom: '10px',
                  }}
                >
                  Confirm Password
                </label>

                <div style={{ position: 'relative' }}>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="••••••••"
                    aria-label="Confirm password"
                    autoComplete="new-password"
                    style={{
                      ...inputBaseStyle,
                      paddingRight: '48px',
                      borderColor: errors.confirmPassword ? 'var(--color-danger)' : 'var(--border-default)',
                      boxShadow: errors.confirmPassword ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                    }}
                  />

                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '44px',
                      padding: 0,
                    }}
                  >
                    <EyeIcon visible={showConfirmPassword} />
                  </button>
                </div>
                {errors.confirmPassword && (
                  <div role="alert" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '12px', marginTop: '8px' }}>
                    {errors.confirmPassword}
                  </div>
                )}
              </div>

              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                }}
              >
                By creating an account, you agree to our{' '}
                <button type="button" onClick={() => go('/terms')} style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer' }}>
                  Terms of Service
                </button>{' '}
                and{' '}
                <button type="button" onClick={() => go('/privacy')} style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer' }}>
                  Privacy Policy
                </button>
                .
              </div>

              {successMessage && (
                <div
                  role="status"
                  style={{
                    color: 'var(--color-success)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  borderRadius: '999px',
                  minHeight: '54px',
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'transform 180ms ease, opacity 180ms ease',
                  opacity: isSubmitting ? 0.8 : 1,
                }}
              >
                Create Account
                <ArrowRightIcon />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', margin: '6px 0 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Or
                </div>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  border: '1px solid var(--border-default)',
                  borderRadius: '999px',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '11px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                <GoogleGlyph />
                Continue With Google
              </button>

              {googleNotice && (
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                >
                  {googleNotice}
                </div>
              )}
            </form>

            <div
              style={{
                textAlign: 'center',
                marginTop: '26px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
              }}
            >
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => go('/login')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: 'var(--text-primary)',
                  textDecoration: 'underline',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sign in
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

const linkStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  padding: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};
