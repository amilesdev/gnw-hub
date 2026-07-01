'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/shared/AuthCard';
import { TextField } from '@/components/shared/Field';
import { PasswordField } from '@/components/shared/PasswordField';
import { Skeleton, SkeletonList } from '@/components/shared/Skeleton';
import { apiFetch } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';

type ValidState =
  | { kind: 'loading' }
  | { kind: 'valid'; name: string; email: string }
  | { kind: 'invalid'; reason: 'expired' | 'invalid' | 'missing' };

function InviteFlow() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<ValidState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid', reason: 'missing' });
      return;
    }
    (async () => {
      try {
        const data = await apiFetch<{ valid: boolean; name?: string; email?: string }>(
          `/api/invite/validate?token=${encodeURIComponent(token)}`,
        );
        if (data.valid) setState({ kind: 'valid', name: data.name!, email: data.email! });
        else setState({ kind: 'invalid', reason: 'invalid' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        setState({ kind: 'invalid', reason: msg.includes('expired') ? 'expired' : 'invalid' });
      }
    })();
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const { email } = await apiFetch<{ email: string }>('/api/invite/claim', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirm }),
      });
      haptics.success();
      // Auto sign-in then land on member home.
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        router.push('/login');
        return;
      }
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <AuthCard title="Checking your invite…">
        <SkeletonList>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-[3.375rem] w-full rounded-2xl" />
            </div>
          ))}
          <Skeleton className="h-[3.375rem] w-full rounded-2xl" />
        </SkeletonList>
      </AuthCard>
    );
  }

  if (state.kind === 'invalid') {
    const copy =
      state.reason === 'expired'
        ? 'This invite link has expired. Reach out to your worship leader for a fresh invite.'
        : 'This invite link isn’t valid. Reach out to your worship leader for a new one.';
    return (
      <AuthCard title="Invite unavailable" subtitle={copy}>
        <Link href="/login" className="btn-ghost w-full">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={`Welcome, ${state.name.split(' ')[0]}`} subtitle="Set a password to finish joining the team.">
      <form onSubmit={onSubmit} className={error ? 'animate-shake space-y-4' : 'space-y-4'}>
        <TextField label="Name" value={state.name} disabled readOnly />
        <TextField label="Email" value={state.email} disabled readOnly />
        <PasswordField
          label="Create password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          enterKeyHint="next"
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          enterKeyHint="go"
        />
        {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Setting up…' : 'Join the team'}
        </button>
      </form>
    </AuthCard>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteFlow />
    </Suspense>
  );
}
