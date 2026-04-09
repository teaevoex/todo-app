'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PriorityBadge } from '@/components/todos/PriorityBadge'
import { useTemplates } from '@/lib/hooks/useTemplates'
import { TEMPLATE_CATEGORIES } from '@/lib/tokens/templates'
import type { TodoWithRelations } from '@/lib/types'

interface SaveTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  sourceTodo: TodoWithRelations
}

export function SaveTemplateModal({ isOpen, onClose, sourceTodo }: SaveTemplateModalProps) {
  const [name, setName] = useState(sourceTodo.title)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { createTemplate } = useTemplates()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Template name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const subtasks = (sourceTodo.subtasks ?? []).map((s, i) => ({
        title: s.title,
        position: s.position ?? i,
      }))

      const tagIds = (sourceTodo.tags ?? []).map((t) => t.id)

      const offsetDays = dueDateOffsetDays !== ''
        ? parseInt(dueDateOffsetDays, 10)
        : null

      await createTemplate.mutateAsync({
        name: trimmedName,
        description: description.trim() || null,
        category: category.trim() || null,
        title_template: sourceTodo.title,
        priority: sourceTodo.priority,
        is_recurring: sourceTodo.is_recurring,
        recurrence_pattern: sourceTodo.recurrence_pattern,
        reminder_minutes: sourceTodo.reminder_minutes,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        tag_ids: tagIds.length > 0 ? tagIds : undefined,
        due_date_offset_days: isNaN(offsetDays as number) ? null : offsetDays,
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setIsSubmitting(false)
    }
  }

  const subtasks = sourceTodo.subtasks ?? []
  const tags = sourceTodo.tags ?? []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[400px]"
        data-testid="save-template-modal"
      >
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Template name *</Label>
            <Input
              id="template-name"
              data-testid="template-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="e.g. Weekly Team Sync"
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Input
              id="template-description"
              data-testid="template-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-category">Category (optional)</Label>
            <Input
              id="template-category"
              data-testid="template-category-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Work, Personal..."
              maxLength={50}
              list="template-categories"
            />
            <datalist id="template-categories">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-offset">Due date offset (days, optional)</Label>
            <Input
              id="template-offset"
              data-testid="template-offset-input"
              type="number"
              value={dueDateOffsetDays}
              onChange={(e) => setDueDateOffsetDays(e.target.value)}
              placeholder="e.g. 7 = due in 1 week"
            />
          </div>

          {/* Preview section */}
          <div className="rounded-lg bg-muted p-3 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Preview
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {sourceTodo.title}
              </span>
              <PriorityBadge priority={sourceTodo.priority} size="sm" />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {sourceTodo.is_recurring && sourceTodo.recurrence_pattern && (
                <Badge variant="outline" className="text-xs capitalize">
                  {sourceTodo.recurrence_pattern}
                </Badge>
              )}
              {sourceTodo.reminder_minutes && (
                <Badge variant="outline" className="text-xs">
                  Reminder set
                </Badge>
              )}
              {subtasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {tags.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {tags.length} tag{tags.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="save-template-submit"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
