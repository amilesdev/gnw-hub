import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { CallRoom } from '@/components/call/CallRoom';

export const dynamic = 'force-dynamic';

// A single call room. Full-screen (outside the AppShell) — the client component
// requests its own join token and connects to LiveKit. Any authenticated user
// may join an active call this pass.
export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const { id } = await params;

  return <CallRoom callId={id} />;
}
