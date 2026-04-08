import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  userDB,
  todoDB,
  subtaskDB,
  tagDB,
  todoTagDB,
  templateDB,
  holidayDB,
} from '@/lib/db'
import type {
  User,
  Todo,
  Tag,
  Subtask,
  Template,
} from '@/lib/db'

// Use a unique test username to avoid collisions
const TEST_USER = `test_user_${Date.now()}`
let testUser: User
let testTodo: Todo

beforeAll(() => {
  testUser = userDB.create(TEST_USER)
})

afterAll(() => {
  // Clean up test data
  const todos = todoDB.findAll(testUser.id)
  for (const todo of todos) {
    todoDB.delete(todo.id, testUser.id)
  }
  const tags = tagDB.findAll(testUser.id)
  for (const tag of tags) {
    tagDB.delete(tag.id, testUser.id)
  }
  const templates = templateDB.findAll(testUser.id)
  for (const tmpl of templates) {
    templateDB.delete(tmpl.id, testUser.id)
  }
})

describe('userDB', () => {
  it('creates a user and returns it', () => {
    expect(testUser).toBeDefined()
    expect(testUser.username).toBe(TEST_USER)
    expect(testUser.id).toBeGreaterThan(0)
  })

  it('finds user by username', () => {
    const found = userDB.findByUsername(TEST_USER)
    expect(found).toBeDefined()
    expect(found!.id).toBe(testUser.id)
  })

  it('finds user by id', () => {
    const found = userDB.findById(testUser.id)
    expect(found).toBeDefined()
    expect(found!.username).toBe(TEST_USER)
  })

  it('returns undefined for non-existent user', () => {
    expect(userDB.findByUsername('non_existent_user_xyz')).toBeUndefined()
    expect(userDB.findById(999999)).toBeUndefined()
  })
})

