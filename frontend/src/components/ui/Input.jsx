export default function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-subtle)] rounded-none ${
          error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[var(--color-danger)] font-medium">{error}</span>}
      {helperText && !error && <span className="text-xs text-[var(--text-subtle)]">{helperText}</span>}
    </div>
  );
}
