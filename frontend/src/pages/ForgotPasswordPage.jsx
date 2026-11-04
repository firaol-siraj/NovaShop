import { useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../lib/api/authApi';

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

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.2 2.2 4.8-5" />
    </svg>
  );
}

function readPrefilledEmail() {
  if (typeof window === 'undefined') return '';

  const params = new URLSearchParams(window.location.search);
  return params.get('email')?.trim() || '';
}

function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Please enter your email address.';
  if (!emailPattern.test(trimmed)) return 'Please enter a valid email address.';
  return '';
}

export default function ForgotPasswordPage({ go }) {
  const [email, setEmail] = useState(() => readPrefilledEmail());
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState(null); // { message, sentEmail }
  const [toastVisible, setToastVisible] = useState(false);
  const inputRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (sentEmail) => {
    setToast({ sentEmail });
    setToastVisible(true);

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    // Start fade-out at 4.4s, remove at 5s
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(null), 400);
    }, 4600);
  };

  const inputStyle = useMemo(
    () => ({
      width: '100%',
      background: 'var(--bg-input)',
      border: '1px solid var(--border-default)',
      borderRadius: '0',
      color: 'var(--text-primary)',
      padding: '14px 12px',
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

    const nextError = validateEmail(email);
    if (nextError) {
      setError(nextError);
      return;
    }

    setError('');
    setIsSending(true);

    try {
      await authApi.forgotPassword({ email: email.trim() });
      showToast(email.trim());
    } catch (requestError) {
      setError(requestError.message || 'Unable to send the reset link. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes nsSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nsFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes nsFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 767px) {
          .fp-toast { right: 16px !important; left: 16px !important; max-width: none !important; bottom: calc(16px + var(--safe-area-bottom, 0px)) !important; }
          .fp-input-field { font-size: 16px !important; min-height: 44px !important; }
          .fp-submit-btn { min-height: 48px !important; }
        }
      `}</style>

      {/* ── Bottom-right toast ── */}
      {toast && (
        <div
          className="fp-toast"
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            zIndex: 9999,
            maxWidth: '340px',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            animation: toastVisible
              ? 'nsSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both'
              : 'nsFadeOut 0.4s ease forwards',
          }}
          role="status"
          aria-live="polite"
        >
          <span style={{ color: 'var(--color-success)', marginTop: '1px', flexShrink: 0 }}>
            <CheckCircleIcon />
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '4px' }}>
              Check your inbox
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{toast.sentEmail}</strong>, the reset request was accepted. The link expires in 10 minutes.
            </div>
          </div>
        </div>
      )}

      {/* ── Main centered content ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '42px 20px' }}>
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            display: 'grid',
            gap: '22px',
            justifyItems: 'center',
          }}
        >
          {/* Heading */}
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1
              style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(30px, 3vw, 38px)',
                lineHeight: 1.12,
                fontWeight: 400,
                letterSpacing: '-0.04em',
              }}
            >
              Forgot your password?
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
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {/* Form */}
          <div style={{ width: '100%' }}>
            <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '16px', width: '100%' }}>
              <div>
                <label
                  htmlFor="fp-email"
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Email Address
                </label>

                <input
                  id="fp-email"
                  className="fp-input-field"
                  ref={inputRef}
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-label="Email address"
                  style={{
                    ...inputStyle,
                    borderColor: error ? 'var(--color-danger)' : 'var(--border-default)',
                    boxShadow: error ? '0 0 0 3px rgba(217, 83, 79, 0.15)' : 'none',
                  }}
                />

                {error && (
                  <div
                    role="alert"
                    style={{
                      marginTop: '8px',
                      color: 'var(--color-danger)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                      lineHeight: 1.5,
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="fp-submit-btn"
                disabled={isSending}
                style={{
                  width: '100%',
                  minHeight: '46px',
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  borderRadius: '0',
                  cursor: isSending ? 'wait' : 'pointer',
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
                  opacity: isSending ? 0.85 : 1,
                  marginTop: '4px',
                }}
              >
                {isSending ? 'Sending…' : 'Send Reset Link'}
                {!isSending && <ArrowRightIcon />}
              </button>
            </form>
          </div>

          {/* Back to Login */}
          <div style={{ width: '100%', display: 'grid', gap: '18px' }}>
            <div style={{ width: '100%', height: '1px', background: 'var(--border-default)' }} />
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
                transition: 'color 180ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><ArrowLeftIcon /></span>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
