# Dial In: sound-matching ear-training game

## 1. Concept

A game for learning synthesis by ear. Each round, the player hears a **target sound** made by a simple built-in synth, then recreates it using the **same synth's controls**. On submit they get a **score from 0 to 100** and **specific feedback** on what was off ("cutoff about one octave too low", "attack too slow"). Controls unlock gradually, level by level.

Inspired by Syntorial. The core content is genre-neutral: it teaches synthesis fundamentals that apply to any style. Genre- and topic-specific content (bass music first, then sub-genres such as dubstep or drum & bass) comes later as **packs** that plug into the same engine and progression system (see §7). Alongside the game, **Free Play** turns the app into a standalone synth for making and saving your own sounds (see §10). It must run in a browser on desktop and mobile, and install on phones as a PWA.

### Modes

| Mode | What it is |
| --- | --- |
| **Learn** | Pick a pack and work through its chapters and levels. Progression, stars, unlocks. |
| **Practice** | Endless rounds from levels you've already completed. No progression. (Earlier drafts called this "free play".) |
| **Free Play** | The synth on its own: every control, a playable keyboard and a library of saved sounds. No targets, no scores. |
| **Daily challenge** | A new target every day, the same for everyone, with streaks and a spoiler-free result to share. No backend needed (see §11). |

## 2. Goals and non-goals

