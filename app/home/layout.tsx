import { AppShell } from '@/components/shared/AppShell';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="member">{children}</AppShell>;
}
