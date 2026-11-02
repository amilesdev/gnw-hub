import { redirect } from 'next/navigation';

// Suggestions moved inside the Song Library; keep the old address working.
export default function OldLeaderSuggestionsPage() {
  redirect('/dashboard/library/suggestions');
}
