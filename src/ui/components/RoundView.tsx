import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Level, Pack } from '../../content/schema';
import { ComparePlayer } from '../../engine/comparePlayer';
import { DEFAULT_HOLD_TIME, HINT_COST, LIVE_START_DELAY } from '../../engine/constants';
import { midiToNoteName } from '../../engine/notes';
import { PARAM_IDS, type ParamId, type Patch } from '../../engine/params';
import { patchesEqual, setParam } from '../../engine/patch';
import { measureAudio } from '../../game/measureAudio';
import { passMarkOf } from '../../game/progress';
import { formatReplayCode } from '../../game/replayCode';
import { generateRound } from '../../game/targetGenerator';
import type { ListeningContext } from '../../scoring/audible';
import { hintFor } from '../../scoring/feedback';
import { scoreParams } from '../../scoring/paramScore';
import { scoreRound, type RoundResult } from '../../scoring/scoreRound';
import type { LiveAudio } from '../audio';
import { isButtonLike, isTypingTarget } from '../hooks';
import { ResultCard } from './ResultCard';
import { SynthPanel } from './SynthPanel';

/**
 * Limits for challenge rounds (the daily). Without rules a round has
 * unlimited submits, hints, and shows the answer after every submit.
 */
export interface RoundRules {
  readonly maxSubmits: number;
  readonly hints: boolean;
  /** A score of at least this finishes the round early. */
  readonly finishScore: number;
}

/** Attempts made on a round so far, e.g. to continue a daily after a reload. */
export interface Attempts {
  readonly submits: number;
  readonly best: number | null;
  /** Out of submits, scored finishScore, or the answer was revealed. */
  readonly finished: boolean;
}

const NO_ATTEMPTS: Attempts = { submits: 0, best: null, finished: false };

interface RoundViewProps {
  readonly audio: LiveAudio;
  readonly pack: Pack;
  readonly level: Level;
  readonly seed: number;
  /** Shown at the top left, e.g. "Round 2 of 5". */
  readonly heading: ReactNode;
  /** Label for moving on from the result card, e.g. "Next round"; null for no button. */
  readonly nextLabel: string | null;
  /** Called with the round's best score when the player moves on. */
  readonly onNext?: (best: number) => void;
  /** Called once, with the first submitted attempt (used for the per-control stats). */
  readonly onFirstResult?: (result: RoundResult) => void;
  readonly notice?: string | null;
  readonly rules?: RoundRules;
  readonly saved?: Attempts;
  /** Called after every submit, and when the answer is revealed. */
  readonly onAttempts?: (attempts: Attempts) => void;
}

/**
 * One round: hear the target, match it with the unlocked controls, submit
 * for a score and tips, retry or move on. Mount with a new key per round.
 */
