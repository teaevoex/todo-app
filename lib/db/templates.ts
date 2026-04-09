import { db } from './connection'
import type {
  Template,
  CreateTemplateDto,
  TemplateSubtask,
} from '@/lib/types'

interface TemplateRow {
  id: number
  user_id: number
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: string
  is_recurring: number
  recurrence_pattern: string | null
  reminder_minutes: number | null
  subtasks_json: string | null
  tag_ids_json: string | null
  due_date_offset_days: number | null
  created_at: string
}

function rowToTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    category: row.category,
    title_template: row.title_template,
    priority: row.priority as Template['priority'],
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: row.recurrence_pattern as Template['recurrence_pattern'],
    reminder_minutes: row.reminder_minutes as Template['reminder_minutes'],
    subtasks_json: row.subtasks_json ?? '[]',
    tag_ids_json: row.tag_ids_json ?? '[]',
    due_date_offset_days: row.due_date_offset_days,
    created_at: row.created_at,
  }
}

// Ensure tag_ids_json column exists (idempotent migration)
try {
  db.exec(`ALTER TABLE templates ADD COLUMN tag_ids_json TEXT NOT NULL DEFAULT '[]'`)
} catch {
  // Column already exists
}

export const templateDB = {
  create(userId: number, dto: CreateTemplateDto): Template {
    const subtasksJson = dto.subtasks ? JSON.stringify(dto.subtasks) : '[]'
    const tagIdsJson = dto.tag_ids ? JSON.stringify(dto.tag_ids) : '[]'

    const stmt = db.prepare(`
      INSERT INTO templates (
        user_id, name, description, category, title_template,
        priority, is_recurring, recurrence_pattern, reminder_minutes,
        subtasks_json, tag_ids_json, due_date_offset_days
      ) VALUES (
        @userId, @name, @description, @category, @title_template,
        @priority, @is_recurring, @recurrence_pattern, @reminder_minutes,
        @subtasks_json, @tag_ids_json, @due_date_offset_days
      )
    `)

    const info = stmt.run({
      userId,
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category ?? null,
      title_template: dto.title_template,
      priority: dto.priority ?? 'medium',
      is_recurring: dto.is_recurring ? 1 : 0,
      recurrence_pattern: dto.recurrence_pattern ?? null,
      reminder_minutes: dto.reminder_minutes ?? null,
      subtasks_json: subtasksJson,
      tag_ids_json: tagIdsJson,
      due_date_offset_days: dto.due_date_offset_days ?? null,
    })

    const row = db
      .prepare('SELECT * FROM templates WHERE id = ?')
      .get(info.lastInsertRowid) as TemplateRow

    return rowToTemplate(row)
  },

  findAll(userId: number): Template[] {
    const rows = db
      .prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as TemplateRow[]

    return rows.map(rowToTemplate)
  },

  findById(id: number, userId: number): Template | null {
    const row = db
      .prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .get(id, userId) as TemplateRow | undefined

    return row ? rowToTemplate(row) : null
  },

  update(id: number, userId: number, dto: Partial<CreateTemplateDto>): Template {
    const existing = db
      .prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .get(id, userId) as TemplateRow | undefined

    if (!existing) {
      throw new Error('Template not found')
    }

    const fields: string[] = []
    const values: Record<string, unknown> = { id, userId }

    if (dto.name !== undefined) {
      fields.push('name = @name')
      values.name = dto.name
    }
    if (dto.description !== undefined) {
      fields.push('description = @description')
      values.description = dto.description
    }
    if (dto.category !== undefined) {
      fields.push('category = @category')
      values.category = dto.category
    }
    if (dto.title_template !== undefined) {
      fields.push('title_template = @title_template')
      values.title_template = dto.title_template
    }
    if (dto.priority !== undefined) {
      fields.push('priority = @priority')
      values.priority = dto.priority
    }
    if (dto.is_recurring !== undefined) {
      fields.push('is_recurring = @is_recurring')
      values.is_recurring = dto.is_recurring ? 1 : 0
    }
    if (dto.recurrence_pattern !== undefined) {
      fields.push('recurrence_pattern = @recurrence_pattern')
      values.recurrence_pattern = dto.recurrence_pattern
    }
    if (dto.reminder_minutes !== undefined) {
      fields.push('reminder_minutes = @reminder_minutes')
      values.reminder_minutes = dto.reminder_minutes
    }
    if (dto.subtasks !== undefined) {
      fields.push('subtasks_json = @subtasks_json')
      values.subtasks_json = JSON.stringify(dto.subtasks)
    }
    if (dto.due_date_offset_days !== undefined) {
      fields.push('due_date_offset_days = @due_date_offset_days')
      values.due_date_offset_days = dto.due_date_offset_days
    }
    if (dto.tag_ids !== undefined) {
      fields.push('tag_ids_json = @tag_ids_json')
      values.tag_ids_json = JSON.stringify(dto.tag_ids)
    }

    if (fields.length > 0) {
      db.prepare(
        `UPDATE templates SET ${fields.join(', ')} WHERE id = @id AND user_id = @userId`
      ).run(values)
    }

    const updated = db
      .prepare('SELECT * FROM templates WHERE id = ?')
      .get(id) as TemplateRow

    return rowToTemplate(updated)
  },

  delete(id: number, userId: number): void {
    const existing = db
      .prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
      .get(id, userId)

    if (!existing) {
      throw new Error('Template not found')
    }

    db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId)
  },

  parseSubtasks(template: Template): TemplateSubtask[] {
    try {
      return JSON.parse(template.subtasks_json ?? '[]') as TemplateSubtask[]
    } catch {
      return []
    }
  },

  parseTagIds(template: Template): number[] {
    try {
      return JSON.parse(template.tag_ids_json ?? '[]') as number[]
    } catch {
      return []
    }
  },
}
