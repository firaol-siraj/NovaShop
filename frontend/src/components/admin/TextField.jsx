function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export default function TextField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  error,
  leadingIcon,
  readOnly,
  disabled,
  name,
  inputMode,
}) {
  const hasLeadingIcon = !!leadingIcon;

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: 'block',
            marginBottom: '5px',
            color: '#1C1917',
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '32px',
          border: error ? '1px solid #C84A3C' : '1px solid #E5DFD6',
          borderRadius: '6px',
          background: '#FFFFFF',
          transition: 'border-color 180ms ease, box-shadow 180ms ease',
          boxShadow: error ? '0 0 0 3px rgba(200,74,60,0.08)' : 'none',
          outline: 'none',
        }}
        className="admin-field-wrap"
      >
        {hasLeadingIcon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              color: '#8E897F',
              flexShrink: 0,
            }}
          >
            {leadingIcon || <MailIcon />}
          </span>
        )}

        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          disabled={disabled}
          inputMode={inputMode}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            color: '#0B0805',
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            padding: hasLeadingIcon ? '0 10px 0 0' : '0 10px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {error && (
        <p
          id={`${id}-error`}
          aria-live="polite"
          style={{
            margin: '7px 0 0',
            color: '#B04F3D',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
