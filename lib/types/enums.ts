export type Priority = 'high' | 'medium' | 'low'

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080

export const PRIORITY_VALUES: readonly Priority[] = ['high', 'medium', 'low'] as const

export const RECURRENCE_VALUES: readonly RecurrencePattern[] = [
  'daily', 'weekly', 'monthly', 'yearly',
] as const

export const REMINDER_OPTIONS: readonly { label: string; value: ReminderMinutes }[] = [
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: '1 week before', value: 10080 },
] as const

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
}
