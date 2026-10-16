interface StartProps {
  readonly onStart: () => void;
  readonly error: string | null;
}

/** First screen. The tap resumes audio, which mobile browsers only allow from a user gesture. */
export function Start({ onStart, error }: StartProps) {
  return (
    <main className="start">
      <h1 className="start-title">Dial In</h1>
      <p className="start-tagline">Learn synthesis by ear.</p>
      <button type="button" className="button primary start-button" onClick={onStart}>
        Tap to start
      </button>
      {error && (
        <p className="start-error" role="alert">
          Couldn't start audio: {error}
        </p>
      )}
      <ul className="start-tips">
        <li>No sound on a phone? Check the silent switch and the volume.</li>
        <li>Headphones recommended: phone speakers can't play low bass notes.</li>
      </ul>
    </main>
  );
}
