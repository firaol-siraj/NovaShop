import { useEffect, useState } from 'react';
import { homeApi } from '../lib/api/homeApi';

export default function NewsletterConfirmPage({ go, search = '' }) {
  const [status, setStatus] = useState('confirming'); // 'confirming' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const token = new URLSearchParams(search).get('token') || '';

  useEffect(() => {
    document.title = 'Confirm Subscription | NovaShop';
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing confirmation link. Please check the URL from your email.');
      return;
    }

    let active = true;
    homeApi
      .confirmNewsletter(token)
      .then((res) => {
        if (!active) return;
        setStatus('success');
        setMessage(res?.data?.message || 'Your subscription to The NovaShop Journal has been confirmed!');
      })
      .catch((err) => {
        if (!active) return;
        setStatus('error');
        setMessage(
          err?.response?.data?.message ||
          err?.message ||
          'This confirmation link has expired or has already been used.'
        );
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main
      style={{
        backgroundColor: 'var(--bg-main)',
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          padding: 'clamp(28px, 6vw, 48px) clamp(18px, 5vw, 40px)',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: '10px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '16px',
          }}
        >
          THE NOVASHOP JOURNAL
        </span>

        {status === 'confirming' && (
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}
            >
              Confirming Your Subscription...
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              Please wait while we verify your private membership token.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '20px',
              }}
            >
              ✓
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '30px',
                fontWeight: 400,
                fontStyle: 'italic',
                color: 'var(--text-primary)',
                marginBottom: '14px',
              }}
            >
              Welcome to The Journal
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7, marginBottom: '24px' }}>
              {message}
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px dashed var(--border-strong)',
                padding: '16px',
                marginBottom: '32px',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Welcome Privilege Code
              </span>
              <strong style={{ fontSize: '18px', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                JOURNAL10
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Apply at checkout for 10% off your next order.
              </p>
            </div>

            <button
              type="button"
              onClick={() => go('/shop')}
              style={{
                width: '100%',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                border: 'none',
                padding: '14px 28px',
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Explore The Shop
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--color-danger)',
                marginBottom: '16px',
              }}
            >
              Unable to Confirm Link
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
              {message}
            </p>
            <button
              type="button"
              onClick={() => go('/')}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                border: 'none',
                padding: '12px 24px',
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Return to Home
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
