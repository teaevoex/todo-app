import { db } from './connection'
import type { Holiday } from '@/lib/types'

interface HolidayRow {
  id: number
  date: string
  name: string
  year: number
}

function rowToHoliday(row: HolidayRow): Holiday {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    year: row.year,
  }
}

export const holidayDB = {
  findByMonth(year: number, month: number): Holiday[] {
    const rows = db
      .prepare(
        `SELECT * FROM holidays
         WHERE year = ?
           AND CAST(substr(date, 6, 2) AS INTEGER) = ?
         ORDER BY date`
      )
      .all(year, month) as HolidayRow[]
    return rows.map(rowToHoliday)
  },

  findByYear(year: number): Holiday[] {
    const rows = db
      .prepare(
        `SELECT * FROM holidays
         WHERE year = ?
         ORDER BY date`
      )
      .all(year) as HolidayRow[]
    return rows.map(rowToHoliday)
  },
}
