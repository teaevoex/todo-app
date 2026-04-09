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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 mb-4">
            <span className="text-3xl">✏️</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
            Todo App
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organize your life, effortlessly</p>
        </div>

        <div className="glass-card rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none p-6">
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50 animate-fade-in">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full border rounded-xl px-4 py-3 text-sm
                           border-gray-200 dark:border-gray-600
                           bg-white/50 dark:bg-gray-800/50
                           text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
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
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold
                         bg-gradient-to-r from-indigo-600 to-purple-600
                         text-white shadow-md shadow-indigo-500/25
                         hover:shadow-lg hover:shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                         active:scale-[0.98] transition-all"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
            <button
              onClick={handleRegister}
              disabled={loading || !username.trim()}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold
                         border-2 border-indigo-200 text-indigo-600
                         hover:bg-indigo-50 hover:border-indigo-300
                         dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20
                         disabled:opacity-50 disabled:cursor-not-allowed
                         active:scale-[0.98] transition-all"
            >
              {loading ? 'Processing...' : 'Register'}
            </button>
          </div>

          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
            Uses your device&apos;s biometric authentication to sign in securely — no passwords needed.
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
