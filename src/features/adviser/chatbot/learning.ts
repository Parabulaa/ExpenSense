import AsyncStorage from '@react-native-async-storage/async-storage';

import { classifier } from './classifier';
import { TRAINING_DATA, type Intent } from './training-data';

/**
 * Questions the user clarified through "Did you mean…?" become new training
 * examples, kept on this device so the classifier gets them right next time.
 */
const STORAGE_KEY = 'expensense.adviser.learned.v1';
const MAX_EXAMPLES = 200;

type Learned = { intent: Intent; text: string };
let loaded: Promise<void> | null = null;
let learned: Learned[] = [];

export function loadLearnedExamples() {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const parsed = raw ? (JSON.parse(raw) as Learned[]) : [];
      learned = Array.isArray(parsed) ? parsed.filter((item) => item && item.intent in TRAINING_DATA && typeof item.text === 'string').slice(-MAX_EXAMPLES) : [];
      learned.forEach((item) => classifier().learn(item.intent, item.text));
    })
    .catch(() => undefined);
  return loaded;
}

export function teach(intent: Intent, text: string) {
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  classifier().learn(intent, clean);
  learned = [...learned, { intent, text: clean }].slice(-MAX_EXAMPLES);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(learned)).catch(() => undefined);
}
