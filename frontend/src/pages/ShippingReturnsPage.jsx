import { useEffect } from 'react';

const T = {
  bg: 'var(--bg-main)',
  bgAlt: 'var(--bg-surface)',
  espresso: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  border: 'var(--border-default)',
};

export default function ShippingReturnsPage({ go }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <style>{`
        .sr-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 1024px) {
          .sr-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .sr-grid > div:last-child {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 767px) {
          .sr-grid {
            grid-template-columns: 1fr;
          }
          .sr-grid > div:last-child {
            grid-column: auto;
          }
          .sr-page-header {
            padding: 64px 24px 32px !important;
            text-align: left !important;
          }
          .sr-page-header h1 {
            font-size: clamp(32px, 8vw, 36px) !important;
          }
          .sr-section-header {
            text-align: left;
          }
          .sr-help-card {
            padding: 32px 24px !important;
          }
        }
      `}</style>

      {/* PAGE HEADER */}
      <section className="sr-page-header" style={{
        background: T.bg,
        padding: '96px 24px 48px',
        textAlign: 'center',
      }}>
        <h1 style={{
          margin: '0 0 16px',
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(36px, 5vw, 48px)',
          fontWeight: 400,
          color: T.espresso,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>
          Shipping & Returns
        </h1>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: '16px',
          color: T.muted,
          maxWidth: '500px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
        }}>
          Simple, clear information about delivery, returns, and refunds.
        </p>
      </section>

      {/* SHIPPING SECTION */}
      <section style={{
        background: T.bg,
        padding: '48px clamp(24px, 6vw, 80px) 80px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="sr-section-header" style={{ marginBottom: '40px' }}>
            <span style={{
              display: 'block',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: T.muted,
              fontWeight: 600,
              marginBottom: '12px',
            }}>
              Shipping
            </span>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(28px, 3.5vw, 36px)',
              fontWeight: 400,
              color: T.espresso,
              lineHeight: 1.2,
            }}>
              Delivery, made simple.
            </h2>
          </div>

          <div className="sr-grid">
            {/* Card 1 */}
            <div style={{
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `1px solid ${T.espresso}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.espresso} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                Standard Delivery
              </h3>
              <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: T.muted, lineHeight: 1.5 }}>
                3–7 business days
              </p>
            </div>

            {/* Card 2 */}
            <div style={{
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `1px solid ${T.espresso}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.espresso} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                Express Delivery
              </h3>
              <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: T.muted, lineHeight: 1.5 }}>
                1–3 business days
              </p>
            </div>

            {/* Card 3 */}
            <div style={{
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `1px solid ${T.espresso}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.espresso} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: T.espresso }}>
                Order Tracking
              </h3>
              <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: T.muted, lineHeight: 1.5 }}>
                Track your order after it ships
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RETURNS SECTION */}
      <section style={{
        background: T.bgAlt,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '80px clamp(24px, 6vw, 80px)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="sr-section-header" style={{ marginBottom: '40px' }}>
            <span style={{
              display: 'block',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: T.muted,
              fontWeight: 600,
              marginBottom: '12px',
            }}>
              Returns
            </span>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(28px, 3.5vw, 36px)',
              fontWeight: 400,
              color: T.espresso,
              lineHeight: 1.2,
            }}>
              Not quite right?
            </h2>
          </div>

          <div className="sr-grid" style={{ marginBottom: '32px' }}>
            {[
              { num: '01', title: 'Request a return' },
              { num: '02', title: 'Send it back' },
              { num: '03', title: 'Refund issued' }
            ].map((step, idx) => (
              <div key={idx} style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                padding: '34px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-end',
                minHeight: '140px'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '26px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '54px',
                  lineHeight: 1,
                  color: T.espresso,
                  opacity: 0.14,
                  pointerEvents: 'none',
                }}>
                  {step.num}
                </div>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '16px', fontWeight: 600, color: T.espresso, position: 'relative', zIndex: 1 }}>
                  {step.title}
                </h3>
              </div>
            ))}
          </div>

          <p style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: T.muted,
            textAlign: 'center',
          }}>
            Items must be unworn and returned within the applicable return period.
          </p>
        </div>
      </section>

      {/* NEED HELP? CTA */}
      <section style={{
        background: T.bg,
        padding: '80px clamp(24px, 6vw, 80px)',
      }}>
        <div className="sr-help-card" style={{
          maxWidth: '600px',
          margin: '0 auto',
          background: T.bgAlt,
          border: `1px solid ${T.border}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <h2 style={{
            margin: '0 0 24px',
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: 400,
            color: T.espresso,
          }}>
            Need help?
          </h2>
          <button
            type="button"
            onClick={() => go('/help')}
            style={{
              background: 'transparent',
              color: T.espresso,
              border: `1px solid ${T.espresso}`,
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              padding: '14px 32px',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = T.espresso;
              e.currentTarget.style.color = 'var(--color-primary-contrast)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.espresso;
            }}
          >
            Contact Us
          </button>
        </div>
      </section>
    </>
  );
}
