import { calmShouting, GENTLE, SAVAGE, softenLine, type AdviserIntensity } from '@/features/adviser/intensity';
import type { AdviserFacts, AdviserPersonaId } from '@/features/adviser/personas';
import type { MonthAnalytics } from '@/features/analytics/analytics';
import type { MascotMood } from '@/features/analytics/mascot-mood';
import type { MonthlyBudget } from '@/features/budget/types';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import type { Expense } from '@/features/expenses/types';
import { formatPeso } from '@/lib/format';

import { classifier, normalizeWords } from './classifier';
import { INTENT_PROMPTS, type Intent } from './training-data';
import { VOICES, type Tone } from './voices';

/**
 * ExpenSense's own chatbot: classify the question, pull out amounts,
 * categories and periods, calculate the answer from saved data, then let the
 * chosen persona phrase it. Every number comes from step three.
 */

export type ChatContext = {
  expenses: Expense[];
  categories: DashboardCategory[];
  budget?: MonthlyBudget;
  current: MonthAnalytics;
  previous: MonthAnalytics;
  facts: AdviserFacts;
  today: string;
  /** First name, for "what’s my name". */
  userName?: string;
};

export type ChatMemory = { lastIntent?: Intent; lastCategoryId?: string; awaitingAmount?: boolean; why?: string };

export type ChatReply = {
  bubbles: string[];
  mood: MascotMood;
  memory: ChatMemory;
  suggestions: string[];
  /** Offered when the classifier isn't sure; tapping one teaches it. */
  didYouMean?: { label: string; intent: Intent }[];
  intent: Intent;
};

type Period = 'today' | 'week' | 'month' | 'last_month';
type Answer = { tone: Tone; lines: string[]; mood?: MascotMood; why?: string; suggestions?: string[]; memory?: Partial<ChatMemory> };

const CONFIDENT = 0.4;
/** A clear lead over the runner-up also counts, so one-word messages like "hi" work. */
const LEAD = 2;
const pick = <T,>(items: T[], seed: number) => items[Math.abs(seed) % items.length];
const peso = (cents: number) => formatPeso(Math.abs(cents));
const sum = (items: Expense[]) => items.reduce((total, item) => total + item.amountCents, 0);

/* ---------- entities ---------- */

/** "₱2,500", "2500", "1.5k" → cents. */
export function extractAmount(text: string): number | null {
  const match = text.toLowerCase().replace(/,/g, '').match(/(?:₱|php|p)?\s*(\d+(?:\.\d{1,2})?)\s*(k)?\b/);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] ? 1000 : 1);
  return value > 0 ? Math.round(value * 100) : null;
}

/** Everyday words that point at a built-in category. */
const ITEM_HINTS: Record<string, string> = {
  coffee: 'food', lunch: 'food', dinner: 'food', breakfast: 'food', takeout: 'food', milktea: 'food', jollibee: 'food', mcdo: 'food', snack: 'food', snacks: 'food', eat: 'food', food: 'food',
  grab: 'transport', jeep: 'transport', taxi: 'transport', fare: 'transport', gas: 'transport', commute: 'transport', transport: 'transport',
  shoes: 'shopping', clothes: 'shopping', bag: 'shopping', shirt: 'shopping', phone: 'shopping', gadget: 'shopping', laptop: 'shopping', sneakers: 'shopping',
  netflix: 'entertainment', movie: 'entertainment', game: 'entertainment', games: 'entertainment', concert: 'entertainment', spotify: 'entertainment',
  rent: 'bills', electricity: 'bills', internet: 'bills', wifi: 'bills', load: 'bills', water: 'bills',
  medicine: 'health', doctor: 'health', vitamins: 'health', book: 'school', books: 'school', tuition: 'school', supplies: 'school',
  grocery: 'groceries', groceries: 'groceries', trip: 'travel', flight: 'travel', hotel: 'travel',
};

