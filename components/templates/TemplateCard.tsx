'use client'

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PriorityBadge } from '@/components/todos/PriorityBadge'
import { REMINDER_LABELS } from '@/lib/types'
import type { Template, Tag } from '@/lib/types'

interface TemplateCardProps {
  template: Template
  tags: Tag[]
  onUse: (id: number) => void
  onDelete: (id: number) => void
}

function parseSubtasks(subtasksJson: string | null): { title: string; position: number }[] {
  try {
    return JSON.parse(subtasksJson ?? '[]')
  } catch {
    return []
  }
}

function parseTagIds(tagIdsJson: string | null): number[] {
  try {
    return JSON.parse(tagIdsJson ?? '[]')
  } catch {
    return []
  }
}

export function TemplateCard({ template, tags, onUse, onDelete }: TemplateCardProps) {
  const subtasks = parseSubtasks(template.subtasks_json)
  const tagIds = parseTagIds(template.tag_ids_json)
  const templateTags = tags.filter((t) => tagIds.includes(t.id))

  return (
    <Card
      className="hover:shadow-md transition-shadow bg-card text-card-foreground rounded-lg shadow-sm"
      data-testid={`template-card-${template.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{template.name}</h3>
            {template.category && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {template.category}
              </Badge>
            )}
          </div>
          <PriorityBadge priority={template.priority} size="sm" />
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {template.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground truncate max-w-[160px]">
            &ldquo;{template.title_template}&rdquo;
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {template.is_recurring && template.recurrence_pattern && (
            <Badge variant="outline" className="text-xs capitalize">
              {template.recurrence_pattern}
            </Badge>
          )}

          {template.reminder_minutes && (
            <Badge variant="outline" className="text-xs">
              Reminder: {REMINDER_LABELS[template.reminder_minutes]}
            </Badge>
          )}

          {subtasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
            </Badge>
          )}

          {template.due_date_offset_days !== null ? (
            <Badge variant="outline" className="text-xs">
              Due in {template.due_date_offset_days}d
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No due date
            </Badge>
          )}
        </div>

        {templateTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {templateTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}26`,
                  color: tag.color,
                  border: `1px solid ${tag.color}4d`,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onUse(template.id)}
          data-testid={`use-template-${template.id}`}
          aria-label={`Use template: ${template.name}`}
        >
          Use
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(template.id)}
          data-testid={`delete-template-${template.id}`}
          aria-label={`Delete template: ${template.name}`}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
