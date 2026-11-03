import Spinner from './Spinner';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const base = [
    'inline-flex items-center justify-center font-medium transition-all duration-200',
    'focus:outline-none focus:ring-1 focus:ring-offset-1',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'rounded-none',                    // Sharp shape language — no rounding
    'tracking-widest uppercase text-xs',
  ].join(' ');

  const variants = {
    primary:  'bg-[var(--color-primary)] text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] focus:ring-[var(--border-focus)]',
    secondary:'bg-[var(--bg-surface-sunken)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus:ring-[var(--border-default)]',
    outline:  'border border-[var(--border-strong)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-contrast)] focus:ring-[var(--border-focus)]',
    'outline-ivory': 'border border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary)]/10 focus:ring-[var(--color-primary)]',
    ghost:    'text-[var(--text-primary)] bg-transparent hover:bg-[var(--bg-hover)] focus:ring-[var(--border-default)]',
    danger:   'bg-[var(--color-danger)] text-white hover:opacity-90 focus:ring-[var(--color-danger)]',
  };

  const sizes = {
    xs: 'px-4 py-2 text-[10px]',
    sm: 'px-5 py-2.5 text-[10px]',
    md: 'px-7 py-3 text-[11px]',
    lg: 'px-10 py-4 text-[11px]',
  };

  return (
    <button
      className={`${base} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner size="sm" className="text-current" />}
      {children}
    </button>
  );
}