export function extractCategory(text: string, categories: DashboardCategory[]): DashboardCategory | undefined {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ')} `;
  const named = [...categories].sort((a, b) => b.fullLabel.length - a.fullLabel.length)
    .find((item) => lower.includes(` ${item.fullLabel.toLowerCase()} `) || lower.includes(` ${item.label.toLowerCase()} `));
  if (named) return named;
  const hinted = normalizeWords(text).map((word) => ITEM_HINTS[word]).find(Boolean);
  return hinted ? categories.find((item) => item.id === hinted) : undefined;
}

function extractPeriod(text: string): Period {
  const words = normalizeWords(text).join(' ');
  if (/last month|previous month/.test(words)) return 'last_month';
  if (/\bweek\b/.test(words)) return 'week';
  if (/\btoday\b|\bday\b/.test(words) && !/per day|a day|daily/.test(words)) return 'today';
  return 'month';
}

/* ---------- helpers ---------- */

function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function inPeriod(ctx: ChatContext, period: Period) {
  if (period === 'today') return ctx.expenses.filter((item) => item.transactionDate === ctx.today);
  if (period === 'week') { const from = addDays(ctx.today, -6); return ctx.expenses.filter((item) => item.transactionDate >= from && item.transactionDate <= ctx.today); }
  if (period === 'last_month') return ctx.previous.expenses;
  return ctx.current.expenses;
}
const periodLabel: Record<Period, string> = { today: 'today', week: 'in the last 7 days', month: 'this month', last_month: 'last month' };

function categoryStatus(ctx: ChatContext, categoryId: string) {
  const spent = sum(ctx.current.expenses.filter((item) => item.categoryId === categoryId));
  const limit = ctx.budget?.categoryBudgets.find((item) => item.categoryId === categoryId && item.amountCents > 0)?.amountCents ?? null;
  return { spent, limit, left: limit === null ? null : limit - spent };
}

/* ---------- answers ---------- */

