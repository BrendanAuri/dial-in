import { useSpectrumShown } from '../preferences';
import { LiveSpectrum } from './LiveSpectrum';

interface SpectrumStripProps {
  readonly analyser: AnalyserNode;
  /** CSS custom property for the colour, e.g. "--target". */
  readonly colorVar: string;
  readonly label?: string;
  readonly maskedMessage?: string | null;
}

/** The live spectrum with a hide / show toggle that's remembered between visits. */
export function SpectrumStrip({ analyser, colorVar, label, maskedMessage }: SpectrumStripProps) {
  const [shown, setShown] = useSpectrumShown();
  if (!shown) {
    return (
      <button type="button" className="spectrum-toggle show" onClick={() => setShown(true)}>
        Show spectrum
      </button>
    );
  }
  return (
    <div className="spectrum-strip">
      <LiveSpectrum analyser={analyser} colorVar={colorVar} label={label} maskedMessage={maskedMessage} />
      <button type="button" className="spectrum-toggle hide" onClick={() => setShown(false)} aria-label="Hide spectrum">
        ×
      </button>
    </div>
  );
}
