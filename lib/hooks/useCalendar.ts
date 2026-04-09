'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { todosApi } from '@/lib/api/todos'
import { useHolidays } from './useHolidays'
import { buildCalendarMonth, currentSGMonth } from '@/lib/calendar'
import type { CalendarMonth, CalendarDay } from '@/lib/calendar'
import type { TodoWithRelations } from '@/lib/types'

interface UseCalendarReturn {
  calendarMonth: CalendarMonth | null
  isLoading: boolean
  isError: boolean
  todosForDay: (date: string) => CalendarDay['todos']
  holidayForDay: (date: string) => CalendarDay['holidays'][0] | undefined
  monthLabel: string
}

/**
 * Composes todo data + holiday data into a CalendarMonth grid.
 * @param monthStr 'YYYY-MM' format
 */
export function useCalendar(monthStr: string): UseCalendarReturn {
  // Parse and validate monthStr
  const validMonthStr = /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : currentSGMonth()
  const [yearStr, monthNumStr] = validMonthStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthNumStr, 10)

  const todosQuery = useQuery({
    queryKey: queryKeys.todos,
    queryFn: todosApi.fetchTodos,
    staleTime: 30_000,
    gcTime: 300_000,
  })

  const { holidays, isLoading: holidaysLoading, error: holidaysError } = useHolidays(year, month)

  const todos: TodoWithRelations[] = todosQuery.data ?? []

  const calendarMonth = useMemo(() => {
    if (todosQuery.isLoading) return null
    return buildCalendarMonth(year, month, todos, holidays)
  }, [year, month, todos, holidays, todosQuery.isLoading])

  // Build a lookup map for fast day access
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    if (!calendarMonth) return map
    for (const week of calendarMonth.weeks) {
      for (const day of week) {
        map.set(day.date, day)
      }
    }
    return map
  }, [calendarMonth])

  const todosForDay = (date: string) => dayMap.get(date)?.todos ?? []
  const holidayForDay = (date: string) => dayMap.get(date)?.holidays[0]

  // Format month label: "April 2026"
  const monthLabel = new Intl.DateTimeFormat('en-SG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(Date.UTC(year, month - 1, 1)))

  return {
    calendarMonth,
    isLoading: todosQuery.isLoading || holidaysLoading,
    isError: !!todosQuery.error || !!holidaysError,
    todosForDay,
    holidayForDay,
    monthLabel,
  }
}
