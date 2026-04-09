import { NextResponse } from 'next/server';
import { holidayDB } from '@/lib/db';
import { singaporeHolidays } from '@/lib/holidays';

export async function GET() {
  const holidays = holidayDB.list();
  if (holidays.length > 0) {
    return NextResponse.json({ holidays });
  }

  holidayDB.replaceAll([...singaporeHolidays]);
  return NextResponse.json({ holidays: holidayDB.list() });
}
