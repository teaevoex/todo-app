import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db/tags'
import type { ApiResponse, Tag, UpdateTagDto } from '@/lib/types'

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Tag>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 })
  }

  let body: UpdateTagDto
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.name !== undefined) {
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
    body = { ...body, name }
  }

  if (body.color !== undefined && !HEX_COLOR_RE.test(body.color)) {
    return NextResponse.json(
      { success: false, error: 'Color must be a valid hex color (#RRGGBB)' },
      { status: 400 }
    )
  }

  try {
    const tag = tagDB.update(id, session.userId, body)
    return NextResponse.json({ success: true, data: tag })
  } catch (error) {
    if (error instanceof Error && error.message === 'Tag not found') {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'Tag name already exists') {
      return NextResponse.json(
        { success: false, error: 'Tag name already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update tag' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 })
  }

  try {
    tagDB.delete(id, session.userId)
    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Tag not found') {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete tag' },
      { status: 500 }
    )
  }
}
