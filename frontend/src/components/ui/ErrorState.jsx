import Button from './Button';

export default function ErrorState({ title = 'Something went wrong', message = 'Failed to load content. Please try again.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-[var(--color-danger-soft)] bg-[var(--bg-surface-raised)]">
      <h3 className="text-2xl font-serif text-[var(--color-danger)] mb-2">{title}</h3>
      <p className="text-[var(--text-muted)] text-sm max-w-md mb-6">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white">
          Try Again
        </Button>
      )}
    </div>
  );
}
