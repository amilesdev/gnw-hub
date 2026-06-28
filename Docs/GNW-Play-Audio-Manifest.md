# AUDIO ASSET MANIFEST — GNW Play

Place files in `GNW-Hub/public/sounds/` (filenames exact, lowercase `.mp3`).
Played via `lib/play/audio.ts`; missing files are silent (no errors).

---

Filename: lobby-music.mp3
Used in: Lobby screen (loops while players are waiting)
Description: Upbeat, energetic background music. Should feel hype/anticipatory.
Think: game show lobby, fun and social energy.

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

---

## Additional SFX implemented beyond the original list
None added — the implementation uses exactly the cues above. (The per-second
question tick is split between `countdown-tick` at the start and
`countdown-final` for the last 3 seconds, as specified.)
