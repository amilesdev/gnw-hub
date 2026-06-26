import { redirect } from 'next/navigation';

// Profile is consolidated into the Settings tab for leaders.
export default function LeaderProfileRedirect() {
  redirect('/dashboard/settings');
}
