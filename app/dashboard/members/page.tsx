import { redirect } from 'next/navigation';

// Members is consolidated into the Settings tab for leaders.
export default function LeaderMembersRedirect() {
  redirect('/dashboard/settings');
}
