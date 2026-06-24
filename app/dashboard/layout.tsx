import { AppShell } from '@/components/shared/AppShell';

export default function LeaderLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="leader">{children}</AppShell>;
}
