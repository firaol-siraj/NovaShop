export default function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-[var(--skeleton-base)] rounded-none ${className}`} />
  );
}
