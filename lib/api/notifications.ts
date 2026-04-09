import { apiClient } from './client'
import type { TodoReminder } from '@/lib/types'

export const notificationsApi = {
  checkNotifications(): Promise<TodoReminder[]> {
    return apiClient.get<TodoReminder[]>('/api/notifications/check')
  },
}
