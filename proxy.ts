import { NextResponse, type NextRequest } from 'next/server';

// Optimistic check only: the session token is verified in the dashboard layout
// and in every Server Action (lib/session.ts).
export function proxy(request: NextRequest) {
  if (request.cookies.has('kg_session')) return NextResponse.next();
  const url = new URL('/login', request.url);
  url.searchParams.set(
    'next',
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
