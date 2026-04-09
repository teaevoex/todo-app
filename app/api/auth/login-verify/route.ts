import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB } from '@/lib/db/users'
import { getChallenge, createSession } from '@/lib/auth'

const RP_ID = process.env.RP_ID ?? 'localhost'
const RP_ORIGIN = process.env.RP_ORIGIN ?? 'http://localhost:3000'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const response = body.response

    if (!username || !response) {
      return NextResponse.json(
        { success: false, error: 'Missing username or response' },
        { status: 400 }
      )
    }

    const challenge = getChallenge(username)
    if (!challenge) {
      return NextResponse.json(
        { success: false, error: 'Authentication challenge expired. Please try again.' },
        { status: 400 }
      )
    }

    const user = userDB.findByUsername(username)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 400 }
      )
    }

    const authenticator = userDB.findAuthenticatorByCredentialId(response.id)
    if (!authenticator || authenticator.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 400 }
      )
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports
          ? JSON.parse(authenticator.transports)
          : undefined,
      },
    })

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 400 }
      )
    }

    userDB.updateAuthenticatorCounter(
      authenticator.id,
      verification.authenticationInfo.newCounter
    )

    await createSession(user.id, user.username)

    return NextResponse.json({
      success: true,
      data: { id: user.id, username: user.username },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