**Goals (v1)**
- Runs in modern desktop and mobile browsers; installable as a PWA and works offline after first load
- Mobile-first touch UI that also works with mouse and keyboard
- Target and attempt rendered by the exact same synth code, so a perfect match is possible
- Scoring that is fair (ignores controls you can't hear) and feedback that teaches
- Content is data: levels live in packs, so a new pack needs no changes to engine, scoring or UI code
- Free Play with a library of saved sounds that survives app updates

**v1 content**: the **Foundations** pack only (§7.2). Bass Music and other packs come after v1 (Milestone 10).

**Non-goals (v1)**: user accounts, backend, multiplayer, app-store builds, MIDI input, downloadable or paid packs. These are stretch goals (see Milestone 11).

## 3. Tech stack

- **TypeScript** (strict) + **Vite** + **React**
- **Web Audio API** directly for the synth (no Tone.js), so the engine stays small and fully under our control
- **OfflineAudioContext** to render target and attempt to buffers for audio-based scoring
- Audio feature extraction (RMS, spectral centroid, MFCC) written in-house in `scoring/audioFeatures.ts`, following **Meyda**'s definitions. Meyda itself is a dev dependency only: the tests check our numbers against it. Ours is about 5× faster (6 ms against 30 ms per render in Node), which matters on phones, and keeps Meyda out of the bundle.
- **vite-plugin-pwa** for manifest, service worker and offline caching
- **Vitest** for unit tests
- **localStorage** for progress and the sound library, behind a small storage interface so it can move to IndexedDB if needed
- Later: **Capacitor** to wrap as native iOS and Android apps

Ask before adding any dependency not listed here.

## 4. Architecture

```
src/
  engine/            # pure TypeScript, no React or DOM imports
    params.ts        # parameter schema: ids, ranges, scales, defaults, engine module
    patch.ts         # Patch type, defaults, clamping, versioned (de)serialisation
    voice.ts         # buildVoice(ctx: BaseAudioContext, patch, note, startTime) -> VoiceHandle
    voiceManager.ts  # live note on/off, polyphony and mono mode (Free Play)
    render.ts        # renderPatch(patch, note, holdTime) -> AudioBuffer via OfflineAudioContext
    constants.ts     # every tunable number lives here
  scoring/           # pure TypeScript
    paramScore.ts    # perceptual per-parameter distance
    audible.ts       # isAudible(paramId, patch) rules
    audioScore.ts    # feature comparison of two AudioBuffers
    feedback.ts      # turns distances into plain-language tips
    finalScore.ts    # blends param and audio scores
  content/           # pure data, no logic
    schema.ts        # Pack, Chapter, Level, GeneratorSpec types
    packs/
      foundations.ts # the v1 pack
  game/
    rng.ts           # seeded RNG so any round can be replayed from its seed
    targetGenerator.ts  # builds targets from a level's GeneratorSpec
    packs.ts         # pack registry, validation, prerequisites, unlock logic
    daily.ts         # date -> daily number and seeds, streaks, share text
    progress.ts      # persistence, versioned schema
  library/
    library.ts       # saved sounds: save, load, tags, search, import/export
  storage/
    storage.ts       # key-value interface over localStorage (swappable for IndexedDB)
  ui/
    components/      # Knob, Selector, Keyboard, PlayButtons, ABToggle, SpectrumView, ResultCard
    screens/         # Start (audio unlock), Home, PackSelect, LevelSelect, Round, Result, Practice, Daily, FreePlay, Library
```

Rules:
- `engine/` and `scoring/` never import React or touch the DOM.
- The **same** `buildVoice` is used for live playback (AudioContext) and offline rendering (OfflineAudioContext). It takes a `BaseAudioContext`.
- Keep the maths (distances, feature comparisons, curve mapping) in plain functions that take numbers and arrays, so it can be unit-tested in Node without Web Audio.
- `content/` is plain, JSON-serialisable data: no functions, no imports beyond types. This keeps the door open to loading packs at runtime later.
- Nothing outside `content/` refers to a specific pack or level id. Foundations gets no special-casing.

## 5. The synth (v1 voice)

One voice per note. Rounds play a single note: hold 1.5 s, then release. Free Play plays notes live from a keyboard (§10). Signal flow per voice:

```
Osc 1 ─┐
Osc 2 ─┼─> Lowpass filter ─> Amp (envelope) ─> Master gain ─> output
Noise ─┘        ^
          filter envelope + LFO
```

Parameters belong to engine **modules** (osc, osc 2, noise, filter, amp envelope, filter envelope, LFO). Which level introduces a control is pack data (§7), not part of the parameter schema; the last column shows where the Foundations pack introduces it.

| id | Label | Range | Scale | Default | Foundations level |
| --- | --- | --- | --- | --- | --- |
| `osc.wave` | Waveform | sine, triangle, saw, square | discrete | saw | 1 |
| `osc.octave` | Octave | -1, 0, +1 | discrete | 0 | 1 |
| `filter.cutoff` | Cutoff | 40–18,000 Hz | log | 18,000 | 2 |
| `filter.resonance` | Resonance | 0–1 (maps to lowpass Q in dB, about 0–18 dB) | linear | 0 | 3 |
| `amp.attack` | Attack | 0.001–2 s | log | 0.005 | 4 |
| `amp.release` | Release | 0.01–3 s | log | 0.1 | 4 |
| `amp.decay` | Decay | 0.01–2 s | log | 0.3 | 5 |
| `amp.sustain` | Sustain | 0–1 | linear | 1 | 5 |
| `fenv.amount` | Filter env amount | 0–5 octaves | linear (octaves) | 0 | 6 |
| `fenv.decay` | Filter env decay | 0.01–2 s | log | 0.3 | 6 |
| `lfo.target` | LFO target | off, cutoff, pitch, amp | discrete | off | 7 |
| `lfo.rate` | LFO rate | 0.1–20 Hz | log | 2 | 7 |
| `lfo.depth` | LFO depth | 0–1 | linear | 0 | 7 |
| `osc2.detune` | Osc 2 detune (same wave as osc 1; 0 = off) | 0–50 cents | linear | 0 | 8 |
| `noise.level` | Noise | 0–1 | linear | 0 | 9 |

Implementation notes:
- `buildVoice` returns a `VoiceHandle` with `release(time)`, `stop(time)` and `update(patch, time)`. Rounds and `renderPatch` call `release` at the hold time; Free Play calls it on key-up. `update` applies oscillator, filter, noise and LFO changes to a sounding voice (continuous ones with short smoothing); attack, decay, sustain and the filter envelope take effect from the next note, and release applies if the note hasn't started releasing yet.
- Envelopes via `setValueAtTime`, `linearRampToValueAtTime` and `setTargetAtTime`; cancel scheduled values cleanly on retrigger.
- Filter envelope works in octaves: `cutoff × 2^(env × amount)`, clamped to the cutoff range.
- LFO: `OscillatorNode` → `GainNode` (depth) → target `AudioParam`. Depth meaning per target: cutoff ±3 octaves, pitch ±1 semitone, amp 0–100 % tremolo.
- Noise: looping white-noise `AudioBufferSourceNode`.
- Loudness: fixed master gain plus RMS-matching of rendered buffers before audio scoring, so volume never biases the score.
- Avoid clicks: short fade at note start and end.
- Patches serialise as `{ v, params }` with every parameter stored explicitly. On load, missing parameters take their defaults and unknown ones are dropped.
- **Engine growth rule**: every parameter added after v1 must default to a neutral value (off / no effect), so existing saved sounds and pack targets sound identical after an engine update.

## 6. Round flow

1. Generate a target patch from the level's generator spec, using only the level's unlocked controls; locked controls use the level's fixed values and are shown greyed out (a module with every control locked shows only its title).
2. Player can **Play target**, **Play mine**, and **A/B** (same note, same length). A/B plays both in sync starting on the target; pressing it again while it plays flips between them with a short crossfade. Knob changes are heard straight away on your sounding note.
3. **Submit** → score, top three feedback tips, and a reveal table (target vs mine for every unlocked control, with a closeness meter, each control's tip, and a reason for any control that isn't scored) with both spectra overlaid (Milestone 8). Changing the sound after submitting shows a note and turns Next back into Submit, so it can be rescored.
4. **Retry** the same target, keeping your knobs (best score kept), or **Next**.
5. **Hint** (optional): costs 10 points; names the control that's furthest off and which direction to move it, without the value.

Target generator: seeded RNG; the result card shows a replay code (`packId/levelId@packVersion:seed`) so any round can be replayed. Reject near-silent or too-short targets (a rough loudness estimate from the envelope and filter), and targets too close to the starting knob positions: at least one of the level's new controls must be audible in the target and far enough off that the starting knobs would score at most 0.5 closeness on it.

## 7. Packs and chapters

Content is organised as **Pack → Chapter → Level → Round**.
- A **pack** is a topic or genre (Foundations, Bass Music). A sub-genre can be a chapter inside its parent pack or, once it's big enough, its own pack that requires the parent (e.g. `bass.dubstep` requires `bass`).
- A **chapter** groups levels around one area of the synth or one family of sounds.
- A **level** introduces zero or more controls and defines how its targets are generated.

### 7.1 Pack format (`content/schema.ts`, sketch)

```ts
interface Pack {
  id: string;                  // 'foundations', 'bass', 'bass.dubstep'
  title: string;
  description: string;
  version: number;             // bump when content changes
  requires?: {
    packs?: string[];          // packs to complete first
    engineModules?: string[];  // e.g. 'drive', 'lfo.sync'; pack is hidden if the engine lacks one
  };
  baseControls: ParamId[];     // unlocked from the start of the pack
  chapters: Chapter[];
  presets?: SavedSound[];      // factory sounds added to the Free Play library
  daily?: DailyTier[];         // daily challenge tiers this pack offers (§11)
}

interface DailyTier {
  id: string;                  // 'basics', 'full'
  title: string;
  levelId: string;             // uses this level's controls and generator; available once it's passed
}

interface Chapter {
  id: string;
  title: string;
  description: string;
  levels: Level[];
}

interface Level {
  id: string;                  // unique within the pack
  title: string;
  intro: string;               // one or two sentences shown before the first round
  newControls: ParamId[];      // unlocked from this level onwards
  fixed: Partial<Patch>;       // values for controls that are still locked
  generator: GeneratorSpec;    // per-control ranges and/or weighted templates with variation
  noteRange: [string, string]; // e.g. ['C3', 'C5']
  rounds?: number;             // default 5
  passMark?: number;           // default 80
}

interface GeneratorSpec {
  params: { [K in ParamId]?: ParamGenerator<K> };  // range (min, max, scale, offChance, offValue) or weighted choice
  templates?: GeneratorTemplate[];                  // sound types: one is picked per round by weight
}

interface GeneratorTemplate {
  id: string;
  title: string;               // shown after submitting: "This was a pad."
  weight: number;
  params: { [K in ParamId]?: ParamGenerator<K> };  // override the level's
  noteRange?: [string, string];                     // e.g. basses play lower
}
```

`daily` (`DailyTier[]`: id, title, levelId) lists the pack's daily tiers (§11). `presets` is added to the schema when first used (Milestone 10).

Rules:
- A level's unlocked controls are the pack's `baseControls` plus the `newControls` of that level and every earlier level in the pack.
- Progress is keyed by `packId/levelId` strings, never by position, so packs can gain, reorder or drop levels without breaking saves.
- A level is passed when its average round score reaches its pass mark. Passing a level unlocks the next one; passing a chapter's last level unlocks the next chapter.
- `game/validation.ts` checks every pack in a unit test: id formats and uniqueness (packs, chapters, levels, templates), known controls, each control introduced once, generators only for unlocked controls, ranges inside parameter ranges (log ranges above 0), valid choices and weights, valid note ranges, rounds and pass marks, and requirements that resolve. Another test checks every shipped level generates fair targets without running out of attempts.
- Test fixture packs (`game/fixtures.ts`, not shipped) prove a second pack works with no code changes, including one that requires another.
- Packs and levels shipped are listed in `content/index.ts`, which also names the templates Free Play's Randomise uses, so no code outside `content/` refers to a specific pack.

### 7.2 Foundations pack (v1)

Genre-neutral. Note range C3–C5 unless stated.

| Chapter | Level | Name | New controls |
| --- | --- | --- | --- |
| Oscillators | 1 | Waveforms | waveform, octave |
| Filter | 2 | Brightness | cutoff |
| | 3 | Resonance | resonance |
| Envelopes | 4 | Start and end | attack, release |
| | 5 | Full ADSR | decay, sustain |
| | 6 | Plucks and sweeps | filter envelope amount and decay |
| Movement and texture | 7 | Movement | LFO target, rate, depth |
| | 8 | Thickness | osc 2 detune |
| | 9 | Air and grit | noise |
| Putting it together | 10 | Sound types | everything, built from general templates (pluck, pad, lead, bass, brass) with random variation; bass templates use C2–C3 |

Daily tiers: **Starter** (level 2: waveform, octave, cutoff), **Basics** (level 3: adds resonance), **Shapes** (level 6: adds the envelopes) and **Full** (level 10: everything). Starter gives new players a daily after about ten rounds.

### 7.3 Expansion packs (after v1, outline only)

- **Bass Music**: requires Foundations. Chapters such as sub bass, reese, wobble, stabs and plucks, and a "bass mode" finale built from sub, reese, wobble and pluck templates. Note range C1–C3. Likely needs new engine modules first: drive/distortion and tempo-synced LFO.
- **Sub-genre packs** that require Bass Music, e.g. dubstep, drum & bass, UK garage/bassline. Some will need further modules (FM, unison, more filter types).
- Each pack can ship factory presets, so it adds sounds to Free Play as well as lessons.

## 8. Scoring

### 8.1 Parameter score (main score, drives feedback)
For each unlocked **and audible** parameter `p`:
- **log params**: `d = |log2(mine / target)| / tolerance` (starting tolerances: cutoff 2 octaves, times 3 octaves, LFO rate 2 octaves)
- **linear params**: `d = |mine − target| / (range × tolerance)` (starting tolerance 0.5)
- **discrete params**: `d = 0` if equal, else `1`
- closeness `c = max(0, 1 − d)`

`paramScore = 100 × weighted mean of c`. Starting weights: waveform 2, cutoff 2, everything else 1. All tolerances and weights live in `engine/constants.ts`.

### 8.2 Audibility rules (`isAudible`)
Skip a parameter when it can't be heard in the **target**, for example:
- resonance when cutoff is near the top of the range
- `fenv.decay` when the filter envelope doesn't move the cutoff (`fenv.amount` is 0, or cutoff is already at the top); `fenv.amount` when cutoff is at the top
- `lfo.rate` and `lfo.depth` when the target's LFO is effectively off (`lfo.target` is off or depth is near 0)
- `amp.decay` when sustain is 1; `amp.decay` and `amp.sustain` when the attack lasts the whole note
- `amp.release` when the note has already faded out before release
- `osc2.detune` differences under about 2 cents (a deadband in the distance)
- waveform differences when cutoff is so low that only the fundamental passes

`lfo.target` is always scored, by what you hear: if the target's LFO is effectively off, yours must be too; otherwise the targets must match. That way adding movement to a still target costs points, and a depth mistake isn't also counted as a target mistake.

Each skipped control shows its reason in the reveal table.

### 8.3 Audio score (safety net)
Render both patches with `renderPatch` (same note, same length, 44.1 kHz, RMS-matched). Extract per frame with Meyda (buffer 2048, hop 512): RMS, spectral centroid, 13 MFCCs. Compare:
- loudness envelope: mean absolute difference in dB
- brightness: mean absolute centroid difference in octaves
- timbre: mean Euclidean MFCC distance

Frames where both sides are quieter than −45 dBFS (after RMS matching) are skipped, so near-silent tails don't dominate. Loudness and timbre use frames where either side makes sound (sound against silence counts as very different); brightness uses frames where both do.

Map each to 0–100 with calibration constants (`AUDIO_CALIBRATION`: full marks up to `perfect`, zero from `zero`) and average them. The hidden **dev calibration page** (open the app with `#calibrate`) renders pairs (identical, slightly off, very off), prints the raw distances and part scores with a summary per group, and plays A and B, so the constants can be tuned by ear. First calibration: identical 100, slight changes mean 90, large changes mean 62 with none reaching 95.

Known limitation: the comparison lines frames up in time, so differences in modulation rate (detune beating, LFO rate) can score lower than they sound, e.g. +4 cents on an already detuned pad.

### 8.4 Final score
`final = round(0.7 × paramScore + 0.3 × audioScore)`, except if `audioScore ≥ 95` then `final = max(final, 90)`, so different settings that sound the same still pass. Hints then take 10 points each off the rounded score (never below 0). Default pass mark 80 (packs can override per level). Stars at 80 / 90 / 97. If the audio can't be rendered, `final` is the parameter score alone. The result card shows both parts ("Settings 84 · Sound 91") and says when sounding the same lifted the score.

### 8.5 Feedback
For each audible parameter with `c < 0.8`, generate one tip that gives direction and size in musician's language, explains what you'd hear, and ties it to the spectrum where helpful:
- "Cutoff: about 1 octave too low, so your sound is darker than the target."
- "Waveform: you used square (odd harmonics only); the target is saw (every harmonic)."
- "Attack: too slow. The target starts instantly."

Sort by impact (`weight × (1 − c)`). Show the top three on the result card; show all of them in the reveal table.

## 9. Practice mode

- Endless rounds from any level you've passed, or **Mix** to draw each round from a random passed level. Reuses the levels' generator specs, so it needs no generator logic of its own.
- Rounds update the per-parameter stats (§13) but not level progress.
- Same round screen, scoring, hints and replay codes as Learn. **Enter replay code** plays any round from a code here.
- "Practise" next to a weak control on Home opens Practice on the level that introduces it, if that level is passed (otherwise the Mix).

## 10. Free Play

The synth as an instrument: no targets, no scores.

- **Controls**: every engine control, regardless of progress (see open questions). Same Knob and Selector components as rounds.
- **Two ways to audition**:
  - **Play**: a short note (the same length as a round's) of the last note played. Space on desktop. Turns Hold off.
  - **Hold**: keeps notes sounding so knob changes can be heard live. Works like a sustain pedal: while it's on, released keys keep sounding; turning it off releases them. Turned on with nothing playing, it sustains the last note played.
- **Keyboard**: on-screen keyboard (one octave on phones, two from `KEYBOARD_TWO_OCTAVE_MIN_WIDTH`, octave shift, multi-touch). Desktop: A–K for white keys, W E T Y U for black keys, Z / X for octave down / up, key letters shown on the keys.
- **Voices**: polyphonic up to `MAX_VOICES` (starting at 8) via `voiceManager.ts`, each note its own `buildVoice`; the oldest releasing voice is stolen first. A **Mono** switch uses last-note priority (glide comes later as an engine module).
- **Live edits**: knob changes are heard on held notes straight away (see `VoiceHandle.update`).
- **New** (init patch as a new, unsaved sound), **Randomise**, **Undo** and **Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z; a knob drag is one step). Randomise picks one of the sound-type templates (pluck, pad, lead, bass, brass) named by `content/index.ts`.
- **Session**: the working sound, its unsaved changes, voice mode and octave are kept across reloads, since mobile browsers often reload backgrounded tabs.
- **Spectrum**: the same live analyser view as rounds (Milestone 8).
- **Library**:
  - Save, Save as, rename, duplicate, delete (with confirmation), favourite, tags, search, sort by recent or name.
  - Each saved sound: `{ id, name, tags, favourite, createdAt, updatedAt, source, patch }`, where `source` is `user` or `preset:<packId>`.
  - Factory presets from packs are read-only; saving an edited preset creates a user copy.
  - **Export / import** the whole library or a single sound as a JSON file, so sounds survive cleared browser data and can move between devices. Imports always become new user sounds; ones already in the library (same name and settings) are skipped.
  - Prompt about unsaved changes before loading another sound or starting a new one. Leaving Free Play needs no prompt: the working sound is kept (see Session).
  - If stored library data can't be read, keep a copy of it under a separate key rather than overwriting it.

## 11. Daily challenge

One new target per tier per day, identical for every player, with no backend.

- **Tiers** come from pack data (`Pack.daily`, §7.1), so packs can add their own daily tiers later. A tier is available once you've passed its level; Foundations offers Starter, Basics, Shapes and Full (§7.2).
- **Seed**: a 32-bit FNV-1a hash of `YYYY-MM-DD/packId/tierId`, using the player's local date, so everyone gets the same target on the same day and it rolls over at local midnight. The **daily number** counts from `DAILY_EPOCH` (2026-10-01 is Daily #1), e.g. "Daily #142".
- **Attempts**: listen as often as you like; up to `DAILY_SUBMITS` submits (3, decided 2026-10-17: tips between submits teach, and the share line shows how many you needed), best one counts. No hints. Score and tips show after each submit, but the reveal table and the sound type only appear once you've used all submits, scored `DAILY_FINISH_SCORE` (97) or more, or pressed **Reveal answer**, so retries stay honest. Submit stays disabled until the sound changes, so a submit can't be wasted by accident. Submits used and the best score are saved after each submit, so a reload continues the daily.
- **Streak**: consecutive days with at least one daily tier submitted **on its own date**. Whether a daily counts is fixed when it's first saved, so finishing it after midnight still counts for its date. Today not played yet doesn't break the streak until the day is over. Worked out from the saved daily results rather than stored separately. Current and best streak show on Home and on the daily screen.
- **Share**: a spoiler-free text summary sent with the Web Share API where there is one, else copied to the clipboard (and selectable if copying is blocked), e.g. `Dial In daily #142 · Full · 94 ★★ · 2/3`. No patch values in it.
- **Archive**: a month calendar from `DAILY_EPOCH` to today, marking days played on the day (●) and played later (○). Past dailies play with the same rules and are saved, but don't count towards streaks.
- **Finished dailies**: reopening a finished tier shows its score, the share text and **Play it again (not scored)**, which replays the same round with normal rules (hints, answer shown).
- Daily rounds update the per-parameter stats (§13) from the first submit.
- Changing a tier's level or generator changes that tier's daily for every date, including past ones. That's acceptable without a backend, but avoid it once dailies are live.
- Reminder notifications wait for Capacitor builds (web push needs a server).

## 12. UI and UX

- Portrait-first, dark theme, large touch targets.
- **Start screen** with a "Tap to start" button that resumes the AudioContext (mobile browsers require a user gesture). Show a tip that the phone's silent switch can mute audio, and recommend headphones: phone speakers can't reproduce low bass notes.
- **Navigation**: tabs for Home, Practice and Free Play. Screens are hash routes (`#/`, `#/pack/<pack>`, `#/play/<pack>/<level>`, `#/practice[/<pack>/<level>]`, `#/daily[/<date>]`, `#/free-play`), so the back button and reloads keep your place.
- **Home**: continue where you left off (a level run in progress, else the next unpassed level), today's daily (number, streak, each tier's status, or which level unlocks it), packs with progress and stars, and "your weakest controls" with a Practise button each.
- **Pack screen**: chapters and levels, each showing its new controls and whether it's locked, new, in progress or passed (best average and stars).
- **Level run**: the level's rounds one after another ("Round 2 of 5" with progress dots), then a summary: average, stars, pass or not, each round's score, and Next level / Play again / All levels.
- **Knobs**: vertical drag, fine adjust with a modifier or two-finger drag, double-tap to reset, tap value to type a number; units shown (Hz, s, %, cents).
- **Spectrum**: live `AnalyserNode` view while playing; on the result screen, overlay target vs mine.
- Desktop shortcuts in rounds: Space = play target, M = play mine, B = A/B, Enter = submit (then next round). Tab is left for keyboard navigation. Free Play keyboard mapping in §10.

