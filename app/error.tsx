'use client'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="text-4xl font-bold text-foreground">Something went wrong</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <div className="mt-6 flex gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <button
          onClick={() => { window.location.href = '/' }}
          className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Go back home
        </button>
      </div>
    </div>
  )
}
