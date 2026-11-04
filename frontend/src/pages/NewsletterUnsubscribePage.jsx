import { useEffect, useState } from 'react';
import { homeApi } from '../lib/api/homeApi';

export default function NewsletterUnsubscribePage({ go, search = '' }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'unsubscribing' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const token = new URLSearchParams(search).get('token') || '';

  useEffect(() => {
    document.title = 'Unsubscribe | NovaShop Journal';
  }, []);

  const handleUnsubscribe = async () => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing unsubscribe token.');
      return;
    }

    setStatus('unsubscribing');
    try {
      const res = await homeApi.unsubscribe(token);
      setStatus('success');
      setMessage(res?.data?.message || 'You have been successfully unsubscribed from NovaShop emails.');
    } catch (err) {
      setStatus('error');
      setMessage(err?.response?.data?.message || err?.message || 'Unable to process unsubscribe request.');
    }
  };

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
          maxWidth: '500px',
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

        {status === 'idle' && (
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--text-primary)',
                marginBottom: '14px',
              }}
            >
              Unsubscribe from The Journal
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
              Are you sure you would like to stop receiving seasonal previews, new release alerts, and editorial stories from NovaShop?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => go('/')}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  padding: '12px 24px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleUnsubscribe}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Confirm Unsubscribe
              </button>
            </div>
          </div>
        )}

        {status === 'unsubscribing' && (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Processing your request...</p>
        )}

        {status === 'success' && (
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--text-primary)',
                marginBottom: '14px',
              }}
            >
              Unsubscribed
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
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Return to Store
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
                marginBottom: '14px',
              }}
            >
              Notice
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
                letterSpacing: '0.12em',
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
