// Draws the Dial In app icons (a knob) and writes them to public/.
// No dependencies: shapes are rasterised with supersampling and PNGs are
// encoded with Node's built-in zlib. Run with `npm run icons`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/', import.meta.url);

// Colours (match src/ui/styles.css).
const BG = [17, 19, 24];
const TRACK = [42, 46, 56];
const ACCENT = [79, 209, 197];
const POINTER = [232, 234, 240];

// Geometry in a unit square, angles in degrees clockwise from straight up.
// Slightly below the middle: the arc is open at the bottom, so this centres it visually.
const CENTRE = { x: 0.5, y: 0.54 };
const RADIUS = 0.3;
const THICKNESS = 0.08;
const SWEEP_START = -135;
const SWEEP_END = 135;
const VALUE_END = 60;
const POINTER_INNER = 0.08;
// Reaches the ring's centre line, so the pointer meets the end of the teal arc.
const POINTER_OUTER = RADIUS;
// A little wider than the ring, so the pointer's rounded end covers the arc's end completely.
const POINTER_THICKNESS = 0.092;
const CORNER = 0.22;
/** Maskable icons keep content inside the central 80 %. */
const MASKABLE_SCALE = 0.8;
const SAMPLES = 4;

const rad = (deg) => (deg * Math.PI) / 180;
const pointAt = (radius, deg) => ({ x: CENTRE.x + radius * Math.sin(rad(deg)), y: CENTRE.y - radius * Math.cos(rad(deg)) });

function angleOf(x, y) {
  return (Math.atan2(x - CENTRE.x, -(y - CENTRE.y)) * 180) / Math.PI;
}

/** On an arc of the ring from `from` to `to` degrees, with round caps. */
function onArc(x, y, from, to) {
  const half = THICKNESS / 2;
  const dist = Math.hypot(x - CENTRE.x, y - CENTRE.y);
  const angle = angleOf(x, y);
  if (Math.abs(dist - RADIUS) <= half && angle >= from && angle <= to) return true;
  return [from, to].some((deg) => {
    const end = pointAt(RADIUS, deg);
    return Math.hypot(x - end.x, y - end.y) <= half;
  });
}

function onSegment(x, y, a, b, thickness) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= thickness / 2;
}

function inRoundedSquare(x, y, corner) {
  const cx = Math.min(Math.max(x, corner), 1 - corner);
  const cy = Math.min(Math.max(y, corner), 1 - corner);
  return Math.hypot(x - cx, y - cy) <= corner;
}

/** Colour and alpha of one sample point; `scale` shrinks the knob towards the centre. */
function sample(x, y, { rounded, scale }) {
  if (rounded && !inRoundedSquare(x, y, CORNER)) return null;
  const kx = CENTRE.x + (x - CENTRE.x) / scale;
  const ky = CENTRE.y + (y - CENTRE.y) / scale;
  if (onSegment(kx, ky, pointAt(POINTER_INNER, VALUE_END), pointAt(POINTER_OUTER, VALUE_END), POINTER_THICKNESS)) return POINTER;
  if (onArc(kx, ky, SWEEP_START, VALUE_END)) return ACCENT;
  if (onArc(kx, ky, VALUE_END, SWEEP_END)) return TRACK;
  return BG;
}

function render(size, options) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const colour = sample((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size, options);
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          covered++;
        }
      }
      const i = (py * size + px) * 4;
      if (covered > 0) {
        pixels[i] = Math.round(r / covered);
        pixels[i + 1] = Math.round(g / covered);
        pixels[i + 2] = Math.round(b / covered);
      }
      pixels[i + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return pixels;
}

// ── PNG encoding ─────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── SVG favicon (same drawing as vector) ─────────────────────────────────

function arcPath(from, to) {
  const a = pointAt(RADIUS, from);
  const b = pointAt(RADIUS, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${(a.x * 100).toFixed(2)} ${(a.y * 100).toFixed(2)} A ${RADIUS * 100} ${RADIUS * 100} 0 ${large} 1 ${(b.x * 100).toFixed(2)} ${(b.y * 100).toFixed(2)}`;
}

function svg() {
  const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const p1 = pointAt(POINTER_INNER, VALUE_END);
  const p2 = pointAt(POINTER_OUTER, VALUE_END);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${CORNER * 100}" fill="${hex(BG)}"/>
  <g fill="none" stroke-linecap="round" stroke-width="${THICKNESS * 100}">
    <path d="${arcPath(VALUE_END, SWEEP_END)}" stroke="${hex(TRACK)}"/>
    <path d="${arcPath(SWEEP_START, VALUE_END)}" stroke="${hex(ACCENT)}"/>
  </g>
  <line x1="${(p1.x * 100).toFixed(2)}" y1="${(p1.y * 100).toFixed(2)}" x2="${(p2.x * 100).toFixed(2)}" y2="${(p2.y * 100).toFixed(2)}" stroke="${hex(POINTER)}" stroke-width="${POINTER_THICKNESS * 100}" stroke-linecap="round"/>
</svg>
`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, scale: MASKABLE_SCALE },
  // iOS adds its own rounded corners and dislikes transparency.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.9 },
];

mkdirSync(OUT, { recursive: true });
for (const icon of ICONS) {
  writeFileSync(new URL(icon.file, OUT), png(icon.size, render(icon.size, icon)));
  console.log(`wrote public/${icon.file}`);
}
writeFileSync(new URL('favicon.svg', OUT), svg());
console.log('wrote public/favicon.svg');
