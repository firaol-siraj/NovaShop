export default function Select({
  label,
  options = [],
  error,
  className = '',
  id,
  ...props
}) {
  const selectId = id || props.name;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--border-focus)] transition-colors rounded-none appearance-none cursor-pointer ${
          error ? 'border-[var(--color-danger)]' : ''
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-[var(--color-danger)] font-medium">{error}</span>}
    </div>
  );
}
