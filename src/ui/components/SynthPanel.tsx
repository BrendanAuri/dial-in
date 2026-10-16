import { memo } from 'react';
import { MODULES, paramsInModule, type ParamId, type Patch } from '../../engine/params';
import { ParamControl } from './ParamControl';

interface SynthPanelProps {
  readonly patch: Readonly<Patch>;
  readonly onChange: (id: ParamId, value: unknown) => void;
}

/** Every engine control, grouped by module. */
export const SynthPanel = memo(function SynthPanel({ patch, onChange }: SynthPanelProps) {
  return (
    <main className="modules">
      {MODULES.map((module) => (
        <section key={module.id} className="module" aria-labelledby={`module-${module.id}`}>
          <h2 id={`module-${module.id}`} className="module-title">
            {module.label}
          </h2>
          <div className="module-controls">
            {paramsInModule(module.id).map((id) => (
              <ParamControl key={id} id={id} patch={patch} onChange={onChange} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
});
