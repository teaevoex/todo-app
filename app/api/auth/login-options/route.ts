import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { userDB, authenticatorDB } from '@/lib/db'

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'

export async function POST(request: NextRequest) {
  const { username } = await request.json()

  if (!username || typeof username !== 'string' || !username.trim()) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  const user = userDB.findByUsername(username.trim())
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const authenticators = authenticatorDB.findByUserId(user.id)
  if (authenticators.length === 0) {
    return NextResponse.json({ error: 'No authenticators registered' }, { status: 400 })
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: authenticators.map(auth => ({
      id: auth.credential_id,
      transports: auth.transports ? JSON.parse(auth.transports) : undefined,
    })),
    userVerification: 'preferred',
  })

  const cookieStore = await cookies()
  cookieStore.set('login-challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })
  cookieStore.set('login-username', username.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return NextResponse.json(options)
}
