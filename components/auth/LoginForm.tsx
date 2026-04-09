'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types'
import { authApi } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'

interface LoginFormProps {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [webAuthnSupported, setWebAuthnSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
      setWebAuthnSupported(false)
      setError('Your browser does not support passkeys. Please use a modern browser.')
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = username.trim()
    if (trimmed.length === 0) {
      setError('Username is required')
      return
    }

    if (!webAuthnSupported) return

    setIsLoading(true)

    try {
      let options
      try {
        options = await authApi.loginOptions(trimmed)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
        if (message.includes('User not found')) {
          setError('User not found. Did you mean to register?')
          return
        }
        throw err
      }

      let assertion
      try {
        assertion = await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON })
      } catch (err) {
        // User cancelled the browser prompt
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setIsLoading(false)
          return
        }
        throw err
      }

      await authApi.loginVerify(trimmed, assertion)
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="login-form" className="space-y-4">
      <div>
        <label
          htmlFor="username-login"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Username
        </label>
        <input
          id="username-login"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          disabled={!webAuthnSupported || isLoading}
          data-testid="login-username-input"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          data-testid="login-error"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!webAuthnSupported || isLoading}
        aria-busy={isLoading}
        data-testid="login-submit-btn"
        className="w-full"
      >
        {isLoading ? 'Logging in...' : 'Login with Passkey'}
      </Button>
    </form>
  )
}
