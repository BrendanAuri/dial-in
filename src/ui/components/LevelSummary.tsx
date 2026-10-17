import { STAR_SCORES } from '../../engine/constants';
import { starsFor } from '../../scoring/finalScore';

interface LevelSummaryProps {
  readonly levelTitle: string;
  readonly scores: readonly number[];
  readonly average: number;
  readonly passMark: number;
  /** The level's best average before this run, if it had been played. */
  readonly previousBest: number | null;
  /** Title of the level this run unlocked (or that was already open), if there is one. */
  readonly nextLevelTitle: string | null;
  readonly onNextLevel: () => void;
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

/** End of a level run: the average, pass or not, stars and each round's score. */
export function LevelSummary(props: LevelSummaryProps) {
  const { scores, average, passMark, previousBest, nextLevelTitle } = props;
  const passed = average >= passMark;
  const stars = starsFor(average);
  const newBest = previousBest !== null && average > previousBest;
  return (
    <section className="card level-summary" aria-labelledby="summary-title">
      <h2 id="summary-title" className="card-kicker">
        {props.levelTitle}: {passed ? 'level passed' : 'not passed yet'}
      </h2>
      <div className="result-head">
        <div className="result-score" aria-label={`Average ${average} out of 100`}>
          {average}
        </div>
        <div className="result-summary">
          <div className="stars" aria-label={`${stars} of ${STAR_SCORES.length} stars`}>
            {STAR_SCORES.map((needed, i) => (
              <span key={needed} className={i < stars ? 'star-icon on' : 'star-icon'} aria-hidden="true">
                ★
              </span>
            ))}
          </div>
          <div className={passed ? 'result-verdict pass' : 'result-verdict'}>
            {passed ? (nextLevelTitle ? `Unlocked: ${nextLevelTitle}` : 'Pack complete!') : `Average ${passMark} to pass`}
          </div>
          {newBest && <div className="result-detail">New best (was {previousBest})</div>}
        </div>
      </div>
      <ol className="round-scores">
        {scores.map((score, i) => (
          <li key={i}>
            Round {i + 1}: <strong>{score}</strong>
          </li>
        ))}
      </ol>
      <div className="form-actions">
        <button type="button" className="button" onClick={props.onBack}>
          All levels
        </button>
        <button type="button" className={passed && nextLevelTitle ? 'button' : 'button primary'} onClick={props.onRetry}>
          Play again
        </button>
        {passed && nextLevelTitle && (
          <button type="button" className="button primary" onClick={props.onNextLevel}>
            Next level
          </button>
        )}
      </div>
    </section>
  );
}
