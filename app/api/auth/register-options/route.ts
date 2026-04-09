import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { userDB } from '@/lib/db/users'
import { setChallenge } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const RP_NAME = process.env.RP_NAME ?? 'Todo App'
const RP_ID = process.env.RP_ID ?? 'localhost'

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,50}$/

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = checkRateLimit(`register:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      logger.warn('Rate limit exceeded for registration', 'auth', { ip })
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }
    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username.trim() : ''

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username must be 3-50 characters (letters, numbers, - _)' },
        { status: 400 }
      )
    }

    const existingUser = userDB.findByUsername(username)
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username already taken' },
        { status: 409 }
      )
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: username,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    })

    setChallenge(username, options.challenge)

    return NextResponse.json({ success: true, data: options })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
