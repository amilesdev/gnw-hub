// Soft on/off switch for the whole GNW Play feature. UI-only: hides the Play
// tab (navConfig) and 404s the /play screens (app/play/layout.tsx). All Play
// code, DB models, and API routes stay in place — flip the env var to bring it
// back. Set NEXT_PUBLIC_PLAY_ENABLED="false" (in .env.local AND Vercel) to
// disable; anything else (or unset) leaves Play enabled.
//
// Must be NEXT_PUBLIC_* so client components (TabBar via navConfig) can read it.
export const PLAY_ENABLED = process.env.NEXT_PUBLIC_PLAY_ENABLED !== 'false';

// Separate switch for the dev-only screen gallery at /play-preview. It lives
// OUTSIDE the /play route group on purpose, so every Play screen can be reviewed
// while PLAY_ENABLED is still false. On by default in local dev; off in any
// production build unless NEXT_PUBLIC_PLAY_PREVIEW="true" is set explicitly
// (set it on a Vercel Preview deploy to review on a real device — never on
// Production).
export const PLAY_PREVIEW_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_PLAY_PREVIEW === 'true';
