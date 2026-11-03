import { useState } from 'react';
import { homeApi } from '../../lib/api/homeApi';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [hpSource, setHpSource] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      setSubmittedMessage('');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await homeApi.subscribe({
        email: trimmedEmail,
        hp_source: hpSource,
        source: 'homepage_newsletter',
      });
      const data = res?.data || {};
      if (data.alreadySubscribed) {
        setSubmittedMessage("You're already subscribed to The NovaShop Journal.");
      } else {
        setSubmittedMessage('Please check your inbox to confirm your subscription.');
      }
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ backgroundColor: 'var(--bg-main)', padding: '78px 0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
        <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '30px' }} />
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
          <span
            style={{
              display: 'block',
              marginBottom: '18px',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            THE NOVASHOP JOURNAL
          </span>

          <h2
            style={{
              margin: '0 0 14px',
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(32px, 3.2vw, 44px)',
              lineHeight: 1.08,
              fontWeight: 400,
              fontStyle: 'italic',
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}
          >
            Stay in the know.
          </h2>

          <p
            style={{
              margin: '0 auto 32px',
              maxWidth: '420px',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: '1.8',
              color: 'var(--text-secondary)',
              fontWeight: 300,
            }}
          >
            New collections, seasonal edits, and exclusive releases — delivered directly to your inbox.
          </p>

          {submittedMessage ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '52px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-success)',
                padding: '0 16px',
                lineHeight: 1.5,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '18px' }}>✓</span>
              {submittedMessage}
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '420px', margin: '0 auto' }}>
              {/* Offscreen honeypot input for anti-bot protection */}
              <input
                type="text"
                name="website"
                value={hpSource}
                onChange={(e) => setHpSource(e.target.value)}
                tabIndex="-1"
                autoComplete="off"
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1 }}
                aria-hidden="true"
              />
              <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', borderBottom: error ? '2px solid var(--color-danger)' : '2px solid var(--border-focus)', background: 'transparent' }}>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Your email address"
                  aria-label="Email address"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    padding: '12px 0 10px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    letterSpacing: '0.01em',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  aria-label="Subscribe to the newsletter"
                  style={{
                    height: '42px',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'var(--color-primary-contrast)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    padding: '0 18px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loading ? 'SUBSCRIBING...' : 'SUBSCRIBE'}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    marginTop: '8px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    color: 'var(--color-danger)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {error}
                </div>
              )}
            </form>
          )}

          <p
            style={{
              margin: '16px auto 0',
              maxWidth: '420px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              lineHeight: '1.7',
              color: 'var(--text-muted)',
            }}
          >
            Never shared. Unsubscribe with one click anytime. Review our{' '}
            <a
              href="/privacy-policy"
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
