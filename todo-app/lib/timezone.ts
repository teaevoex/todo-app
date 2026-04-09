const SINGAPORE_TIMEZONE = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  const now = new Date();
  const singapore = new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

  return new Date(
    `${singapore.year}-${singapore.month}-${singapore.day}T${singapore.hour}:${singapore.minute}:${singapore.second}+08:00`,
  );
}

export function toSingaporeISOString(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date).toISOString();
}

export function formatSingaporeDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SINGAPORE_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function toDatetimeLocalValue(value: string | Date | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function minutesUntil(dateString: string): number {
  const diff = new Date(dateString).getTime() - getSingaporeNow().getTime();
  return Math.floor(diff / 60000);
}

export function isAtLeastOneMinuteInFuture(dateString: string): boolean {
  return minutesUntil(dateString) >= 1;
}

export function addRecurrence(dateString: string, pattern: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const date = new Date(dateString);
  switch (pattern) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case 'yearly':
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }
  return date.toISOString();
}
