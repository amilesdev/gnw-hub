import { redirect } from 'next/navigation';

// The Library is now a view inside Songs (Setlists | Library); keep the old
// address working for links and pushes.
export default function LeaderLibraryPage() {
  redirect('/dashboard/setlist?view=library');
}
