import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { Session } from '@/lib/types'

export type { Session }

// --- Environment validation ---

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET not configured') })()
)

const COOKIE_NAME = 'session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

// --- Challenge store (in-memory, single-process) ---

interface StoredChallenge {
  challenge: string
  expiresAt: number
}

const challengeStore = new Map<string, StoredChallenge>()

export function setChallenge(username: string, challenge: string): void {
  challengeStore.set(username, {
    challenge,
    expiresAt: Date.now() + 60_000,
  })
}

export function getChallenge(username: string): string | null {
  const stored = challengeStore.get(username)
  challengeStore.delete(username)

  if (!stored) {
    return null
  }

  if (Date.now() > stored.expiresAt) {
    return null
  }

  return stored.challenge
}

// --- Session management (JWT + HTTP-only cookies) ---

export async function createSession(userId: number, username: string): Promise<void> {
  const token = await new SignJWT({ sub: String(userId), username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: Number(payload.sub),
      username: payload.username as string,
    }
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
