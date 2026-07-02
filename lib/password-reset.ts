import { randomToken } from '@/lib/utils';

// Reset links are short-lived and single-use — much tighter than the 48h invite
// window since the account already exists and email is the only factor.
export const RESET_TTL_MINUTES = 60;

export function newResetToken() {
  const resetToken = randomToken(24);
  const resetExpiry = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
  return { resetToken, resetExpiry };
}

export function resetUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/reset-password?token=${token}`;
}

export function isResetExpired(resetExpiry: Date | null): boolean {
  if (!resetExpiry) return true;
  return resetExpiry.getTime() < Date.now();
}
