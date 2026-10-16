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
        <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-stone-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-4 py-2.5 bg-[#FDFBF7] border border-stone-300 text-stone-900 text-sm focus:outline-none focus:border-stone-900 transition-colors rounded-none appearance-none cursor-pointer ${
          error ? 'border-rose-600' : ''
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
    </div>
  );
}
