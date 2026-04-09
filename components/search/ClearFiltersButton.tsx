'use client'

import { Button } from '@/components/ui/button'

interface ClearFiltersButtonProps {
  onClick: () => void
  disabled?: boolean
}

export function ClearFiltersButton({ onClick, disabled }: ClearFiltersButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label="Clear all filters"
      data-testid="clear-filters"
      className="h-7 text-xs"
    >
      Clear All
    </Button>
  )
}
