import { withAuth } from 'next-auth/middleware';

// NextAuth middleware guards all app routes: unauthenticated users are sent to
// /login. Role gating is NOT done here — the JWT no longer carries `role` (it's
// re-read live in the session callback), so the /dashboard/* layout is the
// authoritative leader gate. Checking token.role here would always fail
// (undefined !== 'leader') and wrongly bounce every leader, superadmin included,
// to /home.
export default withAuth(
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
