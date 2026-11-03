import { useMemo, useState, useEffect } from 'react';
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
      <path fill="#EA4335" d="M12 10.2v3.99h5.57c-.24 1.33-1.58 3.9-5.57 3.9-3.35 0-6.08-2.77-6.08-6.19s2.73-6.19 6.08-6.19c1.91 0 3.2.81 3.94 1.5l2.68-2.6C16.96 2.74 14.76 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c5.77 0 9.57-4.05 9.57-9.75 0-.66-.07-1.15-.16-1.65H12Z"/>
      <path fill="#34A853" d="M3.9 7.5l3.45 2.52c.93-1.77 2.87-3.02 4.65-3.02 1.91 0 3.2.81 3.94 1.5l2.68-2.6C16.96 2.74 14.76 2 12 2 8.31 2 5.17 4.28 3.9 7.5Z"/>
      <path fill="#FBBC05" d="M3.9 16.5A10 10 0 0 1 2 12c0-1.31.3-2.55.84-3.67l3.81 2.81c-.2.49-.31 1.04-.31 1.62 0 .88.19 1.72.56 2.49l-3.9 2.75Z"/>
      <path fill="#4285F4" d="M12 22c2.7 0 4.96-.89 6.62-2.4l-3.08-2.66c-.82.56-1.91.91-3.54.91-2.67 0-4.91-1.8-5.71-4.22l-3.29 2.53A10 10 0 0 0 12 22Z"/>
    </svg>
  );
}

export default function LoginPage({ go }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!emailPattern.test(trimmedEmail) || !trimmedPassword) {
      setError('Invalid email or password');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await login({ email: trimmedEmail, password: trimmedPassword, rememberMe: rememberSession });
      go(getPostLoginRedirect());
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    try {
      const toast = sessionStorage.getItem('novashop_toast');
      if (toast) {
        setToastMessage(toast);
        sessionStorage.removeItem('novashop_toast');
        setTimeout(() => setToastMessage(''), 5000); // clear after 5s
      }
    } catch (e) {
      // ignore
    }
  }, []);

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
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          background: 'var(--bg-main)',
          position: 'relative'
        }}
      >
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-success)',
              color: 'var(--color-primary-contrast)',
              padding: '12px 24px',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              animation: 'nsFadeIn 0.3s ease-out'
            }}
          >
            {toastMessage}
          </div>
        )}
        <div style={{ display: 'flex', flex: 1 }}>
        <aside
          style={{
            position: 'relative',
            flex: '0 0 46%',
            minHeight: '560px',
            backgroundImage:
              'linear-gradient(180deg, rgba(15, 12, 10, 0.18) 0%, rgba(15, 12, 10, 0.54) 100%), url("https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '28px 36px 34px',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.42) 100%)' }} />

          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%' }}>
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
                Collection 04 / Autumn Archetypes
              </span>

              <span
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '9px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  paddingTop: '2px',
                }}
              >
                Ref. SR6-01
              </span>
            </div>

            <div style={{ maxWidth: '500px' }}>
              <p
                style={{
                  margin: 0,
                  color: '#F5F1EC',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(24px, 2.4vw, 30px)',
                  lineHeight: 1.3,
                  letterSpacing: '-0.03em',
                  maxWidth: '460px',
                }}
              >
                Enduring silhouettes, thoughtfully crafted for timeless permanence.
              </p>

              <div
                style={{
                  marginTop: '14px',
                  color: 'rgba(255,255,255,0.74)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Atelier Archives — Paris • New York
              </div>
            </div>
          </div>
        </aside>

        <main
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

            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}
              >
                Account Membership
              </div>

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
                Welcome back
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
                Sign in to access your curated archive, saved measurements, and bespoke orders.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '18px' }}>
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
                    htmlFor="login-email"
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
                    Email Address
                  </label>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Required
                  </span>
                </div>

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="client@domain.com"
                  aria-label="Email address"
                  autoComplete="email"
                  style={{
                    ...inputBaseStyle,
                    borderColor: error ? 'var(--color-danger)' : 'var(--border-default)',
                    boxShadow: error ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                  }}
                />
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
                    htmlFor="login-password"
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

                  <button
                    type="button"
                    onClick={() => go('/forgot-password?email=' + encodeURIComponent(email))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    aria-label="Password"
                    autoComplete="current-password"
                    style={{
                      ...inputBaseStyle,
                      paddingRight: '48px',
                      borderColor: error ? 'var(--color-danger)' : 'var(--border-default)',
                      boxShadow: error ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                    }}
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(event) => setRememberSession(event.target.checked)}
                  aria-label="Remember this client session"
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                Remember this client session
              </label>

              {error && (
                <div
                  role="alert"
                  style={{
                    color: 'var(--color-danger)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    marginTop: '-4px',
                  }}
                >
                  {error}
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
                Sign In
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
                  Or Continue Via
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
                Google Account
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
              New to our archives?{' '}
              <button
                type="button"
                onClick={() => go('/signup')}
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
                Create an account
              </button>
            </div>

            <div
              style={{
                textAlign: 'center',
                marginTop: '22px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              <span aria-label="Encrypted session">🔒</span> Encrypted Session {'  '}•{'  '}
              <button
                type="button"
                onClick={() => go('/support')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Concierge Assist
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
