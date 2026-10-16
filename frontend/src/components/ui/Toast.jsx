export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const typeStyles = {
    info: 'bg-stone-900 text-stone-50',
    success: 'bg-emerald-900 text-emerald-50',
    error: 'bg-rose-900 text-rose-50',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 border border-stone-800 text-sm flex items-center gap-4 shadow-lg ${typeStyles[type] || typeStyles.info}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-70 hover:opacity-100 text-xs">
          ✕
        </button>
      )}
    </div>
  );
}
