import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { settingsApi } from '../../lib/api/settingsApi';

/**
 * Central auth-aware navigation helper.
 * If the user is logged in  → go(path) directly.
 * If not logged in          → store the redirect in sessionStorage,
 *                             then go to /login?redirect=<encoded path>.
 */
const navigateProtected = (go, path, isAuthenticated) => {
  if (isAuthenticated) {
    go(path);
  } else {
    try {
      sessionStorage.setItem('novashop_redirect_after_login', path);
    } catch { /* ignore */ }
    go(`/login?redirect=${encodeURIComponent(path)}`);
  }
};

/* ─── Footer link data ───────────────────────────────────── */
const SHOP_LINKS = [
  { label: 'Shop All',     path: '/shop' },
  { label: 'New Arrivals', path: '/shop?filter=new-arrivals' },
  { label: 'Sale',         path: '/shop?category=sale' },
];

const CARE_LINKS = [
  { label: 'Contact & Help',     path: '/help',              protected: false },
  { label: 'Shipping & Returns', path: '/shipping-returns',  protected: false },
  { label: 'Order Tracking',     path: '/account/orders',    protected: true  },
];

const ABOUT_LINKS = [
  { label: 'About NovaShop', path: '/about',          protected: false },
  { label: 'Privacy Policy', path: '/privacy-policy', protected: false },
  { label: 'Terms of Service', path: '/terms-of-service', protected: false },
];

const ACCOUNT_LINKS = [
  { label: 'Account Overview', path: '/account',           protected: true },
  { label: 'Orders',           path: '/account/orders',    protected: true },
  { label: 'Saved Pieces',     path: '/account/wishlist',  protected: true },
  { label: 'Addresses',        path: '/account/addresses', protected: true },
];

const SOCIAL_LINKS = [
  { label: 'INSTAGRAM', href: 'https://instagram.com/novashop' },
  { label: 'PINTEREST',  href: 'https://pinterest.com/novashop' },
  { label: 'TIKTOK',     href: 'https://tiktok.com/@novashop' },
];

const regionOptions = [
  'United States (USD $)',
  'United Kingdom (GBP £)',
  'European Union (EUR €)',
  'Ethiopia (ETB Br)',
];

function getStoredCurrency() {
  try {
    const raw = localStorage.getItem('novashop_user_settings');
    if (!raw) return 'United States (USD $)';
    const { currency } = JSON.parse(raw);
    const map = {
      'USD ($)': 'United States (USD $)',
      'GBP (£)': 'United Kingdom (GBP £)',
      'EUR (€)': 'European Union (EUR €)',
      'ETB (Br)': 'Ethiopia (ETB Br)',
    };
    return map[currency] ?? 'United States (USD $)';
  } catch {
    return 'United States (USD $)';
  }
}