## 13. Persistence

All storage goes through `storage/storage.ts`. Two keys, each with a schema version and a migration stub:
- **Progress** (`dialin.progress`): per `packId/levelId`: best run average, stars, passed (sticky once passed) and runs played. The level run in progress (level, pack version, round scores so far, current round's seed), so a reload continues the same round; starting another level replaces it, and a pack version change discards it. The last level played, total rounds, and **average closeness per parameter**, used to show "your weakest controls" on the home screen. Closeness comes from the **first** submit of each round, before the reveal table shows the answer, and only counts controls audible in the target. Per daily (`date/packId/tierId`): best score, submits used, finished, and on time (first played on its own date). Streaks are worked out from these.
- **Library**: saved sounds. A separate key, so a large library never has to be rewritten along with progress.

Request persistent storage (`navigator.storage.persist()`) where supported. Browsers, Safari in particular, can clear data for sites that aren't installed and haven't been used for a while, so nudge users to install the PWA and offer a library export now and then.

## 14. Milestones

Build in order. Each milestone ends with the app running, `npm run test` and `npm run build` passing, and a commit.

1. **Scaffold and engine**: Vite + React + TS strict + Vitest; parameter schema; `buildVoice` with `VoiceHandle`; a page with knobs for every parameter and a Play button. Unit tests for value-to-scale mapping and patch (de)serialisation.
2. **Free Play**: grow the milestone 1 page into Free Play: on-screen and computer keyboard, voice manager, live edits, library with save, load, export and import. It comes this early because it's the simplest mode and lets the synth be tuned by ear before any scoring exists.
3. **Rounds**: seeded target generator; Play target / Play mine / A/B; a round screen driven by a hard-coded test level.
4. **Parameter scoring and feedback**: `paramScore`, `isAudible`, feedback tips, result card and reveal table. Tests: identical patch scores 100; cutoff one octave off lands in the expected band; inaudible parameters are ignored.
5. **Audio scoring**: `renderPatch`, Meyda features, `audioScore`, final blend, dev calibration page.
6. **Packs, levels and progress**: content schema, pack registry and validation, Foundations pack as data, test fixture pack, Home / pack / level select, unlocking, persistence, Practice mode, weakest-controls stat.
7. **Daily challenge**: tiers from pack data, date-based seeds, submit limit, streaks, share text, archive. Tests: same date gives the same target; the next date gives a different one; streak rules across missed days and month/year boundaries.
8. **Spectrum views**: live analyser and result overlay.
9. **PWA and mobile polish**: manifest, icons, offline cache, iOS testing, deploy to static hosting.
10. **First expansion pack** (probably Bass Music): add the engine modules it needs (with neutral defaults), then its chapters, levels, presets and daily tiers. Proves the pack system end to end.
11. **Stretch**: sample-based targets (audio-only scoring), Web MIDI keyboard input, Capacitor native builds (with daily reminder notifications), and anything promoted from the idea backlog (§17).

## 15. Conventions

- TypeScript strict; no `any`.
- No magic numbers outside `engine/constants.ts`.
- Small, documented functions in `engine/` and `scoring/`.
- Stop after each milestone and summarise what was built and how to run it.

## 16. Open questions

- Should hints be allowed on scored level rounds, or only in Practice?
- Tempo-synced LFO rates (1/16 to 1 bar) instead of Hz? Probably needed for the Bass Music pack.
- Is a second filter type (high-pass, band-pass) worth adding before v1 ships?
- Free Play: every control from day one, or only the ones you've learned (with a "show all" switch)? All is more useful as a synth; learned-only is less overwhelming for beginners.
- Free Play polyphony: 8-voice poly with a Mono switch (as above), or mono only to keep v1 simpler?
- Pack prerequisites: must the whole parent pack be passed, or only specific levels?
- Distribution: will packs always ship inside the app, or might they be downloaded or sold separately one day? v1 compiles them in; keeping them JSON-serialisable leaves both options open.
- Audience: still a personal tool, or heading for a public release? That decides how much onboarding, accessibility and sharing polish v1 needs.
- Audio score and modulation: add a phase-insensitive measure (e.g. compare the spread of loudness rather than frame by frame) so detune and LFO-rate differences aren't over-penalised? Matters more once the Bass Music pack leans on reese and wobble sounds.

## 17. Idea backlog (proposed, not committed)

Promote, park or delete. ★ = suggested first.

**Learning**
- ★ **Interactive level intros**: grow the text `intro` into a short guided demo of the new control ("drag cutoff while it plays") plus one quick check ("which is brighter, A or B?"). Matching cold is hard; teach first, then test.
- **Quick drills**: 10-second ear tests ("which is brighter?", "which control changed?", "same or different?"). Good for short mobile sessions, and the answers show which differences a player can actually hear, which helps tune tolerances.
- **Adaptive practice**: Practice mode leans towards levels and targets that exercise your weakest controls.
- **Difficulty settings**: Relaxed / Standard / Pro scale tolerances and pass marks; replay passed levels on Pro for extra stars.
- **Ear profile**: a radar chart of per-control accuracy on the home screen, extending "your weakest controls".

**Linking the game and Free Play**
- ★ **Keep what you match**: after scoring 90+ on a round, save the target to your library in one tap (tagged "Matched"). Learn mode then gives you sounds to keep, and Free Play fills up as you play.
- ★ **Share codes**: encode a patch as a short URL-safe string (`/#/p/<code>`) so sounds can be shared without a backend.
- ★ **Make it a challenge**: turn a saved sound into a round (choose which controls the solver gets) and share it as a code, so friends can try to match your sounds. Still no backend.
- **WAV export**: render a sound (one-shot or riff) to WAV with `OfflineAudioContext`, to drop into a DAW. A hand-written WAV encoder, no dependency.

**Daily challenge extras**
- **Streak freezes**: earn one per 7-day streak; it covers a single missed day.
- **Weekly boss**: a harder Sunday target (tighter tolerances, more controls) with its own badge.

**Listening context**
- **Riff preview**: optionally hear target and attempt as a short riff instead of a single note, with an optional drum loop. Scoring still uses the single note. Packs can ship riffs at genre tempos (e.g. 140 or 174 BPM).
- **Speaker check**: on first launch, play a low tone and ask whether you can hear it; if not, suggest headphones and move low notes up an octave outside the bass packs.

**More packs**
- Keys and plucks, Pads and atmospheres, Leads, Acid (303-style: saw/square, resonance, glide, accent), Synthwave, Game SFX (lasers, risers, zaps; needs a pitch envelope).
- Engine modules these would need, roughly in order of value: drive/distortion, tempo-synced LFO, unison and stereo spread, sub oscillator, glide, more filter types, pitch envelope, FM, and effects (chorus, delay, reverb; these need care in audio scoring).
