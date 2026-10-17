import { useState } from 'react';
import { startAudio, type LiveAudio } from './ui/audio';
import { UpdatePrompt } from './ui/components/UpdatePrompt';
import { useRoute, type Navigate, type Route } from './ui/router';
import { Calibration } from './ui/screens/Calibration';
import { DailyScreen } from './ui/screens/DailyScreen';
import { FreePlay } from './ui/screens/FreePlay';
import { Home } from './ui/screens/Home';
import { LevelScreen } from './ui/screens/LevelScreen';
import { PackScreen } from './ui/screens/PackScreen';
import { PracticeScreen } from './ui/screens/PracticeScreen';
import { Start } from './ui/screens/Start';

type Tab = 'home' | 'practice' | 'freeplay';

const TABS: readonly { readonly id: Tab; readonly label: string; readonly route: Route }[] = [
  { id: 'home', label: 'Home', route: { name: 'home' } },
  { id: 'practice', label: 'Practice', route: { name: 'practice' } },
  { id: 'freeplay', label: 'Free Play', route: { name: 'freeplay' } },
];

function tabOf(route: Route): Tab {
  if (route.name === 'practice') return 'practice';
  if (route.name === 'freeplay') return 'freeplay';
  return 'home';
}

export function App() {
  const [route, navigate] = useRoute();
  return (
    <>
      {route.name === 'calibrate' ? <Calibration /> : <MainApp route={route} navigate={navigate} />}
      <UpdatePrompt />
    </>
  );
}

function MainApp({ route, navigate }: { readonly route: Route; readonly navigate: Navigate }) {
  const [audio, setAudio] = useState<LiveAudio | null>(null);
  const [error, setError] = useState<string | null>(null);

  function start(): void {
    setError(null);
    startAudio().then(setAudio, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }

  if (!audio) return <Start onStart={start} error={error} />;

  const current = tabOf(route);
  return (
    <>
      <header className="app-bar">
        <button type="button" className="app-title" onClick={() => navigate({ name: 'home' })}>
          Dial In
        </button>
        <nav className="tabs" aria-label="Mode">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === current ? 'tab current' : 'tab'}
              aria-current={tab.id === current ? 'page' : undefined}
              onClick={() => navigate(tab.route)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <Screen route={route} audio={audio} navigate={navigate} />
    </>
  );
}

function Screen({ route, audio, navigate }: { readonly route: Route; readonly audio: LiveAudio; readonly navigate: Navigate }) {
  switch (route.name) {
    case 'home':
    case 'calibrate':
      return <Home navigate={navigate} />;
    case 'pack':
      return <PackScreen key={route.packId} packId={route.packId} navigate={navigate} />;
    case 'level':
      return (
        <LevelScreen
          key={`${route.packId}/${route.levelId}`}
          audio={audio}
          packId={route.packId}
          levelId={route.levelId}
          navigate={navigate}
        />
      );
    case 'practice':
      return (
        <PracticeScreen
          key={`${route.packId ?? ''}/${route.levelId ?? ''}`}
          audio={audio}
          packId={route.packId}
          levelId={route.levelId}
          navigate={navigate}
        />
      );
    case 'daily':
      return <DailyScreen key={route.date ?? 'today'} audio={audio} date={route.date} navigate={navigate} />;
    case 'freeplay':
      return <FreePlay audio={audio} />;
  }
}
