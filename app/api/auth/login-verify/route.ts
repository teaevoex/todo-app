import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'
import { createSession } from '@/lib/auth'

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const cookieStore = await cookies()
  const expectedChallenge = cookieStore.get('login-challenge')?.value
  const username = cookieStore.get('login-username')?.value

  if (!expectedChallenge || !username) {
    return NextResponse.json({ error: 'Login session expired' }, { status: 400 })
  }

  const user = userDB.findByUsername(username)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const credentialId = body.rawId
  const authenticator = authenticatorDB.findByCredentialId(credentialId)

  if (!authenticator || authenticator.user_id !== user.id) {
    return NextResponse.json({ error: 'Authenticator not found' }, { status: 400 })
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 400 })
    }

    const { authenticationInfo } = verification
    authenticatorDB.updateCounter(
      authenticator.credential_id,
      authenticationInfo.newCounter ?? 0
    )

    // Clean up challenge cookies
    cookieStore.delete('login-challenge')
    cookieStore.delete('login-username')

    await createSession(user.id, user.username)

    return NextResponse.json({ verified: true, username: user.username })
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 400 }
    )
  }
}
