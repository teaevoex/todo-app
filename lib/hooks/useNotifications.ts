'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api/notifications'
import { todosApi } from '@/lib/api/todos'
import { formatSingaporeDate } from '@/lib/timezone'
import { queryKeys } from '@/lib/queryKeys'
import type { TodoReminder } from '@/lib/types'

const POLL_INTERVAL_MS = 30_000

export function useNotifications() {
  const queryClient = useQueryClient()

  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  async function requestPermission() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      setNotificationsEnabled(true)
    }
  }

  const { data: pendingReminders } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationsApi.checkNotifications,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 10_000,
    enabled: notificationsEnabled && permission === 'granted',
  })

  const { mutate: markSent } = useMutation({
    mutationFn: (id: number) =>
      todosApi.updateTodo(id, { last_notification_sent: new Date().toISOString() }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  useEffect(() => {
    if (!pendingReminders || pendingReminders.length === 0) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    for (const reminder of pendingReminders) {
      try {
        const notification = new Notification(`Todo Reminder: ${reminder.title}`, {
          body: `Due: ${formatSingaporeDate(reminder.due_date)}`,
          tag: `todo-${reminder.id}`,
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
        markSent(reminder.id)
      } catch (err) {
        console.warn('Failed to show notification for todo', reminder.id, err)
      }
    }
  }, [pendingReminders, markSent])

  return {
    notificationsEnabled,
    permission,
    requestPermission,
    pendingReminders: pendingReminders ?? ([] as TodoReminder[]),
  }
}
