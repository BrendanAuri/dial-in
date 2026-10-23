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
| **Challenges** | A friend's sound to match, opened from a link they made in Free Play, with the controls they chose (see §10.1). |

## 2. Goals and non-goals

**Goals (v1)**
- Runs in modern desktop and mobile browsers; installable as a PWA and works offline after first load
- Mobile-first touch UI that also works with mouse and keyboard
- Target and attempt rendered by the exact same synth code, so a perfect match is possible
- Scoring that is fair (ignores controls you can't hear) and feedback that teaches
- Content is data: levels live in packs, so a new pack needs no changes to engine, scoring or UI code
- Free Play with a library of saved sounds that survives app updates

**v1 content**: the **Foundations** pack (§7.2). Milestone 10 added the first expansion pack, **Bass Music** (§7.3).

**Non-goals (v1)**: user accounts, backend, multiplayer, app-store builds, MIDI input, downloadable or paid packs. These are stretch goals (see Milestone 12).

## 3. Tech stack

- **TypeScript** (strict) + **Vite** + **React**
- **Web Audio API** directly for the synth (no Tone.js), so the engine stays small and fully under our control
- **OfflineAudioContext** to render target and attempt to buffers for audio-based scoring
- Audio feature extraction (RMS, spectral centroid, MFCC) written in-house in `scoring/audioFeatures.ts`, following **Meyda**'s definitions. Meyda itself is a dev dependency only: the tests check our numbers against it. Ours is about 5× faster (6 ms against 30 ms per render in Node), which matters on phones, and keeps Meyda out of the bundle.
- **vite-plugin-pwa** (with its `workbox-window` peer) for manifest, service worker and offline caching. App icons are drawn by `scripts/make-icons.mjs` (`npm run icons`), with no image dependency.
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
    drive.ts         # the drive stage's soft-clipper curve
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
    schema.ts        # Pack, Chapter, Level, GeneratorSpec, Preset types
    soundTypes.ts    # general sound-type templates (pluck, pad, lead, bass, brass)
    bassTypes.ts     # bass music templates (sub, reese, wobble, growl, stab)
    packs/
      foundations.ts # the v1 pack
      bass.ts        # Bass Music, the first expansion pack
  game/
    rng.ts           # seeded RNG so any round can be replayed from its seed
    targetGenerator.ts  # builds targets from a level's GeneratorSpec
    packs.ts         # pack registry, validation, prerequisites, unlock logic
    daily.ts         # date -> daily number and seeds, streaks, share text
    shareCode.ts     # sounds and challenges as short URL-safe codes
    challenge.ts     # a sound as a round: chosen controls, playability, share texts
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

## 5. The synth

One voice per note. Rounds play a single note: hold 1.5 s, then release. Free Play plays notes live from a keyboard (§10). Signal flow per voice:

```
Osc 1 ─┐
Osc 2 ─┼─> Lowpass filter ─> Drive ─┐
Noise ─┘        ^                   ├─> Amp (envelope) ─> Master gain ─> output
                │            Sub ───┘
          filter envelope + LFO
```

The sub joins after the filter and drive, so it stays clean however the rest is shaped (as producers keep their subs).

Parameters belong to engine **modules** (osc, osc 2, sub, noise, filter, drive, amp envelope, filter envelope, LFO). Which level introduces a control is pack data (§7), not part of the parameter schema; the last column shows where each pack introduces it (F = Foundations, B = Bass Music).

| id | Label | Range | Scale | Default | Introduced |
| --- | --- | --- | --- | --- | --- |
| `osc.wave` | Waveform | sine, triangle, saw, square | discrete | saw | F1, B base |
| `osc.octave` | Octave | -1, 0, +1 | discrete | 0 | F1, B base |
| `filter.cutoff` | Cutoff | 40–18,000 Hz | log | 18,000 | F2, B base |
| `filter.resonance` | Resonance | 0–1 (maps to lowpass Q in dB, about 0–18 dB) | linear | 0 | F3, B base |
| `amp.attack` | Attack | 0.001–2 s | log | 0.005 | F4, B6 |
| `amp.release` | Release | 0.01–3 s | log | 0.1 | F4, B6 |
| `amp.decay` | Decay | 0.01–2 s | log | 0.3 | F5, B6 |
| `amp.sustain` | Sustain | 0–1 | linear | 1 | F5, B6 |
| `fenv.amount` | Filter env amount | 0–5 octaves | linear (octaves) | 0 | F6, B6 |
| `fenv.decay` | Filter env decay | 0.01–2 s | log | 0.3 | F6, B6 |
| `lfo.target` | LFO target | off, cutoff, pitch, amp | discrete | off | F7, B4 |
| `lfo.rate` | LFO rate (used while Sync is off) | 0.1–20 Hz | log | 2 | F7 |
| `lfo.depth` | LFO depth | 0–1 | linear | 0 | F7, B4 |
| `osc2.detune` | Osc 2 detune (same wave as osc 1; 0 = off) | 0–50 cents | linear | 0 | F8, B3 |
| `noise.level` | Noise | 0–1 | linear | 0 | F9 |
| `sub.level` | Sub (sine one octave below osc 1) | 0–1 | linear | 0 | B1 |
| `drive.amount` | Drive | 0–1 | linear | 0 | B2 |
| `lfo.sync` | LFO sync | off, 1/2, 1/4, 1/4T, 1/8, 1/8T, 1/16, 1/16T | discrete | off | B4 |
| `lfo.tempo` | Tempo (used while Sync is on) | 60–200 BPM, whole numbers | linear | 120 | fixed by levels |

Implementation notes:
- `buildVoice` returns a `VoiceHandle` with `release(time)`, `stop(time)` and `update(patch, time)`. Rounds and `renderPatch` call `release` at the hold time; Free Play calls it on key-up. `update` applies oscillator, filter, noise and LFO changes to a sounding voice (continuous ones with short smoothing); attack, decay, sustain and the filter envelope take effect from the next note, and release applies if the note hasn't started releasing yet.
- Envelopes via `setValueAtTime`, `linearRampToValueAtTime` and `setTargetAtTime`; cancel scheduled values cleanly on retrigger.
- Filter envelope works in octaves: `cutoff × 2^(env × amount)`, clamped to the cutoff range.
- LFO: `OscillatorNode` → `GainNode` (depth) → target `AudioParam`. Depth meaning per target: cutoff ±3 octaves, pitch ±1 semitone, amp 0–100 % tremolo.
- Noise: looping white-noise `AudioBufferSourceNode`.
- Sub: a sine `OscillatorNode` one octave below osc 1 (following its octave and the pitch LFO), at up to `SUB_MAX_GAIN`.
- Drive: a `WaveShaperNode` (4× oversampled) with a tanh soft-clip curve, `tanh(g·x) / tanh(g)` with `g = DRIVE_MAX_GAIN^amount − 1`, so full scale stays at full scale and quiet parts get squashed up. The signal is scaled down by `DRIVE_HEADROOM` into the shaper and back up after it, so loud resonant peaks aren't hard-clipped. At 0 the shaper has no curve, which passes the signal through untouched.
- LFO sync: when Sync isn't off, the LFO runs at `tempo / 60 × cycles per beat` (1/4 = 1, 1/8 = 2, 1/8T = 3, …), instead of its Rate. `lfoRateHz(patch)` gives the speed either way. Tempo snaps to whole BPM (parameters can have a `step`). In Free Play the unused one of Rate and Tempo is dimmed, with a note saying why.
- Loudness: fixed master gain plus RMS-matching of rendered buffers before audio scoring, so volume never biases the score.
- Avoid clicks: short fade at note start and end.
- Patches serialise as `{ v, params }` with every parameter stored explicitly. On load, missing parameters take their defaults and unknown ones are dropped.
- **Engine growth rule**: every parameter added after v1 must default to a neutral value (off / no effect), so existing saved sounds and pack targets sound identical after an engine update. `game/stability.test.ts` fingerprints every Foundations level's rounds, so a change that alters existing rounds (and so dailies and replay codes) fails a test.

## 6. Round flow

1. Generate a target patch from the level's generator spec, using only the level's unlocked controls; locked controls use the level's fixed values and are shown greyed out (a module with every control locked shows only its title).
2. Player can **Play target**, **Play mine**, and **A/B** (same note, same length). A/B plays both in sync starting on the target; pressing it again while it plays flips between them with a short crossfade. Knob changes are heard straight away on your sounding note.
3. **Submit** → score, top three feedback tips, and a reveal table (target vs mine for every unlocked control, with a closeness meter, each control's tip, and a reason for any control that isn't scored) with both spectra overlaid (see Spectrum in §12). Changing the sound after submitting shows a note and turns Next back into Submit, so it can be rescored.
4. **Retry** the same target, keeping your knobs (best score kept), or **Next**.
5. **Hint** (optional): costs 10 points; names the control that's furthest off and which direction to move it, without the value.
6. **Keep this sound**: once the answer is showing and your best on the round is `KEEP_MIN_SCORE` (90) or more, the result card offers to save the target to your Free Play library, named after its sound type or level ("Pad", "Brightness") and tagged "matched". In a daily that's only after you've finished, so a target can't be kept and inspected early. A sound with the same settings already in the library isn't added twice.

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
    engineModules?: string[];  // e.g. 'sub', 'drive'; pack is hidden if the engine lacks one
  };
  baseControls: ParamId[];     // unlocked from the start of the pack
  chapters: Chapter[];
  daily?: DailyTier[];         // daily challenge tiers this pack offers (§11)
  presets?: Preset[];          // factory sounds added to the Free Play library (§10)
}

