import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PACKS } from '../../content';
import type { Level, Pack } from '../../content/schema';
import { ComparePlayer } from '../../engine/comparePlayer';
import { DEFAULT_HOLD_TIME, HINT_COST, LIVE_START_DELAY, PASS_MARK } from '../../engine/constants';
import { midiToNoteName } from '../../engine/notes';
import { PARAM_IDS, type ParamId, type Patch } from '../../engine/params';
import { patchesEqual, setParam } from '../../engine/patch';
import { measureAudio } from '../../game/measureAudio';
import { findLevel, getPack, packLevels } from '../../game/packs';
import { formatReplayCode, parseReplayCode } from '../../game/replayCode';
import { randomSeed } from '../../game/rng';
import { generateRound, type GeneratedRound } from '../../game/targetGenerator';
import type { ListeningContext } from '../../scoring/audible';
import { hintFor } from '../../scoring/feedback';
import { scoreParams } from '../../scoring/paramScore';
import { scoreRound, type RoundResult } from '../../scoring/scoreRound';
import type { LiveAudio } from '../audio';
import { ReplayCodeDialog } from '../components/ReplayCodeDialog';
import { ResultCard } from '../components/ResultCard';
import { SynthPanel } from '../components/SynthPanel';
import { isButtonLike, isTypingTarget } from '../hooks';

interface LevelRef {
  readonly pack: Pack;
  readonly level: Level;
}

interface RoundState {
  readonly ref: LevelRef;
  readonly round: GeneratedRound;
  readonly mine: Patch;
  /** The latest submitted attempt, or null before the first submit / after Try again. */
  readonly result: RoundResult | null;
  /** Best score on this round so far. */
  readonly best: number | null;
  readonly hintsUsed: number;
  readonly hint: string | null;
  /** Rounds played in this level since it was picked. */
  readonly number: number;
  /** Shown above the round, e.g. when a replay code is from an older pack version. */
  readonly notice: string | null;
}

const LEVELS: readonly LevelRef[] = PACKS.flatMap((pack) => packLevels(pack).map((level) => ({ pack, level })));

function newRound(ref: LevelRef, seed: number, number: number, notice: string | null = null): RoundState {
  const round = generateRound(ref.pack, ref.level, seed);
  return { ref, round, mine: { ...round.start }, result: null, best: null, hintsUsed: 0, hint: null, number, notice };
}

function levelKey(ref: LevelRef): string {
  return `${ref.pack.id}/${ref.level.id}`;
}

function listening(round: GeneratedRound): ListeningContext {
  return { note: round.note, holdTime: DEFAULT_HOLD_TIME };
}

interface RoundScreenProps {
  readonly audio: LiveAudio;
}

export function RoundScreen({ audio }: RoundScreenProps) {
  const first = LEVELS[0];
  if (!first) return <p className="screen">No levels yet.</p>;
  return <Round audio={audio} first={first} />;
}

/**
 * A round: hear the target, match it with the unlocked controls, submit for
 * a score and tips. Driven by the test levels until the Foundations pack exists.
 */
