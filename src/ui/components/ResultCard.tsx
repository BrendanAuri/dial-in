import { Fragment } from 'react';
import { AUDIO_MATCH_FLOOR, RESULT_TIPS, STAR_SCORES, TIP_CLOSENESS } from '../../engine/constants';
import { controlName, type Patch } from '../../engine/params';
import type { RoundResult } from '../../scoring/scoreRound';
import { formatParam } from '../format';

/** Closeness at or above which a meter shows as "fair" rather than "poor". */
const FAIR_CLOSENESS = 0.4;

interface ResultCardProps {
  readonly result: RoundResult;
  readonly target: Readonly<Patch>;
  /** Best score on this round so far, including this attempt. */
  readonly best: number;
  readonly passMark: number;
  /** The sound has changed since it was submitted. */
  readonly changed: boolean;
  /** The target's sound type ("Pad"), for levels built from templates. */
  readonly soundType: string | null;
  readonly nextLabel: string;
  readonly onRetry: () => void;
  readonly onNext: () => void;
}

function meterClass(closeness: number): string {
  if (closeness >= TIP_CLOSENESS) return 'meter-fill good';
  if (closeness >= FAIR_CLOSENESS) return 'meter-fill fair';
  return 'meter-fill poor';
}

/** Score, stars, the top tips, and every unlocked control compared with the target. */
export function ResultCard({ result, target, best, passMark, changed, soundType, nextLabel, onRetry, onNext }: ResultCardProps) {
  const { score, params, tips, mine } = result;
  const tipFor = new Map(tips.map((tip) => [tip.id, tip.text]));

  return (
    <section className="card result" aria-labelledby="result-title">
      <h2 id="result-title" className="visually-hidden">
        Result
      </h2>
      <div className="result-head">
        <div className="result-score" aria-label={`Score ${score.score} out of 100`}>
          {score.score}
        </div>
        <div className="result-summary">
          <div className="stars" aria-label={`${score.stars} of ${STAR_SCORES.length} stars`}>
            {STAR_SCORES.map((needed, i) => (
              <span key={needed} className={i < score.stars ? 'star-icon on' : 'star-icon'} aria-hidden="true">
                ★
              </span>
            ))}
          </div>
          <div className={score.passed ? 'result-verdict pass' : 'result-verdict'}>
            {score.passed ? 'Passed' : `Not yet: ${passMark} to pass`}
          </div>
          <div className="result-detail">
            Settings {Math.round(score.paramScore)}
            {score.audioScore === null ? ' · sound check unavailable' : ` · Sound ${Math.round(score.audioScore)}`}
          </div>
          {score.liftedBySound && (
            <div className="result-detail">Sounds the same as the target, so it counts as at least {AUDIO_MATCH_FLOOR}</div>
          )}
          {score.hintPenalty > 0 && <div className="result-detail">Includes −{score.hintPenalty} for hints</div>}
          {best > score.score && <div className="result-detail">Best on this round: {best}</div>}
        </div>
      </div>

      {soundType && <p className="result-sound-type">This was a {soundType.toLowerCase()}.</p>}

      {changed && (
        <p className="notice" role="status">
          You've changed your sound since submitting. Submit again to rescore it.
        </p>
      )}

      {tips.length === 0 ? (
        <p className="result-perfect">Spot on. Nothing to fix.</p>
      ) : (
        <ol className="tips">
          {tips.slice(0, RESULT_TIPS).map((tip) => (
            <li key={tip.id}>{tip.text}</li>
          ))}
        </ol>
      )}

      <table className="reveal-table">
        <thead>
          <tr>
            <th scope="col">Control</th>
            <th scope="col">Target</th>
            <th scope="col">Yours</th>
            <th scope="col">
              <span className="visually-hidden">Closeness</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {params.controls.map((control) => {
            const note = control.inaudible ?? tipFor.get(control.id);
            return (
              <Fragment key={control.id}>
                <tr className={control.inaudible ? 'inaudible' : undefined}>
                  <th scope="row">{controlName(control.id)}</th>
                  <td>{formatParam(control.id, target)}</td>
                  <td>{formatParam(control.id, mine)}</td>
                  <td className="meter-cell">
                    {control.inaudible ? (
                      <span className="not-scored">not scored</span>
                    ) : (
                      <span className="meter" role="img" aria-label={`${Math.round(control.closeness * 100)}% close`}>
                        <span className={meterClass(control.closeness)} style={{ width: `${control.closeness * 100}%` }} />
                      </span>
                    )}
                  </td>
                </tr>
                {note && (
                  <tr className={control.inaudible ? 'tip-row inaudible' : 'tip-row'}>
                    <td colSpan={4}>{note}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="form-actions">
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="button primary" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </section>
  );
}
