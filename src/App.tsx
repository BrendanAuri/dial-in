import { useState } from 'react';
import { startAudio, type LiveAudio } from './ui/audio';
import { FreePlay } from './ui/screens/FreePlay';
import { RoundScreen } from './ui/screens/RoundScreen';
import { Start } from './ui/screens/Start';

type Screen = 'rounds' | 'freeplay';

const SCREENS: readonly { readonly id: Screen; readonly label: string }[] = [
  { id: 'rounds', label: 'Rounds' },
  { id: 'freeplay', label: 'Free Play' },
];

export function App() {
  const [audio, setAudio] = useState<LiveAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('rounds');

  function start(): void {
    setError(null);
    startAudio().then(setAudio, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }

  if (!audio) return <Start onStart={start} error={error} />;

  return (
    <>
      <header className="app-bar">
        <span className="app-title">Dial In</span>
        <nav className="tabs" aria-label="Mode">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === screen ? 'tab current' : 'tab'}
              aria-current={s.id === screen ? 'page' : undefined}
              onClick={() => setScreen(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>
      {screen === 'rounds' ? <RoundScreen audio={audio} /> : <FreePlay audio={audio} />}
    </>
  );
}
