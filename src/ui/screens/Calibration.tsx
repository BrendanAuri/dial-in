import { useEffect, useRef, useState } from 'react';
import { ComparePlayer, type Side } from '../../engine/comparePlayer';
import { AUDIO_CALIBRATION, DEFAULT_HOLD_TIME, LIVE_START_DELAY, PASS_MARK } from '../../engine/constants';
import { noteNameToMidi } from '../../engine/notes';
import { PARAM_IDS } from '../../engine/params';
import { measureAudio } from '../../game/measureAudio';
import type { AudioScore } from '../../scoring/audioScore';
import { finalScore } from '../../scoring/finalScore';
import { scoreParams } from '../../scoring/paramScore';
import { startAudio } from '../audio';
import { CALIBRATION_CASES, type CalibrationCase, type CaseKind } from '../calibrationCases';

const NOTE = noteNameToMidi('C3');
const KINDS: readonly CaseKind[] = ['identical', 'slight', 'large'];

interface Row {
  readonly testCase: CalibrationCase;
  readonly paramScore: number;
  readonly audio: AudioScore | null;
  readonly final: number;
}

function fixed(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '–';
}

/**
 * Hidden dev page (open the app with #calibrate): renders the calibration
 * pairs and prints raw audio distances and part scores, so the constants in
 * AUDIO_CALIBRATION can be tuned by ear.
 */
export function Calibration() {
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [running, setRunning] = useState(false);
  const player = useRef<ComparePlayer | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const runToken = useRef(0);

  /** Render every case in turn. A newer run supersedes an older one still in progress. */
  async function run(): Promise<void> {
    const token = ++runToken.current;
    setRunning(true);
    setRows([]);
    const context = { note: NOTE, holdTime: DEFAULT_HOLD_TIME };
    for (const testCase of CALIBRATION_CASES) {
      const audio = (await measureAudio(testCase.a, testCase.b, NOTE, DEFAULT_HOLD_TIME))?.score ?? null;
      if (runToken.current !== token) return;
      const paramScore = scoreParams(testCase.a, testCase.b, PARAM_IDS, context).score;
      const final = finalScore(paramScore, audio?.score ?? null, 0, PASS_MARK).score;
      setRows((current) => [...current, { testCase, paramScore, audio, final }]);
    }
    setRunning(false);
  }

  useEffect(() => {
    void run();
    return () => {
      runToken.current++;
    };
  }, []);

  async function play(testCase: CalibrationCase, side: Side): Promise<void> {
    const live = await startAudio();
    if (!player.current || audioCtx.current !== live.ctx) {
      player.current = new ComparePlayer(live.ctx, live.output);
      audioCtx.current = live.ctx;
    }
    const time = live.ctx.currentTime + LIVE_START_DELAY;
    player.current.play(side, { target: testCase.a, mine: testCase.b }, NOTE, time, DEFAULT_HOLD_TIME);
  }

  const summary = KINDS.map((kind) => {
    const scores = rows.filter((row) => row.testCase.kind === kind && row.audio).map((row) => row.audio?.score ?? 0);
    return {
      kind,
      count: scores.length,
      min: scores.length ? Math.min(...scores) : NaN,
      mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : NaN,
      max: scores.length ? Math.max(...scores) : NaN,
    };
  });

  return (
    <div className="screen calibration">
      <header className="top-bar">
        <h1 className="calibration-title">Audio score calibration</h1>
        <button type="button" className="button" onClick={() => void run()} disabled={running}>
          {running ? `Rendering ${rows.length}/${CALIBRATION_CASES.length}…` : 'Run again'}
        </button>
      </header>
      <p className="card-note">
        Each part scores 100 up to “perfect” and 0 from “zero”. Identical pairs should score 100, slight changes
        high, large ones low. Edit <code>AUDIO_CALIBRATION</code> in <code>engine/constants.ts</code>. Play A and B to
        judge by ear.
      </p>
      <pre className="calibration-constants">{JSON.stringify(AUDIO_CALIBRATION, null, 1)}</pre>

      <table className="calibration-table">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Pairs</th>
            <th>Sound min</th>
            <th>Sound mean</th>
            <th>Sound max</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.kind}>
              <th>{s.kind}</th>
              <td>{s.count}</td>
              <td>{fixed(s.min, 0)}</td>
              <td>{fixed(s.mean, 0)}</td>
              <td>{fixed(s.max, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="calibration-table">
        <thead>
          <tr>
            <th>Sound</th>
            <th>Change</th>
            <th>Settings</th>
            <th>Loudness dB</th>
            <th>Brightness oct</th>
            <th>Timbre</th>
            <th>Low end dB</th>
            <th>Sound</th>
            <th>Final</th>
            <th>Listen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { testCase, audio } = row;
            return (
              <tr key={`${testCase.base}/${testCase.change}`} className={`kind-${testCase.kind}`}>
                <td>{testCase.base}</td>
                <td>{testCase.change}</td>
                <td>{fixed(row.paramScore, 0)}</td>
                <td>
                  {audio ? `${fixed(audio.distances.loudnessDb)} → ${fixed(audio.parts.loudness, 0)}` : 'n/a'}
                </td>
                <td>
                  {audio ? `${fixed(audio.distances.brightnessOctaves, 3)} → ${fixed(audio.parts.brightness, 0)}` : 'n/a'}
                </td>
                <td>{audio ? `${fixed(audio.distances.timbre, 1)} → ${fixed(audio.parts.timbre, 0)}` : 'n/a'}</td>
                <td>
                  {audio && audio.distances.lowEndDb !== null && audio.parts.lowEnd !== null
                    ? `${fixed(audio.distances.lowEndDb)} → ${fixed(audio.parts.lowEnd, 0)}`
                    : '–'}
                </td>
                <td>
                  <strong>{audio ? fixed(audio.score, 0) : 'n/a'}</strong>
                </td>
                <td>{row.final}</td>
                <td className="calibration-play">
                  <button type="button" className="button" onClick={() => void play(testCase, 'target')}>
                    A
                  </button>
                  <button type="button" className="button" onClick={() => void play(testCase, 'mine')}>
                    B
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