function Round({ audio, first }: RoundScreenProps & { readonly first: LevelRef }) {
  const [state, setState] = useState<RoundState>(() => newRound(first, randomSeed(), 1));
  const [player] = useState(() => new ComparePlayer(audio.ctx, audio.output));
  const playback = useSyncExternalStore(player.subscribe, player.getState);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scoring, setScoring] = useState(false);
  const submitToken = useRef(0);

  const { ref, round, mine, result } = state;
  const passMark = ref.level.passMark ?? PASS_MARK;
  const locked = useMemo(() => new Set(PARAM_IDS.filter((id) => !round.unlocked.includes(id))), [round]);
  const code = formatReplayCode({ packId: ref.pack.id, levelId: ref.level.id, packVersion: ref.pack.version, seed: round.seed });
  const changedSinceSubmit = result !== null && !patchesEqual(result.mine, mine);
  const showNext = result !== null && !changedSinceSubmit;

  useEffect(() => {
    player.updateMine(mine, audio.ctx.currentTime);
  }, [player, mine, audio]);

  useEffect(() => () => player.stop(audio.ctx.currentTime), [player, audio]);

  // Bring the result into view when it appears.
  const resultShown = result !== null;
  useEffect(() => {
    if (resultShown) document.getElementById('result-title')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [resultShown, state.best]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const eventTime = useCallback((): number => {
    if (audio.ctx.state !== 'running') void audio.ctx.resume();
    return audio.ctx.currentTime + LIVE_START_DELAY;
  }, [audio]);

  const patches = useMemo(() => ({ target: round.target, mine }), [round, mine]);

  const playTarget = useCallback(
    () => player.play('target', patches, round.note, eventTime(), DEFAULT_HOLD_TIME),
    [player, patches, round, eventTime],
  );
  const playMine = useCallback(
    () => player.play('mine', patches, round.note, eventTime(), DEFAULT_HOLD_TIME),
    [player, patches, round, eventTime],
  );
  /** Starts both in sync hearing the target; pressing again while it plays flips sides. */
  const playAB = useCallback(() => {
    const time = eventTime();
    if (!player.flip(time)) player.playAB(patches, round.note, time, DEFAULT_HOLD_TIME);
  }, [player, patches, round, eventTime]);

  /** Render both sounds offline, compare them, then score. Ignored if the round moved on meanwhile. */
  const submit = useCallback(() => {
    if (scoring) return;
    const submitted = state;
    const token = ++submitToken.current;
    setScoring(true);
    void measureAudio(submitted.round.target, submitted.mine, submitted.round.note, DEFAULT_HOLD_TIME).then((audio) => {
      if (submitToken.current !== token) return;
      setScoring(false);
      setState((s) => {
        if (s.round !== submitted.round) return s;
        const scored = scoreRound({
          target: s.round.target,
          mine: submitted.mine,
          unlocked: s.round.unlocked,
          context: listening(s.round),
          audio,
          hintsUsed: s.hintsUsed,
          passMark: s.ref.level.passMark ?? PASS_MARK,
        });
        return { ...s, result: scored, best: Math.max(s.best ?? 0, scored.score.score), hint: null };
      });
    });
  }, [scoring, state]);

  const hint = useCallback(() => {
    setState((s) => {
      const params = scoreParams(s.round.target, s.mine, s.round.unlocked, listening(s.round));
      return { ...s, hintsUsed: s.hintsUsed + 1, hint: hintFor(params, s.mine, s.round.target) };
    });
  }, []);

  const retry = useCallback(() => setState((s) => ({ ...s, result: null })), []);
  const next = useCallback(() => {
    submitToken.current++;
    setScoring(false);
    setState((s) => newRound(s.ref, randomSeed(), s.number + 1));
  }, []);
  const resetKnobs = useCallback(() => setState((s) => ({ ...s, mine: { ...s.round.start } })), []);

  const onParamChange = useCallback(
    (id: ParamId, value: unknown) => {
      if (locked.has(id)) return;
      setState((s) => ({ ...s, mine: setParam(s.mine, id, value) }));
    },
    [locked],
  );

  const onPickLevel = (key: string): void => {
    const picked = LEVELS.find((candidate) => levelKey(candidate) === key);
    if (picked) setState(newRound(picked, randomSeed(), 1));
  };

  const onReplayCode = (text: string): string | null => {
    const parsed = parseReplayCode(text);
    if (!parsed) return "That doesn't look like a replay code.";
    const pack = getPack(parsed.packId);
    const level = pack ? findLevel(pack, parsed.levelId) : undefined;
    if (!pack || !level) return "That code is for a level this version of Dial In doesn't have.";
    const notice =
      parsed.packVersion === pack.version
        ? null
        : 'This code is from a different version of the level, so the round may not be the same.';
    setState(newRound({ pack, level }, parsed.seed, 1, notice));
    setCodeDialogOpen(false);
    return null;
  };

  const copyCode = (): void => {
    void navigator.clipboard?.writeText(code).then(() => setCopied(true));
  };

  // Space: target · M: mine · B: A/B · Enter: submit, then next round.
  useEffect(() => {
    if (codeDialogOpen) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      const onButton = isButtonLike(event.target);
      if (event.code === 'Space' && !onButton) {
        event.preventDefault();
        playTarget();
      } else if (event.code === 'KeyM') {
        playMine();
      } else if (event.code === 'KeyB') {
        playAB();
      } else if (event.code === 'Enter' && !onButton) {
        event.preventDefault();
        if (showNext) next();
        else submit();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [codeDialogOpen, playTarget, playMine, playAB, submit, next, showNext]);

  const hearingLabel = playback.hearing === 'mine' ? 'yours' : 'target';

  return (
    <div className="screen round-screen">
      <div className="round-header">
        <label className="level-picker">
          <span className="visually-hidden">Level</span>
          <select className="input" value={levelKey(ref)} onChange={(event) => onPickLevel(event.target.value)}>
            {PACKS.map((pack) => (
              <optgroup key={pack.id} label={pack.title}>
                {packLevels(pack).map((level) => (
                  <option key={level.id} value={`${pack.id}/${level.id}`}>
                    {level.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="round-number">
          Round {state.number} · {midiToNoteName(round.note)}
        </span>
      </div>

      {state.notice && (
        <p className="notice" role="status">
          {state.notice}
        </p>
      )}
      <p className="level-intro">{ref.level.intro}</p>

      {result && (
        <ResultCard
          result={result}
          target={round.target}
          best={state.best ?? result.score.score}
          passMark={passMark}
          changed={changedSinceSubmit}
          onRetry={retry}
          onNext={next}
        />
      )}

      {state.hint && !result && (
        <p className="hint-text" role="status">
          <strong>Hint:</strong> {state.hint}
        </p>
      )}

      <SynthPanel patch={mine} onChange={onParamChange} locked={locked} />

      <div className="round-tools">
        <button type="button" className="button" onClick={hint} disabled={result !== null}>
          Hint (−{HINT_COST})
        </button>
        <button type="button" className="button" onClick={resetKnobs}>
          Reset knobs
        </button>
        <span className="replay-code">
          Replay code <code>{code}</code>
        </span>
        <button type="button" className="button" onClick={copyCode}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="button" onClick={() => setCodeDialogOpen(true)}>
          Enter code
        </button>
      </div>

      <p className="hint">Space plays the target · M plays yours · B for A/B · Enter to submit</p>

      <div className="dock round-dock">
        <button
          type="button"
          className={playback.playing === 'target' ? 'button primary play-side playing' : 'button primary play-side'}
          onClick={playTarget}
        >
          ▶ Target
        </button>
        <button
          type="button"
          className={playback.playing === 'mine' ? 'button primary play-side playing' : 'button primary play-side'}
          onClick={playMine}
        >
          ▶ Mine
        </button>
        <button
          type="button"
          className={playback.playing === 'ab' ? 'button ab on' : 'button ab'}
          aria-pressed={playback.playing === 'ab'}
          onClick={playAB}
          title="Play both in sync; press again to switch between them"
        >
          A/B
          {playback.playing === 'ab' && <span className="ab-hearing">{hearingLabel}</span>}
        </button>
        <button
          type="button"
          className="button submit-button"
          onClick={showNext ? next : submit}
          disabled={scoring}
          aria-busy={scoring}
        >
          {scoring ? 'Scoring…' : showNext ? 'Next' : 'Submit'}
        </button>
      </div>

      {codeDialogOpen && <ReplayCodeDialog onSubmit={onReplayCode} onCancel={() => setCodeDialogOpen(false)} />}
    </div>
  );
}
