import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// NextAuth middleware guards all app routes. Members who try to reach
// /dashboard are bounced to /home. Unauthenticated users are sent to /login.
export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Leader-only area.
    if (pathname.startsWith('/dashboard') && token?.role !== 'leader') {
      return NextResponse.redirect(new URL('/home', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      // Returning true => authorized. Only gate the protected app areas here;
      // public routes (login, invite, signup) are excluded via the matcher.
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: '/login' },
  },
);

export const config = {
  // Protect the app areas. Public: /login, /invite, /signup, /api/auth, assets.
  matcher: ['/home/:path*', '/dashboard/:path*'],
};