export default function Footer({ go }) {
  const { isAuthenticated } = useAuth();
  const { categories } = useCategories();
  const shopLinks = [
    ...SHOP_LINKS.slice(0, 2),
    ...categories.map((category) => ({
      label: category.name,
      path: `/shop?category=${encodeURIComponent(category.slug)}`,
    })),
    SHOP_LINKS[2],
  ];
  const [regionOpen, setRegionOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(getStoredCurrency);
  const [storeName, setStoreName] = useState('NovaShop');

  useEffect(() => {
    let isMounted = true;
    settingsApi.getPublicSettings().then((res) => {
      const data = res.data?.data || res.data;
      if (isMounted && data?.storeName) {
        setStoreName(data.storeName);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const sync = () => setSelectedRegion(getStoredCurrency());
    window.addEventListener('novashop:settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('novashop:settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  /* Close region dropdown when clicking outside */
  useEffect(() => {
    if (!regionOpen) return;
    const handler = (e) => {
      if (!e.target.closest('#footer-region-picker')) setRegionOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [regionOpen]);

  /* ─── Link renderers ─────────────────────────────────────── */
  const renderPublicLink = (path, label) => (
    <button
      key={path + label}
      type="button"
      onClick={() => go(path)}
      style={linkBtnStyle}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      {label}
    </button>
  );

  const renderProtectedLink = (path, label) => (
    <button
      key={path + label}
      type="button"
      onClick={() => navigateProtected(go, path, isAuthenticated)}
      style={linkBtnStyle}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      {label}
    </button>
  );

  const renderLink = ({ label, path, protected: prot }) =>
    prot ? renderProtectedLink(path, label) : renderPublicLink(path, label);

  return (
    <footer style={{ backgroundColor: 'var(--bg-surface-sunken)', borderTop: '1px solid var(--border-default)' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '52px 40px 24px' }}>
        <div
          className="footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr repeat(4, minmax(0, 1fr))',
            gap: '42px',
            alignItems: 'flex-start',
          }}
        >
          {/* ── Brand column ── */}
          <div>
            <button
              type="button"
              onClick={() => go('/')}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', marginBottom: '18px' }}
              aria-label="NovaShop home"
            >
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-serif)',
                fontSize: '22px',
                fontWeight: 400,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
              }}>
                NOVASHOP
              </span>
            </button>

            <p style={{
              margin: '0 0 18px',
              maxWidth: '260px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: '1.8',
              color: 'var(--text-muted)',
              fontWeight: 300,
            }}>
              Understated luxury, modern silhouettes, and effortless essentials designed for everyday movement.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {SOCIAL_LINKS.map((s, idx) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      fontWeight: 500,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      transition: 'opacity 180ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {s.label}
                  </a>
                  {idx < SOCIAL_LINKS.length - 1 && (
                    <span style={{ margin: '0 6px', color: '#9B9189' }}>•</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── SHOP column ── */}
          <div>
            <h3 style={colHeadStyle}>SHOP</h3>
            <div style={colBodyStyle}>
              {shopLinks.map(l => renderPublicLink(l.path, l.label))}
            </div>
          </div>

          {/* ── CUSTOMER CARE column ── */}
          <div>
            <h3 style={colHeadStyle}>CUSTOMER CARE</h3>
            <div style={colBodyStyle}>
              {CARE_LINKS.map(renderLink)}
            </div>
          </div>

          {/* ── ABOUT column ── */}
          <div>
            <h3 style={colHeadStyle}>ABOUT</h3>
            <div style={colBodyStyle}>
              {ABOUT_LINKS.map(renderLink)}
            </div>
          </div>

          {/* ── ACCOUNT column ── */}
          <div>
            <h3 style={colHeadStyle}>ACCOUNT</h3>
            <div style={colBodyStyle}>
              {ACCOUNT_LINKS.map(renderLink)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom sub-bar ── */}
      <div style={{ borderTop: '1px solid rgba(27,24,22,0.12)' }}>
        <div
          className="footer-bottom"
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '18px 40px 26px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: region + legal links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
            {/* Region picker */}
            <div id="footer-region-picker" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
              </svg>
              <button
                type="button"
                onClick={() => setRegionOpen(v => !v)}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  cursor: 'pointer', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', fontSize: '11px',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <span>Region: {selectedRegion}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: regionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {regionOpen && (
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 0,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '8px 0',
                  minWidth: '200px',
                  zIndex: 50,
                }}>
                  {regionOptions.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => { setSelectedRegion(option); setRegionOpen(false); }}
                      style={{
                        width: '100%', border: 'none', background: 'transparent',
                        textAlign: 'left', padding: '8px 14px', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: '12px',
                        color: selectedRegion === option ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: selectedRegion === option ? 600 : 400,
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <button type="button" onClick={() => go('/privacy-policy')} style={subBarLinkStyle}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              Privacy Policy
            </button>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <button type="button" onClick={() => go('/terms-of-service')} style={subBarLinkStyle}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              Terms of Service
            </button>
          </div>

          {/* Right: copyright */}
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .footer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 28px 32px !important;
          }
        }
        @media (max-width: 767px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .footer-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </footer>
  );
}

/* ─── Shared style objects ───────────────────────────────── */
const colHeadStyle = {
  margin: '0 0 16px',
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-primary)',
};

const colBodyStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  lineHeight: '1.6',
  transition: 'color 180ms ease',
};

const subBarLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
  transition: 'color 180ms ease',
};
