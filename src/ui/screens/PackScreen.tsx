import { PACKS } from '../../content';
import { controlName } from '../../engine/params';
import { getPack, levelNumber } from '../../game/packs';
import {
  isLevelUnlocked,
  isPackUnlocked,
  levelKey,
  levelRecord,
  packSummary,
  roundsIn,
} from '../../game/progress';
import { useProgress } from '../progress';
import type { Navigate } from '../router';

interface PackScreenProps {
  readonly packId: string;
  readonly navigate: Navigate;
}

/** A pack's chapters and levels, with what's locked, open and passed. */
export function PackScreen({ packId, navigate }: PackScreenProps) {
  const progress = useProgress();
  const pack = getPack(packId);
  if (!pack) {
    return (
      <div className="screen">
        <p>That pack doesn't exist.</p>
        <button type="button" className="button" onClick={() => navigate({ name: 'home' })}>
          Home
        </button>
      </div>
    );
  }
  const summary = packSummary(progress, pack);
  const packUnlocked = isPackUnlocked(progress, pack, PACKS);

  return (
    <div className="screen pack-screen">
      <div className="screen-head">
        <button type="button" className="back-link" onClick={() => navigate({ name: 'home' })}>
          ← Home
        </button>
        <h1 className="screen-title">{pack.title}</h1>
        <p className="card-note">
          {pack.description} {summary.passed} of {summary.total} passed · ★ {summary.stars}/{summary.maxStars}
        </p>
      </div>

      {pack.chapters.map((chapter) => (
        <section key={chapter.id} className="chapter" aria-labelledby={`chapter-${chapter.id}`}>
          <h2 id={`chapter-${chapter.id}`} className="section-title">
            {chapter.title}
          </h2>
          <p className="card-note">{chapter.description}</p>
          <ol className="level-list">
            {chapter.levels.map((level) => {
              const unlocked = packUnlocked && isLevelUnlocked(progress, pack, level.id, PACKS);
              const record = levelRecord(progress, { pack, level });
              const inProgress = progress.run?.level === levelKey(pack.id, level.id) ? progress.run : null;
              const status = !unlocked
                ? 'Locked'
                : inProgress
                  ? `Round ${inProgress.scores.length + 1} of ${roundsIn(level)}`
                  : record?.passed
                    ? `Best ${record.best}`
                    : record
                      ? `Best ${record.best} · not passed yet`
                      : 'New';
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    className={`level-row${unlocked ? '' : ' locked'}${record?.passed ? ' passed' : ''}`}
                    disabled={!unlocked}
                    onClick={() => navigate({ name: 'level', packId: pack.id, levelId: level.id })}
                  >
                    <span className="level-number" aria-hidden="true">
                      {record?.passed ? '✓' : unlocked ? levelNumber(pack, level.id) : '🔒'}
                    </span>
                    <span className="level-text">
                      <span className="level-title">
                        {levelNumber(pack, level.id)}. {level.title}
                      </span>
                      <span className="level-new">
                        {level.newControls.length > 0
                          ? `New: ${level.newControls.map(controlName).join(', ')}`
                          : 'Everything together'}
                      </span>
                    </span>
                    <span className="level-status">
                      {record && record.stars > 0 && (
                        <span className="level-stars" aria-label={`${record.stars} of 3 stars`}>
                          {'★'.repeat(record.stars)}
                          <span className="star-empty">{'★'.repeat(3 - record.stars)}</span>
                        </span>
                      )}
                      <span>{status}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
