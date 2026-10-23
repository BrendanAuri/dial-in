import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_HOLD_TIME, DEFAULT_NOTE, LIVE_START_DELAY, PASS_MARK } from '../../engine/constants';
import { noteNameToMidi } from '../../engine/notes';
import { controlName } from '../../engine/params';
import { patchesEqual } from '../../engine/patch';
import { buildVoice, type VoiceHandle } from '../../engine/voice';
import { challengeResultText, challengeRound, isPlayableChallenge } from '../../game/challenge';
import { recordRound } from '../../game/progress';
import { decodeShareCode, type Challenge, type SharedSound } from '../../game/shareCode';
import { newId } from '../../library/ids';
import { keepSound, loadLibrary, type KeepOutcome } from '../../library/libraryStore';
import type { RoundResult } from '../../scoring/scoreRound';
import { browserStore, requestPersistentStorage } from '../../storage/storage';
import type { LiveAudio } from '../audio';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RoundPlayer, type Attempts } from '../components/RoundView';
import { ShareBox } from '../components/ShareBox';
import { progressStore } from '../progress';
import { routeUrl, type Navigate } from '../router';
import { openInFreePlay, unsavedSessionName } from '../session';

interface SharedScreenProps {
  readonly audio: LiveAudio;
  readonly code: string;
  readonly navigate: Navigate;
}

/** Where a shared link lands: a sound to play and keep, or a challenge to match. */
export function SharedScreen({ audio, code, navigate }: SharedScreenProps) {
  const decoded = useMemo(() => decodeShareCode(code), [code]);
  if (!decoded.ok) {
    return (
      <div className="screen">
        <section className="card">
          <h1 className="screen-title">This link doesn't work</h1>
          <p>
            {decoded.reason === 'newer'
              ? 'It was made with a newer version of Dial In. Reload the app to update it, then open the link again.'
              : 'It may have been cut short or changed when it was copied. Ask for it again, or copy the whole link.'}
          </p>
          <button type="button" className="button primary" onClick={() => navigate({ name: 'home' })}>
            Home
          </button>
        </section>
      </div>
    );
  }
  return decoded.shared.kind === 'sound' ? (
    <SharedSoundView audio={audio} sound={decoded.shared} navigate={navigate} />
  ) : (
    <ChallengeView audio={audio} challenge={decoded.shared} code={code} navigate={navigate} />
  );
}

const SAVED_MESSAGES: Readonly<Record<KeepOutcome, string>> = {
  kept: 'Saved to your sounds.',
  already: "It's already in your sounds.",
  failed: "Couldn't save it: your sounds couldn't be read or the browser refused.",
};

interface SharedSoundViewProps {
  readonly audio: LiveAudio;
  readonly sound: SharedSound;
  readonly navigate: Navigate;
}

