const SG_TIMEZONE = 'Asia/Singapore'

export function getSingaporeNow(): Date {
  const now = new Date()
  const sgString = now.toLocaleString('en-US', { timeZone: SG_TIMEZONE })
  return new Date(sgString)
}

export function formatSingaporeDate(
  dateString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(dateString)
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: SG_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }
  return new Intl.DateTimeFormat('en-SG', defaultOptions).format(date)
}

export function toSingaporeISO(date?: Date): string {
  const target = date ?? new Date()
  const sgFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = sgFormatter.formatToParts(target)
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`
}

export function parseSingaporeDate(dateString: string): Date {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`)
  }
  return date
}
