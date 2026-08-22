# GNW Play — Audio assets

MP3s live directly in this folder, lowercase, named exactly as below. They're
loaded by `lib/play/audio.ts`; a missing file is silent for that cue and never
throws, so the game runs either way.

See `Docs/GNW-Play-Audio-Manifest.md` for what each cue is, and for the
**timing spec on `game-start.mp3`**, which is authored against the on-screen
3-2-1 rather than played over it.

## Status — all 11 cues shipped

- [x] lobby-music-*.mp3 — the lobby playlist (5 tracks; see note below)
- [x] celebration-music.mp3
- [x] podium-land.mp3
- [x] countdown-tick.mp3
- [x] countdown-final.mp3
- [x] answer-correct.mp3
- [x] answer-wrong.mp3
- [x] elimination.mp3
- [x] heart-lost.mp3
- [x] round-end.mp3
- [x] game-start.mp3 — hits at 0/1/2/3s (see the timing note in the manifest)

## Notes

- Files must sit in `public/sounds/` itself, not a subfolder. `audio.ts` asks
  for `/sounds/<name>.mp3` exactly.
- MP3 only. WAV works in a browser but is roughly ten times the size for no
  audible gain at these lengths.
- The `lobby-music-*` files are a playlist, not a cue: the lobby shuffles them
  and crossfades each into the next so there's no silence between tracks. The
  filenames are listed in `LOBBY_TRACKS` in `lib/play/audio.ts` — adding or
  renaming a track means editing that array too, since `public/` can't be
  listed at runtime.
- Cues are preloaded ahead of when they're needed — the countdown cue on lobby
  mount, the round cues on live-game mount — so a cold first play never lands
  behind its visual.
