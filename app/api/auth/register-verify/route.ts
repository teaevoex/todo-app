import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { db } from '@/lib/db/connection'
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

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { success: false, error: 'Registration verification failed' },
        { status: 400 }
      )
    }

    const { credential } = verification.registrationInfo
    const credentialId = credential.id
    const credentialPublicKey = isoBase64URL.fromBuffer(credential.publicKey)
    const counter = credential.counter ?? 0
    const transports = credential.transports
      ? JSON.stringify(credential.transports)
      : null

    // Use a transaction to create both user and authenticator atomically
    const insertUserAndAuth = db.transaction(() => {
      const user = userDB.create(username)
      userDB.createAuthenticator({
        user_id: user.id,
        credential_id: credentialId,
        credential_public_key: credentialPublicKey,
        counter,
        transports,
      })
      return user
    })

    const user = insertUserAndAuth()

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
