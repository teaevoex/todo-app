import { apiClient } from './client'
import type { User } from '@/lib/types'

export const authApi = {
  registerOptions(username: string): Promise<unknown> {
    return apiClient.post<unknown>('/api/auth/register-options', { username })
  },

  registerVerify(username: string, response: unknown): Promise<{ id: number; username: string }> {
    return apiClient.post<{ id: number; username: string }>('/api/auth/register-verify', {
      username,
      response,
    })
  },

  loginOptions(username: string): Promise<unknown> {
    return apiClient.post<unknown>('/api/auth/login-options', { username })
  },

  loginVerify(username: string, response: unknown): Promise<{ id: number; username: string }> {
    return apiClient.post<{ id: number; username: string }>('/api/auth/login-verify', {
      username,
      response,
    })
  },

  logout(): Promise<void> {
    return apiClient.post<void>('/api/auth/logout')
  },

  me(): Promise<User> {
    return apiClient.get<User>('/api/auth/me')
  },
}
