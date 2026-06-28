'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser-only anon client. Used ONLY for Supabase Realtime (Broadcast +
// Presence) on the Play game channel — never for data reads/writes, which all
// go through authenticated Next.js API routes. Realtime Broadcast works with the
// public anon key independent of Hub's NextAuth session.
let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}
