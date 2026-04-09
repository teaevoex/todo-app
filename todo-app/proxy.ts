import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/', '/calendar'];

export function proxy(request: NextRequest) {
  const session = request.cookies.get('todo-app-session')?.value;
  const { pathname } = request.nextUrl;

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (PROTECTED_PATHS.includes(pathname) && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar', '/login'],
};