export function RoundView(props: RoundViewProps) {
  const { audio, pack, level, seed, heading, nextLabel, onNext, onFirstResult, notice, rules, onAttempts } = props;
  const saved = props.saved ?? NO_ATTEMPTS;
  const round = useMemo(() => generateRound(pack, level, seed), [pack, level, seed]);
  const [mine, setMine] = useState<Patch>(() => ({ ...round.start }));
  const [result, setResult] = useState<RoundResult | null>(null);
  const [best, setBest] = useState<number | null>(saved.best);
  const [submits, setSubmits] = useState(saved.submits);
  const [gaveUp, setGaveUp] = useState(saved.finished);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [player] = useState(() => new ComparePlayer(audio.ctx, audio.output));
  const playback = useSyncExternalStore(player.subscribe, player.getState);
  const submitToken = useRef(0);
  const reportedFirst = useRef(saved.submits > 0);

  const passMark = passMarkOf(level);
  const context: ListeningContext = useMemo(() => ({ note: round.note, holdTime: DEFAULT_HOLD_TIME }), [round]);
  const locked = useMemo(() => new Set(PARAM_IDS.filter((id) => !round.unlocked.includes(id))), [round]);
  const code = formatReplayCode({ packId: pack.id, levelId: level.id, packVersion: pack.version, seed });
  const soundType = level.generator.templates?.find((t) => t.id === round.template)?.title ?? null;
  const changedSinceSubmit = result !== null && !patchesEqual(result.mine, mine);
  const isFinished = (count: number, top: number | null, revealed: boolean): boolean =>
    rules === undefined || revealed || count >= rules.maxSubmits || (top ?? 0) >= rules.finishScore;
  const finished = rules === undefined ? result !== null : isFinished(submits, best, gaveUp);
  const submitsLeft = rules === undefined ? Infinity : rules.maxSubmits - submits;
  const canSubmit = !scoring && (rules === undefined || (!finished && submitsLeft > 0 && (result === null || changedSinceSubmit)));
  const showNext = nextLabel !== null && result !== null && !changedSinceSubmit && (rules === undefined || finished);

  useEffect(() => {
    player.updateMine(mine, audio.ctx.currentTime);
  }, [player, mine, audio]);

  useEffect(
    () => () => {
      submitToken.current++;
      player.stop(audio.ctx.currentTime);
    },
    [player, audio],
  );

  // Bring the result into view when it appears.
  useEffect(() => {
    if (result) document.getElementById('result-title')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

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

  /** Render both sounds offline, compare them, then score. */
  const submit = useCallback(() => {
    if (!canSubmit) return;
    const submitted = mine;
    const token = ++submitToken.current;
    setScoring(true);
    void measureAudio(round.target, submitted, round.note, DEFAULT_HOLD_TIME).then((audioScore) => {
      if (submitToken.current !== token) return;
      const scored = scoreRound({
        target: round.target,
        mine: submitted,
        unlocked: round.unlocked,
        context,
        audio: audioScore,
        hintsUsed,
        passMark,
      });
      const count = submits + 1;
      const top = Math.max(best ?? 0, scored.score.score);
      setScoring(false);
      setResult(scored);
      setSubmits(count);
      setBest(top);
      setHint(null);
      onAttempts?.({ submits: count, best: top, finished: isFinished(count, top, gaveUp) });
      if (!reportedFirst.current) {
        reportedFirst.current = true;
        onFirstResult?.(scored);
      }
    });
    // isFinished only reads `rules`, which stays the same for a round's lifetime.
  }, [canSubmit, mine, round, context, hintsUsed, passMark, submits, best, gaveUp, onAttempts, onFirstResult]);

  /** End a challenge round now and show the answer. */
  const reveal = useCallback(() => {
    setGaveUp(true);
    onAttempts?.({ submits, best, finished: true });
  }, [submits, best, onAttempts]);

  const giveHint = useCallback(() => {
    const params = scoreParams(round.target, mine, round.unlocked, context);
    setHintsUsed((n) => n + 1);
    setHint(hintFor(params, mine, round.target));
  }, [round, mine, context]);

  const next = useCallback(() => {
    if (best !== null) onNext?.(best);
  }, [best, onNext]);

  const onParamChange = useCallback(
    (id: ParamId, value: unknown) => {
      if (!locked.has(id)) setMine((current) => setParam(current, id, value));
    },
    [locked],
  );

  const copyCode = (): void => {
    void navigator.clipboard?.writeText(code).then(() => setCopied(true));
  };

  // Space: target · M: mine · B: A/B · Enter: submit, then move on.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
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
  }, [playTarget, playMine, playAB, submit, next, showNext]);

  const hearingLabel = playback.hearing === 'mine' ? 'yours' : 'target';

  return (
    <div className="round">
      <div className="round-header">
        <div className="round-heading">{heading}</div>
        <span className="round-number">{midiToNoteName(round.note)}</span>
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <p className="level-intro">{level.intro}</p>

      {result && (
        <ResultCard
          result={result}
          target={round.target}
          best={best ?? result.score.score}
          passMark={passMark}
          changed={changedSinceSubmit}
          soundType={soundType}
          showReveal={finished}
          attemptsNote={
            rules && !finished
              ? `${submits} of ${rules.maxSubmits} submits used. The answer appears when you've used them all or score ${rules.finishScore}+.`
              : null
          }
          nextLabel={nextLabel}
          onRetry={rules === undefined || (!finished && submitsLeft > 0) ? () => setResult(null) : null}
          onReveal={rules && !finished ? reveal : null}
          onNext={next}
        />
      )}

      {hint && !result && (
        <p className="hint-text" role="status">
          <strong>Hint:</strong> {hint}
        </p>
      )}

      <SynthPanel patch={mine} onChange={onParamChange} locked={locked} />

      <div className="round-tools">
        {(rules === undefined || rules.hints) && (
          <button type="button" className="button" onClick={giveHint} disabled={result !== null}>
            Hint (−{HINT_COST})
          </button>
        )}
        <button type="button" className="button" onClick={() => setMine({ ...round.start })}>
          Reset knobs
        </button>
        <span className="replay-code">
          Replay code <code>{code}</code>
        </span>
        <button type="button" className="button" onClick={copyCode}>
          {copied ? 'Copied' : 'Copy'}
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
          disabled={!showNext && !canSubmit}
          aria-busy={scoring}
        >
          {scoring ? 'Scoring…' : showNext ? 'Next' : rules && finished ? 'Finished' : 'Submit'}
          {rules && !finished && !scoring && <span className="button-sub">{submitsLeft} left</span>}
        </button>
      </div>
    </div>
  );
}
