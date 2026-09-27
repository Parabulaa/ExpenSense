// Derives dark-mode equivalents for the one-off tints hardcoded around the
// app, so every pale chip or translucent card doesn't need a hand-picked twin.
// Hue and alpha are kept; only lightness (and a little saturation) moves.

type Hsla = { h: number; s: number; l: number; a: number };

function parse(color: string): Hsla | null {
  let r: number, g: number, b: number, a = 1;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color.trim());
  if (hex) {
    let v = hex[1];
    if (v.length === 3) v = v.split('').map((c) => c + c).join('');
    r = parseInt(v.slice(0, 2), 16); g = parseInt(v.slice(2, 4), 16); b = parseInt(v.slice(4, 6), 16);
    if (v.length === 8) a = parseInt(v.slice(6, 8), 16) / 255;
  } else if (rgb) {
    r = +rgb[1]; g = +rgb[2]; b = +rgb[3];
    if (rgb[4] !== undefined) a = +rgb[4];
  } else {
    return null;
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l, a };
}

function format({ h, s, l, a }: Hsla) {
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return `hsla(${Math.round(h)}, ${pct(s)}, ${pct(l)}, ${Math.round(a * 100) / 100})`;
}

/** A light fill or border → a dark one of the same hue. Dark fills pass through. */
export function darkTint(color: string) {
  const c = parse(color);
  if (!c || c.l < 0.55) return color;
  // Near-white fills are the translucent cream cards; they become the dark
  // card surface rather than a muddy brown of cream's warm hue.
  if (c.l > 0.93) return format({ h: 147, s: 0.18, l: 0.14, a: c.a });
  return format({ ...c, s: c.s * 0.6, l: 0.14 + ((1 - c.l) / 0.45) * 0.28 });
}

/** Dark text or icon ink → light ink of the same hue. Light ink passes through. */
export function lightInk(color: string) {
  const c = parse(color);
  if (!c || c.l >= 0.45) return color;
  return format({ ...c, l: Math.max(0.68, 1 - c.l) });
}

const INK_KEYS = new Set(['color', 'tintColor', 'textDecorationColor']);
const FILL_KEYS = /^(backgroundColor|border\w*Color|outlineColor)$/;

/** Adapts the literal colors in a style sheet for dark mode, skipping palette tokens. */
export function adaptSheetForDark<T>(sheet: T, keep: Set<string>): T {
  const out: Record<string, unknown> = {};
  for (const [name, style] of Object.entries(sheet as Record<string, unknown>)) {
    if (!style || typeof style !== 'object' || Array.isArray(style)) { out[name] = style; continue; }
    const next: Record<string, unknown> = { ...style };
    for (const [key, value] of Object.entries(next)) {
      if (typeof value !== 'string' || keep.has(value)) continue;
      if (INK_KEYS.has(key)) next[key] = lightInk(value);
      else if (FILL_KEYS.test(key)) next[key] = darkTint(value);
    }
    out[name] = next;
  }
  return out as T;
}
