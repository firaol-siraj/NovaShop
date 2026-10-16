import Button from './Button';

export default function ErrorState({ title = 'Something went wrong', message = 'Failed to load content. Please try again.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-rose-100 bg-rose-50/50">
      <h3 className="text-2xl font-serif text-rose-950 mb-2">{title}</h3>
      <p className="text-rose-700 text-sm max-w-md mb-6">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="border-rose-900 text-rose-900 hover:bg-rose-900 hover:text-white">
          Try Again
        </Button>
      )}
    </div>
  );
}
