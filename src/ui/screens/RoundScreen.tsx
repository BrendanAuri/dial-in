import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PACKS } from '../../content';
import type { Level, Pack } from '../../content/schema';
import { ComparePlayer } from '../../engine/comparePlayer';
import { DEFAULT_HOLD_TIME, LIVE_START_DELAY } from '../../engine/constants';
import { midiToNoteName } from '../../engine/notes';
import { PARAM_IDS, type ParamId, type Patch } from '../../engine/params';
import { setParam } from '../../engine/patch';
import { findLevel, getPack, packLevels } from '../../game/packs';
import { formatReplayCode, parseReplayCode } from '../../game/replayCode';
import { randomSeed } from '../../game/rng';
import { generateRound, type GeneratedRound } from '../../game/targetGenerator';
import type { LiveAudio } from '../audio';
import { ReplayCodeDialog } from '../components/ReplayCodeDialog';
import { RevealCard } from '../components/RevealCard';
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
  readonly revealed: boolean;
  /** Rounds played in this level since it was picked. */
  readonly number: number;
  /** Shown above the round, e.g. when a replay code is from an older pack version. */
  readonly notice: string | null;
}

const LEVELS: readonly LevelRef[] = PACKS.flatMap((pack) => packLevels(pack).map((level) => ({ pack, level })));

function newRound(ref: LevelRef, seed: number, number: number, notice: string | null = null): RoundState {
  const round = generateRound(ref.pack, ref.level, seed);
  return { ref, round, mine: { ...round.start }, revealed: false, number, notice };
}

function levelKey(ref: LevelRef): string {
  return `${ref.pack.id}/${ref.level.id}`;
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
 * A round: hear the target, match it with the unlocked controls, then
 * reveal. Driven by the test levels until the Foundations pack exists.
 */
function Round({ audio, first }: RoundScreenProps & { readonly first: LevelRef }) {
  const [state, setState] = useState<RoundState>(() => newRound(first, randomSeed(), 1));
  const [player] = useState(() => new ComparePlayer(audio.ctx, audio.output));
  const playback = useSyncExternalStore(player.subscribe, player.getState);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { ref, round, mine, revealed } = state;
  const locked = useMemo(() => new Set(PARAM_IDS.filter((id) => !round.unlocked.includes(id))), [round]);
  const code = formatReplayCode({ packId: ref.pack.id, levelId: ref.level.id, packVersion: ref.pack.version, seed: round.seed });

  useEffect(() => {
    player.updateMine(mine, audio.ctx.currentTime);
  }, [player, mine, audio]);

  useEffect(() => () => player.stop(audio.ctx.currentTime), [player, audio]);

  useEffect(() => {
    if (revealed) document.getElementById('reveal-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [revealed]);

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

  const reveal = useCallback(() => setState((s) => ({ ...s, revealed: true })), []);
  const retry = useCallback(() => setState((s) => ({ ...s, mine: { ...s.round.start }, revealed: false })), []);
  const next = useCallback(() => setState((s) => newRound(s.ref, randomSeed(), s.number + 1)), []);
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

  // Space: target · M: mine · B: A/B · Enter: reveal, then next round.
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
        if (revealed) next();
        else reveal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [codeDialogOpen, playTarget, playMine, playAB, reveal, next, revealed]);

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

      {revealed && (
        <RevealCard unlocked={round.unlocked} target={round.target} mine={mine} onRetry={retry} onNext={next} />
      )}

      <SynthPanel patch={mine} onChange={onParamChange} locked={locked} />

      <div className="round-tools">
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

      <p className="hint">Space plays the target · M plays yours · B for A/B · Enter to reveal</p>

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
        <button type="button" className="button reveal-button" onClick={revealed ? next : reveal}>
          {revealed ? 'Next' : 'Reveal'}
        </button>
      </div>

      {codeDialogOpen && <ReplayCodeDialog onSubmit={onReplayCode} onCancel={() => setCodeDialogOpen(false)} />}
    </div>
  );
}
