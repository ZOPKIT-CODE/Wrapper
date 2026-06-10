import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorMessageProps {
  title: string
  message: string
  onRetry?: () => void
  className?: string
}

/**
 * Error Message Component
 *
 * Features:
 * - Consistent error display
 * - Optional retry functionality
 * - Accessible design
 */
export function ErrorMessage({
  title,
  message,
  onRetry,
  className = '',
}: ErrorMessageProps) {
  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className}`}
    >
      <div className="flex items-start">
        <AlertTriangle className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold text-red-800">{title}</h3>
          <p className="mb-4 text-red-600">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
