/**
 * The house backdrop for the results stage.
 *
 * Flat black behind the podium reads as an empty slot rather than as a room, so
 * the stage takes an optional still or short loop underneath it. This is the
 * one place that changes when the art arrives: drop the file in
 * `public/play/` and point `src` at it.
 *
 *   export const STAGE_BACKDROP: StageBackdrop = {
 *     src: '/play/house.mp4',
 *     kind: 'video',
 *     poster: '/play/house.jpg',   // optional; the first frame while it loads
 *   };
 *
 * With `src: null` the screen falls back to the painted ground
 * (`.play-stage--house` in globals.css) and nothing is fetched. Whatever is
 * supplied is covered by a scrim (`.play-backdrop::after`) before any text sits
 * on it, so a bright clip can't drag the podium below its contrast floor.
 *
 * Keep a loop short and small — it is fetched on a phone at the moment the
 * game ends, competing with the celebration audio. Under ~2MB, 1080×1920 or
 * smaller, no audio track.
 */
export interface StageBackdrop {
  /** Public path to the asset, or null for the painted ground. */
  src: string | null;
  kind?: 'video' | 'image';
  /** Video only: a still shown until the first frame decodes. */
  poster?: string;
}

export const STAGE_BACKDROP: StageBackdrop = {
  src: null,
};
