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

/** Curly bangs: a row of downward bumps from right to left along the hairline. */
function bangs(fromX: number, toX: number, y: number, bumps: number) {
  const step = (fromX - toX) / bumps;
  return Array.from({ length: bumps }, (_, index) => `A${step / 2} ${step / 2.4} 0 0 1 ${fromX - step * (index + 1)} ${y}`).join(' ');
}

const HAIR = '#3B2418';
const HAIR_LIGHT = '#6B4430';

/** Strict Mom: a curly bob with a top bun, pearl earrings, reading glasses and a raised sandok. */
const mom: Costume = {
  free: `
  <g transform="rotate(-20 140 420)">
    <rect x="118" y="330" width="44" height="300" rx="22" fill="#B9773D" stroke="${INK}" stroke-width="20"/>
    <ellipse cx="140" cy="270" rx="80" ry="104" fill="#D49A5C" stroke="${INK}" stroke-width="22"/>
    <ellipse cx="140" cy="262" rx="44" ry="62" fill="#B9773D" opacity="0.55"/>
  </g>`,
  face: `
  <circle cx="640" cy="215" r="120" fill="${HAIR}" stroke="${INK}" stroke-width="22"/>
  <path d="M585 170 Q640 130 700 175" fill="none" stroke="${HAIR_LIGHT}" stroke-width="18" stroke-linecap="round"/>
  <circle cx="150" cy="760" r="80" fill="${HAIR}" stroke="${INK}" stroke-width="22"/>
  <circle cx="1140" cy="760" r="80" fill="${HAIR}" stroke="${INK}" stroke-width="22"/>
  <path d="M90 690 Q70 540 170 460 Q300 290 640 270 Q980 290 1110 470 Q1210 560 1195 690 ${bangs(1195, 90, 690, 9)} Z" fill="${HAIR}" stroke="${INK}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M300 470 Q380 400 470 420 M800 400 Q900 410 960 480 M560 360 Q640 330 720 355" fill="none" stroke="${HAIR_LIGHT}" stroke-width="20" stroke-linecap="round"/>
  <ellipse cx="640" cy="318" rx="130" ry="42" fill="#E85D8A" stroke="${INK}" stroke-width="20"/>
  <circle cx="215" cy="925" r="26" fill="#FFFFFF" stroke="${INK}" stroke-width="12"/>
  <circle cx="1075" cy="925" r="26" fill="#FFFFFF" stroke="${INK}" stroke-width="12"/>
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

/** The Butler: slicked, side-parted hair over the cap, a top hat and a gold monocle. */
const BUTLER_HAIR = '#2A2A30';
/** The pig's own skin tone, to paint a forehead where the cap was. */
const SKIN = '#FCF2DD';
const butler: Costume = {
  face: `
  <path d="M228 705 Q225 500 640 480 Q1155 500 1152 695 Q640 775 228 705 Z" fill="${SKIN}"/>
  <path d="M70 725 Q50 560 160 465 Q300 280 640 262 Q985 280 1115 465 Q1225 560 1210 715 Q1165 705 1150 650 Q1120 560 1000 545 Q820 520 640 540 Q470 555 330 600 Q250 635 238 705 Q170 700 70 725 Z" fill="${BUTLER_HAIR}" stroke="${INK}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M470 575 Q520 430 680 380 Q850 340 1010 420" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
  <path d="M560 480 Q700 410 920 450 M260 560 Q330 450 450 410" fill="none" stroke="#6A6A78" stroke-width="14" stroke-linecap="round"/>
  <path d="M700 330 Q820 320 930 360" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="20" stroke-linecap="round"/>
  <g transform="rotate(-8 720 300)">
    <rect x="560" y="0" width="320" height="300" rx="18" fill="#1E1E24" stroke="${INK}" stroke-width="22"/>
    <rect x="560" y="225" width="320" height="58" fill="#8E2B2B" stroke="${INK}" stroke-width="18"/>
    <ellipse cx="720" cy="310" rx="250" ry="48" fill="#1E1E24" stroke="${INK}" stroke-width="22"/>
    <path d="M600 50 L600 200" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="22" stroke-linecap="round"/>
  </g>
  <circle cx="822" cy="875" r="108" fill="#FFFFFF" fill-opacity="0.18" stroke="#C9A227" stroke-width="20"/>
  <circle cx="822" cy="875" r="108" fill="none" stroke="${INK}" stroke-width="6"/>
  <path d="M905 945 Q960 1010 1010 1060" fill="none" stroke="#C9A227" stroke-width="10" stroke-dasharray="4 14" stroke-linecap="round"/>`,
};

/** Wise Sensei: a woven straw hat over the cap, bushy white brows, a long moustache and beard. */
const STRAW = '#E2C47A';
const BEARD = '#F4F1EA';
const sensei: Costume = {
  face: `
  <path d="M640 1240 Q520 1150 505 1035 Q640 1075 775 1035 Q760 1150 640 1240 Z" fill="${BEARD}" stroke="${INK}" stroke-width="20" stroke-linejoin="round"/>
  <path d="M600 1080 Q620 1150 640 1200 M680 1080 Q660 1150 640 1200" fill="none" stroke="#D6D0C2" stroke-width="10" stroke-linecap="round"/>
  <path d="M520 1030 Q420 1040 380 1120 Q350 1190 300 1210" fill="none" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>
  <path d="M520 1030 Q420 1040 380 1120 Q350 1190 300 1210" fill="none" stroke="${BEARD}" stroke-width="18" stroke-linecap="round"/>
  <path d="M760 1030 Q860 1040 900 1120 Q930 1190 980 1210" fill="none" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>
  <path d="M760 1030 Q860 1040 900 1120 Q930 1190 980 1210" fill="none" stroke="${BEARD}" stroke-width="18" stroke-linecap="round"/>
  <path d="M385 790 Q440 745 540 775 M745 775 Q845 745 900 790" fill="none" stroke="${INK}" stroke-width="44" stroke-linecap="round"/>
  <path d="M385 790 Q440 745 540 775 M745 775 Q845 745 900 790" fill="none" stroke="${BEARD}" stroke-width="26" stroke-linecap="round"/>
  <path d="M10 715 Q250 280 640 70 Q1045 280 1270 715 Q640 800 10 715 Z" fill="${STRAW}" stroke="${INK}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M640 85 L640 755 M640 85 L330 735 M640 85 L950 735 M640 85 L120 715 M640 85 L1160 715" fill="none" stroke="#C4A35A" stroke-width="12" stroke-linecap="round"/>
  <path d="M150 600 Q640 670 1130 600 M290 430 Q640 480 990 430" fill="none" stroke="#C4A35A" stroke-width="12" stroke-linecap="round"/>
  <path d="M40 690 Q640 780 1240 690" fill="none" stroke="#8E2B2B" stroke-width="26" stroke-linecap="round"/>
  <circle cx="640" cy="80" r="26" fill="#8E2B2B" stroke="${INK}" stroke-width="14"/>`,
};

const COSTUMES: Record<AdviserPersonaId, Costume | null> = { classic: null, mom, chill, bestie, sergeant, butler, sensei };

/** Full SVG for a persona's costume on a given expression, or null for none. */
export function costumeXml(persona: AdviserPersonaId, mood: MascotMood | 'neutral' = 'neutral') {
  const costume = COSTUMES[persona];
  if (!costume) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COSTUME_VIEWBOX}">${costume.free ?? ''}<g transform="${faceTransform(mood)}">${costume.face}</g></svg>`;
}
