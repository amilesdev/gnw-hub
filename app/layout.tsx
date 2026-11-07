import type { Metadata, Viewport } from 'next';
import { Albert_Sans, Literata, Outfit } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';
import { ThemeScript } from '@/components/shared/ThemeProvider';
import { splashStartupImages } from '@/lib/splash';

// 3a type: Literata for titles, numerals, verse and lyrics; Albert Sans for
// everything else. Both are variable fonts, so no `weight` array; Literata
// keeps its optical-size axis so a 36px title and 17px lyrics each get the
// right cut. globals.css builds --font-display / --font-ui from these.
const albertSans = Albert_Sans({
  subsets: ['latin'],
  variable: '--font-albert',
  display: 'swap',
});

const literata = Literata({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-literata',
  display: 'swap',
});

// GNW Play's display face — used ONLY past the Enter gate (see the
// `html.play-active .font-display` remap in globals.css). The Hub keeps
// Literata, so crossing the gate is a genuine change of world.
//
// Register is confident and geometric, NOT toy — a rounded/bouncy face read as
// goofy here. Outfit is a geometric sans that stays clean at display sizes and
// gets genuinely heavy for scores and answers.
// No `weight` array: Outfit is a variable font, so this ships the whole 100–900
// range in one file (smaller than several static cuts) and lets the answer
// letter chips use font-black without synthesising a fake bold.
// Alternatives can be auditioned live at /play-preview.
const playDisplay = Outfit({
  subsets: ['latin'],
  variable: '--font-play',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'GNW Hub',
  description: 'Communication hub for the GNW team.',
  applicationName: 'GNW Hub',
  manifest: '/manifest.webmanifest',
  // `default` status bar (tinted to match via theme-color) keeps the layout inside
  // the safe area so the bottom nav sits flush — matches the proven GNW Roll Call setup.
  // startupImage: the launch screen shown while the installed app opens (lib/splash).
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GNW Hub', startupImage: splashStartupImages },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Shrink the layout viewport when the soft keyboard opens instead of letting it
  // overlay content, so focused inputs and submit buttons stay on-screen.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF0E3' },
    { media: '(prefers-color-scheme: dark)', color: '#1B1D16' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // ThemeScript adds the theme class to <html> before React loads, so the
    // server's className never matches in dark mode; that difference is expected.
    <html lang="en" className={`${albertSans.variable} ${literata.variable} ${playDisplay.variable}`} suppressHydrationWarning>
      <body>
        <ThemeScript />
        {/* Tints the iOS status strip to match the top of the wash (globals.css). */}
        <div className="status-tint" aria-hidden />
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
