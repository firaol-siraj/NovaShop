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
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-stone-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-2.5 bg-[#FDFBF7] border border-stone-300 text-stone-900 text-sm focus:outline-none focus:border-stone-900 transition-colors placeholder:text-stone-400 rounded-none ${
          error ? 'border-rose-600 focus:border-rose-600' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
      {helperText && !error && <span className="text-xs text-stone-500">{helperText}</span>}
    </div>
  );
}
