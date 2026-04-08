import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700">404</h1>
        <h2 className="text-xl font-semibold mt-4 text-gray-900 dark:text-white">
          Page Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium
                     hover:bg-blue-600 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
