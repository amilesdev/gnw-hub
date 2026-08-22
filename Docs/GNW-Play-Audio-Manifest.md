# AUDIO ASSET MANIFEST — GNW Play

Place files in `GNW-Hub/public/sounds/` (filenames exact, lowercase `.mp3`).
Played via `lib/play/audio.ts`; missing files are silent (no errors).

---

Filename: lobby-music-*.mp3  (a playlist — any number of files with this prefix)
Used in: Lobby screen (plays while players are waiting)
Description: Upbeat, energetic background music. Should feel hype/anticipatory.
Think: game show lobby, fun and social energy.
Note: the lobby shuffles these and crossfades one into the next, so it never
falls silent and never plays the same order twice. To add or remove a track,
drop the file in `public/sounds/` and edit `LOBBY_TRACKS` in `lib/play/audio.ts`
(the list is hardcoded — `public/` isn't enumerable at runtime).
Current tracks: fill-the-room, great-jehovah, joy-is-coming, open-the-eyes, praise.

Filename: celebration-music.mp3
Used in: Results screen (plays during podium animation)
Description: Victory fanfare / celebration track. Big, triumphant, joyful.

Filename: podium-land.mp3
Used in: Each avatar landing on a podium platform
Description: Cartoony "thud" or "boing". Short (< 1s). Plays 3 times with a slight stagger.

Filename: countdown-tick.mp3
Used in: Start of each question (subtle cue as the timer begins)
Description: Subtle tick/click. Non-distracting.

Filename: countdown-final.mp3
Used in: Last 3 seconds of the question timer (once per second)
Description: More urgent tick. Heightened tension.

Filename: answer-correct.mp3
Used in: Reveal — plays for players who answered correctly
Description: Positive chime / ding. Short, satisfying.

Filename: answer-wrong.mp3
Used in: Reveal — plays for players who answered wrong (or didn't answer)
Description: Classic wrong-answer buzzer. Humorous, not harsh.

Filename: elimination.mp3
Used in: Survival — when the local player is eliminated
Description: Dramatic "out" sound. Game-show elimination; deflating/falling energy.

Filename: heart-lost.mp3
Used in: Survival — when the local player loses a heart (but isn't out)
Description: Short negative sound. Distinct from elimination.

Filename: round-end.mp3
Used in: End of each question, the moment results are revealed
Description: Short suspenseful sting. "And the answer is…"

Filename: game-start.mp3
Used in: 3-2-1 countdown when the host starts the game (fires from the lobby)
Description: Energetic countdown sound. Builds excitement.
**This one is timed against the visuals — see the spec below.**

---

## game-start.mp3 — timing spec

The 3-2-1 numerals are driven by this file's own playhead, not by a timer, so
whatever the file does, the numbers land on it. That means the file leads and
the visuals follow — but only if the beat times in the code match the file.

**Shipped and verified.** The file is authored at 0/1/2/3s — measured spacing
1.002 / 1.004 / 0.978s — and the on-screen numerals land within one frame of
each hit.

### The 26ms you will not find in the source file

The delivered MP3 carries **~26ms of encoder padding at the head** and has no
LAME/Xing gapless header, so no decoder strips it. Every transient therefore
*sounds* 26ms later than the time it was authored at. Measured attack points off
the decoded waveform:

| Authored | Actually sounds at | Screen                |
|----------|--------------------|-----------------------|
| 0.000    | **0.026**          | **3** appears         |
| 1.000    | **1.025**          | **2**                 |
| 2.000    | **2.026**          | **1**                 |
| 3.000    | **3.031**          | **Go**                |
| —        | 3.944              | → the first question  |
| —        | ~4.00              | audio decays out      |

`COUNT_BEATS_S` / `GO_AT_S` in `Lobby.tsx` hold the measured column, not the
authored one. **Re-exporting the file means re-measuring**: an encoder that
writes a gapless header strips that padding, and these values would then fire
26ms early instead of on time.

Authoring notes:

- **No leading silence.** The first hit must be at sample 0. Any silence at the
  head shifts every beat and the numbers arrive early.
- **A tail past 3.000 is welcome.** Playback is not stopped when the screen
  changes at 3.900, so a 0.5–1.5s decay rings out over the first question and
  carries the player in. Total file length of ~4.5s is ideal.
- **Make the 3.000 hit the biggest.** It's the "Go", and it's the only beat with
  a full 900ms of screen time behind it.
- Peak around −1 dBFS. It plays at full volume, unlike the ducked cues.

**The spacing does not have to be even.** An accelerating countdown (say hits at
0.000 / 0.900 / 1.650 / 2.250) is more exciting and fully supported — it just
means retuning two constants at the top of `Lobby.tsx`:

```ts
const COUNT_BEATS_S = [0, 0.9, 1.65];  // when "3", "2", "1" appear
const GO_AT_S = 2.25;                  // when "Go" appears
```

Ship the file with whatever timing you like and say what it is; if it's easier,
drop it in as-is and the onsets can be measured off the decoded audio and the
array set from that.

**Coupling to watch:** the server broadcasts `{ type: 'GAME_STARTING',
countdown: 3 }`, but that number now only means "start" — the array above is
what decides how many numerals appear. Adding a fourth numeral means adding a
fourth entry *and* a fourth hit in the file.

---

## Sizes

Every cue is preloaded before it's needed (`preloadSfx` in `lib/play/audio.ts`),
so file size costs first-load bandwidth on a member's phone, not sync.

- SFX stings: keep under ~100 KB each. All current ones are.
- The `lobby-music-*` tracks are 2.5–4.7 MB each (~18 MB total), but only two
  are ever fetched: the one playing and the one after it. A lobby rarely lasts
  past the second track, so a phone downloads ~8 MB at worst, not the set.
  They do all live in git forever, though — trimming each to a 60–90s excerpt at
  128 kbps would cut the repo weight without changing what anyone hears.

---

## Additional SFX implemented beyond the original list
None added — the implementation uses exactly the cues above. (The per-second
question tick is split between `countdown-tick` at the start and
`countdown-final` for the last 3 seconds, as specified.)
