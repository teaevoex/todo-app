import type { ApiResponse } from '@/lib/types'

const BASE_URL = ''

async function request<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${url}`, options)
  const json: ApiResponse<T> = await response.json()

  if (!json.success) {
    throw new Error(json.error ?? 'An unexpected error occurred')
  }

  return json.data as T
}

export const apiClient = {
  get<T>(url: string): Promise<T> {
    return request<T>('GET', url)
  },

  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>('POST', url, body)
  },

  put<T>(url: string, body?: unknown): Promise<T> {
    return request<T>('PUT', url, body)
  },

  delete<T>(url: string, body?: unknown): Promise<T> {
    return request<T>('DELETE', url, body)
  },
}
