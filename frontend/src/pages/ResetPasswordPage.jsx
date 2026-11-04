import { useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../lib/api/authApi';

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

export default function ResetPasswordPage({ go, search }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [tokenChecking, setTokenChecking] = useState(true);
  const token = new URLSearchParams(search).get('token') || '';
  const tokenInvalid = !token || invalidToken;

  const inputRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
      setTokenChecking(false);
      return;
    }
    let active = true;
    authApi
      .validateResetToken(token)
      .then(() => {
        if (!active) return;
        setInvalidToken(false);
      })
      .catch(() => {
        if (!active) return;
        setInvalidToken(true);
      })
      .finally(() => {
        if (active) setTokenChecking(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (token && !invalidToken) {
      inputRef.current?.focus();
    }
  }, [token, invalidToken]);

  const inputStyle = useMemo(
    () => ({
      width: '100%',
      background: 'var(--bg-input)',
      border: '1px solid var(--border-default)',
      borderRadius: '0',
      color: 'var(--text-primary)',
      padding: '14px 12px',
      paddingRight: '48px', // space for eye icon
      fontSize: '14px',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box',
      outline: 'none',
      transition: 'border-color 180ms ease, box-shadow 180ms ease',
    }),
    []
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (tokenInvalid || !token) return;

    const nextErrors = {};
    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await authApi.resetPassword(token, { password });
      go('/login');
    } catch (requestError) {
      setInvalidToken(true);
      setErrors({
        password: requestError.message || 'This reset link is invalid or has expired.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .rp-input-field { font-size: 16px !important; min-height: 44px !important; }
          .rp-submit-btn { min-height: 48px !important; }
        }
      `}</style>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '42px 20px', minHeight: '100dvh' }}>
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            display: 'grid',
            gap: '32px',
            justifyItems: 'center',
          }}
        >
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1
              style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(26px, 3vw, 30px)',
                lineHeight: 1.12,
                fontWeight: 400,
                letterSpacing: '-0.04em',
              }}
            >
              Reset your password
            </h1>

            <p
              style={{
                margin: '12px auto 0',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                lineHeight: 1.7,
                maxWidth: '360px',
              }}
            >
              Enter your new password below.
            </p>
          </div>

          <div style={{ width: '100%' }}>
            {tokenInvalid ? (
              <div style={{ textAlign: 'center', background: 'rgba(217, 83, 79, 0.08)', padding: '24px', border: '1px solid var(--color-danger)' }}>
                <div style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: '13px', marginBottom: '18px' }}>
                  This reset link is invalid or has expired.
                </div>
                <button
                  type="button"
                  onClick={() => go('/forgot-password')}
                  style={{
                    background: 'var(--color-primary)',
                    color: 'var(--color-primary-contrast)',
                    border: 'none',
                    borderRadius: '0',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 18px',
                  }}
                >
                  Request a new link
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '20px', width: '100%' }}>
                <div>
                  <label
                    htmlFor="reset-password"
                    style={{
                      display: 'block',
                      marginBottom: '10px',
                      textAlign: 'left',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    New Password
                  </label>

                  <div style={{ position: 'relative' }}>
                    <input
                      id="reset-password"
                      className="rp-input-field"
                      ref={inputRef}
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (errors.password) setErrors((e) => ({ ...e, password: '' }));
                        // Clear match error if it exists
                        if (errors.confirmPassword === 'Passwords do not match.') {
                          setErrors((e) => ({ ...e, confirmPassword: '' }));
                        }
                      }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      aria-label="New password"
                      style={{
                        ...inputStyle,
                        borderColor: errors.password ? 'var(--color-danger)' : 'var(--border-default)',
                        boxShadow: errors.password ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                      }}
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
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

                  {errors.password ? (
                    <div
                      role="alert"
                      style={{
                        marginTop: '8px',
                        color: 'var(--color-danger)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        textAlign: 'left',
                      }}
                    >
                      {errors.password}
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: '8px',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        textAlign: 'left',
                      }}
                    >
                      At least 8 characters
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    style={{
                      display: 'block',
                      marginBottom: '10px',
                      textAlign: 'left',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    Confirm Password
                  </label>

                  <div style={{ position: 'relative' }}>
                    <input
                      id="reset-confirm-password"
                      className="rp-input-field"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: '' }));
                      }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      aria-label="Confirm password"
                      style={{
                        ...inputStyle,
                        borderColor: errors.confirmPassword ? 'var(--color-danger)' : 'var(--border-default)',
                        boxShadow: errors.confirmPassword ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                      }}
                    />

                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPassword((v) => !v)}
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
                    <div
                      role="alert"
                      style={{
                        marginTop: '8px',
                        color: 'var(--color-danger)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        textAlign: 'left',
                      }}
                    >
                      {errors.confirmPassword}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    background: 'var(--color-primary)',
                    color: 'var(--color-primary-contrast)',
                    border: 'none',
                    borderRadius: '0',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '0 18px',
                    transition: 'opacity 180ms ease',
                    opacity: isSubmitting ? 0.9 : 1,
                    marginTop: '4px',
                  }}
                >
                  {isSubmitting ? 'Updating…' : 'Update Password'}
                  {!isSubmitting && <ArrowRightIcon />}
                </button>
              </form>
            )}
          </div>

          <div style={{ width: '100%', display: 'grid', gap: '18px' }}>
            <button
              type="button"
              onClick={() => go('/login')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                transition: 'color 180ms ease, transform 180ms ease',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = 'var(--text-primary)';
                event.currentTarget.firstChild.style.transform = 'translateX(-3px)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = 'var(--text-secondary)';
                event.currentTarget.firstChild.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', transition: 'transform 180ms ease' }}>
                <ArrowLeftIcon />
              </span>
              Back to Login
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes nsFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 767px) {
          header {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          header button:last-child {
            font-size: 9px !important;
            letter-spacing: 0.12em !important;
          }

          main {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }

          footer {
            padding-left: 18px !important;
            padding-right: 18px !important;
            justify-content: center !important;
            text-align: center !important;
          }

          footer > div {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </>
  );
}
