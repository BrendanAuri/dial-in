import { useCallback, useState } from 'react';
import { PACKS } from '../../content';
import { findLevel, getPack } from '../../game/packs';
import { levelKey, passedLevels, recordRound, resolveLevel, type LevelRef } from '../../game/progress';
import { parseReplayCode } from '../../game/replayCode';
import { pick, randomSeed } from '../../game/rng';
import type { RoundResult } from '../../scoring/scoreRound';
import type { LiveAudio } from '../audio';
import { ReplayCodeDialog } from '../components/ReplayCodeDialog';
import { RoundView } from '../components/RoundView';
import { progressStore, useProgress } from '../progress';
import type { Navigate } from '../router';

const MIX = 'mix';

interface PracticeScreenProps {
  readonly audio: LiveAudio;
  readonly packId?: string | undefined;
  readonly levelId?: string | undefined;
  readonly navigate: Navigate;
}

interface PracticeRound {
  readonly ref: LevelRef;
  readonly seed: number;
  readonly notice: string | null;
}

/**
 * Endless rounds from levels you've passed, or a mix of them. Counts towards
 * the per-control stats but not level progress.
 */
export function PracticeScreen({ audio, packId, levelId, navigate }: PracticeScreenProps) {
  const progress = useProgress();
  const store = progressStore();
  const passed = passedLevels(progress, PACKS);
  const requested = packId && levelId ? levelKey(packId, levelId) : null;
  const [selection, setSelection] = useState<string>(() =>
    requested && passed.some((r) => levelKey(r.pack.id, r.level.id) === requested) ? requested : MIX,
  );
  const choose = useCallback(
    (value: string): PracticeRound | null => {
      const ref = value === MIX ? (passed.length > 0 ? pick(Math.random, passed) : null) : resolveLevel(value, PACKS);
      return ref ? { ref, seed: randomSeed(), notice: null } : null;
    },
    [passed],
  );
  const [round, setRound] = useState<PracticeRound | null>(() => choose(selection));
  const [count, setCount] = useState(1);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);

  const onFirstResult = useCallback(
    (result: RoundResult) => store.update((p) => recordRound(p, result.params.controls)),
    [store],
  );

  const onNext = useCallback(() => {
    setRound(choose(selection));
    setCount((n) => n + 1);
    window.scrollTo({ top: 0 });
  }, [choose, selection]);

  const onSelect = (value: string): void => {
    setSelection(value);
    setRound(choose(value));
    setCount((n) => n + 1);
  };

  const onReplayCode = (text: string): string | null => {
    const parsed = parseReplayCode(text);
    if (!parsed) return "That doesn't look like a replay code.";
    const pack = getPack(parsed.packId);
    const level = pack ? findLevel(pack, parsed.levelId) : undefined;
    if (!pack || !level) return "That code is for a level this version of Dial In doesn't have.";
    const notice =
      parsed.packVersion === pack.version ? null : 'This code is from a different version of the level, so the round may not be the same.';
    setRound({ ref: { pack, level }, seed: parsed.seed, notice });
    setCount((n) => n + 1);
    setCodeDialogOpen(false);
    return null;
  };

  return (
    <div className="screen practice-screen">
      <div className="screen-head">
        <h1 className="screen-title">Practice</h1>
        <p className="card-note">Endless rounds from levels you've passed. They count towards your weakest controls, not level progress.</p>
        <div className="practice-tools">
          {passed.length > 0 && (
            <label className="level-picker">
              <span className="visually-hidden">Level to practise</span>
              <select className="input" value={selection} onChange={(event) => onSelect(event.target.value)}>
                <option value={MIX}>Mix of passed levels</option>
                {PACKS.map((pack) => {
                  const levels = passed.filter((r) => r.pack.id === pack.id);
                  return levels.length === 0 ? null : (
                    <optgroup key={pack.id} label={pack.title}>
                      {levels.map((r) => (
                        <option key={r.level.id} value={levelKey(pack.id, r.level.id)}>
                          {r.level.title}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          )}
          <button type="button" className="button" onClick={() => setCodeDialogOpen(true)}>
            Enter replay code
          </button>
        </div>
      </div>

      {round ? (
        <RoundView
          key={`${count}:${levelKey(round.ref.pack.id, round.ref.level.id)}:${round.seed}`}
          audio={audio}
          pack={round.ref.pack}
          level={round.ref.level}
          seed={round.seed}
          heading={
            <span>
              Practice {count} · {round.ref.level.title}
            </span>
          }
          nextLabel="Next round"
          onNext={onNext}
          onFirstResult={onFirstResult}
          notice={round.notice}
        />
      ) : (
        <div className="card">
          <p>Pass a level and you can practise it here as much as you like.</p>
          <button type="button" className="button primary" onClick={() => navigate({ name: 'home' })}>
            Go to levels
          </button>
        </div>
      )}

      {codeDialogOpen && <ReplayCodeDialog onSubmit={onReplayCode} onCancel={() => setCodeDialogOpen(false)} />}
    </div>
  );
}
