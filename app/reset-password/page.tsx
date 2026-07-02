'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/shared/AuthCard';
import { PasswordField } from '@/components/shared/PasswordField';
import { Skeleton, SkeletonList } from '@/components/shared/Skeleton';
import { apiFetch } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';

type ValidState =
  | { kind: 'loading' }
  | { kind: 'valid' }
  | { kind: 'invalid'; reason: 'expired' | 'invalid' | 'missing' };

function ResetFlow() {
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
        const data = await apiFetch<{ valid: boolean }>(
          `/api/password/validate?token=${encodeURIComponent(token)}`,
        );
        setState(data.valid ? { kind: 'valid' } : { kind: 'invalid', reason: 'invalid' });
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
      const { email } = await apiFetch<{ email: string }>('/api/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirm }),
      });
      haptics.success();
      // Sign in with the new password (this fresh JWT carries the bumped token
      // version; any old sessions are already invalid).
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        router.push('/login');
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <AuthCard title="Checking your link…">
        <SkeletonList>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-[3.375rem] w-full rounded-2xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-[3.375rem] w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[3.375rem] w-full rounded-2xl" />
        </SkeletonList>
      </AuthCard>
    );
  }

  if (state.kind === 'invalid') {
    const copy =
      state.reason === 'expired'
        ? 'This reset link has expired. Request a fresh one from the sign-in screen.'
        : 'This reset link isn’t valid. Request a new one from the sign-in screen.';
    return (
      <AuthCard title="Link unavailable" subtitle={copy}>
        <Link href="/forgot-password" className="btn-primary w-full">
          Request a new link
        </Link>
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-semibold text-accent-ink dark:text-accent-on">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a new password to finish resetting your account.">
      <form onSubmit={onSubmit} className={error ? 'animate-shake space-y-4' : 'space-y-4'}>
        <PasswordField
          label="New password"
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
          {busy ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetFlow />
    </Suspense>
  );
}
