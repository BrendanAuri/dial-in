import type { ParamId, Patch } from '../../engine/params';
import { controlName, formatParam } from '../format';

interface RevealCardProps {
  readonly unlocked: readonly ParamId[];
  readonly target: Readonly<Patch>;
  readonly mine: Readonly<Patch>;
  readonly onRetry: () => void;
  readonly onNext: () => void;
}

/**
 * Target vs yours for every unlocked control. Scores and tips are added
 * with parameter scoring (Milestone 4).
 */
export function RevealCard({ unlocked, target, mine, onRetry, onNext }: RevealCardProps) {
  return (
    <section className="card reveal" aria-labelledby="reveal-title">
      <h2 id="reveal-title" className="card-title">
        Target vs yours
      </h2>
      <p className="card-note">Scoring isn't built yet, so compare the values to see how close you were.</p>
      <table className="reveal-table">
        <thead>
          <tr>
            <th scope="col">Control</th>
            <th scope="col">Target</th>
            <th scope="col">Yours</th>
          </tr>
        </thead>
        <tbody>
          {unlocked.map((id) => {
            const targetText = formatParam(id, target);
            const mineText = formatParam(id, mine);
            const same = targetText === mineText;
            return (
              <tr key={id} className={same ? 'same' : undefined}>
                <th scope="row">{controlName(id)}</th>
                <td>{targetText}</td>
                <td>
                  {mineText}
                  {same && <span className="match"> ✓</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="form-actions">
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="button primary" onClick={onNext}>
          Next round
        </button>
      </div>
    </section>
  );
}
