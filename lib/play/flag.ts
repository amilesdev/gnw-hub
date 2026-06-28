// Soft on/off switch for the whole GNW Play feature. UI-only: hides the Play
// tab (navConfig) and 404s the /play screens (app/play/layout.tsx). All Play
// code, DB models, and API routes stay in place — flip the env var to bring it
// back. Set NEXT_PUBLIC_PLAY_ENABLED="false" (in .env.local AND Vercel) to
// disable; anything else (or unset) leaves Play enabled.
//
// Must be NEXT_PUBLIC_* so client components (TabBar via navConfig) can read it.
export const PLAY_ENABLED = process.env.NEXT_PUBLIC_PLAY_ENABLED !== 'false';
