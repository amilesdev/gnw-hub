# GNW Worship Hub

A role-gated, mobile-first ministry communication app for the GNW praise & worship team.
One codebase, two experiences — **member** and **leader** — on one Supabase project and one
Vercel deployment.

Built with **Next.js 15 (App Router) · TypeScript · Prisma · Supabase (Postgres + Storage) ·
NextAuth (credentials) · Resend · Tailwind**. All UI follows the GNW design system in
[`../Docs/GNW-Apps-Hub.md`](../Docs/GNW-Apps-Hub.md) — warm cream page, sage-green accent, crisp
white cards, paper grain.

---

## Feature map (by phase)

| Phase | What | Key routes / files |
|---|---|---|
| 1 | Invite-only auth + role gating | `app/login`, `app/invite`, `app/signup`, `middleware.ts`, `app/api/members/*`, `app/api/invite/*` |
| 2 | Events, recurring occurrences, Holy Talks, attire + photos | `app/api/events/*`, `components/leader/EventForm.tsx`, `components/shared/EventDetail.tsx`, `AttireModal.tsx` |
| 3 | Setlists, per-song audio slots, drag reorder, in-app player | `app/api/setlists/*`, `app/api/songs/*`, `components/leader/SetlistForm.tsx`, `components/shared/AudioPlayer.tsx` |
| 4 | Announcements (10-day max expiry, auto-expiry), bell + badge | `app/api/announcements/*`, `components/shared/AnnouncementBell.tsx` |
| 5 | Member home (greeting, upcoming, this-week setlist, announcements), empty states w/ KJV verse, profile | `app/home/*`, `components/member/MemberHome.tsx`, `lib/bible.ts` |
| 6 | Leader dashboard (quick actions, alerts, members management) | `app/dashboard/*`, `components/leader/LeaderHome.tsx`, `MembersManager.tsx` |

Folder layout follows the brief: `app/dashboard` (leader), `app/home` (member), `app/api`
(backend), and `components/{leader,member,shared}`.

---

## Local setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` → `.env.local` and fill in real values:

- **Supabase** — create a project. Grab the pooled `DATABASE_URL` (port 6543) and direct
  `DIRECT_URL` (port 5432) from *Project Settings → Database*, plus the project URL, anon key,
  and service-role key from *Project Settings → API*.
- **Storage** — create a **public** bucket named `gnw-media` (or change `SUPABASE_STORAGE_BUCKET`).
  Attire photos land under `attire/...`, audio under `audio/{month}/{song}/{part}`.
- **NextAuth** — set `NEXTAUTH_SECRET` (`openssl rand -base64 32`) and `NEXTAUTH_URL`.
- **Resend** — add `RESEND_API_KEY` and a verified `EMAIL_FROM`. *Without a key, invite emails are
  skipped and the invite link is logged to the server console — handy for local dev.*
- **Super admin** — `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` seed the only account that can grant
  the **leader** role.

### 3. Run migrations & seed

```bash
npm run db:migrate      # prisma migrate dev  (creates tables from the committed migration)
npm run db:seed         # creates the super-admin (leader) from your env
```

### 4. Start

```bash
npm run dev             # http://localhost:3000
```

Sign in with your `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`. As the super-admin you can invite
members and leaders from **Members**. Invited members claim their account at
`/invite?token=...` (48-hour expiry), set a password, and land on the member home.

---

## How auth & roles work

- **No public signup.** `/signup` is an invite-only notice; the only way in is a valid invite token.
- `middleware.ts` guards `/home/*` and `/dashboard/*`. Unauthenticated users go to `/login`;
  members who hit a `/dashboard` route are redirected to `/home`.
- Only the **super-admin** may grant the `leader` role; all other invites default to `member`.

## Notes for future work

The schema and structure leave room for the roadmap items: RSVP on events, push notifications,
attendance-tracker integration, and merging into a broader GNW leadership dashboard. Events carry a
`seriesId` so recurring occurrences stay independently editable while still groupable.

## Deploy (Vercel)

1. Push to a Git repo and import into Vercel.
2. Add all `.env.local` keys as Vercel environment variables (set `NEXTAUTH_URL` /
   `NEXT_PUBLIC_APP_URL` to the production URL).
3. Build command runs `prisma generate && next build`. Run `prisma migrate deploy` against the
   production database (e.g. as a deploy step or once via the Supabase SQL editor using
   `prisma/migrations/0_init/migration.sql`).
