import { useMemo, useState } from 'react';
import { CHALLENGE_NOTES, DEFAULT_CHALLENGE_NOTE } from '../../engine/constants';
import { noteNameToMidi } from '../../engine/notes';
import { MODULES, PARAMS, PARAM_IDS, paramsInModule, type ParamId, type Patch } from '../../engine/params';
import { challengeInviteText, isPlayableChallenge, soundInviteText, suggestedControls } from '../../game/challenge';
import { encodeShareCode } from '../../game/shareCode';
import { routeUrl, type Route } from '../router';
import { Modal } from './Modal';
import { Selector } from './Selector';
import { ShareBox } from './ShareBox';

type Mode = 'sound' | 'challenge';

const MODE_OPTIONS = [
  { value: 'sound', label: 'The sound' },
  { value: 'challenge', label: 'A challenge' },
] as const;

const NOTE_OPTIONS = CHALLENGE_NOTES.map((note) => ({ value: note, label: note }));

interface ShareDialogProps {
  readonly name: string;
  readonly patch: Readonly<Patch>;
  readonly onClose: () => void;
  /** Play the challenge yourself (leaves Free Play; the working sound is kept). */
  readonly onTry: (route: Route) => void;
}

/** Share a sound as a link: either the sound itself, or a challenge to match it with the controls you pick. */
export function ShareDialog({ name, patch, onClose, onTry }: ShareDialogProps) {
  const [mode, setMode] = useState<Mode>('sound');
  const [noteName, setNoteName] = useState<string>(DEFAULT_CHALLENGE_NOTE);
  const note = noteNameToMidi(noteName);
  const [controls, setControls] = useState<ReadonlySet<ParamId>>(() => new Set(suggestedControls(patch, note)));

  const soundRoute: Route = useMemo(
    () => ({ name: 'shared', kind: 'sound', code: encodeShareCode({ kind: 'sound', name, patch: { ...patch } }) }),
    [name, patch],
  );
  const chosen = PARAM_IDS.filter((id) => controls.has(id));
  const challenge = { kind: 'challenge', name, patch: { ...patch }, controls: chosen, note } as const;
  const playable = isPlayableChallenge(challenge);
  const challengeRoute: Route = { name: 'shared', kind: 'challenge', code: encodeShareCode(challenge) };

  const toggle = (id: ParamId): void => {
    setControls((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal title={`Share "${name}"`} onClose={onClose}>
      <Selector label="Share as" options={MODE_OPTIONS} value={mode} onChange={setMode} hideLabel />

      {mode === 'sound' ? (
        <>
          <p className="card-note">Anyone with the link can play it, keep it and open it in Free Play.</p>
          <ShareBox text={soundInviteText(name)} url={routeUrl(soundRoute)} label="Share link" />
        </>
      ) : (
        <>
          <p className="card-note">
            Pick the controls your friend has to match. They start at their defaults; everything else is set to match your
            sound.
          </p>
          <Selector label="Note it plays" options={NOTE_OPTIONS} value={noteName} onChange={setNoteName} />
          <div className="control-picker">
            <div className="control-picker-tools">
              <button type="button" className="button" onClick={() => setControls(new Set(suggestedControls(patch, note)))}>
                What this sound changes
              </button>
              <button type="button" className="button" onClick={() => setControls(new Set(PARAM_IDS))}>
                All
              </button>
              <button type="button" className="button" onClick={() => setControls(new Set())}>
                None
              </button>
            </div>
            {MODULES.map((module) => (
              <fieldset key={module.id} className="control-group">
                <legend>{module.label}</legend>
                {paramsInModule(module.id).map((id) => (
                  <label key={id} className="control-option">
                    <input type="checkbox" checked={controls.has(id)} onChange={() => toggle(id)} />
                    <span>{PARAMS[id].label}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          {playable ? (
            <>
              <ShareBox text={challengeInviteText(name, chosen.length)} url={routeUrl(challengeRoute)} label="Share challenge" />
              <button type="button" className="button" onClick={() => onTry(challengeRoute)}>
                Try it yourself
              </button>
            </>
          ) : (
            <p className="form-error" role="status">
              Pick at least one control that you've moved away from its default, so there's something to match.
            </p>
          )}
        </>
      )}

      <div className="form-actions">
        <button type="button" className="button primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
