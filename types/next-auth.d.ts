import type { Role, MemberPart, MemberSection } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role: Role;
    section?: MemberSection | null;
    part?: MemberPart | null;
    isSuperAdmin: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      section?: MemberSection | null;
      part?: MemberPart | null;
      isSuperAdmin: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    role: Role;
    section?: MemberSection | null;
    part?: MemberPart | null;
    isSuperAdmin: boolean;
  }
}
