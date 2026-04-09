import type { ExportPayload } from '@/lib/types'

export function validatePayload(body: unknown): body is ExportPayload {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>

  if (b.version === undefined) {
    throw new Error("Missing required field: version")
  }
  if (typeof b.version !== 'number') {
    throw new Error("Field 'version' must be a number")
  }
  if (b.version !== 1) {
    throw new Error(`Unsupported export version: ${b.version}. Expected version 1.`)
  }
  if (!Array.isArray(b.todos)) {
    throw new Error("Invalid JSON structure: missing required field 'todos'")
  }

  return true
}
