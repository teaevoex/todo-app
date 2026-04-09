'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  message: string
  icon?: ReactNode
  className?: string
  action?: ReactNode
}

export function EmptyState({ message, icon, className, action }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