interface Preset {
  id: string;                  // unique within the pack; the library id is 'packId/presetId'
  name: string;
  tags: string[];
  patch: Partial<Patch>;       // settings that differ from the defaults
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

`daily` (`DailyTier[]`: id, title, levelId) lists the pack's daily tiers (§11). Unlocked controls without a generator entry use their full range, so a level in a pack with many base controls lists every one.

Rules:
- A level's unlocked controls are the pack's `baseControls` plus the `newControls` of that level and every earlier level in the pack.
- Progress is keyed by `packId/levelId` strings, never by position, so packs can gain, reorder or drop levels without breaking saves.
- A level is passed when its average round score reaches its pass mark. Passing a level unlocks the next one; passing a chapter's last level unlocks the next chapter.
- `game/validation.ts` checks every pack in a unit test: id formats and uniqueness (packs, chapters, levels, templates), known controls, each control introduced once, generators only for unlocked controls, ranges inside parameter ranges (log ranges above 0), valid choices and weights, valid note ranges, rounds and pass marks, presets (ids, names, valid values) and requirements that resolve. Another test checks every shipped level generates fair targets without running out of attempts.
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

### 7.3 Bass Music pack (Milestone 10)

Requires Foundations (every level passed) and the `sub` and `drive` engine modules. Base controls: waveform, octave, cutoff, resonance. Every level fixes the LFO tempo at 140 BPM, shown greyed in the LFO panel so synced wobbles have a beat to follow. Notes are low (C1–C3), so the pack description and intros ask for headphones.

| Chapter | Level | Name | New controls | Notes |
| --- | --- | --- | --- | --- |
| Low end | 1 | Sub | sub | C2–C3, so the sub (C1–C2) can be heard |
| | 2 | Drive | drive | C1–C3; any waveform, sub sometimes |
| Reese | 3 | Reese | osc 2 detune | C1–C2; saws detuned 10–40 cents, drive and sub sometimes |
| Wobble | 4 | Tempo sync | LFO target, sync, depth | C1–C2; cutoff wobbles from 1/2 to 1/16 (Rate stays locked) |
| | 5 | Wobble bass | none | wobble, growl and reese-wobble templates |
| Stabs and plucks | 6 | Stabs and plucks | filter envelope, amp envelope | C2–C3; short basses with snappy envelopes |
| Bass mode | 7 | Bass mode | none | everything, from sub bass, reese, wobble, growl, reese wobble and stab templates (`content/bassTypes.ts`) |

Noise and the free LFO rate are never unlocked here: they stay at their defaults.

Daily tiers: **Low end** (level 3: sub, drive, detune) and **Bass mode** (level 7: everything).

Factory presets (in Free Play's library): Clean sub, Warm sub, Driven sine, Reese, Dark reese 174, Wobble 1/4, Triplet growl, Bass stab, Gated sub 1/16. They play an octave down, so they sound like basses on the default keyboard octave.

### 7.4 More packs (outline only)

- **Sub-genre packs** that require Bass Music, e.g. dubstep, drum & bass, UK garage/bassline. Some will need further modules (FM, unison, more filter types).
- Each pack can ship factory presets, so it adds sounds to Free Play as well as lessons.

## 8. Scoring

### 8.1 Parameter score (main score, drives feedback)
For each unlocked **and audible** parameter `p`:
- **log params**: `d = |log2(mine / target)| / tolerance` (starting tolerances: cutoff 2 octaves, times 3 octaves, LFO rate 2 octaves)
- **linear params**: `d = |mine − target| / (range × tolerance)` (starting tolerance 0.5)
- **discrete params**: `d = 0` if equal, else `1`
- **LFO speed** (`lfo.rate` and `lfo.sync`): the octaves between the speeds you hear (`lfoRateHz`), over the LFO rate tolerance. A free rate that matches a synced one scores as a match, and a synced note length one step off at double speed (1/8 against 1/16) scores 0.5.
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
- `sub.level` when the sub would be below 25 Hz at the round's note
- the LFO's speed is scored once, under the control the target uses: `lfo.sync` when the target is synced, `lfo.rate` when it runs free. `lfo.tempo` is never scored on its own (levels fix it anyway).

`lfo.target` is always scored, by what you hear: if the target's LFO is effectively off, yours must be too; otherwise the targets must match. That way adding movement to a still target costs points, and a depth mistake isn't also counted as a target mistake.

Each skipped control shows its reason in the reveal table.

### 8.3 Audio score (safety net)
Render both patches with `renderPatch` (same note, same length, 44.1 kHz, RMS-matched). Extract per frame with Meyda (buffer 2048, hop 512): RMS, spectral centroid, 13 MFCCs. Compare:
- loudness envelope: mean absolute difference in dB
- brightness: mean absolute centroid difference in octaves
- timbre: mean Euclidean MFCC distance
- low end: how much of each render's energy sits in the 20–40 Hz and 40–80 Hz octave bands (dB of the total, from an 8192-point FFT, floored at −24 dB), mean absolute difference over bands where either side is above the floor. Added for Bass Music: MFCCs and the centroid barely register a sub, so removing one could otherwise score 95+ and get lifted to a pass.

Frames where both sides are quieter than −45 dBFS (after RMS matching) are skipped, so near-silent tails don't dominate. Loudness and timbre use frames where either side makes sound (sound against silence counts as very different); brightness uses frames where both do.

Map each to 0–100 with calibration constants (`AUDIO_CALIBRATION`: full marks up to `perfect`, zero from `zero`) and average loudness, brightness and timbre. The low end only applies when either sound has one, and can only pull the score down: the score is the lower of the three-part and four-part means, so it catches what the others miss without softening what they heard. The hidden **dev calibration page** (open the app with `#calibrate`) renders pairs (identical, slightly off, very off), prints the raw distances and part scores with a summary per group, and plays A and B, so the constants can be tuned by ear. First calibration: identical 100, slight changes mean 90, large changes mean 62 with none reaching 95. Milestone 10 added Reese and Synced growl sounds and drive, sub and sync changes (91 pairs): identical 100, slight mean 91, large mean 58 with none reaching 95; removing a sub now scores 41–89 (it was 84–98 before the low-end part).

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

- **Controls**: every engine control, regardless of progress (see open questions). Same Knob and Selector components as rounds. A control that does nothing in the current patch (LFO Rate while Sync is on, Tempo while it's off) is dimmed but still works, with a note saying why. Selectors with more than five options (LFO sync) wrap into rows of four.
- **Two ways to audition**:
  - **Play**: a short note (the same length as a round's) of the last note played. Space on desktop. Turns Hold off.
  - **Hold**: keeps notes sounding so knob changes can be heard live. Works like a sustain pedal: while it's on, released keys keep sounding; turning it off releases them. Turned on with nothing playing, it sustains the last note played.
- **Keyboard**: on-screen keyboard (one octave on phones, two from `KEYBOARD_TWO_OCTAVE_MIN_WIDTH`, octave shift, multi-touch). Desktop: A–K for white keys, W E T Y U for black keys, Z / X for octave down / up, key letters shown on the keys.
- **Voices**: polyphonic up to `MAX_VOICES` (starting at 8) via `voiceManager.ts`, each note its own `buildVoice`; the oldest releasing voice is stolen first. A **Mono** switch uses last-note priority (glide comes later as an engine module).
- **Live edits**: knob changes are heard on held notes straight away (see `VoiceHandle.update`).
- **New** (init patch as a new, unsaved sound), **Randomise**, **Undo** and **Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z; a knob drag is one step). Randomise picks one of the sound-type templates named by `content/index.ts`: the general ones (pluck, pad, lead, bass, brass) and the bass music ones (sub bass, reese, wobble, growl, reese wobble, stab). Controls a template doesn't set stay at their defaults, except Tempo, which keeps yours.
- **Session**: the working sound, its unsaved changes, voice mode and octave are kept across reloads, since mobile browsers often reload backgrounded tabs.
- **Spectrum**: the same live analyser strip as rounds, at the top of the dock.
- **Library**:
  - Save, Save as, rename, duplicate, delete (with confirmation), favourite, tags, search, sort by recent or name.
  - Each saved sound: `{ id, name, tags, favourite, createdAt, updatedAt, source, patch }`, where `source` is `user` or `preset:<packId>`.
  - Factory presets from packs (`Pack.presets`) are read-only; saving an edited preset creates a user copy. They're synced into the library each time Free Play opens: new ones added, changed ones refreshed (keeping favourites), ones no longer shipped removed. They're listed after your own sounds under Recent, without a date, and are available whether or not their pack is unlocked. The Sounds button counts only your own sounds.
  - **Export / import** the whole library (your own sounds; presets come with the app) or a single sound as a JSON file, so sounds survive cleared browser data and can move between devices. Imports always become new user sounds; ones already in the library (same name and settings) are skipped.
  - Prompt about unsaved changes before loading another sound or starting a new one. Leaving Free Play needs no prompt: the working sound is kept (see Session).
  - If stored library data can't be read, keep a copy of it under a separate key rather than overwriting it. Keeping a sound from a round or a link refuses to save in that case, so the copy isn't the only one left.
- **Share**: the toolbar's Share button (the working sound) and each library sound's Share action open the share dialog (§10.1).

### 10.1 Sharing and challenges

Sounds travel as links, with no backend.

- **Share codes** (`game/shareCode.ts`): a sound as a short URL-safe string, about 25–50 characters. Bytes: format version, kind (sound or challenge), the number of controls, a mask of the controls that differ from the defaults and two bytes for each of them, then for a challenge the solver's controls (another mask) and the note, then the name as UTF-8. That's base64url-encoded, with two characters of check value (`hashString`) on the end, so a link that was cut short or mistyped is caught instead of opening a different sound. Continuous values are their knob position in 16 bits, choices their option index. Controls are numbered by `SHARE_ORDER`, which only ever grows at the end, and every value takes two bytes, so adding controls never needs a new format version: older versions of the app skip ones they don't know. A test pins one code, so a format change can't quietly break links already sent.
- **Links**: `#/p/<code>` for a sound, `#/c/<code>` for a challenge, on the app's own address (`routeUrl`). Either prefix opens either kind; the code says which. A link that doesn't decode says so (cut short, or made by a newer version) instead of guessing.
- **Share dialog**: share **the sound** (a link and an invite line, `"Reese": a sound made in Dial In.`) or **a challenge**. For a challenge you choose the note it plays on (C1–C5, C3 by default) and the controls the solver gets, starting from the ones your sound moves away from their defaults that can be heard on that note ("What this sound changes"), with All and None. It needs at least one chosen control that can be heard and starts far enough off to earn a tip; otherwise it says why and offers no link. **Try it yourself** opens the challenge.
- **A shared sound** (`#/p/`): its name, **Play** (a short note), **Save to my sounds** (tagged "shared"; skipped if those settings are already there) and **Open in Free Play**, which makes it the working sound: the saved copy if there is one, else an unsaved sound. If Free Play's working sound has unsaved changes, it asks first.
- **A challenge** (`#/c/`): a round (`RoundPlayer`) where the chosen controls start at their defaults and everything else is set as in the sound and shown locked. Normal round rules: retries, hints, the answer after each submit, the default pass mark, and Keep this sound at 90+. It counts towards your weakest controls like Practice, but nothing else is saved. After a submit it offers your best score to share with the same link (`Dial In challenge "Growl" · 92 ★★. Can you beat it?`) and a way to make your own.
- Share texts carry names and scores only, never settings.

## 11. Daily challenge

One new target per tier per day, identical for every player, with no backend.

- **Tiers** come from pack data (`Pack.daily`, §7.1), so packs can add their own daily tiers later. A tier is available once you've passed its level; Foundations offers Starter, Basics, Shapes and Full (§7.2), and Bass Music adds Low end and Bass mode (§7.3). The tier tabs wrap onto a second row on phones, which keeps each pack's tiers together. A tier whose pack is still locked says which pack to pass first.
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
- **PWA**: installable with a manifest (standalone, dark theme, 192/512 and maskable icons, Apple touch icon and iOS meta tags). Everything is precached, so after the first visit the app loads and plays rounds offline. A new version shows "A new version of Dial In is ready" with **Reload** / **Later**, so an update never interrupts a round. A first-time notice says it now works offline. Home shows an **Install Dial In** card (the browser's install prompt where there is one; Share → Add to Home Screen instructions on iPhone and iPad), dismissible for good. The first progress save asks for persistent storage.
- **Navigation**: tabs for Home, Practice and Free Play. Screens are hash routes (`#/`, `#/pack/<pack>`, `#/play/<pack>/<level>`, `#/practice[/<pack>/<level>]`, `#/daily[/<date>]`, `#/free-play`, and shared links `#/p/<code>` and `#/c/<code>`), so the back button and reloads keep your place.
- **Home**: continue where you left off (a level run in progress, else the next unpassed level), today's daily (number, streak, each tier's status, or which level unlocks it), packs with progress and stars, and "your weakest controls" with a Practise button each.
- **Pack screen**: chapters and levels, each showing its new controls and whether it's locked, new, in progress or passed (best average and stars).
- **Level run**: the level's rounds one after another ("Round 2 of 5" with progress dots), then a summary: average, stars, pass or not, each round's score, and Next level / Play again / All levels.
- **Knobs**: vertical drag, fine adjust with a modifier or two-finger drag, double-tap to reset, tap value to type a number; units shown (Hz, s, %, cents, BPM).
- **Spectrum**:
  - **Live**: an `AnalyserNode` tapping the master bus (FFT 4096) feeds a canvas strip at the top of the sticky dock in rounds and Free Play. It shows 20 Hz–16 kHz on a log axis (down to 20 Hz since Bass Music, so a sub shows) with 100 / 1k / 10k grid lines, coloured by what you hear (`--target` teal, `--mine` orange). A × hides it and "Show spectrum" brings it back; the choice is remembered per browser. In an unfinished daily the target's spectrum is masked ("Target spectrum hidden until you finish") so the daily stays an ear test; yours still shows.
  - **Result overlay**: the offline renders made at Submit also give each sound's average spectrum, volume-matched like the audio score, in 96 log-spaced bands (interpolated in dB below one FFT bin, so curves stay smooth). Target and yours are drawn on one chart with a key, and a caption compares their spectral centres ("Spectral centre: target 894 Hz, yours 3.62 kHz, so yours is brighter."), which is how feedback ties to the spectrum. In the daily it appears with the reveal table, once you've finished.
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
9. **PWA and mobile polish**: manifest, icons, offline cache, update prompt, install card, deploy configs (GitHub Pages workflow, `netlify.toml`; `DIAL_IN_BASE` for sub-paths), and an iOS checklist ([docs/ios-testing.md](docs/ios-testing.md)) to run on a real device after deploying.
10. **First expansion pack**: Bass Music (§7.3). Engine modules with neutral defaults: sub oscillator, drive and tempo-synced LFO (§5). Scoring for them, including a low-end part in the audio score (§8). Factory presets in the Free Play library, bass templates for Randomise, two daily tiers. A fingerprint test proves Foundations rounds didn't change.
11. **Share and keep**: keep a matched target as a sound, share codes and links for sounds, and challenges made from them (§6, §10.1). Rounds split into `RoundPlayer` (any round) and `RoundView` (a level's round from its seed).
12. **Stretch**: sample-based targets (audio-only scoring), Web MIDI keyboard input, Capacitor native builds (with daily reminder notifications), and anything promoted from the idea backlog (§17).

## 15. Conventions

- TypeScript strict; no `any`.
- No magic numbers outside `engine/constants.ts`.
- Small, documented functions in `engine/` and `scoring/`.
- Stop after each milestone and summarise what was built and how to run it.

## 16. Open questions

- Should hints be allowed on scored level rounds, or only in Practice?
- Is a second filter type (high-pass, band-pass) worth adding before v1 ships?
- Free Play: every control from day one, or only the ones you've learned (with a "show all" switch)? All is more useful as a synth; learned-only is less overwhelming for beginners.
- Free Play polyphony: 8-voice poly with a Mono switch (as above), or mono only to keep v1 simpler?
- Pack prerequisites: must the whole parent pack be passed, or only specific levels? Bass Music currently needs every Foundations level passed (10 levels, about 50 rounds). Earlier access (e.g. after Movement) would mean a `requires.levels` field.
- Distribution: will packs always ship inside the app, or might they be downloaded or sold separately one day? v1 compiles them in; keeping them JSON-serialisable leaves both options open.
- Audience: still a personal tool, or heading for a public release? That decides how much onboarding, accessibility and sharing polish v1 needs.
- Audio score and modulation: add a phase-insensitive measure (e.g. compare the spread of loudness rather than frame by frame) so detune and LFO-rate differences aren't over-penalised? Bass Music leans on reese and wobble sounds, so this matters more now: in calibration, +4 cents on the Synced growl scores 71 on sound.
- Level focus: a level can be passed while ignoring its new control (e.g. Sub: leaving the sub at 0 still averages about 80, as leaving resonance alone does in Foundations' Resonance level). Should a level's new controls count extra in its own rounds?

## 17. Idea backlog (proposed, not committed)

Promote, park or delete. ★ = suggested first.

**Learning**
- ★ **Interactive level intros**: grow the text `intro` into a short guided demo of the new control ("drag cutoff while it plays") plus one quick check ("which is brighter, A or B?"). Matching cold is hard; teach first, then test.
- **Quick drills**: 10-second ear tests ("which is brighter?", "which control changed?", "same or different?"). Good for short mobile sessions, and the answers show which differences a player can actually hear, which helps tune tolerances.
- **Adaptive practice**: Practice mode leans towards levels and targets that exercise your weakest controls.
- **Difficulty settings**: Relaxed / Standard / Pro scale tolerances and pass marks; replay passed levels on Pro for extra stars.
- **Ear profile**: a radar chart of per-control accuracy on the home screen, extending "your weakest controls".

**Linking the game and Free Play** (keep what you match, share codes and challenges arrived in Milestone 11)
- **Challenge replies**: after matching a challenge, send back one of your own in a tap.
- **WAV export**: render a sound (one-shot or riff) to WAV with `OfflineAudioContext`, to drop into a DAW. A hand-written WAV encoder, no dependency.

**Daily challenge extras**
- **Streak freezes**: earn one per 7-day streak; it covers a single missed day.
- **Weekly boss**: a harder Sunday target (tighter tolerances, more controls) with its own badge.

**Listening context**
- **Riff preview**: optionally hear target and attempt as a short riff instead of a single note, with an optional drum loop. Scoring still uses the single note. Packs can ship riffs at genre tempos (e.g. 140 or 174 BPM).
- **Speaker check**: on first launch, play a low tone and ask whether you can hear it; if not, suggest headphones and move low notes up an octave outside the bass packs.

**More packs**
- Keys and plucks, Pads and atmospheres, Leads, Acid (303-style: saw/square, resonance, glide, accent), Synthwave, Game SFX (lasers, risers, zaps; needs a pitch envelope).
- Engine modules these would need, roughly in order of value (drive, tempo-synced LFO and the sub oscillator arrived with Bass Music): unison and stereo spread, glide, more filter types, pitch envelope (for 808s), FM, and effects (chorus, delay, reverb; these need care in audio scoring).
