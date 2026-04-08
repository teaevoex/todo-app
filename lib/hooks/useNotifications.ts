import { useEffect, useCallback, useState, useRef } from 'react'
import type { Todo } from '@/lib/db'

const POLL_INTERVAL = 30000 // 30 seconds

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return

    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  const checkAndNotify = useCallback(async () => {
    if (permission !== 'granted') return

    try {
      const res = await fetch('/api/notifications/check')
      if (!res.ok) return

      const todos: Todo[] = await res.json()
      if (todos.length === 0) return

      const todoIds: number[] = []

      for (const todo of todos) {
        const dueText = todo.due_date
          ? new Date(todo.due_date).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
          : ''

        new Notification(todo.title, {
          body: dueText ? `Due: ${dueText}` : 'Reminder',
          icon: '/favicon.ico',
          tag: `todo-${todo.id}`,
        })

        todoIds.push(todo.id)
      }

      if (todoIds.length > 0) {
        await fetch('/api/notifications/mark-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ todoIds }),
        })
      }
    } catch {
      // Failed poll — silently retry on next interval
    }
  }, [permission])

  useEffect(() => {
    if (permission === 'granted') {
      checkAndNotify()
      intervalRef.current = setInterval(checkAndNotify, POLL_INTERVAL)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [permission, checkAndNotify])

  return {
    permission,
    requestPermission,
    isEnabled: permission === 'granted',
  }
}
