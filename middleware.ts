import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { HOME_HINT_COOKIE, isHomeHint } from '@/lib/home-hint';

// NextAuth middleware guards all app routes: unauthenticated users are sent to
// /login. Role gating is NOT done here — the JWT no longer carries `role` (it's
// re-read live in the session callback), so the /dashboard/* layout is the
// authoritative leader gate. Checking token.role here would always fail
// (undefined !== 'leader') and wrongly bounce every leader, superadmin included,
// to /home.
export default withAuth(
  function middleware(req) {
    // App launch (the manifest's start_url is "/"): send a signed-in person
    // straight to the home they last used, here at the edge, instead of waking a
    // server function only to be redirected. The cookie just picks the URL —
    // that home's layout still checks the account and role.
    if (req.nextUrl.pathname === '/') {
      const home = req.cookies.get(HOME_HINT_COOKIE)?.value;
      if (isHomeHint(home)) return NextResponse.redirect(new URL(home, req.url));
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
  // "/" is here only for the launch shortcut above (it redirects either way).
  matcher: ['/', '/home/:path*', '/dashboard/:path*'],
};
