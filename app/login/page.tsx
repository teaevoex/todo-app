'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    setError('')
    setLoading(true)

    try {
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })

      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        setError(data.error || 'Failed to start registration')
        return
      }

      const options = await optionsRes.json()
      const credential = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || 'Registration verification failed')
        return
      }

      router.push('/')
    } catch {
      setError('Registration was cancelled or failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setError('')
    setLoading(true)

    try {
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })

      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        setError(data.error || 'Failed to start login')
        return
      }

      const options = await optionsRes.json()
      const credential = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || 'Login verification failed')
        return
      }

      router.push('/')
    } catch {
      setError('Login was cancelled or failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6 dark:text-white">
          📝 Todo App
        </h1>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full border rounded-lg px-4 py-2.5 text-sm
                         border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         outline-none"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && username.trim()) {
                  handleLogin()
                }
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLogin}
              disabled={loading || !username.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                         bg-blue-600 text-white hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
            <button
              onClick={handleRegister}
              disabled={loading || !username.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                         border border-blue-300 text-blue-600 hover:bg-blue-50
                         dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? 'Processing...' : 'Register'}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
            Use your device&apos;s biometric authentication (fingerprint, Face ID, or Windows Hello) to sign in securely without a password.
          </p>
        </div>
      </div>
    </div>
  )
}
