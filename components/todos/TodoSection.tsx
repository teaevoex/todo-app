'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TodoSectionProps {
  title: string
  count: number
  variant: 'danger' | 'default' | 'muted'
  children: ReactNode
}

const variantStyles: Record<TodoSectionProps['variant'], string> = {
  danger: 'text-destructive bg-destructive/5 border-destructive/20',
  default: 'text-foreground',
  muted: 'text-muted-foreground',
}

export function TodoSection({ title, count, variant, children }: TodoSectionProps) {
  const [open, setOpen] = useState(true)

  if (count === 0) return null

  return (
    <section
      data-testid={`todo-section-${variant}`}
      className="mb-4"
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`section-body-${variant}`}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent',
          variantStyles[variant]
        )}
      >
        <span>
          {title}
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {count}
          </span>
        </span>
        <svg
          className={cn('h-4 w-4 transition-transform', open ? 'rotate-180' : '')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          id={`section-body-${variant}`}
          className="mt-2 flex flex-col gap-2"
        >
          {children}
        </div>
      )}
    </section>
  )
}
