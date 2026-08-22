import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces, Outfit } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';
import { ThemeScript } from '@/components/shared/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

// GNW Play's display face — used ONLY past the Enter gate (see the
// `html.play-active .font-display` remap in globals.css). The Hub keeps
// Fraunces, so crossing the gate is a genuine change of world.
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
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GNW Hub' },
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
    { media: '(prefers-color-scheme: light)', color: '#FAF7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#161410' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${playDisplay.variable}`}>
      <body>
        <ThemeScript />
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
