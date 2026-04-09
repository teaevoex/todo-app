import { db } from './connection'
import type { User, Authenticator } from '@/lib/types'

interface AuthenticatorRow {
  id: number
  user_id: number
  credential_id: string
  credential_public_key: string
  counter: number
  transports: string | null
  created_at: string
}

interface CreateAuthenticatorData {
  user_id: number
  credential_id: string
  credential_public_key: string
  counter: number
  transports: string | null
}

export const userDB = {
  create(username: string): User {
    const stmt = db.prepare(
      'INSERT INTO users (username) VALUES (?)'
    )
    const result = stmt.run(username)
    return {
      id: Number(result.lastInsertRowid),
      username,
      created_at: new Date().toISOString(),
    }
  },

  findByUsername(username: string): User | null {
    const stmt = db.prepare(
      'SELECT id, username, created_at FROM users WHERE username = ?'
    )
    const row = stmt.get(username) as User | undefined
    return row ?? null
  },

  findById(id: number): User | null {
    const stmt = db.prepare(
      'SELECT id, username, created_at FROM users WHERE id = ?'
    )
    const row = stmt.get(id) as User | undefined
    return row ?? null
  },

  createAuthenticator(data: CreateAuthenticatorData): Authenticator {
    const stmt = db.prepare(
      `INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports)
       VALUES (?, ?, ?, ?, ?)`
    )
    const result = stmt.run(
      data.user_id,
      data.credential_id,
      data.credential_public_key,
      data.counter,
      data.transports
    )
    return {
      id: Number(result.lastInsertRowid),
      user_id: data.user_id,
      credential_id: data.credential_id,
      credential_public_key: data.credential_public_key,
      counter: data.counter,
      transports: data.transports,
      created_at: new Date().toISOString(),
    }
  },

  findAuthenticatorsByUserId(userId: number): Authenticator[] {
    const stmt = db.prepare(
      'SELECT id, user_id, credential_id, credential_public_key, counter, transports, created_at FROM authenticators WHERE user_id = ?'
    )
    const rows = stmt.all(userId) as AuthenticatorRow[]
    return rows
  },

  findAuthenticatorByCredentialId(credentialId: string): Authenticator | null {
    const stmt = db.prepare(
      'SELECT id, user_id, credential_id, credential_public_key, counter, transports, created_at FROM authenticators WHERE credential_id = ?'
    )
    const row = stmt.get(credentialId) as AuthenticatorRow | undefined
    return row ?? null
  },

  updateAuthenticatorCounter(id: number, counter: number): void {
    const stmt = db.prepare(
      'UPDATE authenticators SET counter = ? WHERE id = ?'
    )
    stmt.run(counter, id)
  },
}
