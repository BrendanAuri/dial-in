import { useState } from 'react';
import { startAudio, type LiveAudio } from './ui/audio';
import { FreePlay } from './ui/screens/FreePlay';
import { Start } from './ui/screens/Start';

export function App() {
  const [audio, setAudio] = useState<LiveAudio | null>(null);
  const [error, setError] = useState<string | null>(null);

  function start(): void {
    setError(null);
    startAudio().then(setAudio, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }

  return audio ? <FreePlay audio={audio} /> : <Start onStart={start} error={error} />;
}
