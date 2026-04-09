import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { resolveWebAuthnConfig, storeLoginChallenge } from '@/lib/webauthn';

const validTransports = new Set<AuthenticatorTransportFuture>(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);

function parseTransports(value: string | null): AuthenticatorTransportFuture[] {
  try {
    const parsed = JSON.parse(value ?? '[]') as unknown[];
    return parsed.filter((transport): transport is AuthenticatorTransportFuture => typeof transport === 'string' && validTransports.has(transport as AuthenticatorTransportFuture));
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const { username } = (await request.json()) as { username?: string };
  const normalized = username?.trim();
  if (!normalized) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }
  const user = userDB.getByUsername(normalized);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const authenticators = authenticatorDB.getForUser(user.id);
  if (authenticators.length === 0) {
    return NextResponse.json({ error: 'No passkey registered for this username' }, { status: 400 });
  }
  const { rpID } = resolveWebAuthnConfig(request);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: authenticators.map((authenticator) => ({
      id: authenticator.credential_id,
      transports: parseTransports(authenticator.transports),
    })),
  });
  await storeLoginChallenge(normalized, options.challenge);
  return NextResponse.json(options);
}
