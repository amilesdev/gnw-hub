import type { Role, MemberPart, MemberSection } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role: Role;
    section?: MemberSection | null;
    part?: MemberPart | null;
    image?: string | null;
    isSuperAdmin: boolean;
    vocalDirector: boolean;
    adminAssistant: boolean;
    tokenVersion: number;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      section?: MemberSection | null;
      part?: MemberPart | null;
      isSuperAdmin: boolean;
      // Narrow capability, not a role — see lib/access.ts → canEditVocalParts.
      vocalDirector: boolean;
      // Ditto — see lib/access.ts → canEditLyricCharts.
      adminAssistant: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    tokenVersion: number;
  }
}
