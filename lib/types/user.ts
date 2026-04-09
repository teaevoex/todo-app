export interface User {
  id: number
  username: string
  created_at: string
}

export interface Session {
  userId: number
  username: string
}

export interface Authenticator {
  id: number
  user_id: number
  credential_id: string
  credential_public_key: string
  counter: number
  transports: string | null
  created_at: string
}
