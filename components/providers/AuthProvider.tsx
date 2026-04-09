'use client'

import { createContext, useMemo, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/types'
import { authApi } from '@/lib/api/auth'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  logout: async () => {},
})

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch {
        return null
      }
    },
    staleTime: 300_000,
    gcTime: 600_000,
    retry: false,
  })

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      queryClient.clear()
      router.push('/login')
    }
  }, [queryClient, router])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: user != null,
      logout,
    }),
    [user, isLoading, logout]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
