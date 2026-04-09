/**
 * Seed script for Singapore public holidays (2024-2026).
 * Idempotent: uses INSERT OR IGNORE — safe to run multiple times.
 *
 * Usage: npx tsx scripts/seed-holidays.ts
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'todos.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

interface HolidaySeed {
  date: string
  name: string
  year: number
}

const holidays: HolidaySeed[] = [
  // 2024
  { date: '2024-01-01', name: "New Year's Day",     year: 2024 },
  { date: '2024-02-10', name: 'Chinese New Year',   year: 2024 },
  { date: '2024-02-11', name: 'Chinese New Year',   year: 2024 },
  { date: '2024-03-29', name: 'Good Friday',         year: 2024 },
  { date: '2024-04-10', name: 'Hari Raya Puasa',    year: 2024 },
  { date: '2024-05-01', name: 'Labour Day',          year: 2024 },
  { date: '2024-05-22', name: 'Vesak Day',           year: 2024 },
  { date: '2024-06-17', name: 'Hari Raya Haji',     year: 2024 },
  { date: '2024-08-09', name: 'National Day',        year: 2024 },
  { date: '2024-10-31', name: 'Deepavali',           year: 2024 },
  { date: '2024-12-25', name: 'Christmas Day',       year: 2024 },

  // 2025
  { date: '2025-01-01', name: "New Year's Day",     year: 2025 },
  { date: '2025-01-29', name: 'Chinese New Year',   year: 2025 },
  { date: '2025-01-30', name: 'Chinese New Year',   year: 2025 },
  { date: '2025-03-31', name: 'Hari Raya Puasa',    year: 2025 },
  { date: '2025-04-18', name: 'Good Friday',         year: 2025 },
  { date: '2025-05-01', name: 'Labour Day',          year: 2025 },
  { date: '2025-05-12', name: 'Vesak Day',           year: 2025 },
  { date: '2025-06-07', name: 'Hari Raya Haji',     year: 2025 },
  { date: '2025-08-09', name: 'National Day',        year: 2025 },
  { date: '2025-10-20', name: 'Deepavali',           year: 2025 },
  { date: '2025-12-25', name: 'Christmas Day',       year: 2025 },

  // 2026
  { date: '2026-01-01', name: "New Year's Day",     year: 2026 },
  { date: '2026-01-28', name: 'Chinese New Year',   year: 2026 },
  { date: '2026-01-29', name: 'Chinese New Year',   year: 2026 },
  { date: '2026-03-20', name: 'Hari Raya Puasa',    year: 2026 },
  { date: '2026-04-03', name: 'Good Friday',         year: 2026 },
  { date: '2026-05-01', name: 'Labour Day',          year: 2026 },
  { date: '2026-05-26', name: 'Vesak Day',           year: 2026 },
  { date: '2026-05-27', name: 'Hari Raya Haji',     year: 2026 },
  { date: '2026-08-09', name: 'National Day',        year: 2026 },
  { date: '2026-11-08', name: 'Deepavali',           year: 2026 },
  { date: '2026-12-25', name: 'Christmas Day',       year: 2026 },
]

const stmt = db.prepare(
  `INSERT OR IGNORE INTO holidays (date, name, year) VALUES (@date, @name, @year)`
)

const insertMany = db.transaction((rows: HolidaySeed[]) => {
  let inserted = 0
  for (const row of rows) {
    const result = stmt.run(row)
    inserted += result.changes
  }
  return inserted
})

const inserted = insertMany(holidays)
console.log(`Seeded ${inserted} holiday records (${holidays.length - inserted} already existed).`)

db.close()
