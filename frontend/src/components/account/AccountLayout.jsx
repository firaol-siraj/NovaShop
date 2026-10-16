import { useMemo } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

function AccountSidebar({ go, currentPath, onSignOut, onWishlistOpen }) {
  const accountNav = [
    { key: 'overview', label: 'Overview', path: '/account' },
    { key: 'orders', label: 'Orders', path: '/account/orders' },
    { key: 'wishlist', label: 'Wishlist', path: '/account/wishlist' },
    { key: 'addresses', label: 'Addresses', path: '/account/addresses' },
    { key: 'payments', label: 'Payments', path: '/account/payments' },
    { key: 'profile', label: 'Profile', path: '/account/profile' },
    { key: 'settings', label: 'Settings', path: '/account/settings' },
  ];

  const activeKey = useMemo(() => {
    if (currentPath === '/account' || currentPath === '/account/') return 'overview';
    if (currentPath.startsWith('/account/orders')) return 'orders';
    if (currentPath.startsWith('/account/wishlist')) return 'wishlist';
    if (currentPath.startsWith('/account/addresses')) return 'addresses';
    if (currentPath.startsWith('/account/payments')) return 'payments';
    if (currentPath.startsWith('/account/profile')) return 'profile';
    if (currentPath.startsWith('/account/settings')) return 'settings';
    return 'overview';
  }, [currentPath]);

  const handleNavAction = (item) => {
    if (item.key === 'wishlist') {
      go('/account/wishlist');
      return;
    }
    go(item.path);
  };

  return (
    <aside style={{ paddingTop: '4px' }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '14px' }}>
        Account
      </div>

      <nav style={{ display: 'grid', gap: '4px' }}>
        {accountNav.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavAction(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: isActive ? '#F0E8DE' : 'transparent',
                borderLeft: isActive ? '2px solid #1B1816' : '2px solid transparent',
                padding: '12px 12px 12px 14px',
                cursor: 'pointer',
                color: isActive ? '#1B1816' : '#6E6962',
                transition: 'background 180ms ease, color 180ms ease',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                letterSpacing: '0.01em',
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: '1px solid rgba(27,24,22,0.1)' }}>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: '#6E6962',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function AccountLayout({ children, go, currentPath }) {
  const { openWishlist } = useCart();
  const { logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    go('/');
  };

  return (
    <div style={{ background: '#F6F1EA', minHeight: '100vh', color: '#1B1816' }} className="ns-account-shell">
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 40px 52px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '36px', alignItems: 'start' }}>
          <div style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.10)', borderRadius: '14px', padding: '18px 14px 20px' }}>
            <AccountSidebar go={go} currentPath={currentPath} onSignOut={handleSignOut} onWishlistOpen={openWishlist} />
          </div>

          <main style={{ display: 'grid', gap: '26px' }}>
            {children}
          </main>
        </div>
      </div>

      <style>{`
        .ns-account-shell * { box-sizing: border-box; }
        .ns-account-shell {
          animation: nsFadeIn 200ms ease;
        }
        @keyframes nsFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1023px) {
          .ns-account-shell > div > div { grid-template-columns: 1fr !important; }
          .ns-account-shell > div > div > div:first-child {
            overflow-x: auto;
            padding-bottom: 10px;
          }
          .ns-account-shell nav {
            display: flex !important;
            gap: 8px !important;
            overflow-x: auto;
            white-space: nowrap;
          }
          .ns-account-shell nav button {
            min-width: max-content;
            border-left: none !important;
            border-bottom: 2px solid transparent;
          }
        }
        @media (max-width: 767px) {
          .ns-account-shell > div {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}
