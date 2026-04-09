'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  const result = await Notification.requestPermission()
  return result
}

export function NotificationToggle() {
  const { notificationsEnabled, permission, requestPermission } = useNotifications()

  if (typeof Notification === 'undefined') {
    return null
  }

  if (permission === 'denied') {
    return (
      <div
        role="alert"
        data-testid="notification-denied-banner"
        className="bg-warning/15 text-warning-foreground p-3 rounded-md text-sm"
      >
        Notifications are blocked. Enable them in your browser settings to receive reminders.
      </div>
    )
  }

  if (notificationsEnabled && permission === 'granted') {
    return (
      <Badge
        data-testid="notification-toggle"
        variant="outline"
        className="gap-1 text-xs font-medium bg-success/15 text-success-foreground border-success/30"
      >
        <Bell className="h-3 w-3" aria-hidden="true" />
        Notifications On
      </Badge>
    )
  }

  return (
    <Button
      data-testid="notification-toggle"
      variant="outline"
      size="sm"
      onClick={requestPermission}
      className="gap-1.5"
    >
      <BellOff className="h-4 w-4" aria-hidden="true" />
      Enable Notifications
    </Button>
  )
}
