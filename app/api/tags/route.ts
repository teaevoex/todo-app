import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db/tags'
import type { ApiResponse, Tag, CreateTagDto } from '@/lib/types'

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export async function GET(): Promise<NextResponse<ApiResponse<Tag[]>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tags = tagDB.findAll(session.userId)
    return NextResponse.json({ success: true, data: tags })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Tag>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateTagDto
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Name is required' },
      { status: 400 }
    )
  }
  if (name.length > 50) {
    return NextResponse.json(
      { success: false, error: 'Name must be \u2264 50 characters' },
      { status: 400 }
    )
  }

  const color = body.color ?? '#3B82F6'
  if (!HEX_COLOR_RE.test(color)) {
    return NextResponse.json(
      { success: false, error: 'Color must be a valid hex color (#RRGGBB)' },
      { status: 400 }
    )
  }

  try {
    const tag = tagDB.create(session.userId, { name, color })
    return NextResponse.json({ success: true, data: tag }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Tag name already exists') {
      return NextResponse.json(
        { success: false, error: 'Tag name already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create tag' },
      { status: 500 }
    )
  }
}
