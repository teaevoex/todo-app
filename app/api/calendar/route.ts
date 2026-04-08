import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, todoTagDB, holidayDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`

  const todos = todoDB.findAll(session.userId).filter(
    todo => todo.due_date && todo.due_date >= startDate && todo.due_date <= endDate
  )

  const enrichedTodos = todos.map(todo => {
    const subtasks = subtaskDB.findByTodoId(todo.id)
    const tags = todoTagDB.findByTodoId(todo.id)
    return {
      ...todo,
      subtasks,
      subtask_count: subtasks.length,
      subtask_completed: subtasks.filter(s => s.completed).length,
      tags,
    }
  })

  const holidays = holidayDB.findByMonth(year, month)

  return NextResponse.json({
    year,
    month,
    todos: enrichedTodos,
    holidays,
  })
}