/** A shared sound: hear it, save it, or open it in Free Play. */
function SharedSoundView({ audio, sound, navigate }: SharedSoundViewProps) {
  const [store] = useState(browserStore);
  const [saved, setSaved] = useState<KeepOutcome | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const voice = useRef<VoiceHandle | null>(null);

  useEffect(() => () => void voice.current?.stop(audio.ctx.currentTime), [audio]);

  const play = (): void => {
    if (audio.ctx.state !== 'running') void audio.ctx.resume();
    const time = audio.ctx.currentTime + LIVE_START_DELAY;
    voice.current?.stop(time);
    voice.current = buildVoice(audio.ctx, sound.patch, noteNameToMidi(DEFAULT_NOTE), time, audio.output);
    voice.current.release(time + DEFAULT_HOLD_TIME);
  };

  const save = (): void => {
    setSaved(keepSound(store, { name: sound.name, tags: ['shared'], patch: sound.patch }, { id: newId(), now: Date.now() }));
    void requestPersistentStorage();
  };

  const open = useCallback(() => {
    // If it's in the library (saved here or before), open that copy so Save updates it.
    const existing = loadLibrary(store, Date.now()).library.sounds.find((s) => patchesEqual(s.patch, sound.patch));
    openInFreePlay(store, { name: existing?.name ?? sound.name, patch: sound.patch, id: existing?.id ?? null });
    navigate({ name: 'freeplay' });
  }, [store, sound, navigate]);

  const requestOpen = (): void => {
    const unsaved = unsavedSessionName(store);
    if (unsaved !== null) setConfirming(unsaved);
    else open();
  };

  return (
    <div className="screen shared-screen">
      <div className="screen-head">
        <p className="card-kicker">A shared sound</p>
        <h1 className="screen-title">{sound.name}</h1>
        <p className="card-note">Someone made this in Dial In and sent it to you. Play it, keep it, or open it in Free Play to see how it's made.</p>
      </div>
      <section className="card">
        <div className="form-actions shared-actions">
          <button type="button" className="button primary" onClick={play}>
            ▶ Play
          </button>
          <button type="button" className="button" onClick={save} disabled={saved === 'kept' || saved === 'already'}>
            Save to my sounds
          </button>
          <button type="button" className="button" onClick={requestOpen}>
            Open in Free Play
          </button>
        </div>
        {saved && (
          <p className="card-note" role="status">
            {SAVED_MESSAGES[saved]}
          </p>
        )}
      </section>
      {confirming !== null && (
        <ConfirmDialog
          title="Replace your sound in Free Play?"
          message={`"${confirming}" has unsaved changes in Free Play. They'll be lost.`}
          confirmLabel="Replace"
          destructive
          onConfirm={open}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

interface ChallengeViewProps {
  readonly audio: LiveAudio;
  readonly challenge: Challenge;
  readonly code: string;
  readonly navigate: Navigate;
}

/** A shared challenge: match someone's sound with the controls they chose. */
function ChallengeView({ audio, challenge, code, navigate }: ChallengeViewProps) {
  const round = useMemo(() => challengeRound(challenge), [challenge]);
  const playable = useMemo(() => isPlayableChallenge(challenge), [challenge]);
  const [best, setBest] = useState<number | null>(null);
  const store = progressStore();

  // Challenges count towards your weakest controls, like Practice.
  const onFirstResult = useCallback(
    (result: RoundResult) => store.update((p) => recordRound(p, result.params.controls)),
    [store],
  );
  const onAttempts = useCallback((attempts: Attempts) => setBest(attempts.best), []);

  const controls = round.unlocked.map(controlName);
  const intro = `You get ${controls.length === 1 ? 'one control' : `${controls.length} controls`}: ${controls.join(', ')}. Everything else is already set to match.`;
  const link = routeUrl({ name: 'shared', kind: 'challenge', code });

  return (
    <div className="screen challenge-screen">
      <div className="screen-head">
        <p className="card-kicker">A challenge</p>
        <h1 className="screen-title">{challenge.name}</h1>
        <p className="card-note">Someone made this sound and wants to see if you can match it.</p>
      </div>
      {playable ? (
        <RoundPlayer
          audio={audio}
          round={round}
          intro={intro}
          passMark={PASS_MARK}
          replayCode={null}
          soundType={null}
          keepName={challenge.name}
          keepTags={['matched', 'challenge']}
          heading={<span>Match "{challenge.name}"</span>}
          nextLabel={null}
          onFirstResult={onFirstResult}
          onAttempts={onAttempts}
          afterResult={
            best !== null && (
              <section className="card share-card" aria-label="Share your score">
                <ShareBox text={challengeResultText(challenge.name, best)} url={link} label="Share score" />
                <button type="button" className="button" onClick={() => navigate({ name: 'freeplay' })}>
                  Make your own challenge in Free Play
                </button>
              </section>
            )
          }
        />
      ) : (
        <section className="card">
          <p>There's nothing to match in this challenge: every control it gives you already sounds like the target.</p>
          <button type="button" className="button primary" onClick={() => navigate({ name: 'home' })}>
            Home
          </button>
        </section>
      )}
    </div>
  );
}
