import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { consumeRegisterChallenge, resolveWebAuthnConfig } from '@/lib/webauthn';

function credentialIdToString(input: unknown) {
  if (typeof input === 'string') return input;
  return isoBase64URL.fromBuffer(new Uint8Array(input as ArrayBuffer));
}

function publicKeyToString(input: unknown) {
  if (typeof input === 'string') return input;
  return isoBase64URL.fromBuffer(new Uint8Array(input as ArrayBuffer));
}

export async function POST(request: NextRequest) {
  try {
    const { origin, rpID } = resolveWebAuthnConfig(request);
    const body = (await request.json()) as { username?: string; response?: Record<string, unknown> };
    const username = body.username?.trim();
    if (!username || !body.response) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const challenge = await consumeRegisterChallenge(username);
    if (!challenge) {
      return NextResponse.json({ error: 'Registration challenge missing or expired' }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: body.response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    const credentialId = credentialIdToString(verification.registrationInfo.credential.id);
    if (authenticatorDB.getByCredentialId(credentialId)) {
      return NextResponse.json({ error: 'This passkey is already registered' }, { status: 400 });
    }

    const user = userDB.create(username);
    if (!user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    try {
      authenticatorDB.create({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKeyToString(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter ?? 0,
        device_type: verification.registrationInfo.credentialDeviceType,
        backed_up: verification.registrationInfo.credentialBackedUp ? 1 : 0,
        transports: JSON.stringify((((body.response as { response?: { transports?: string[] } }).response?.transports) ?? [])),
      });
    } catch (error) {
      userDB.delete(user.id);
      throw error;
    }

    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ verified: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
