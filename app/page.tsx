import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';

export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect(user.role === 'leader' ? '/dashboard' : '/home');
}
