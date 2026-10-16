import Button from './Button';

export default function EmptyState({ title = 'No items found', description = 'We couldn’t find what you were looking for.', actionText, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-6 text-stone-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </div>
      <h3 className="text-2xl font-serif text-stone-900 mb-2">{title}</h3>
      <p className="text-stone-500 text-sm max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <Button onClick={onAction} variant="outline" size="sm">
          {actionText}
        </Button>
      )}
    </div>
  );
}
