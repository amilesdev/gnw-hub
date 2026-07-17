import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

// An invalidated session: keep only `expires` so getServerSession returns
// something well-formed, but with no `user` — every guard (getSessionUser,
// requireUser/Leader) then treats the caller as signed-out. Used when the
// account was removed, deactivated, or its token version was bumped.
function invalidSession(session: Session): Session {
  return { expires: session.expires } as unknown as Session;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        // Only active users with a password may log in.
        if (!user || user.status !== 'active' || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          section: user.section,
          part: user.part,
          image: user.image,
          isSuperAdmin: user.isSuperAdmin,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Only identity + the revocation stamp are frozen into the JWT at
        // sign-in. Everything else (role, part, name) is re-read live in the
        // session callback, so leader edits and revocations take effect at once.
        token.uid = user.id;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
    async session({ session, token }) {
      const uid = token.uid as string | undefined;
      if (!uid) return invalidSession(session);

      // Re-validate the account on every session resolve (one PK lookup). This
      // is what makes removal/deactivation and role changes effective within a
      // request instead of lingering for the ~30-day JWT lifetime.
      const fresh = await prisma.user.findUnique({
        where: { id: uid },
        select: {
          status: true,
          tokenVersion: true,
          role: true,
          section: true,
          part: true,
          name: true,
          image: true,
          isSuperAdmin: true,
        },
      });

      const tokenVersion = typeof token.tokenVersion === 'number' ? token.tokenVersion : 0;
      if (!fresh || fresh.status !== 'active' || fresh.tokenVersion !== tokenVersion) {
        return invalidSession(session);
      }

      if (session.user) {
        session.user.id = uid;
        session.user.name = fresh.name;
        session.user.role = fresh.role as Role;
        session.user.section = fresh.section ?? null;
        session.user.part = fresh.part ?? null;
        session.user.image = fresh.image ?? null;
        session.user.isSuperAdmin = fresh.isSuperAdmin;
      }
      return session;
    },
  },
};
