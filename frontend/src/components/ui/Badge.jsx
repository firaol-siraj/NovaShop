export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-stone-100 text-stone-800 border-stone-200',
    sale: 'bg-stone-900 text-stone-50 border-stone-900',
    new: 'bg-amber-100 text-amber-900 border-amber-200',
    outline: 'bg-transparent text-stone-700 border-stone-300',
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
