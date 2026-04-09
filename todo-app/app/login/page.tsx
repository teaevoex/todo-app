'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTheme } from '@/lib/hooks/useTheme';

type MeResponse = {
  user: { userId: number; username: string } | null;
};

type JsonPayload = {
  error?: string;
  [key: string]: unknown;
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'register' | 'login' | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as MeResponse;
      })
      .then((data) => {
        if (data?.user) router.replace('/');
      })
      .catch(() => null);
  }, [router]);

  const parseJsonSafely = async (response: Response): Promise<JsonPayload> => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as JsonPayload;
    } catch {
      return { error: text };
    }
  };

  const runFlow = async (mode: 'register' | 'login', event: FormEvent) => {
    event.preventDefault();
    setLoading(mode);
    setError('');

    try {
      const optionPath = `/api/auth/${mode}-options`;
      const verifyPath = `/api/auth/${mode}-verify`;

      const optionsResponse = await fetch(optionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const optionsPayload = await parseJsonSafely(optionsResponse);
      if (!optionsResponse.ok) throw new Error(optionsPayload.error ?? 'Failed to start auth flow');

      const webauthnResponse =
        mode === 'register'
          ? await startRegistration({ optionsJSON: optionsPayload as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'] })
          : await startAuthentication({ optionsJSON: optionsPayload as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'] });

      const verifyResponse = await fetch(verifyPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: webauthnResponse }),
      });

      const verifyPayload = await parseJsonSafely(verifyResponse);
      if (!verifyResponse.ok) throw new Error(verifyPayload.error ?? 'Verification failed');
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(16px, 5vw, 32px)',
      }}
    >
      <section
        style={{
          width: 'min(100%, 520px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: 'clamp(20px, 5vw, 32px)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)',
        }}
      >
        <p style={{ margin: 0, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
          Todo App
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              padding: '0.7rem 0.95rem',
            }}
          >
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>
        <h1 style={{ marginTop: 8, marginBottom: 12, fontSize: 'clamp(2rem, 6vw, 2.5rem)', lineHeight: 1.05 }}>Passkey Sign In</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Register once with WebAuthn, then return with the same passkey. This app uses Singapore timezone for all scheduling.
        </p>

        <form style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. testuser"
              style={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '0.9rem 1rem',
                background: 'var(--surface-alt)',
                color: 'var(--text)',
              }}
            />
          </label>
          {error ? (
            <p style={{ margin: 0, color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <button
              onClick={(event) => void runFlow('register', event)}
              disabled={loading !== null}
              style={{
                border: 0,
                borderRadius: 14,
                padding: '0.95rem',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {loading === 'register' ? 'Registering...' : 'Register'}
            </button>
            <button
              onClick={(event) => void runFlow('login', event)}
              disabled={loading !== null}
              style={{
                borderRadius: 14,
                padding: '0.95rem',
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                fontWeight: 700,
              }}
            >
              {loading === 'login' ? 'Signing in...' : 'Login'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
