import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { consumeLoginChallenge, resolveWebAuthnConfig } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  try {
    const { origin, rpID } = resolveWebAuthnConfig(request);
    const body = (await request.json()) as { username?: string; response?: Record<string, unknown> };
    const username = body.username?.trim();
    if (!username || !body.response) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const challenge = await consumeLoginChallenge(username);
    if (!challenge) {
      return NextResponse.json({ error: 'Authentication challenge missing or expired' }, { status: 400 });
    }

    const user = userDB.getByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const credentialId = (body.response.id ?? '') as string;
    const authenticator = authenticatorDB.getByCredentialId(credentialId);
    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 });
    }

    const verification = await verifyAuthenticationResponse({
      response: body.response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.public_key),
        counter: authenticator.counter ?? 0,
        transports: JSON.parse(authenticator.transports ?? '[]'),
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
    }

    authenticatorDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0);
    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ verified: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
