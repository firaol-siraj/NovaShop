export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const typeStyles = {
    info: 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-default)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]',
    error: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 border text-sm flex items-center gap-4 shadow-xl ${typeStyles[type] || typeStyles.info}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-70 hover:opacity-100 text-xs cursor-pointer">
          ✕
        </button>
      )}
    </div>
  );
}
