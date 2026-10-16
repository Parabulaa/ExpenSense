import type { AdviserPersonaId } from '@/features/adviser/personas';
import type { MascotMood } from '@/features/analytics/mascot-mood';

/**
 * Persona costumes drawn over the mascot, as SVG markup in the artwork's own
 * 1254×1254 space. They are drawn for the Neutral face; each expression puts
 * the face somewhere else, so the costume is moved, turned and scaled onto
 * that expression's eyes before it is drawn.
 */
export const COSTUME_VIEWBOX = '0 0 1254 1254';

const INK = '#0B2A1C';

/** Eye centres (left, right) in each expression, measured from the artwork. */
type Eyes = [[number, number], [number, number]];
const NEUTRAL_EYES: Eyes = [[465, 875], [822, 875]];
const EYES: Record<MascotMood | 'neutral', Eyes> = {
  neutral: NEUTRAL_EYES,
  warning: [[482, 700], [728, 724]],
  tip: [[378, 813], [675, 813]],
  success: [[461, 705], [771, 745]],
  confused: [[448, 742], [743, 774]],
  scanning: [[470, 722], [765, 750]],
};

/** Maps the Neutral eyes onto another expression's eyes. */
function faceTransform(mood: MascotMood | 'neutral') {
  const [[ax, ay], [bx, by]] = NEUTRAL_EYES;
  const [[cx, cy], [dx, dy]] = EYES[mood];
  const scale = Math.hypot(dx - cx, dy - cy) / Math.hypot(bx - ax, by - ay);
  const angle = (Math.atan2(dy - cy, dx - cx) - Math.atan2(by - ay, bx - ax)) * (180 / Math.PI);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${r((cx + dx) / 2)} ${r((cy + dy) / 2)}) rotate(${r(angle)}) scale(${r(scale)}) translate(${-(ax + bx) / 2} ${-(ay + by) / 2})`;
}

/** `face` follows the pig's face; `free` stays put in the frame. */
type Costume = { face: string; free?: string };

/** Strict Mom: reading glasses, and a wooden sandok raised in the corner. */
const mom: Costume = {
  free: `
  <g transform="rotate(-20 140 420)">
    <rect x="118" y="330" width="44" height="300" rx="22" fill="#B9773D" stroke="${INK}" stroke-width="20"/>
    <ellipse cx="140" cy="270" rx="80" ry="104" fill="#D49A5C" stroke="${INK}" stroke-width="22"/>
    <ellipse cx="140" cy="262" rx="44" ry="62" fill="#B9773D" opacity="0.55"/>
  </g>`,
  face: `
  <circle cx="465" cy="875" r="100" fill="#FFFFFF" fill-opacity="0.22" stroke="${INK}" stroke-width="22"/>
  <circle cx="822" cy="875" r="100" fill="#FFFFFF" fill-opacity="0.22" stroke="${INK}" stroke-width="22"/>
  <path d="M565 860 Q643 815 722 860" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
  <path d="M365 850 L250 800 M922 850 L1050 800" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
  <path d="M410 830 Q440 805 470 815 M767 830 Q797 805 827 815" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>`,
};

/** Chill Guy: dark shades. */
const chill: Costume = {
  face: `
  <rect x="352" y="800" width="226" height="150" rx="62" fill="#13221A" stroke="${INK}" stroke-width="20"/>
  <rect x="708" y="800" width="226" height="150" rx="62" fill="#13221A" stroke="${INK}" stroke-width="20"/>
  <path d="M578 850 Q643 820 708 850" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
  <path d="M352 845 L250 805 M934 845 L1050 805" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
  <path d="M395 838 L455 838 M752 838 L812 838" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="16" stroke-linecap="round"/>`,
};

/** Hype Bestie: blush, a bow, hearts and sparkles. */
const heart = (x: number, y: number, s: number, fill: string) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 30 C0 -10 -55 -10 -55 25 C-55 55 -20 75 0 95 C20 75 55 55 55 25 C55 -10 0 -10 0 30 Z" fill="${fill}" stroke="${INK}" stroke-width="${16 / s}"/>`;
const sparkle = (x: number, y: number, s: number) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -60 Q8 -8 60 0 Q8 8 0 60 Q-8 8 -60 0 Q-8 -8 0 -60 Z" fill="#FFD45C" stroke="${INK}" stroke-width="${12 / s}"/>`;
const bestie: Costume = {
  free: `${heart(120, 330, 0.85, '#F06292')}${heart(300, 120, 0.6, '#F48FB1')}${sparkle(110, 140, 0.6)}`,
  face: `
  <ellipse cx="350" cy="975" rx="64" ry="34" fill="#F48FB1" opacity="0.75"/>
  <ellipse cx="930" cy="975" rx="64" ry="34" fill="#F48FB1" opacity="0.75"/>
  <g transform="rotate(12 940 470)">
    <path d="M940 470 L840 400 Q815 470 840 540 Z" fill="#F06292" stroke="${INK}" stroke-width="20" stroke-linejoin="round"/>
    <path d="M940 470 L1040 400 Q1065 470 1040 540 Z" fill="#F06292" stroke="${INK}" stroke-width="20" stroke-linejoin="round"/>
    <circle cx="940" cy="470" r="34" fill="#EC407A" stroke="${INK}" stroke-width="20"/>
  </g>`,
};

