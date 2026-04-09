import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { userDB } from '@/lib/db/users'
import { setChallenge } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const RP_ID = process.env.RP_ID ?? 'localhost'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = checkRateLimit(`login:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      logger.warn('Rate limit exceeded for login', 'auth', { ip })
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }
    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username.trim() : ''

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      )
    }

    const user = userDB.findByUsername(username)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const authenticators = userDB.findAuthenticatorsByUserId(user.id)

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: authenticators.map((auth) => ({
        id: auth.credential_id,
        transports: auth.transports
          ? JSON.parse(auth.transports)
          : undefined,
      })),
      userVerification: 'preferred',
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
