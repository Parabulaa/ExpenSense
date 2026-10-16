import type { AdviserPersonaId } from '@/features/adviser/personas';

/**
 * The intensity dial. Medium is each persona as written; Low softens the
 * punctuation and ends harsh news kindly; High adds an extra jab. It never
 * changes a number, only how the news is delivered.
 */
export type AdviserIntensity = 'low' | 'medium' | 'high';

export const INTENSITY_OPTIONS: { value: AdviserIntensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** Ends bad news gently at Low. */
export const GENTLE: Record<AdviserPersonaId, string[]> = {
  classic: ['You can get back on track.'],
  mom: ['But I know you’ll do better, anak.', 'It’s okay. We fix it together.', 'Eat well and try again tomorrow.'],
  chill: ['Totally fixable, no pressure.', 'Small steps, you got this.'],
  bestie: ['Still proud of you though', 'We’ll bounce back, promise.'],
  sergeant: ['Regroup and try again, recruit.', 'Mistakes happen. Learn and move on.'],
  butler: ['Nothing that cannot be remedied.', 'A minor setback, easily corrected.'],
};

/** An extra jab on bad news at High. */
export const SAVAGE: Record<AdviserPersonaId, string[]> = {
  classic: ['This needs attention now.'],
  mom: ['I’m telling your Tita at the reunion.', 'This is why we can’t have nice things!', 'When I was your age I saved EVERYTHING.', 'Don’t talk to me until you cook at home.'],
  chill: ['Okay, not gonna lie, that one stung a little.', 'Even I can’t chill about this one.'],
  bestie: ['Bestie this is NOT the plot', 'I’m screaming. Crying. Throwing up.', 'Your wallet just filed a complaint.'],
  sergeant: ['YOU CALL THAT DISCIPLINE?!', 'I’VE SEEN BETTER BUDGETS FROM A GOLDFISH!', 'GIVE ME FIFTY NO-SPEND DAYS!'],
  butler: ['I’ve taken the liberty of hiding your credit card.', 'Even the silverware is disappointed.', 'Shall I sell the second car, then?'],
};

const pick = (items: string[], seed: number) => items[Math.abs(seed) % items.length];

/** "SHOUTING" → "Shouting", so Low takes the volume down for the sergeant too. */
const calm = (text: string) => (text === text.toUpperCase() && /[A-Z]{3}/.test(text)
  ? text.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase())
  : text);
const soften = (text: string) => calm(text).replace(/\?!+|!\?+/g, '?').replace(/!{2,}/g, '!');

/** Applies the dial to a single line of persona speech. */
export function withIntensity(text: string, persona: AdviserPersonaId, intensity: AdviserIntensity, harsh: boolean, seed: number) {
  if (intensity === 'medium' || persona === 'classic') return text;
  if (intensity === 'low') return harsh ? `${soften(text)} ${pick(GENTLE[persona], seed)}` : soften(text);
  return harsh ? `${text} ${pick(SAVAGE[persona], seed)}` : text;
}

export { calm as calmShouting, soften as softenLine };