/** Drill Sergeant: a combat helmet and furious brows. */
const sergeant: Costume = {
  face: `
  <path d="M70 725 Q60 610 160 585 Q225 225 640 205 Q1075 225 1150 590 Q1240 610 1230 725 Z" fill="#5E6B3B" stroke="${INK}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M160 655 Q640 600 1150 655" fill="none" stroke="${INK}" stroke-width="18"/>
  <path d="M330 470 Q420 430 470 500 M800 420 Q880 400 930 470" fill="none" stroke="#7D8A55" stroke-width="20" stroke-linecap="round"/>
  <path d="M640 380 L662 432 L718 434 L674 468 L690 522 L640 490 L590 522 L606 468 L562 434 L618 432 Z" fill="#E9C46A" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
  <path d="M385 770 L545 815 M905 770 L745 815" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>`,
};

/** The Butler: a top hat and a gold monocle. */
const butler: Costume = {
  face: `
  <g transform="rotate(-8 720 420)">
    <rect x="560" y="120" width="320" height="300" rx="18" fill="#1E1E24" stroke="${INK}" stroke-width="22"/>
    <rect x="560" y="345" width="320" height="58" fill="#8E2B2B" stroke="${INK}" stroke-width="18"/>
    <ellipse cx="720" cy="430" rx="250" ry="48" fill="#1E1E24" stroke="${INK}" stroke-width="22"/>
    <path d="M600 170 L600 320" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="22" stroke-linecap="round"/>
  </g>
  <circle cx="822" cy="875" r="108" fill="#FFFFFF" fill-opacity="0.18" stroke="#C9A227" stroke-width="20"/>
  <circle cx="822" cy="875" r="108" fill="none" stroke="${INK}" stroke-width="6"/>
  <path d="M905 945 Q960 1010 1010 1060" fill="none" stroke="#C9A227" stroke-width="10" stroke-dasharray="4 14" stroke-linecap="round"/>`,
};

const COSTUMES: Record<AdviserPersonaId, Costume | null> = { classic: null, mom, chill, bestie, sergeant, butler };

/** Full SVG for a persona's costume on a given expression, or null for none. */
export function costumeXml(persona: AdviserPersonaId, mood: MascotMood | 'neutral' = 'neutral') {
  const costume = COSTUMES[persona];
  if (!costume) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COSTUME_VIEWBOX}">${costume.free ?? ''}<g transform="${faceTransform(mood)}">${costume.face}</g></svg>`;
}
