'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REMINDER_OPTIONS } from '@/lib/types'
import type { ReminderMinutes } from '@/lib/types'

interface ReminderSelectProps {
  value: ReminderMinutes | null
  onChange: (value: ReminderMinutes | null) => void
  disabled?: boolean
}

export function ReminderSelect({ value, onChange, disabled = false }: ReminderSelectProps) {
  return (
    <div>
      <Label htmlFor="todo-reminder" className="mb-1 block text-xs font-medium text-muted-foreground">
        Remind me
      </Label>
      <Select
        value={value?.toString() ?? 'none'}
        onValueChange={(v) => onChange(v === 'none' ? null : (Number(v) as ReminderMinutes))}
        disabled={disabled}
      >
        <SelectTrigger
          id="todo-reminder"
          data-testid="reminder-select"
          aria-describedby={disabled ? 'reminder-disabled-hint' : undefined}
        >
          <SelectValue placeholder="No reminder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No reminder</SelectItem>
          {REMINDER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && (
        <span id="reminder-disabled-hint" className="text-xs text-muted-foreground">
          Set a due date to enable reminders
        </span>
      )}
    </div>
  )
}
