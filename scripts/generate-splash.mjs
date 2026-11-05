// Generates the iOS launch screens (apple-touch-startup-image) in public/splash/:
// the GNW wordmark centered on the app background, light and dark, one per
// iPhone screen size. iOS only uses a startup image whose size matches the
// device exactly, so every size in SPLASH_SCREENS (lib/splash.ts) needs a file.
//   node scripts/generate-splash.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Keep in step with lib/splash.ts.
const SCREENS = [
  [440, 956, 3], [420, 912, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3],
  [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
];
const THEMES = {
  light: { bg: '#FAF7F2', mark: 'public/wordmark-sage.png' },
  dark: { bg: '#161410', mark: 'public/wordmark-cream.png' },
};

// The wordmark PNGs carry a faint near-transparent box behind the lettering,
// which shows as a visible panel on a solid background. Drop it.
async function cleanMark(file, width) {
  const { data, info } = await sharp(file).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] < 64) data[i] = 0;
  return sharp(data, { raw: info }).png().toBuffer();
}

await mkdir('public/splash', { recursive: true });
for (const [w, h, dpr] of SCREENS) {
  const width = w * dpr;
  const height = h * dpr;
  for (const [theme, { bg, mark }] of Object.entries(THEMES)) {
    const logo = await cleanMark(mark, Math.round(width * 0.78));
    await sharp({ create: { width, height, channels: 3, background: bg } })
      .composite([{ input: logo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(`public/splash/${theme}-${width}x${height}.png`);
  }
}
console.log(`Wrote ${SCREENS.length * 2} launch screens to public/splash/`);