describe('todoDB', () => {
  it('creates a todo with defaults', () => {
    testTodo = todoDB.create(testUser.id, { title: 'Test Todo' })
    expect(testTodo.title).toBe('Test Todo')
    expect(testTodo.completed).toBe(0)
    expect(testTodo.priority).toBe('medium')
    expect(testTodo.user_id).toBe(testUser.id)
  })

  it('creates a todo with all options', () => {
    const todo = todoDB.create(testUser.id, {
      title: 'Full Todo',
      due_date: '2025-12-31T00:00:00Z',
      priority: 'high',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      reminder_minutes: 30,
    })
    expect(todo.priority).toBe('high')
    expect(todo.is_recurring).toBe(1)
    expect(todo.recurrence_pattern).toBe('weekly')
    expect(todo.reminder_minutes).toBe(30)
    todoDB.delete(todo.id, testUser.id)
  })

  it('trims whitespace from title', () => {
    const todo = todoDB.create(testUser.id, { title: '  spaced title  ' })
    expect(todo.title).toBe('spaced title')
    todoDB.delete(todo.id, testUser.id)
  })

  it('finds all todos for user', () => {
    const todos = todoDB.findAll(testUser.id)
    expect(todos.length).toBeGreaterThanOrEqual(1)
    expect(todos.every(t => t.user_id === testUser.id)).toBe(true)
  })

  it('finds todo by id', () => {
    const found = todoDB.findById(testTodo.id, testUser.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Test Todo')
  })

  it('returns undefined for wrong user', () => {
    const found = todoDB.findById(testTodo.id, 999999)
    expect(found).toBeUndefined()
  })

  it('updates a todo', () => {
    const updated = todoDB.update(testTodo.id, testUser.id, {
      title: 'Updated Todo',
      priority: 'high',
      completed: true,
    })
    expect(updated).toBeDefined()
    expect(updated!.title).toBe('Updated Todo')
    expect(updated!.priority).toBe('high')
    expect(updated!.completed).toBe(1)
    // Restore
    todoDB.update(testTodo.id, testUser.id, { completed: false, priority: 'medium' })
  })

  it('returns undefined when updating non-existent todo', () => {
    const result = todoDB.update(999999, testUser.id, { title: 'nope' })
    expect(result).toBeUndefined()
  })

  it('deletes a todo', () => {
    const temp = todoDB.create(testUser.id, { title: 'To Delete' })
    expect(todoDB.delete(temp.id, testUser.id)).toBe(true)
    expect(todoDB.findById(temp.id, testUser.id)).toBeUndefined()
  })

  it('returns false when deleting non-existent todo', () => {
    expect(todoDB.delete(999999, testUser.id)).toBe(false)
  })
})

describe('subtaskDB', () => {
  let subtask: Subtask

  it('creates a subtask', () => {
    subtask = subtaskDB.create(testTodo.id, { title: 'Subtask 1' })
    expect(subtask.title).toBe('Subtask 1')
    expect(subtask.todo_id).toBe(testTodo.id)
    expect(subtask.completed).toBe(0)
  })

  it('auto-increments position', () => {
    const sub2 = subtaskDB.create(testTodo.id, { title: 'Subtask 2' })
    expect(sub2.position).toBeGreaterThan(subtask.position)
    subtaskDB.delete(sub2.id)
  })

  it('finds subtasks by todo id', () => {
    const subs = subtaskDB.findByTodoId(testTodo.id)
    expect(subs.length).toBeGreaterThanOrEqual(1)
    expect(subs[0].todo_id).toBe(testTodo.id)
  })

  it('updates a subtask', () => {
    const updated = subtaskDB.update(subtask.id, { completed: true })
    expect(updated).toBeDefined()
    expect(updated!.completed).toBe(1)
  })

  it('deletes a subtask', () => {
    const temp = subtaskDB.create(testTodo.id, { title: 'Temp Sub' })
    expect(subtaskDB.delete(temp.id)).toBe(true)
    expect(subtaskDB.findById(temp.id)).toBeUndefined()
  })

  it('cascade deletes subtasks when todo is deleted', () => {
    const parentTodo = todoDB.create(testUser.id, { title: 'Parent' })
    subtaskDB.create(parentTodo.id, { title: 'Child 1' })
    subtaskDB.create(parentTodo.id, { title: 'Child 2' })
    expect(subtaskDB.findByTodoId(parentTodo.id).length).toBe(2)
    todoDB.delete(parentTodo.id, testUser.id)
    expect(subtaskDB.findByTodoId(parentTodo.id).length).toBe(0)
  })
})

describe('tagDB', () => {
  let tag: Tag

  it('creates a tag with default color', () => {
    tag = tagDB.create(testUser.id, { name: 'work' })
    expect(tag.name).toBe('work')
    expect(tag.color).toBe('#6B7280')
  })

  it('creates a tag with custom color', () => {
    const t = tagDB.create(testUser.id, { name: 'urgent', color: '#ef4444' })
    expect(t.color).toBe('#ef4444')
    tagDB.delete(t.id, testUser.id)
  })

  it('finds all tags for user', () => {
    const tags = tagDB.findAll(testUser.id)
    expect(tags.length).toBeGreaterThanOrEqual(1)
  })

  it('finds tag by name', () => {
    const found = tagDB.findByName('work', testUser.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(tag.id)
  })

  it('updates a tag', () => {
    const updated = tagDB.update(tag.id, testUser.id, { name: 'office', color: '#22c55e' })
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('office')
    expect(updated!.color).toBe('#22c55e')
  })

  it('returns undefined for non-existent tag update', () => {
    expect(tagDB.update(999999, testUser.id, { name: 'x' })).toBeUndefined()
  })

  it('deletes a tag', () => {
    const temp = tagDB.create(testUser.id, { name: 'temp_tag' })
    expect(tagDB.delete(temp.id, testUser.id)).toBe(true)
    expect(tagDB.findById(temp.id, testUser.id)).toBeUndefined()
  })
})

describe('todoTagDB', () => {
  let tag1: Tag
  let tag2: Tag

  beforeAll(() => {
    tag1 = tagDB.create(testUser.id, { name: 'tag_a' })
    tag2 = tagDB.create(testUser.id, { name: 'tag_b' })
  })

  afterAll(() => {
    tagDB.delete(tag1.id, testUser.id)
    tagDB.delete(tag2.id, testUser.id)
  })

  it('assigns tags to a todo', () => {
    todoTagDB.setTags(testTodo.id, [tag1.id, tag2.id])
    const tags = todoTagDB.findByTodoId(testTodo.id)
    expect(tags.length).toBe(2)
  })

  it('replaces tags when setting new ones', () => {
    todoTagDB.setTags(testTodo.id, [tag1.id])
    const tags = todoTagDB.findByTodoId(testTodo.id)
    expect(tags.length).toBe(1)
    expect(tags[0].id).toBe(tag1.id)
  })

  it('adds a single tag', () => {
    todoTagDB.addTag(testTodo.id, tag2.id)
    const tags = todoTagDB.findByTodoId(testTodo.id)
    expect(tags.length).toBe(2)
  })

  it('removes a tag', () => {
    expect(todoTagDB.removeTag(testTodo.id, tag2.id)).toBe(true)
    const tags = todoTagDB.findByTodoId(testTodo.id)
    expect(tags.length).toBe(1)
  })

  it('cascade-deletes todo_tags when todo is deleted', () => {
    const tempTodo = todoDB.create(testUser.id, { title: 'Tag Cascade' })
    todoTagDB.setTags(tempTodo.id, [tag1.id, tag2.id])
    expect(todoTagDB.findByTodoId(tempTodo.id).length).toBe(2)
    todoDB.delete(tempTodo.id, testUser.id)
    expect(todoTagDB.findByTodoId(tempTodo.id).length).toBe(0)
  })
})

describe('templateDB', () => {
  let template: Template

  it('creates a template with defaults', () => {
    template = templateDB.create(testUser.id, { title: 'Morning Routine' })
    expect(template.title).toBe('Morning Routine')
    expect(template.priority).toBe('medium')
    expect(template.subtasks).toBe('[]')
  })

  it('creates a template with subtasks', () => {
    const t = templateDB.create(testUser.id, {
      title: 'Workout',
      priority: 'high',
      category: 'health',
      subtasks: [
        { title: 'Warm up', position: 0 },
        { title: 'Exercise', position: 1 },
      ],
    })
    expect(t.priority).toBe('high')
    expect(t.category).toBe('health')
    const subs = JSON.parse(t.subtasks)
    expect(subs).toHaveLength(2)
    expect(subs[0].title).toBe('Warm up')
    templateDB.delete(t.id, testUser.id)
  })

  it('finds all templates for user', () => {
    const templates = templateDB.findAll(testUser.id)
    expect(templates.length).toBeGreaterThanOrEqual(1)
  })

  it('finds template by id', () => {
    const found = templateDB.findById(template.id, testUser.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Morning Routine')
  })

  it('updates a template', () => {
    const updated = templateDB.update(template.id, testUser.id, {
      title: 'Evening Routine',
      priority: 'low',
    })
    expect(updated).toBeDefined()
    expect(updated!.title).toBe('Evening Routine')
    expect(updated!.priority).toBe('low')
  })

  it('deletes a template', () => {
    const temp = templateDB.create(testUser.id, { title: 'Delete Me' })
    expect(templateDB.delete(temp.id, testUser.id)).toBe(true)
    expect(templateDB.findById(temp.id, testUser.id)).toBeUndefined()
  })
})

describe('holidayDB', () => {
  it('returns empty array for month with no holidays', () => {
    const result = holidayDB.findByMonth(2099, 1)
    expect(result).toEqual([])
  })

  it('findByDate returns undefined for non-holiday date', () => {
    expect(holidayDB.findByDate('2099-01-15')).toBeUndefined()
  })
})
