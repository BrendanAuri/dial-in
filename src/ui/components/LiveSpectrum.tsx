import { useEffect, useRef } from 'react';
import { ANALYSER_MAX_DB, ANALYSER_MIN_DB, SPECTRUM_MAX_HZ, SPECTRUM_MIN_HZ } from '../../engine/constants';
import { axisPosition, columnBins, formatGridHz, GRID_HZ, levelPosition } from '../spectrumGeometry';

const AXIS = { minHz: SPECTRUM_MIN_HZ, maxHz: SPECTRUM_MAX_HZ };
/** Draw one column every this many CSS pixels. */
const COLUMN_PX = 2;
const LABEL_FONT_PX = 10;

interface LiveSpectrumProps {
  readonly analyser: AnalyserNode;
  /** CSS custom property holding the colour, e.g. "--target", to show which side of an A/B you're hearing. */
  readonly colorVar: string;
  readonly label?: string;
  /** Draw only the grid and this message, e.g. to keep a challenge target's spectrum hidden. */
  readonly maskedMessage?: string | null;
}

/** A live, log-frequency spectrum of everything playing, drawn every animation frame. */
export function LiveSpectrum({ analyser, colorVar, label = 'Live spectrum of what’s playing', maskedMessage = null }: LiveSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef('#888');
  const maskRef = useRef<string | null>(maskedMessage);

  useEffect(() => {
    maskRef.current = maskedMessage;
  }, [maskedMessage]);

  // Canvas can't use var(), so resolve the custom property whenever it changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) colorRef.current = getComputedStyle(canvas).getPropertyValue(colorVar).trim() || colorRef.current;
  }, [colorVar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const data = new Float32Array(analyser.frequencyBinCount);
    let columns: [number, number][] = [];
    let frame = 0;

    const resize = (): void => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      columns = columnBins(Math.max(1, Math.floor(canvas.clientWidth / COLUMN_PX)), analyser.context.sampleRate, analyser.fftSize, AXIS);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const styles = getComputedStyle(canvas);
    const gridColor = styles.getPropertyValue('--border').trim() || '#333';
    const textColor = styles.getPropertyValue('--text-muted').trim() || '#999';

    const draw = (): void => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      g.clearRect(0, 0, width, height);

      g.strokeStyle = gridColor;
      g.fillStyle = textColor;
      g.lineWidth = 1;
      g.font = `${LABEL_FONT_PX}px system-ui, sans-serif`;
      for (const hz of GRID_HZ) {
        const x = Math.round(axisPosition(hz, AXIS) * width) + 0.5;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, height);
        g.stroke();
        g.fillText(formatGridHz(hz), x + 3, LABEL_FONT_PX + 2);
      }

      const mask = maskRef.current;
      if (mask) {
        g.fillStyle = textColor;
        g.textAlign = 'center';
        g.fillText(mask, width / 2, height / 2 + LABEL_FONT_PX / 2);
        g.textAlign = 'start';
        frame = requestAnimationFrame(draw);
        return;
      }

      analyser.getFloatFrequencyData(data);
      g.beginPath();
      g.moveTo(0, height);
      columns.forEach(([start, end], i) => {
        let peak = -Infinity;
        for (let k = start; k < end; k++) peak = Math.max(peak, data[k] ?? -Infinity);
        const y = height * (1 - levelPosition(peak, ANALYSER_MIN_DB, ANALYSER_MAX_DB));
        g.lineTo(i * COLUMN_PX, y);
      });
      g.lineTo(width, height);
      g.closePath();
      g.globalAlpha = 0.35;
      g.fillStyle = colorRef.current;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = colorRef.current;
      g.lineWidth = 1.5;
      g.stroke();

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [analyser]);

  return <canvas ref={canvasRef} className="live-spectrum" role="img" aria-label={maskedMessage ?? label} />;
}
