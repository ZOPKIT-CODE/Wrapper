import { ZopkitRoundLoader } from './ZopkitRoundLoader';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading Spinner – uses Zopkit round loader everywhere.
 */
export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  className = ''
}: LoadingSpinnerProps) {
  const loaderSize = size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : 'md';

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <ZopkitRoundLoader size={loaderSize} />
      {message && (
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}
