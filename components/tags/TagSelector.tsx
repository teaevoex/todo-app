'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { TagBadge } from './TagBadge'
import type { Tag } from '@/lib/types'

interface TagSelectorProps {
  selectedTagIds: number[]
  onChange: (ids: number[]) => void
  tags: Tag[]
  disabled?: boolean
}

export function TagSelector({ selectedTagIds, onChange, tags, disabled = false }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleToggle(tagId: number) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  function handleRemove(tagId: number) {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  return (
    <div data-testid="tag-selector" className="relative">
      <div className="flex flex-wrap gap-1 min-h-[2rem] rounded-lg border border-input bg-background px-2 py-1">
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            onRemove={disabled ? undefined : () => handleRemove(tag.id)}
          />
        ))}
        {!disabled && (
          <button
            type="button"
            aria-label="Select tags"
            data-testid="tag-selector-trigger"
            onClick={() => setIsOpen((prev) => !prev)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            {isOpen ? '▲' : '▼'} Tags
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
          {tags.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No tags yet. Create one in Tag Manager.
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer"
                  onClick={() => handleToggle(tag.id)}
                >
                  <Checkbox
                    id={`tag-option-${tag.id}`}
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={() => handleToggle(tag.id)}
                    aria-checked={selectedTagIds.includes(tag.id)}
                    data-testid={`tag-option-${tag.id}`}
                  />
                  <Label
                    htmlFor={`tag-option-${tag.id}`}
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </Label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
