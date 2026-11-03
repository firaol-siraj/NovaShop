import { useEffect, useState, useMemo } from 'react';
import { authApi } from '../lib/api/authApi';

export default function VerifyEmailPage({ go, search, path }) {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Extract token from query params ?token=... or path /verify-email/:token
  const token = useMemo(() => {
    const queryParams = new URLSearchParams(search || window.location.search);
    const queryToken = queryParams.get('token');
    if (queryToken) return queryToken;

    if (path && path.startsWith('/verify-email/')) {
      const parts = path.split('/').filter(Boolean);
      return parts[1] || '';
    }

    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    if (pathSegments[0] === 'verify-email' && pathSegments[1]) {
      return pathSegments[1];
    }

    return '';
  }, [search, path]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('No verification token provided in the URL.');
      return;
    }

    let active = true;
    authApi
      .verifyEmail(token)
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setSuccess(true);
          setMessage(res.message || 'Email verified successfully! You now have full account access.');
        } else {
          setError(res.message || 'Verification token is invalid or has expired.');
        }
      })
      .catch((err) => {
        if (!active) return;
        const errMsg = err.response?.data?.message || err.message || 'Verification token is invalid or has expired.';
        setError(errMsg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div style={{ minHeight: '80vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '48px 36px', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>

        {loading && (
          <div>
            <div style={{ width: '44px', height: '44px', border: '2px solid var(--border-default)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '28px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Verifying your email</h1>
            <p style={{ marginTop: '12px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>Please wait while we confirm your account credentials...</p>
          </div>
        )}

        {!loading && success && (
          <div>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-success)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--color-primary-contrast)', fontSize: '32px', fontWeight: 700 }}>✓</span>
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '32px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Email Verified Successfully</h1>
            <p style={{ margin: '14px 0 28px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {message || 'Your email has been verified. You now have full access to orders, concierge fulfillment, and profile settings.'}
            </p>
            <div style={{ display: 'grid', gap: '12px' }}>
              <button
                type="button"
                onClick={() => go('/account')}
                style={{ width: '100%', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', padding: '14px 20px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Go to My Account →
              </button>
              <button
                type="button"
                onClick={() => go('/account/orders')}
                style={{ width: '100%', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '999px', padding: '14px 20px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                View My Orders
              </button>
            </div>
          </div>
        )}

        {!loading && !success && (
          <div>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-danger)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--color-primary-contrast)', fontSize: '28px' }}>✕</span>
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '32px', fontStyle: 'italic', color: 'var(--text-primary)' }}>Verification Link Expired</h1>
            <p style={{ margin: '14px 0 28px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {error || 'This verification link is invalid or has expired. Please sign in to request a fresh confirmation link.'}
            </p>
            <div style={{ display: 'grid', gap: '12px' }}>
              <button
                type="button"
                onClick={() => go('/login')}
                style={{ width: '100%', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', padding: '14px 20px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Sign In to NovaShop
              </button>
              <button
                type="button"
                onClick={() => go('/shop')}
                style={{ width: '100%', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '999px', padding: '14px 20px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Explore Collection
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
