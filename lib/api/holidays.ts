import { apiClient } from './client'
import type { Holiday } from '@/lib/types'

export const holidaysApi = {
  fetchHolidays(year: number, month?: number): Promise<Holiday[]> {
    const params = month !== undefined
      ? `?year=${year}&month=${month}`
      : `?year=${year}`
    return apiClient.get<Holiday[]>(`/api/holidays${params}`)
  },
}
