/**
 * iOS launch screens for the installed app, so opening it shows the GNW
 * wordmark instead of a blank screen while the first page loads. Files come from
 * scripts/generate-splash.mjs — keep the two lists in step.
 */
const SPLASH_SCREENS: [width: number, height: number, dpr: number][] = [
  [440, 956, 3], [420, 912, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3],
  [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
];

export const splashStartupImages = SPLASH_SCREENS.flatMap(([w, h, dpr]) =>
  (['light', 'dark'] as const).map((theme) => ({
    url: `/splash/${theme}-${w * dpr}x${h * dpr}.png`,
    media:
      `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) ` +
      `and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
  })),
);
