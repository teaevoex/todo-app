type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: string
  details?: unknown
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.context ? `[${entry.context}] ` : ''}${entry.message}`
  if (entry.details !== undefined) {
    return `${base} ${JSON.stringify(entry.details)}`
  }
  return base
}

function createEntry(level: LogLevel, message: string, context?: string, details?: unknown): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    details,
  }
}

export const logger = {
  info(message: string, context?: string, details?: unknown): void {
    const entry = createEntry('info', message, context, details)
    if (process.env.NODE_ENV !== 'test') {
      process.stdout?.write?.(formatEntry(entry) + '\n')
    }
  },

  warn(message: string, context?: string, details?: unknown): void {
    const entry = createEntry('warn', message, context, details)
    if (process.env.NODE_ENV !== 'test') {
      process.stdout?.write?.(formatEntry(entry) + '\n')
    }
  },

  error(message: string, context?: string, details?: unknown): void {
    const entry = createEntry('error', message, context, details)
    if (process.env.NODE_ENV !== 'test') {
      process.stderr?.write?.(formatEntry(entry) + '\n')
    }
  },
}
