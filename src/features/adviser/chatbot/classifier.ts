import { SYNONYMS, TRAINING_DATA, type Intent } from './training-data';

/**
 * A multinomial Naive Bayes intent classifier with typo tolerance. It trains in
 * a few milliseconds on the examples in training-data.ts, runs entirely on the
 * device, and can learn new examples at runtime ("Did you mean…?" choices).
 */

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'am', 'are', 'to', 'of', 'for', 'my', 'me', 'i', 'it', 'this', 'that', 'on', 'in', 'do', 'did', 'please', 'so', 'just', 'really', 'still']);

/** Lowercase words with Taglish and slang folded in; numbers become `<num>`. */
export function normalizeWords(text: string): string[] {
  return text.toLocaleLowerCase()
    .replace(/₱|php/g, ' money ')
    .replace(/[^a-z0-9\s$]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => (/^\d/.test(word) ? ['<num>'] : (SYNONYMS[word] ?? word).split(' ')))
    .filter(Boolean);
}

/** Words plus neighbouring pairs, so "how much" and "much left" carry meaning. */
function features(words: string[]) {
  const content = words.filter((word) => !STOP_WORDS.has(word));
  const pairs = words.slice(1).map((word, index) => `${words[index]}_${word}`);
  return [...content, ...pairs];
}

/** Edit distance, capped early since only near-misses matter. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

export type Prediction = { intent: Intent; confidence: number; ranked: { intent: Intent; confidence: number }[] };

export class IntentClassifier {
  private counts = new Map<Intent, Map<string, number>>();
  private totals = new Map<Intent, number>();
  private docs = new Map<Intent, number>();
  private vocabulary = new Set<string>();
  private docTotal = 0;

  constructor(data: Partial<Record<Intent, string[]>>) {
    (Object.entries(data) as [Intent, string[]][]).forEach(([intent, examples]) => examples.forEach((example) => this.learn(intent, example)));
  }

  learn(intent: Intent, example: string) {
    const words = features(normalizeWords(example));
    const counts = this.counts.get(intent) ?? new Map<string, number>();
    words.forEach((word) => {
      counts.set(word, (counts.get(word) ?? 0) + 1);
      this.vocabulary.add(word);
    });
    this.counts.set(intent, counts);
    this.totals.set(intent, (this.totals.get(intent) ?? 0) + words.length);
    this.docs.set(intent, (this.docs.get(intent) ?? 0) + 1);
    this.docTotal += 1;
  }

  /** Swaps a misspelt word for the closest known one ("budgt" → "budget"). */
  private correct(word: string) {
    if (this.vocabulary.has(word) || word.length < 4 || word.includes('_')) return word;
    const max = word.length >= 7 ? 2 : 1;
    let best = word;
    let bestDistance = max + 1;
    this.vocabulary.forEach((known) => {
      if (known.includes('_')) return;
      const d = distance(word, known, max);
      if (d < bestDistance) { best = known; bestDistance = d; }
    });
    return best;
  }

  predict(text: string): Prediction {
    const words = normalizeWords(text).map((word) => this.correct(word));
    const feats = features(words).filter((word) => this.vocabulary.has(word));
    const vocab = this.vocabulary.size;
    const scores = [...this.counts.keys()].map((intent) => {
      const counts = this.counts.get(intent)!;
      const total = this.totals.get(intent) ?? 0;
      let score = Math.log((this.docs.get(intent) ?? 0) / this.docTotal);
      feats.forEach((word) => { score += Math.log(((counts.get(word) ?? 0) + 1) / (total + vocab)); });
      return { intent, score };
    });
    // Softmax turns log scores into confidences that sum to 1.
    const top = Math.max(...scores.map((item) => item.score));
    const exp = scores.map((item) => ({ intent: item.intent, value: Math.exp(item.score - top) }));
    const sum = exp.reduce((total, item) => total + item.value, 0);
    const ranked = exp.map((item) => ({ intent: item.intent, confidence: item.value / sum })).sort((a, b) => b.confidence - a.confidence);
    // Nothing recognisable at all is never a confident guess.
    if (!feats.length) return { intent: 'out_of_scope', confidence: 0, ranked };
    return { intent: ranked[0].intent, confidence: ranked[0].confidence, ranked };
  }
}

let shared: IntentClassifier | null = null;
export function classifier() {
  shared ??= new IntentClassifier(TRAINING_DATA);
  return shared;
}
