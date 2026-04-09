'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCalendar } from '@/lib/hooks/useCalendar'
import { currentSGMonth } from '@/lib/calendar'
import { CalendarNav } from '@/components/calendar/CalendarNav'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { CalendarDayModal } from '@/components/calendar/CalendarDayModal'
import { Button } from '@/components/ui/button'
import type { CalendarDay } from '@/lib/calendar'

function CalendarPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse month from URL, fall back to current SG month
  const rawMonth = searchParams.get('month') ?? ''
  const isValidMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)
  const monthStr = isValidMonth ? rawMonth : currentSGMonth()

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { calendarMonth, isLoading, isError, monthLabel } = useCalendar(monthStr)

  // Month navigation helpers
  function parseMonth(str: string): { year: number; month: number } {
    const [y, m] = str.split('-').map(Number)
    return { year: y, month: m }
  }

  function formatMonth(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`
  }

  const handlePrev = useCallback(() => {
    const { year, month } = parseMonth(monthStr)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    router.push(`/calendar?month=${formatMonth(prevYear, prevMonth)}`)
  }, [monthStr, router])

  const handleNext = useCallback(() => {
    const { year, month } = parseMonth(monthStr)
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    router.push(`/calendar?month=${formatMonth(nextYear, nextMonth)}`)
  }, [monthStr, router])

  const handleToday = useCallback(() => {
    router.push(`/calendar?month=${currentSGMonth()}`)
  }, [router])

  const handleDayClick = useCallback((day: CalendarDay) => {
    // If clicking a day outside the current month, navigate to that month
    if (!day.isCurrentMonth) {
      const dayMonth = day.date.slice(0, 7)
      setSelectedDay(day)
      setIsModalOpen(true)
      router.push(`/calendar?month=${dayMonth}`)
      return
    }
    setSelectedDay(day)
    setIsModalOpen(true)
  }, [router])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedDay(null)
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View your todos by due date
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              ← Back to Todos
            </Button>
          </Link>
        </header>

        {/* Navigation */}
        <CalendarNav
          currentMonth={monthStr}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />

        {/* Calendar Grid */}
        {isError && (
          <div
            className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
            role="alert"
          >
            Failed to load calendar data. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <div className="rounded-md border border-border bg-background p-8 text-center text-muted-foreground">
            Loading calendar...
          </div>
        ) : calendarMonth ? (
          <CalendarGrid
            calendarMonth={calendarMonth}
            onDayClick={handleDayClick}
          />
        ) : null}
      </div>

      {/* Day Modal */}
      <CalendarDayModal
        day={selectedDay}
        open={isModalOpen}
        onClose={handleCloseModal}
      />
    </main>
  )
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      }
    >
      <CalendarPageInner />
    </Suspense>
  )
}
