import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db/todos'
import type { ApiResponse, TodoReminder } from '@/lib/types'

export async function GET(): Promise<NextResponse<ApiResponse<TodoReminder[]>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const reminders = todoDB.findDueReminders(session.userId)
    return NextResponse.json({ success: true, data: reminders })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to check notifications' },
      { status: 500 }
    )
  }
}