function answer(intent: Intent, question: string, ctx: ChatContext, memory: ChatMemory, persona: AdviserPersonaId, seed: number, intensity: AdviserIntensity = 'medium'): Answer {
  const voice = VOICES[persona];
  const f = ctx.facts;
  const category = extractCategory(question, ctx.categories);
  const period = extractPeriod(question);

  switch (intent) {
    case 'greeting': return { tone: 'neutral', lines: [pick(voice.greeting, seed)], suggestions: ['Budget left?', 'Roast me', 'Can I afford ₱1,500 shoes?'] };
    case 'thanks': return { tone: 'good', lines: [pick(voice.thanks, seed)], mood: 'success', suggestions: ['How can I save?', 'Am I doing well?'] };
    case 'who_are_you': return { tone: 'neutral', lines: [voice.who, 'I run on your phone and only use your saved expenses and budgets.'] };
    case 'my_name': return ctx.userName
      ? { tone: 'good', lines: [voice.name.replace('{name}', ctx.userName)], mood: 'success', suggestions: ['Budget left?', 'Roast me'] }
      : { tone: 'neutral', lines: ['I don’t know your name yet. Add it in Profile → Account Information.'], mood: 'confused' };
    case 'how_are_you': return { tone: 'neutral', lines: [pick(voice.howAreYou, seed)], suggestions: ['How am I doing?', 'Budget left?'] };
    case 'help': return { tone: 'neutral', lines: ['Try asking: how much is left, where your money goes, whether you can afford something, how to save, or ask me to roast you.'], suggestions: ['Where does my money go?', 'Can I afford ₱2,000?', 'Roast me'] };
    case 'out_of_scope': return { tone: 'neutral', lines: [pick(voice.offTopic, seed)], mood: 'confused', suggestions: ['Budget left?', 'How can I save?'] };

    case 'spent_total': {
      if (category) return answer('category_spent', question, ctx, memory, persona, seed);
      const items = inPeriod(ctx, period);
      if (!items.length) return { tone: 'good', lines: [`Nothing spent ${periodLabel[period]}.`], mood: 'success' };
      const total = sum(items);
      const lines = [`You’ve spent ${peso(total)} ${periodLabel[period]} across ${items.length} expense${items.length === 1 ? '' : 's'}.`];
      if (period === 'month' && f.changePercent !== null) lines.push(`That’s ${Math.abs(f.changePercent)}% ${f.changePercent > 0 ? 'more' : 'less'} than last month.`);
      return { tone: f.changePercent !== null && f.changePercent > 15 ? 'bad' : 'neutral', lines, why: 'I added up every saved expense in that period.', suggestions: ['Where does my money go?', 'Compare to last month'] };
    }

    case 'category_spent': {
      const target = category ?? ctx.categories.find((item) => item.id === memory.lastCategoryId);
      if (!target) return { tone: 'neutral', lines: ['Which category? Food, Transport, Shopping…'], suggestions: ctx.current.categorySlices.slice(0, 3).map((slice) => `How much on ${slice.label}?`) };
      const status = categoryStatus(ctx, target.id);
      const lines = [`${target.fullLabel}: ${peso(status.spent)} this month.`];
      let tone: Tone = 'neutral';
      if (status.left !== null && status.limit !== null) {
        if (status.left < 0) { lines.push(`That’s ${peso(status.left)} over its ${peso(status.limit)} limit.`); tone = 'bad'; }
        else { lines.push(`${peso(status.left)} left of ${peso(status.limit)}${f.daysLeft ? `, about ${peso(Math.floor(status.left / Math.max(1, f.daysLeft)))} a day for ${f.daysLeft} days` : ''}.`); tone = status.left < status.limit * 0.2 ? 'bad' : 'good'; }
      } else lines.push('No limit is set for it yet.');
      return { tone, lines, memory: { lastCategoryId: target.id }, why: `I added up this month’s ${target.fullLabel} expenses and compared them with its limit.`, suggestions: [`Can I afford ₱500 on ${target.fullLabel}?`, 'How can I save?'] };
    }

    case 'budget_left': {
      if (category) return answer('category_spent', question, ctx, memory, persona, seed);
      if (!f.budget) return { tone: 'neutral', lines: [`You’ve spent ${peso(f.totalCents)} this month, but there’s no budget set yet.`, 'Set category limits in Budget so I can track what’s left.'], mood: 'confused' };
      const over = f.budget.remainingCents < 0;
      const lines = over
        ? [`You’re ${peso(f.budget.remainingCents)} over your ${peso(f.budget.limitCents)} budget.`]
        : [`${peso(f.budget.remainingCents)} left of ${peso(f.budget.limitCents)} (${f.budget.usedPercent}% used).`];
      if (!over && f.daysLeft) lines.push(`That’s about ${peso(Math.floor(f.budget.remainingCents / Math.max(1, f.daysLeft)))} a day for the next ${f.daysLeft} days.`);
      if (f.over[0]) lines.push(`${f.over[0].label} is already ${peso(f.over[0].overCents)} over.`);
      return { tone: over || f.over.length ? 'bad' : f.budget.usedPercent > 80 ? 'bad' : 'good', lines, why: 'Budget left = your category limits minus what you’ve spent in those categories this month.', suggestions: ['How much per day?', 'How can I save?'] };
    }

    case 'daily_allowance': {
      if (!f.budget) return { tone: 'neutral', lines: ['Set a budget first and I’ll work out a daily amount.'], mood: 'confused' };
      if (f.budget.remainingCents <= 0) return { tone: 'bad', lines: ['Honestly? ₱0 a day. The budget is used up.'], mood: 'warning' };
      const days = Math.max(1, f.daysLeft);
      const daily = Math.floor(f.budget.remainingCents / days);
      const average = ctx.current.averageDailyCents;
      const lines = [`About ${peso(daily)} a day for the next ${days} day${days === 1 ? '' : 's'}.`];
      if (average > 0) lines.push(average > daily ? `You’ve been averaging ${peso(average)} a day, so slow down a bit.` : `You’ve been averaging ${peso(average)} a day, so you’re on track.`);
      return { tone: average > daily ? 'bad' : 'good', lines, why: `${peso(f.budget.remainingCents)} left ÷ ${days} days left in the month.`, suggestions: ['Can I afford ₱300 today?', 'How can I save?'] };
    }

    case 'top_category': {
      const top = ctx.current.categorySlices.slice(0, 3);
      if (!top.length) return { tone: 'neutral', lines: ['No expenses this month yet, so nothing to rank.'], mood: 'confused' };
      const lines = [`${top[0].label} takes the most: ${peso(top[0].amountCents)} (${Math.round(top[0].percentage)}%).`];
      if (top.length > 1) lines.push(`Then ${top.slice(1).map((slice) => `${slice.label} ${peso(slice.amountCents)}`).join(', ')}.`);
      const id = ctx.categories.find((item) => item.fullLabel === top[0].label)?.id;
      return { tone: top[0].percentage > 50 ? 'bad' : 'neutral', lines, memory: { lastCategoryId: id }, why: 'I grouped this month’s expenses by category and sorted them.', suggestions: [`How much is ${top[0].label} left?`, 'How can I save?'] };
    }

    case 'compare': {
      if (ctx.previous.totalCents <= 0) return { tone: 'neutral', lines: ['There isn’t enough from last month to compare yet.'], mood: 'confused' };
      const change = Math.round(((ctx.current.totalCents - ctx.previous.totalCents) / ctx.previous.totalCents) * 100);
      const lines = [`This month: ${peso(ctx.current.totalCents)}. Last month: ${peso(ctx.previous.totalCents)}.`, change === 0 ? 'Exactly the same so far.' : `That’s ${Math.abs(change)}% ${change > 0 ? 'more' : 'less'}.`];
      return { tone: change > 10 ? 'bad' : change < 0 ? 'good' : 'neutral', lines, why: 'Both totals add up every saved expense in each month.', suggestions: ['Where does my money go?', 'How can I save?'] };
    }

    case 'can_afford': {
      const amount = extractAmount(question);
      if (!amount) return { tone: 'neutral', lines: [pick(voice.askAmount, seed)], memory: { awaitingAmount: true, lastCategoryId: category?.id ?? memory.lastCategoryId }, suggestions: ['₱500', '₱1,500', '₱3,000'] };
      const target = category ?? ctx.categories.find((item) => item.id === memory.lastCategoryId);
      const days = Math.max(1, f.daysLeft);
      const status = target ? categoryStatus(ctx, target.id) : null;
      const left = status?.left ?? f.budget?.remainingCents ?? null;
      const scope = status?.left !== null && status?.left !== undefined && target ? `your ${target.fullLabel} budget` : 'your budget';
      if (left === null) {
        const share = ctx.current.totalCents > 0 ? Math.round((amount / ctx.current.totalCents) * 100) : null;
        return { tone: 'neutral', lines: [`There’s no budget to check ${peso(amount)} against.`, share !== null ? `It would be ${share}% of what you’ve spent this month.` : 'Set a budget and I can give you a real answer.'], mood: 'confused', memory: { awaitingAmount: false } };
      }
      const after = left - amount;
      if (after < 0) return { tone: 'bad', mood: 'warning', lines: [`No. ${peso(amount)} would put ${scope} ${peso(after)} over.`, left > 0 ? `You only have ${peso(left)} left.` : 'It’s already used up.'], why: `${peso(left)} left − ${peso(amount)} = −${peso(after)}.`, memory: { awaitingAmount: false, lastCategoryId: target?.id }, suggestions: ['How can I save?', 'How much per day?'] };
      const perDay = Math.floor(after / days);
      if (after < left * 0.25) return { tone: 'bad', mood: 'tip', lines: [`Technically yes, but it’s tight.`, `You’d have ${peso(after)} left in ${scope}, about ${peso(perDay)} a day for ${days} days.`], why: `${peso(left)} left − ${peso(amount)} = ${peso(after)}, spread over ${days} days.`, memory: { awaitingAmount: false, lastCategoryId: target?.id }, suggestions: ['Is there a cheaper way?', 'How can I save?'] };
      return { tone: 'good', mood: 'success', lines: [`Yes, you can afford ${peso(amount)}.`, `${scope.charAt(0).toUpperCase()}${scope.slice(1)} would still have ${peso(after)}, about ${peso(perDay)} a day.`], why: `${peso(left)} left − ${peso(amount)} = ${peso(after)}.`, memory: { awaitingAmount: false, lastCategoryId: target?.id }, suggestions: ['Roast me anyway', 'Budget left?'] };
    }

    case 'how_to_save': {
      const top = ctx.current.categorySlices[0];
      if (!top) return { tone: 'neutral', lines: ['Add a few expenses first and I’ll find where to cut.'], mood: 'confused' };
      const lines = [`Biggest win: cut ${top.label} by 20% and you’d keep ${peso(Math.round(top.amountCents * 0.2))} a month.`];
      const small = ctx.current.expenses.filter((item) => item.amountCents <= 15_000);
      if (small.length >= 4) lines.push(`Also, ${small.length} small buys under ₱150 add up to ${peso(sum(small))}. Little things add up.`);
      const prevTop = ctx.previous.categorySlices.find((slice) => slice.label === top.label);
      if (prevTop && top.amountCents > prevTop.amountCents) lines.push(`${top.label} is up from ${peso(prevTop.amountCents)} last month.`);
      return { tone: 'neutral', mood: 'tip', lines: lines.slice(0, 3), why: `20% of your ${top.label} total, which is your largest category this month.`, suggestions: ['Can I afford ₱500?', 'Roast me'] };
    }

    case 'transaction_count': {
      const items = inPeriod(ctx, period);
      return { tone: 'neutral', lines: [`${items.length} expense${items.length === 1 ? '' : 's'} ${periodLabel[period]}.`], suggestions: ['Biggest expense?', 'Where does my money go?'] };
    }

    case 'biggest_expense': {
      const items = inPeriod(ctx, period);
      const biggest = [...items].sort((a, b) => b.amountCents - a.amountCents)[0];
      if (!biggest) return { tone: 'good', lines: [`No expenses ${periodLabel[period]}.`] };
      const label = ctx.categories.find((item) => item.id === biggest.categoryId)?.fullLabel ?? 'Other';
      return { tone: biggest.amountCents >= 200_000 ? 'bad' : 'neutral', lines: [`${peso(biggest.amountCents)} at ${biggest.merchant || 'an unnamed merchant'} (${label}) ${periodLabel[period]}.`], memory: { lastCategoryId: biggest.categoryId }, suggestions: ['Was it worth it?', 'How can I save?'] };
    }

    case 'roast_me': {
      const points: string[] = [];
      if (f.over[0]) points.push(`${f.over[0].label} is ${peso(f.over[0].overCents)} over its limit.`);
      if (f.changePercent !== null && f.changePercent > 0) points.push(`You’re spending ${f.changePercent}% more than last month.`);
      const small = ctx.current.expenses.filter((item) => item.amountCents <= 15_000);
      if (small.length >= 5) points.push(`${small.length} tiny purchases. ${peso(sum(small))} gone, one small "treat" at a time.`);
      if (f.top && f.top.percent >= 40) points.push(`${f.top.percent}% of your money goes to ${f.top.label}. Just one category!`);
      if (!points.length) return { tone: 'good', mood: 'success', lines: [pick(voice.roastClean, seed)], suggestions: ['Am I doing well?', 'How can I save?'] };
      return { tone: 'bad', mood: 'warning', lines: [pick(voice.roastIntro, seed), ...points.slice(0, intensity === 'high' ? 3 : intensity === 'low' ? 1 : 2)], suggestions: ['Roast me harder', 'How can I save?', 'Am I doing well?'] };
    }

    case 'praise_me': {
      const wins: string[] = [];
      if (f.changePercent !== null && f.changePercent < 0) wins.push(`You’re spending ${Math.abs(f.changePercent)}% less than last month.`);
      if (f.budget && f.budget.remainingCents > 0) wins.push(`${peso(f.budget.remainingCents)} still left in your budget.`);
      if (f.expenseCount >= 10) wins.push(`You’ve logged ${f.expenseCount} expenses. Tracking is half the battle.`);
      if (!wins.length) return { tone: 'neutral', lines: ['Honestly? Not much to praise yet.', 'Stay under budget for a few days and ask me again.'], mood: 'tip' };
      return { tone: 'good', mood: 'success', lines: [pick(voice.praiseIntro, seed), ...wins.slice(0, 2)], suggestions: ['Roast me', 'Budget left?'] };
    }

    case 'why':
      return memory.why ? { tone: 'neutral', lines: [memory.why, 'Every number comes from your saved expenses and budgets. I never guess.'] } : answer('help', question, ctx, memory, persona, seed);
  }
}

