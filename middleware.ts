import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? ''
)

const PROTECTED_PATHS = ['/', '/calendar']

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip middleware for non-protected paths
  if (!isProtectedPath(pathname) && pathname !== '/login') {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  let isAuthenticated = false

  if (token && process.env.JWT_SECRET) {
    try {
      await jwtVerify(token, JWT_SECRET)
      isAuthenticated = true
    } catch {
      // Invalid or expired token
    }
  }

  // Protected route: redirect to /login if not authenticated
  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Login page: redirect to / if already authenticated
  if (pathname === '/login' && isAuthenticated) {
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
