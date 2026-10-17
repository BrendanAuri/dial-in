import { useCallback, useEffect, useMemo, useState } from 'react';
import { PACKS } from '../../content';
import type { Level, Pack } from '../../content/schema';
import { findLevel, getPack, levelNumber, nextLevel } from '../../game/packs';
import {
  advanceRun,
  finishRun,
  isLevelUnlocked,
  levelKey,
  levelRecord,
  passMarkOf,
  recordRound,
  roundsIn,
  runAverage,
  startRun,
} from '../../game/progress';
import { randomSeed } from '../../game/rng';
import type { RoundResult } from '../../scoring/scoreRound';
import type { LiveAudio } from '../audio';
import { LevelSummary } from '../components/LevelSummary';
import { RoundView } from '../components/RoundView';
import { progressStore, useProgress } from '../progress';
import type { Navigate } from '../router';

interface LevelScreenProps {
  readonly audio: LiveAudio;
  readonly packId: string;
  readonly levelId: string;
  readonly navigate: Navigate;
}

export function LevelScreen({ audio, packId, levelId, navigate }: LevelScreenProps) {
  const pack = getPack(packId);
  const level = pack ? findLevel(pack, levelId) : undefined;
  if (!pack || !level) {
    return (
      <div className="screen">
        <p>That level doesn't exist.</p>
        <button type="button" className="button" onClick={() => navigate({ name: 'home' })}>
          Home
        </button>
      </div>
    );
  }
  return <LevelRun audio={audio} pack={pack} level={level} navigate={navigate} />;
}

interface Summary {
  readonly scores: readonly number[];
  readonly previousBest: number | null;
}

/**
 * A run through a level: its rounds one after another, saved after each,
 * then a summary. Passing (average ≥ pass mark) unlocks the next level.
 */
function LevelRun({ audio, pack, level, navigate }: Omit<LevelScreenProps, 'packId' | 'levelId'> & { readonly pack: Pack; readonly level: Level }) {
  const progress = useProgress();
  const store = progressStore();
  const ref = useMemo(() => ({ pack, level }), [pack, level]);
  const key = levelKey(pack.id, level.id);
  const total = roundsIn(level);
  const unlocked = isLevelUnlocked(progress, pack, level.id, PACKS);
  const run = progress.run?.level === key && progress.run.packVersion === pack.version ? progress.run : null;
  const [summary, setSummary] = useState<Summary | null>(null);
  const following = nextLevel(pack, level.id);

  // Start a run (replacing any run in another level) unless one is already going here.
  useEffect(() => {
    if (unlocked && !run && !summary) store.update((p) => startRun(p, ref, randomSeed()));
  }, [unlocked, run, summary, store, ref]);

  const onFirstResult = useCallback(
    (result: RoundResult) => store.update((p) => recordRound(p, result.params.controls)),
    [store],
  );

  const onNext = useCallback(
    (best: number) => {
      if (!run) return;
      const scores = [...run.scores, best];
      if (scores.length < total) {
        store.update((p) => advanceRun(p, best, randomSeed()));
        return;
      }
      setSummary({ scores, previousBest: levelRecord(store.getSnapshot(), ref)?.best ?? null });
      store.update((p) => finishRun(p, ref, scores));
      window.scrollTo({ top: 0 });
    },
    [run, total, store, ref],
  );

  const roundIndex = run?.scores.length ?? 0;

  return (
    <div className="screen level-screen">
      <div className="screen-head">
        <button type="button" className="back-link" onClick={() => navigate({ name: 'pack', packId: pack.id })}>
          ← {pack.title}
        </button>
        <h1 className="screen-title">
          {levelNumber(pack, level.id)}. {level.title}
        </h1>
      </div>

      {!unlocked ? (
        <div className="card">
          <p>This level is locked. Pass the level before it to unlock it.</p>
          <button type="button" className="button" onClick={() => navigate({ name: 'pack', packId: pack.id })}>
            All levels
          </button>
        </div>
      ) : summary ? (
        <LevelSummary
          levelTitle={level.title}
          scores={summary.scores}
          average={runAverage(summary.scores)}
          passMark={passMarkOf(level)}
          previousBest={summary.previousBest}
          nextLevelTitle={following?.title ?? null}
          onNextLevel={() => following && navigate({ name: 'level', packId: pack.id, levelId: following.id })}
          onRetry={() => setSummary(null)}
          onBack={() => navigate({ name: 'pack', packId: pack.id })}
        />
      ) : run ? (
        <RoundView
          key={`${key}:${roundIndex}:${run.seed}`}
          audio={audio}
          pack={pack}
          level={level}
          seed={run.seed}
          heading={
            <span className="run-progress">
              Round {roundIndex + 1} of {total}
              <span className="run-dots" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={i < roundIndex ? 'dot done' : i === roundIndex ? 'dot current' : 'dot'} />
                ))}
              </span>
            </span>
          }
          nextLabel={roundIndex + 1 >= total ? 'Finish level' : 'Next round'}
          onNext={onNext}
          onFirstResult={onFirstResult}
        />
      ) : null}
    </div>
  );
}