/* ---------- conversation ---------- */

export function chat(question: string, ctx: ChatContext, memory: ChatMemory, persona: AdviserPersonaId, seed: number, forced?: Intent, intensity: AdviserIntensity = 'medium'): ChatReply {
  const voice = VOICES[persona];
  const prediction = classifier().predict(question);
  const amount = extractAmount(question);
  let intent: Intent = forced ?? prediction.intent;

  // A bare price right after "how much is it?" finishes the affordability check.
  if (!forced && memory.awaitingAmount && amount && (prediction.confidence < 0.6 || normalizeWords(question).length <= 3)) intent = 'can_afford';
  // "₱2000 shoes?" reads as an affordability question even if phrased loosely.
  else if (!forced && amount && prediction.intent !== 'can_afford' && /\b(buy|afford|get|worth)\b/.test(normalizeWords(question).join(' '))) intent = 'can_afford';

  const [first, second] = prediction.ranked;
  const confident = prediction.confidence >= CONFIDENT || (prediction.confidence > 0 && first.confidence >= second.confidence * LEAD);
  const unsure = !forced && intent === prediction.intent && !confident;
  if (unsure) {
    const didYouMean = prediction.ranked
      .filter((item) => INTENT_PROMPTS[item.intent])
      .slice(0, 3)
      .map((item) => ({ label: INTENT_PROMPTS[item.intent]!, intent: item.intent }));
    return { bubbles: [pick(voice.confused, seed), 'Did you mean one of these?'], mood: 'confused', memory, suggestions: [], didYouMean, intent: 'out_of_scope' };
  }

  const result = answer(intent, question, ctx, memory, persona, seed, intensity);
  const dial = persona === 'classic' ? 'medium' : intensity;
  const bad = result.tone === 'bad';
  const conversational = ['greeting', 'thanks', 'who_are_you', 'my_name', 'how_are_you', 'out_of_scope', 'help'].includes(intent) || Boolean(result.memory?.awaitingAmount);
  // Low swaps harsh openers and closers for kind ones; High adds an extra jab.
  const openTone: Tone = dial === 'low' && bad ? 'neutral' : result.tone;
  const open = conversational || intent === 'roast_me' || intent === 'praise_me' ? '' : pick(voice.open[openTone], seed);
  const close = conversational ? '' : dial === 'low' && bad ? pick(GENTLE[persona], seed + 1) : pick(voice.close[result.tone], seed + 1);
  const jab = dial === 'high' && bad && !conversational ? pick(SAVAGE[persona], seed + 2) : '';
  let bubbles = voice.chatty ? [open, ...result.lines, jab, close].filter(Boolean) : [result.lines.join(' ')];
  // Keep it to a few bubbles: merge the opener into the first fact when long.
  while (bubbles.length > (dial === 'high' ? 5 : 4)) bubbles = [`${bubbles[0]} ${bubbles[1]}`, ...bubbles.slice(2)];
  if (dial === 'low') bubbles = bubbles.map((text) => softenLine(calmShouting(text)));
  else if (voice.shout) bubbles = bubbles.map((text) => text.toUpperCase());

  return {
    bubbles,
    mood: result.mood ?? (result.tone === 'good' ? 'success' : result.tone === 'bad' ? 'warning' : 'tip'),
    memory: { ...memory, awaitingAmount: false, ...result.memory, lastIntent: intent, why: result.why ?? memory.why },
    suggestions: result.suggestions ?? ['Budget left?', 'How can I save?', 'Roast me'],
    intent,
  };
}
