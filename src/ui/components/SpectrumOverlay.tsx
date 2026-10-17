import { OVERLAY_HEADROOM_DB, OVERLAY_RANGE_DB, SPECTRUM_MAX_HZ, SPECTRUM_MIN_HZ } from '../../engine/constants';
import type { PairSpectra } from '../../game/measureAudio';
import type { BandSpectrum } from '../../scoring/spectrum';
import { formatHz } from '../format';
import { axisPosition, formatGridHz, GRID_HZ, levelPosition } from '../spectrumGeometry';

const AXIS = { minHz: SPECTRUM_MIN_HZ, maxHz: SPECTRUM_MAX_HZ };
/** The SVG stretches to fit its box, so it's drawn in a 0–100 unit square. */
const UNITS = 100;
const PERCENT = 100;
/** Spectral centres closer than this many octaves count as the same brightness. */
const SAME_BRIGHTNESS_OCTAVES = 0.15;

function points(spectrum: BandSpectrum, topDb: number): string {
  return spectrum.hz
    .map((hz, i) => {
      const x = axisPosition(hz, AXIS) * UNITS;
      const y = UNITS * (1 - levelPosition(spectrum.db[i] ?? -Infinity, topDb - OVERLAY_RANGE_DB, topDb));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/** "Spectral centre: target 1.80 kHz, yours 900 Hz, so yours is darker." */
export function brightnessCaption(spectra: PairSpectra): string {
  const { target, mine } = spectra;
  const centres = `Spectral centre: target ${formatHz(target.centreHz)}, yours ${formatHz(mine.centreHz)}`;
  if (target.centreHz <= 0 || mine.centreHz <= 0) return `${centres}.`;
  const octaves = Math.log2(mine.centreHz / target.centreHz);
  if (Math.abs(octaves) < SAME_BRIGHTNESS_OCTAVES) return `${centres}, about the same brightness.`;
  return `${centres}, so yours is ${octaves > 0 ? 'brighter' : 'darker'}.`;
}

/** Target and yours, averaged over the whole note, on one log-frequency chart. */
export function SpectrumOverlay({ spectra }: { readonly spectra: PairSpectra }) {
  const topDb = Math.max(...spectra.target.db, ...spectra.mine.db) + OVERLAY_HEADROOM_DB;
  const caption = brightnessCaption(spectra);
  return (
    <figure className="spectrum-overlay">
      <div className="overlay-plot">
        <svg
          viewBox={`0 0 ${UNITS} ${UNITS}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Spectra of the target and yours. ${caption}`}
        >
          {GRID_HZ.map((hz) => {
            const x = axisPosition(hz, AXIS) * UNITS;
            return <line key={hz} className="overlay-grid" x1={x} x2={x} y1={0} y2={UNITS} vectorEffect="non-scaling-stroke" />;
          })}
          <polyline className="overlay-line overlay-target" points={points(spectra.target, topDb)} vectorEffect="non-scaling-stroke" />
          <polyline className="overlay-line overlay-mine" points={points(spectra.mine, topDb)} vectorEffect="non-scaling-stroke" />
        </svg>
        {GRID_HZ.map((hz) => (
          <span key={hz} className="overlay-label" style={{ left: `${axisPosition(hz, AXIS) * PERCENT}%` }} aria-hidden="true">
            {formatGridHz(hz)}
          </span>
        ))}
      </div>
      <figcaption>
        <span className="overlay-key">
          <span className="swatch target" /> Target <span className="swatch mine" /> Yours
        </span>
        <span className="overlay-caption">{caption}</span>
      </figcaption>
    </figure>
  );
}
