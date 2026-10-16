import { useState } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleNewsletterSubscribe = (value) => {
    window.console?.log('Newsletter subscribe:', value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      setSubmitted(false);
      return;
    }

    setError('');
    handleNewsletterSubscribe(trimmedEmail);
    setSubmitted(true);
    setEmail('');
  };

  return (
    <section style={{ backgroundColor: '#F7F2EA', padding: '78px 0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
        <div style={{ borderTop: '1px solid rgba(27, 24, 22, 0.12)', paddingTop: '30px' }} />
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
              color: '#8C837C',
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
              color: '#1B1816',
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
              color: '#6E6962',
              fontWeight: 300,
            }}
          >
            New collections, seasonal edits, and exclusive releases — delivered directly to your inbox.
          </p>

          {submitted ? (
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
                color: '#1B1816',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '18px' }}>✓</span>
              Thanks — you&apos;re subscribed.
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '420px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', borderBottom: error ? '2px solid #B8655E' : '2px solid #1B1816', background: 'transparent' }}>
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
                    color: '#1B1816',
                    letterSpacing: '0.01em',
                  }}
                />
                <button
                  type="submit"
                  aria-label="Subscribe to the newsletter"
                  style={{
                    height: '42px',
                    border: 'none',
                    background: '#1B1816',
                    color: '#FDFBF7',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    padding: '0 18px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  SUBSCRIBE
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
                    color: '#B8655E',
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
              color: '#8C837C',
            }}
          >
            Never shared. Unsubscribe with one click anytime. Review our{' '}
            <a
              href="/privacy-policy"
              style={{
                color: '#1B1816',
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
