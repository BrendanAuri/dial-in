import { PACKS } from '../../content';
import { DAILY_SUBMITS, WEAKEST_CONTROLS_SHOWN, WEAKEST_MIN_ROUNDS } from '../../engine/constants';
import { dailyKey, dailyNumber, dailyTiers, isTierAvailable, localDate, streaks } from '../../game/daily';
import { controlName } from '../../engine/params';
import { levelIntroducing, levelNumber } from '../../game/packs';
import {
  isLevelPassed,
  isPackSupported,
  isPackUnlocked,
  packSummary,
  resolveLevel,
  roundsIn,
  suggestedLevel,
  weakestControls,
  type WeakControl,
} from '../../game/progress';
import { progressStore, useProgress } from '../progress';
import type { Navigate } from '../router';

interface HomeProps {
  readonly navigate: Navigate;
}

/** Continue where you left off, the packs, and your weakest controls. */
export function Home({ navigate }: HomeProps) {
  const progress = useProgress();
  const packs = PACKS.filter(isPackSupported);
  const runLevel = progress.run ? resolveLevel(progress.run.level, PACKS) : null;
  const run = progress.run && runLevel && runLevel.pack.version === progress.run.packVersion ? progress.run : null;
  const suggestion = suggestedLevel(progress, PACKS);
  const weak = weakestControls(progress, WEAKEST_CONTROLS_SHOWN, WEAKEST_MIN_ROUNDS);
  const today = localDate(new Date());
  const dailies = dailyTiers(PACKS);
  const firstDaily = dailies[0];
  const streak = streaks(progress, today);

  /** Practise the level that introduces a control, if it's been passed; otherwise a mix. */
  function practise(control: WeakControl): void {
    for (const pack of packs) {
      const level = levelIntroducing(pack, control.id);
      if (level && isLevelPassed(progress, pack, level.id)) {
        navigate({ name: 'practice', packId: pack.id, levelId: level.id });
        return;
      }
    }
    navigate({ name: 'practice' });
  }

  return (
    <div className="screen home">
      {progressStore().rescueKey && (
        <p className="notice" role="status">
          Your saved progress couldn't be read, so it has started fresh. A copy of the old data was kept.
        </p>
      )}

      <section className="card continue" aria-labelledby="continue-title">
        {run && runLevel ? (
          <>
            <h2 id="continue-title" className="card-kicker">
              Continue
            </h2>
            <p className="continue-level">{runLevel.level.title}</p>
            <p className="card-note">
              Round {run.scores.length + 1} of {roundsIn(runLevel.level)} · {runLevel.pack.title}
            </p>
            <button
              type="button"
              className="button primary"
              onClick={() => navigate({ name: 'level', packId: runLevel.pack.id, levelId: runLevel.level.id })}
            >
              Continue
            </button>
          </>
        ) : suggestion ? (
          <>
            <h2 id="continue-title" className="card-kicker">
              {progress.roundsPlayed === 0 ? 'Start here' : 'Next up'}
            </h2>
            <p className="continue-level">
              {levelNumber(suggestion.pack, suggestion.level.id)}. {suggestion.level.title}
            </p>
            <p className="card-note">{suggestion.level.intro}</p>
            <button
              type="button"
              className="button primary"
              onClick={() => navigate({ name: 'level', packId: suggestion.pack.id, levelId: suggestion.level.id })}
            >
              Play
            </button>
          </>
        ) : (
          <>
            <h2 id="continue-title" className="card-kicker">
              All passed
            </h2>
            <p className="card-note">Every level is passed. Keep your ears sharp in Practice, or replay levels for more stars.</p>
            <button type="button" className="button primary" onClick={() => navigate({ name: 'practice' })}>
              Practice
            </button>
          </>
        )}
      </section>

      {dailies.length > 0 && (
        <section className="card daily-card" aria-labelledby="daily-title">
          <h2 id="daily-title" className="card-kicker">
            Daily #{dailyNumber(today)}
          </h2>
          <p className="streak">
            {streak.current > 0 ? `🔥 ${streak.current}-day streak` : 'No streak yet'} · best {streak.best}
          </p>
          <div className="tier-chips">
            {dailies.map((ref) => {
              const record = progress.dailies[dailyKey(today, ref)];
              const status = !isTierAvailable(progress, ref)
                ? '🔒'
                : record?.finished
                  ? `✓ ${record.best}`
                  : record
                    ? `${record.submits}/${DAILY_SUBMITS}`
                    : 'new';
              return (
                <span key={`${ref.pack.id}/${ref.tier.id}`} className="tier-chip">
                  {ref.tier.title} <span className="tier-status">{status}</span>
                </span>
              );
            })}
          </div>
          {dailies.some((ref) => isTierAvailable(progress, ref)) ? (
            <button type="button" className="button primary" onClick={() => navigate({ name: 'daily' })}>
              Play today's daily
            </button>
          ) : (
            <p className="card-note">Pass {firstDaily?.level.title} to unlock the daily challenge.</p>
          )}
        </section>
      )}

      <h2 className="section-title">Packs</h2>
      <div className="pack-list">
        {packs.map((pack) => {
          const summary = packSummary(progress, pack);
          const unlocked = isPackUnlocked(progress, pack, PACKS);
          const required = (pack.requires?.packs ?? []).map((id) => PACKS.find((p) => p.id === id)?.title ?? id);
          return (
            <button
              key={pack.id}
              type="button"
              className={unlocked ? 'pack-card' : 'pack-card locked'}
              onClick={() => navigate({ name: 'pack', packId: pack.id })}
            >
              <span className="pack-title">{pack.title}</span>
              <span className="pack-description">{pack.description}</span>
              {unlocked ? (
                <>
                  <span className="progress-bar" aria-hidden="true">
                    <span style={{ width: `${(summary.passed / summary.total) * 100}%` }} />
                  </span>
                  <span className="pack-meta">
                    {summary.passed} of {summary.total} levels passed · ★ {summary.stars}/{summary.maxStars}
                  </span>
                </>
              ) : (
                <span className="pack-meta">Pass {required.join(' and ')} to unlock</span>
              )}
            </button>
          );
        })}
      </div>

      <h2 className="section-title">Your weakest controls</h2>
      {weak.length === 0 ? (
        <p className="card-note">Play a few rounds and the controls you find hardest will show up here.</p>
      ) : (
        <ul className="weak-list">
          {weak.map((control) => (
            <li key={control.id} className="weak-row">
              <span className="weak-name">{controlName(control.id)}</span>
              <span className="meter wide" role="img" aria-label={`${Math.round(control.closeness * 100)}% close on average`}>
                <span
                  className={control.closeness >= 0.8 ? 'meter-fill good' : control.closeness >= 0.4 ? 'meter-fill fair' : 'meter-fill poor'}
                  style={{ width: `${control.closeness * 100}%` }}
                />
              </span>
              <span className="weak-value">
                {Math.round(control.closeness * 100)}% · {control.rounds} rounds
              </span>
              <button type="button" className="button" onClick={() => practise(control)}>
                Practise
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="hint">Rounds played: {progress.roundsPlayed}</p>
    </div>
  );
}
