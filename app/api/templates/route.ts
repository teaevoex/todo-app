import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db/templates'
import type { ApiResponse, Template, CreateTemplateDto } from '@/lib/types'

export async function GET(): Promise<NextResponse<ApiResponse<Template[]>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const templates = templateDB.findAll(session.userId)
    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Template>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateTemplateDto
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
  if (name.length > 100) {
    return NextResponse.json(
      { success: false, error: 'Name must be \u2264 100 characters' },
      { status: 400 }
    )
  }

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

  if (body.priority !== undefined && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json(
      { success: false, error: 'Priority must be high, medium, or low' },
      { status: 400 }
    )
  }

  try {
    const template = templateDB.create(session.userId, {
      ...body,
      name,
      title_template: titleTemplate,
    })
    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
