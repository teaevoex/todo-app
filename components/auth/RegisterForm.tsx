'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types'
import { authApi } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'

interface RegisterFormProps {
  onSuccess: () => void
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
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
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (!webAuthnSupported) return

    setIsLoading(true)

    try {
      const options = await authApi.registerOptions(trimmed)

      let attestation
      try {
        attestation = await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON })
      } catch (err) {
        // User cancelled the browser prompt
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setIsLoading(false)
          return
        }
        throw err
      }

      await authApi.registerVerify(trimmed, attestation)
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="register-form" className="space-y-4">
      <div>
        <label
          htmlFor="username-register"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Username
        </label>
        <input
          id="username-register"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter a username"
          disabled={!webAuthnSupported || isLoading}
          data-testid="register-username-input"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          data-testid="register-error"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!webAuthnSupported || isLoading}
        aria-busy={isLoading}
        data-testid="register-submit-btn"
        className="w-full"
      >
        {isLoading ? 'Registering...' : 'Register with Passkey'}
      </Button>
    </form>
  )
}
