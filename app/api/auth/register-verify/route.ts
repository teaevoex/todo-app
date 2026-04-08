import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'
import { createSession } from '@/lib/auth'

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const cookieStore = await cookies()
  const expectedChallenge = cookieStore.get('registration-challenge')?.value
  const username = cookieStore.get('registration-username')?.value

  if (!expectedChallenge || !username) {
    return NextResponse.json({ error: 'Registration session expired' }, { status: 400 })
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    const user = userDB.create(username)

    authenticatorDB.create(user.id, {
      credentialId: credential.id,
      credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter ?? 0,
      transports: body.response?.transports
        ? JSON.stringify(body.response.transports)
        : undefined,
    })

    // Clean up challenge cookies
    cookieStore.delete('registration-challenge')
    cookieStore.delete('registration-username')

    await createSession(user.id, user.username)

    return NextResponse.json({ verified: true, username: user.username })
  } catch (error) {
    return NextResponse.json(
      { error: 'Registration verification failed' },
      { status: 400 }
    )
  }
}
