import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db/templates'
import type { ApiResponse, Template, CreateTemplateDto } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Template>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid template ID' }, { status: 400 })
  }

  let body: Partial<CreateTemplateDto>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }
    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Name must be \u2264 100 characters' },
        { status: 400 }
      )
    }
    body = { ...body, name }
  }

  if (body.title_template !== undefined) {
    const titleTemplate = typeof body.title_template === 'string' ? body.title_template.trim() : ''
    if (!titleTemplate) {
      return NextResponse.json(
        { success: false, error: 'Title template is required' },
        { status: 400 }
      )
    }
    if (titleTemplate.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Title template must be \u2264 200 characters' },
        { status: 400 }
      )
    }
    body = { ...body, title_template: titleTemplate }
  }

  if (body.description && body.description.length > 500) {
    return NextResponse.json(
      { success: false, error: 'Description must be \u2264 500 characters' },
      { status: 400 }
    )
  }

  if (body.category && body.category.length > 50) {
    return NextResponse.json(
      { success: false, error: 'Category must be \u2264 50 characters' },
      { status: 400 }
    )
  }

  try {
    const template = templateDB.update(id, session.userId, body)
    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    if (error instanceof Error && error.message === 'Template not found') {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
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
    return NextResponse.json({ success: false, error: 'Invalid template ID' }, { status: 400 })
  }

  try {
    templateDB.delete(id, session.userId)
    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Template not found') {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
