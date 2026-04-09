'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'

interface LogoutButtonProps {
  className?: string
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const { logout } = useAuth()

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={logout}
      aria-label="Log out"
      data-testid="logout-button"
      className={className}
    >
      Logout
    </Button>
  )
}
