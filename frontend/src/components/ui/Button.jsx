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
    primary:  'bg-[#231E1B] text-[#FDFBF7] hover:bg-[#3a3330] focus:ring-[#231E1B]',
    secondary:'bg-[#EFECE6] text-[#231E1B] hover:bg-[#E8E2D8] focus:ring-[#D5CDC2]',
    outline:  'border border-[#231E1B] text-[#231E1B] bg-transparent hover:bg-[#231E1B] hover:text-[#FDFBF7] focus:ring-[#231E1B]',
    'outline-ivory': 'border border-[#FDFBF7] text-[#FDFBF7] bg-transparent hover:bg-[#FDFBF7]/10 focus:ring-[#FDFBF7]',
    ghost:    'text-[#231E1B] bg-transparent hover:bg-[#F9F6F0] focus:ring-[#D5CDC2]',
    danger:   'bg-rose-900 text-white hover:bg-rose-950 focus:ring-rose-900',
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
