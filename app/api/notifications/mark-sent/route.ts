import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db'
import { getSingaporeNow } from '@/lib/timezone'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { todoIds } = body

  if (!Array.isArray(todoIds) || todoIds.length === 0) {
    return NextResponse.json({ error: 'todoIds must be a non-empty array' }, { status: 400 })
  }

  const now = getSingaporeNow()
  todoDB.markNotificationSent(todoIds, session.userId, now.toISOString())

  return NextResponse.json({ success: true })
}
