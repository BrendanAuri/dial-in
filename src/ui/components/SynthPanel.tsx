import { memo } from 'react';
import { MODULES, paramsInModule, type ParamId, type Patch } from '../../engine/params';
import { ParamControl } from './ParamControl';

interface SynthPanelProps {
  readonly patch: Readonly<Patch>;
  readonly onChange: (id: ParamId, value: unknown) => void;
  /** Controls shown greyed out and fixed. */
  readonly locked?: ReadonlySet<ParamId>;
}

/** Every engine control, grouped by module. */
export const SynthPanel = memo(function SynthPanel({ patch, onChange, locked }: SynthPanelProps) {
  return (
    <main className="modules">
      {MODULES.map((module) => {
        const ids = paramsInModule(module.id);
        const allLocked = locked !== undefined && ids.every((id) => locked.has(id));
        return (
          <section
            key={module.id}
            className={allLocked ? 'module locked' : 'module'}
            aria-labelledby={`module-${module.id}`}
          >
            <h2 id={`module-${module.id}`} className="module-title">
              {module.label}
              {allLocked && <span className="module-badge">Locked</span>}
            </h2>
            {/* A fully locked module is just its title, to keep the unlocked controls close together. */}
            {!allLocked && (
              <div className="module-controls">
                {ids.map((id) => (
                  <ParamControl key={id} id={id} patch={patch} onChange={onChange} disabled={locked?.has(id)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
});
