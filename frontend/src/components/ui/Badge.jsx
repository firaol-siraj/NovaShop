export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
    sale: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]',
    new: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]',
    outline: 'bg-transparent text-[var(--text-primary)] border-[var(--border-default)]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider border rounded-none ${
        variants[variant] || variants.default
      } ${className}`}
    >
      {children}
    </span>
  );
}
