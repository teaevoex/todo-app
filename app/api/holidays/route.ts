import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { holidayDB } from '@/lib/db/holidays'
import type { ApiResponse, Holiday } from '@/lib/types'

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Holiday[]>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const yearStr = searchParams.get('year')
  const monthStr = searchParams.get('month')

  if (!yearStr) {
    return NextResponse.json(
      { success: false, error: 'Invalid year or month parameter' },
      { status: 400 }
    )
  }

  const year = parseInt(yearStr, 10)
  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { success: false, error: 'Invalid year or month parameter' },
      { status: 400 }
    )
  }

  if (monthStr !== null) {
    const month = parseInt(monthStr, 10)
    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month parameter' },
        { status: 400 }
      )
    }

    try {
      const holidays = holidayDB.findByMonth(year, month)
      return NextResponse.json({ success: true, data: holidays })
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch holidays' },
        { status: 500 }
      )
    }
  }

  try {
    const holidays = holidayDB.findByYear(year)
    return NextResponse.json({ success: true, data: holidays })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch holidays' },
      { status: 500 }
    )
  }
}
