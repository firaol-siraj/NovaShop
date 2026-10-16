export default function PrimaryButton({ type = 'button', onClick, disabled, loading, children, fullWidth = true, icon, className }) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={className}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: '32px',
        padding: '0 16px',
        border: 'none',
        borderRadius: '6px',
        background: isDisabled ? '#9B9792' : '#0B0805',
        color: '#FFFFFF',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'opacity 180ms ease, transform 180ms ease, background-color 180ms ease',
      }}
    >
      <span>{children}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <span
            aria-label="Loading"
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid rgba(255,255,255,0.35)',
              borderTopColor: '#FFFFFF',
              borderRadius: '50%',
              animation: 'admin-spin 0.75s linear infinite',
            }}
          />
        ) : (
          icon || (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          )
        )}
      </span>
    </button>
  );
}
