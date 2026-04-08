'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700">500</h1>
        <h2 className="text-xl font-semibold mt-4 text-gray-900 dark:text-white">
          Something went wrong
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-block mt-6 px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium
                     hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
