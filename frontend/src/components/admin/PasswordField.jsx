import { useState } from 'react';

export default function PasswordField({ id, label, value, onChange, onBlur, placeholder, error, name, autoComplete, disabled }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="admin-auth-password-field" style={{ width: '100%' }}>
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
        }}
      >
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
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
            padding: '0 10px',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '100%',
            border: 'none',
            background: 'transparent',
            color: '#6B6660',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showPassword ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
              <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a16.7 16.7 0 0 1-3.61 5.13" />
              <path d="M6.61 6.61A16.9 16.9 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
            </svg>
          )}
        </button>
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
