import Link from 'next/link';
import { AuthCard } from '@/components/shared/AuthCard';

// No public signup exists — access is invite-only. (Phase 1.)
export default function SignupPage() {
  return (
    <AuthCard title="Invite only" subtitle="There’s no public signup for the GNW Hub.">
      <p className="text-ink-soft">
        Membership is granted by invitation. Ask a worship leader to send you an invite, then claim it
        from the link in your email.
      </p>
      <Link href="/login" className="btn-primary mt-6 w-full">
        Go to sign in
      </Link>
    </AuthCard>
  );
}
