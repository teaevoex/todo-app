'use client'

import { useQuery } from '@tanstack/react-query'
import { holidaysApi } from '@/lib/api/holidays'
import { queryKeys } from '@/lib/queryKeys'
import type { Holiday } from '@/lib/types'

interface UseHolidaysReturn {
  holidays: Holiday[]
  isLoading: boolean
  error: Error | null
}

export function useHolidays(year: number, month: number): UseHolidaysReturn {
  const query = useQuery({
    queryKey: queryKeys.holidays(year, month),
    queryFn: () => holidaysApi.fetchHolidays(year, month),
    staleTime: 86_400_000,   // 24 hours — holidays change infrequently
    gcTime: 604_800_000,     // 7 days
    enabled: year > 0 && month > 0,
  })

  return {
    holidays: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
