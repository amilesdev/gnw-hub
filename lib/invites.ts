import { randomToken } from '@/lib/utils';

export const INVITE_TTL_HOURS = 48;

export function newInviteToken() {
  const inviteToken = randomToken(24);
  const inviteExpiry = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  return { inviteToken, inviteExpiry };
}

export function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/invite?token=${token}`;
}

export function isInviteExpired(inviteExpiry: Date | null): boolean {
  if (!inviteExpiry) return true;
  return inviteExpiry.getTime() < Date.now();
}
