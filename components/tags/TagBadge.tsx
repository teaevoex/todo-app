'use client'

import { Badge } from '@/components/ui/badge'
import type { Tag } from '@/lib/types'

interface TagBadgeProps {
  tag: Tag
  onClick?: () => void
  onRemove?: () => void
}

export function TagBadge({ tag, onClick, onRemove }: TagBadgeProps) {
  const badgeBg = `${tag.color}26`
  const badgeBorder = `${tag.color}40`

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        style={{
          backgroundColor: badgeBg,
          color: tag.color,
          borderColor: badgeBorder,
        }}
        className="text-xs font-medium cursor-default"
        data-testid={`tag-badge-${tag.id}`}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `Filter by tag: ${tag.name}` : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        } : undefined}
      >
        {tag.name}
      </Badge>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Remove tag ${tag.name}`}
          data-testid={`tag-badge-remove-${tag.id}`}
        >
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
