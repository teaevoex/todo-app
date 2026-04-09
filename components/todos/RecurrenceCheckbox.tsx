'use client'

interface RecurrenceCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function RecurrenceCheckbox({ checked, onChange, disabled = false }: RecurrenceCheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="todo-recurring"
        data-testid="todo-recurring-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={disabled ? 'recurring-disabled-hint' : undefined}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      <label htmlFor="todo-recurring" className="text-sm font-medium text-muted-foreground cursor-pointer">
        Repeat
      </label>
      {disabled && (
        <span id="recurring-disabled-hint" className="text-xs text-muted-foreground">
          Set a due date first
        </span>
      )}
    </div>
  )
}
