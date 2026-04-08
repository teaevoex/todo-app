import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tags = tagDB.findAll(session.userId)
  return NextResponse.json(tags)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
  }

  const trimmedName = body.name.trim()
  if (trimmedName.length > 50) {
    return NextResponse.json({ error: 'Tag name must be 50 characters or less' }, { status: 400 })
  }

  const existing = tagDB.findByName(trimmedName, session.userId)
  if (existing) {
    return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
  }

  if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    return NextResponse.json({ error: 'Invalid color format (use #RRGGBB)' }, { status: 400 })
  }

  const tag = tagDB.create(session.userId, {
    name: trimmedName,
    color: body.color ?? undefined,
  })

  return NextResponse.json(tag, { status: 201 })
}
