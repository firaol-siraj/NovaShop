function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function AuthLayout({ children, go, hideBackLink }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE9', color: '#1B1816', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '54px',
          padding: '0 28px',
          borderBottom: '1px solid rgba(27, 24, 22, 0.08)',
          background: 'rgba(244, 239, 233, 0.94)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => go('/')}
          aria-label="Return to homepage"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: '#1B1816',
            fontFamily: 'var(--font-serif)',
            fontSize: '18px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          NOVASHOP
        </button>

        {!hideBackLink && (
          <button
            type="button"
            onClick={() => go('/')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#6F6862',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: 0,
            }}
          >
            <ArrowLeftIcon />
            <span>Back to Shopping</span>
          </button>
        )}
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      <footer
        style={{
          background: '#F4EFE9',
          borderTop: '1px solid rgba(27, 24, 22, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '18px',
          padding: '16px 28px 20px',
          flexWrap: 'wrap',
          color: '#7A726C',
          fontFamily: 'var(--font-sans)',
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" onClick={() => go('/support')} style={linkStyle}>Client Concierge</button>
          <button type="button" onClick={() => go('/support')} style={linkStyle}>Privacy Policy</button>
          <button type="button" onClick={() => go('/support')} style={linkStyle}>Terms of Service</button>
          <button type="button" onClick={() => go('/support')} style={linkStyle}>Authenticity &amp; Care</button>
        </div>

        <div style={{ textAlign: 'center' }}>© {new Date().getFullYear()} NOVASHOP. All rights reserved.</div>
      </footer>
    </div>
  );
}

const linkStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#7A726C',
  padding: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};
