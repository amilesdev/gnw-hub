import { notFound } from 'next/navigation';
import { Archivo, Space_Grotesk, Outfit, Baloo_2 } from 'next/font/google';
import { PLAY_PREVIEW_ENABLED } from '@/lib/play/flag';
import { PlayPreviewGallery, type FontChoice } from '@/components/play/PlayPreviewGallery';

// Dev-only gallery of every GNW Play screen, rendered from the real components
// with mock data (lib/play/preview-fixtures). Deliberately NOT under /play: that
// route group is gated by PLAY_ENABLED, and the whole point of this page is to
// review the screens while Play is still switched off.
//
// No auth check by design — it reads nothing and writes nothing, and it 404s in
// any production build unless NEXT_PUBLIC_PLAY_PREVIEW is explicitly set.

// No `metadata` export on purpose: it is evaluated before the notFound() guard,
// so a title here would show up in the <head> of the 404 page in production.

// --- Display-face candidates ------------------------------------------------
// Loaded HERE rather than in the root layout, so these extra faces ship only
// with this dev route and never reach the real app. Each publishes its own var;
// the gallery points --font-play at whichever is selected, which re-skins every
// Play screen live (globals.css remaps .font-display to --font-play inside
// html.play-active).

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-cand-archivo',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cand-space',
  display: 'swap',
});
// Variable range, matching how layout.tsx ships it — so the audition is
// faithful (static cuts would synthesise the font-black answer chips).
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-cand-outfit',
  display: 'swap',
});
const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-cand-baloo',
  display: 'swap',
});

const FONTS: FontChoice[] = [
  { id: 'outfit', name: 'Outfit', note: 'Clean geometric, modern game UI. The shipped face.', varName: '--font-cand-outfit' },
  { id: 'archivo', name: 'Archivo', note: 'Athletic grotesque — scoreboard, jersey.', varName: '--font-cand-archivo' },
  { id: 'space', name: 'Space Grotesk', note: 'Techy arcade, quirky details. Cooler, more machine.', varName: '--font-cand-space' },
  { id: 'baloo', name: 'Baloo 2', note: 'Rounded and warm — softer, closest to the original brief.', varName: '--font-cand-baloo' },
  { id: 'fraunces', name: 'Fraunces (Hub serif)', note: 'The current Hub face, for comparison.', varName: '--font-fraunces' },
];

export default async function PlayPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  if (!PLAY_PREVIEW_ENABLED) notFound();
  const { scene } = await searchParams;
  return (
    <div className={`${archivo.variable} ${spaceGrotesk.variable} ${outfit.variable} ${baloo.variable}`}>
      <PlayPreviewGallery initialSceneId={scene ?? null} fonts={FONTS} />
    </div>
  );
}
