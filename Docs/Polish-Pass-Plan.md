# Polish Pass — make GNW Hub feel like an app, not a website

Status: **built on branch `polish-pass` (2026-11-05), not committed or deployed yet.** Needs testing on the iPhone (see "Testing checklist" at the bottom).

| Phase | State |
|---|---|
| 1 Quick feel fixes | Done: no long-press selection except `.selectable` content, `touch-action`, hover-only-when-supported, shimmer skeletons |
| Keyboard (added) | Done: nav hides while typing (`KeyboardWatcher` → `html.kb-open`); chat layer only trusts the visual viewport while a field is focused (`components/chat/viewport.ts`) so it can't stick; iOS page shift undone on blur |
| 2 Fast first open | Partly done: edge redirect for `/` via `gnw-home` cookie (`middleware.ts`, `lib/home-hint.ts`), iOS launch screens (`lib/splash.ts`, `scripts/generate-splash.mjs`). **Not done:** a cached app shell / last-seen Home served by the service worker (riskier; see notes). Keep-warm still unverified. |
| 3 Saves show up | Done: `lib/data-changed.ts` event after every write through `apiFetch` (minus chat/Play/calls/push), on foreground after 30s away, and when the SW finds a newer copy of a cached read (`sw.js` v4, `noticeIfChanged`, `writeEpoch` race fix). `DataSync` runs `router.refresh()`; client-copy screens reload quietly. `staleTimes` NOT turned on. |
| 4 Motion | Partly done: overlays slide in/out from the right and own a history entry (system back swipe closes exactly one); tab switches fade (`app/*/template.tsx`). Bottom sheets with drag-to-dismiss not done. |
| 5 Unslop | Waiting on the redesign |

Not possible on the web: hiding the iOS keyboard's ▲▼✓ bar. Only a native wrapper can (Capacitor Keyboard `setAccessoryBarVisible(false)`).

## What Alonzo said feels wrong (in priority order)

1. **Slow first open** — "the biggest one."
2. **Saves don't show up** — sometimes you have to leave a screen and come back to see what you just did.
3. **Tap-and-hold pops the blue text-selection tool**, like a website.
4. Screens appear all at once with no loading state; wants the moving shimmer placeholders.
5. No screen-to-screen motion.

## Skills to use (found via research)

| Skill | Use it for | Install |
|---|---|---|
| **mobile-native** (Emil Kowalski) | Phase 1. Removes the "this is a website" tells on a phone: long-press selection, tap lag, sticky hover, input zoom, overscroll. Exactly our #3. | `npx skills add https://github.com/emilkowalski/skills --skill mobile-native` |
| **apple-design** (Emil Kowalski) | Phase 4. Press feedback, sheets, swipe/drag physics, springs, iOS-style motion. | same repo, `--skill apple-design` |
| **animate / review-animations** (Emil Kowalski) | Phase 4. Builds and checks transitions (timing, curves, reduced motion). | same repo |
| **unslop** (Damir Sokolovsky, 9.3k★) | Phase 5 only. Fixes the AI-generated *look* (colors, spacing, copy). Visual, not feel, so it waits for the redesign. | `github.com/heydamir/unslop` |
| ui-ux-pro-max | Already installed; general UI reference. | — |

Research notes: Reddit threads (r/PWA "small things that reduce browser feel," r/ClaudeDesign anti-slop skills) agree with the mobile-native list: tap highlight, long-press callout, text selection on controls, pull-to-refresh, and :active feedback. A direct X search returned no usable posts.

## Measurements (2026-11-05)

- Vercel functions run in **iad1** and the database is in **us-east-1**, so they're in the same place. Good.
- A warm server answers in about **0.4–0.7s**. The server is not the main problem once it's awake.
- The launch currently works like this: iOS has killed the app in the background (it does this often for home-screen apps), so every open starts from scratch:
  blank screen → `/` server render + session DB check → **redirect** → `/home` server render + session DB check again + data queries → download JS → hydrate.
  None of it is shown from memory, so the first open can take several seconds on cellular, and longer if the server was asleep.
- Only **6 of 60** pages have a loading skeleton. **47** are rebuilt on the server on every visit.
- Couldn't verify: whether the keep-warm GitHub workflow is actually running (needs the `APP_URL` repo variable), or the Vercel project settings (the Vercel connector returned 403 for the `amilesdevs-projects` team).

---

## Phase 1 — Quick feel fixes (small, low risk)

Use the mobile-native skill.

- **Kill the blue selection on long-press**: `user-select: none` + `-webkit-touch-callout: none` on app chrome and controls (nav, buttons, tappable cards, tabs, chips, list rows). **Keep** text selectable where people copy things: chat messages, lyrics/charts, notes, addresses.
- `touch-action: manipulation` on everything tappable, so taps don't wait.
- Turn on Tailwind's `future.hoverOnlyWhenSupported`. There are 27 `hover:` styles, and they stick after a tap on iPhone.
- Give every tappable thing instant press feedback (`:active`, a slight scale/tint). There are 52 `active:` styles today; fill the gaps.
- **Shimmer skeletons**: replace the current `animate-pulse` blocks with the moving sheen. Respect reduced motion.

