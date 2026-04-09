'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { tagDefaultPalette } from '@/lib/tokens/tags'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value)

  const handleCustomChange = (hex: string) => {
    setCustomColor(hex)
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex)
    }
  }

  return (
    <div data-testid="color-picker" className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-2">
        {tagDefaultPalette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              onChange(color)
              setCustomColor(color)
            }}
            className={cn(
              'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
              value === color ? 'border-ring ring-2 ring-ring/20' : 'border-transparent'
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="custom-color" className="text-sm text-muted-foreground">
          Custom:
        </label>
        <input
          id="custom-color"
          type="text"
          value={customColor}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          className={cn(
            'w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground',
            'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20'
          )}
        />
        <div
          className="h-6 w-6 rounded border border-border"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  )
}
