import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 })
  }

  if (body.name) {
    const trimmedName = body.name.trim()
    if (trimmedName.length > 50) {
      return NextResponse.json({ error: 'Tag name must be 50 characters or less' }, { status: 400 })
    }
    const existing = tagDB.findByName(trimmedName, session.userId)
    if (existing && existing.id !== Number(id)) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
    }
  }

  if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    return NextResponse.json({ error: 'Invalid color format (use #RRGGBB)' }, { status: 400 })
  }

  const tag = tagDB.update(Number(id), session.userId, body)
  if (!tag) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  return NextResponse.json(tag)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const deleted = tagDB.delete(Number(id), session.userId)

  if (!deleted) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
