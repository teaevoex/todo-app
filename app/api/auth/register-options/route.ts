import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { userDB, authenticatorDB } from '@/lib/db'

const rpName = 'Todo App'
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'

export async function POST(request: NextRequest) {
  const { username } = await request.json()

  if (!username || typeof username !== 'string' || !username.trim()) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  const existingUser = userDB.findByUsername(username.trim())
  if (existingUser) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username.trim(),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  const cookieStore = await cookies()
  cookieStore.set('registration-challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })
  cookieStore.set('registration-username', username.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return NextResponse.json(options)
}
