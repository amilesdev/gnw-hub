'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/components/shared/AuthCard';
import { TextField } from '@/components/shared/Field';
import { apiFetch } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // The endpoint always resolves ok (no account enumeration); show the same
      // confirmation either way.
      await apiFetch('/api/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      /* still show the neutral confirmation */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={`If an account exists for ${email || 'that address'}, we’ve sent a link to reset your password. It expires in an hour.`}
      >
        <Link href="/login" className="btn-ghost w-full">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot password?" subtitle="Enter your email and we’ll send a reset link.">
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          enterKeyHint="go"
        />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="font-semibold text-accent-ink dark:text-accent-on">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