Done when: long-pressing a button, card, or nav item does nothing, and everything reacts the moment it's touched.

## Phase 2 — Fast first open (the biggest one)

1. **Show something instantly on launch.** The service worker serves a cached app shell (header + bottom nav + home skeleton) the moment the app opens, then the real data streams in. The shell has no personal data, so it's safe to cache.
2. **Remember the last-seen Home on the phone** (per user, wiped on sign-out like the API cache already is). On open, the real Home appears immediately and updates quietly in the background, the way GroupMe or Instagram do.
3. **Remove the redirect hop.** Launch straight to the right home screen instead of `/` → redirect → `/home`.
4. **Login check:** it's already deduped within a request (`getSessionUser` = React `cache()`), so the only double cost is the two requests the redirect causes. Item 3 removes that. Leave the `tokenVersion` kill-switch alone.
5. **Branded launch screen** (`apple-touch-startup-image`) so the open shows the GNW splash instead of a blank cream screen.
6. **Confirm the server stays warm**: the `APP_URL` variable is set and the keep-warm runs show up in GitHub Actions. GitHub's 5-minute schedule is often late, so also check Vercel's "Fluid compute" setting.

Done when: tapping the icon shows Home with real content in well under a second on a warm open, and a skeleton (never blank) on a cold one. Test on the iPhone, installed app, after it's been closed a while.

## Phase 3 — Saves show up immediately

**Cause:** about 23 screens copy their data into local state when they first open (`useState(initialX)`). When the server later sends fresh data, those screens ignore it, so you only see the change after leaving and coming back. A few home reads also sit behind a 60-second server cache.

**Fix:** one shared pattern used everywhere:
- Show the change instantly when you tap Save (optimistic update).
- Send it to the server in the background. If it fails, undo it and show a toast.
- Make screens actually accept fresh server data instead of holding onto their first copy.
- Go screen by screen through the ~23 components (events, setlists, songs, members, announcements, crossover, production, chat, suggestions…). Play is excluded.

**Then:** turn on the client screen cache (`staleTimes`) so going back to a tab you just visited is instant. This has to come **after** the save fix, otherwise it makes the stale-data problem worse. Test carefully: Next.js has a known bug where this setting can freeze a link after a failed load.

Done when: every save shows on screen instantly, and stays correct after switching tabs and back.

## Phase 4 — Motion

Use apple-design + animate, and check with review-animations.

- **Screen transitions**: slide in when drilling down (song detail, event detail, member), and a quick crossfade between bottom tabs. Use the browser's View Transitions where Safari supports it.
- **Bottom sheets** with drag-to-dismiss for menus and quick forms, instead of full pages or centered modals.
- **Swipe back**: iOS already provides edge-swipe back in home-screen apps. Check that it works cleanly with our navigation. Do **not** build a custom one on top: it causes a double-swipe flicker.
- Keep it fast and subtle: under 300ms, transform/opacity only, and nothing on things tapped dozens of times a day.

## Phase 5 — Visual de-slop (after the redesign)

The whole-app Claude Design redesign is still pending (see `Docs/Design-Handoff/`). Running unslop before it would be wasted work. After the redesign lands, run `/unslop` screen by screen.

---

## What stays a web limitation (even after all this)

- iOS closes home-screen apps in the background, so "first open" happens a lot. Phase 2 makes it fast; it can't make iOS keep the app alive.
- No real haptics on iPhone web.
- The status-bar strip stays a flat tint (see the PWA layout notes; don't use `viewport-fit=cover`).
- Wrapping the app for TestFlight/App Store doesn't change any of this. It's the same web pages inside a shell.

## Rules for every phase

- Test on the **real iPhone, as the installed app**. Desktop emulation can't show tap lag, long-press, hover sticking, or launch speed. The dev server can be opened over Wi-Fi (`DEV_LAN_HOST`).
- Don't run `next build` while `npm run dev` is running.
- Play is excluded unless asked.

## Testing checklist (iPhone, installed app)

The service worker only registers in production, so the cache items need a deploy (a Vercel preview of the branch is fine). Restart `npm run dev` first, since `tailwind.config.ts` changed.

- Long-press a button, card, nav tab: no blue selection or callout. Long-press lyrics, event notes, an announcement: still copyable. Long-press a chat bubble: the actions sheet opens with Copy, and no selection.
- Tap a field anywhere: the bottom nav disappears; tap away: it comes back and nothing is shifted up.
- Chat: open the keyboard, then dismiss it (✓, or leave the app with it open and come back). The composer must drop back to the bottom.
- Open an event / song: it slides in from the right. Back button and left-edge swipe both slide it out to the right and land on the screen underneath (not a screen further back). Event → song → swipe back twice = one level each.
- Add a vocal part or lyric chart from a song card, close it: the setlist / event / library behind shows it without leaving the screen.
- Another leader edits a setlist; open the app after 30s+: it shows the change.
- Launch: **delete and re-add the home-screen app** (iOS reads launch screens at install), open it: GNW splash, not a blank screen, in light and dark.
- Tab switches fade; every screen shows a shaped shimmer placeholder while loading.
