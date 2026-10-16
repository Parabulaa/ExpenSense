import type { MonthAnalytics } from '@/features/analytics/analytics';
import { budgetUsage, type MonthlyBudget } from '@/features/budget/types';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import type { Expense } from '@/features/expenses/types';
import { formatPeso, percentOf } from '@/lib/format';

/**
 * Financial adviser personalities. Every persona reads the same computed facts
 * and only changes the wording, so a joke can never get the numbers wrong.
 */
export type AdviserPersonaId = 'classic' | 'mom' | 'chill' | 'bestie' | 'sergeant' | 'butler';

export type { AdviserIntensity } from '@/features/adviser/intensity';

export type AdviserSituation = 'empty' | 'over' | 'near' | 'jump' | 'improving' | 'steady';

export type AdviserFacts = {
  situation: AdviserSituation;
  expenseCount: number;
  totalCents: number;
  /** Percent change against last month, or null without a usable baseline. */
  changePercent: number | null;
  budget: { limitCents: number; remainingCents: number; usedPercent: number } | null;
  over: { label: string; overCents: number }[];
  near: { label: string; usedPercent: number }[];
  top: { label: string; amountCents: number; percent: number } | null;
  daysLeft: number;
};

export type ReactionFacts = {
  amountCents: number;
  merchant: string;
  categoryLabel: string;
  /** Left in this category's monthly limit after the expense, if it has one. */
  categoryLeftCents: number | null;
  pushedOver: boolean;
  big: boolean;
  small: boolean;
};

export type AdviserChallenge = { title: string; detail: string; icon: AdviserIcon; progress: number; goal: number };

type AdviserIcon = 'leaf' | 'pot-steam' | 'sunglasses' | 'party-popper' | 'whistle' | 'bow-tie' | 'calendar-check' | 'silverware-fork-knife' | 'notebook-check-outline' | 'star-shooting-outline' | 'shield-check-outline' | 'diamond-stone';

export type AdviserPersona = {
  id: AdviserPersonaId;
  name: string;
  tagline: string;
  icon: AdviserIcon;
  /** Badge and accent; light enough to sit under dark text in both themes. */
  accent: string;
  sample: string;
  say: (facts: AdviserFacts, seed: number) => string;
  react: (reaction: ReactionFacts, seed: number) => string;
  /** Wraps a plain assistant answer in the persona's voice. */
  answer: (text: string, seed: number) => string;
  challenge: (expenses: Expense[], today: string, facts: AdviserFacts) => AdviserChallenge;
};

const pick = (lines: string[], seed: number) => lines[Math.abs(seed) % lines.length];
const peso = (cents: number) => formatPeso(Math.abs(cents));

/* ---------- facts ---------- */

export function adviserFacts({ current, previous, categories, budget, today }: { current: MonthAnalytics; previous: MonthAnalytics; categories: DashboardCategory[]; budget?: MonthlyBudget; today: string }): AdviserFacts {
  const labelOf = (id: string) => categories.find((item) => item.id === id)?.fullLabel ?? 'Other';
  const spentIn = (id: string) => current.expenses.filter((expense) => expense.categoryId === id).reduce((sum, expense) => sum + expense.amountCents, 0);
  const limits = (budget?.categoryBudgets ?? []).filter((limit) => limit.amountCents > 0);
  const over = limits.filter((limit) => spentIn(limit.categoryId) > limit.amountCents)
    .map((limit) => ({ label: labelOf(limit.categoryId), overCents: spentIn(limit.categoryId) - limit.amountCents }))
    .sort((a, b) => b.overCents - a.overCents);
  const near = limits.map((limit) => ({ label: labelOf(limit.categoryId), usedPercent: percentOf(spentIn(limit.categoryId), limit.amountCents) ?? 0 }))
    .filter((item) => item.usedPercent >= 80 && item.usedPercent <= 100)
    .sort((a, b) => b.usedPercent - a.usedPercent);
  const usage = budgetUsage(budget, current.expenses);
  const changePercent = previous.expenses.length >= 3 && previous.totalCents > 0 ? Math.round(((current.totalCents - previous.totalCents) / previous.totalCents) * 100) : null;
  const topSlice = current.categorySlices[0];
  const [year, month, day] = today.split('-').map(Number);
  const inThisMonth = current.month === today.slice(0, 7);
  const daysLeft = inThisMonth ? new Date(year, month, 0).getDate() - day : 0;

  const situation: AdviserSituation = !current.expenses.length ? 'empty'
    : over.length || (usage.hasBudget && usage.remainingCents < 0) ? 'over'
    : changePercent !== null && changePercent > 15 ? 'jump'
    : near.length ? 'near'
    : previous.totalCents > 0 && current.totalCents < previous.totalCents ? 'improving'
    : 'steady';

  return {
    situation,
    expenseCount: current.expenses.length,
    totalCents: current.totalCents,
    changePercent,
    budget: usage.hasBudget ? { limitCents: usage.limitCents, remainingCents: usage.remainingCents, usedPercent: percentOf(usage.spentCents, usage.limitCents) ?? 0 } : null,
    over,
    near,
    top: topSlice ? { label: topSlice.label, amountCents: topSlice.amountCents, percent: Math.round(topSlice.percentage) } : null,
    daysLeft,
  };
}

export function reactionFacts({ expense, expenses, categories, budget }: { expense: Pick<Expense, 'id' | 'amountCents' | 'merchant' | 'categoryId' | 'transactionDate'>; expenses: Expense[]; categories: DashboardCategory[]; budget?: MonthlyBudget }): ReactionFacts {
  const month = expense.transactionDate.slice(0, 7);
  // The list may or may not include the new row yet, so it is added exactly once.
  const before = expenses.filter((item) => item.id !== expense.id && item.categoryId === expense.categoryId && item.transactionDate.startsWith(month)).reduce((sum, item) => sum + item.amountCents, 0);
  const limit = budget?.categoryBudgets.find((item) => item.categoryId === expense.categoryId && item.amountCents > 0);
  const leftBefore = limit ? limit.amountCents - before : null;
  const leftAfter = leftBefore === null ? null : leftBefore - expense.amountCents;
  return {
    amountCents: expense.amountCents,
    merchant: expense.merchant.trim() || 'that',
    categoryLabel: categories.find((item) => item.id === expense.categoryId)?.fullLabel ?? 'Expenses',
    categoryLeftCents: leftAfter,
    pushedOver: leftBefore !== null && leftAfter !== null && leftBefore >= 0 && leftAfter < 0,
    big: limit ? expense.amountCents >= limit.amountCents * 0.25 : expense.amountCents >= 100_000,
    small: expense.amountCents <= 10_000,
  };
}

/* ---------- challenges ---------- */

function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
const lastDays = (today: string, count: number) => Array.from({ length: count }, (_, index) => addDays(today, -index));
const daysWith = (expenses: Expense[], days: string[]) => new Set(expenses.filter((item) => days.includes(item.transactionDate)).map((item) => item.transactionDate));

function noSpendDays(expenses: Expense[], today: string, goal: number) {
  const week = lastDays(today, 7);
  return Math.min(goal, week.length - daysWith(expenses, week).size);
}
function daysSinceCategory(expenses: Expense[], today: string, categoryId: string | undefined, goal: number) {
  if (!categoryId) return 0;
  let streak = 0;
  for (const day of lastDays(today, goal)) {
    if (expenses.some((item) => item.transactionDate === day && item.categoryId === categoryId)) break;
    streak += 1;
  }
  return streak;
}

/* ---------- personas ---------- */

const classic: AdviserPersona = {
  id: 'classic',
  name: 'ExpenSense',
  tagline: 'Clear, neutral and to the point.',
  icon: 'leaf',
  accent: '#DDEBDD',
  sample: 'Food is 92% of its limit. Review recent purchases to stay on track.',
  say: (f) => {
    switch (f.situation) {
      case 'empty': return 'Add your first expense this month and I’ll start tracking it.';
      case 'over': return f.over[0] ? `${f.over[0].label} is ${peso(f.over[0].overCents)} over its limit.` : `You are ${peso(f.budget?.remainingCents ?? 0)} over budget.`;
      case 'jump': return `You are spending ${f.changePercent}% more than last month.`;
      case 'near': return `${f.near[0].label} has used ${f.near[0].usedPercent}% of its limit.`;
      case 'improving': return `Nice: you’re spending ${Math.abs(f.changePercent ?? 0)}% less than last month.`;
      default: return f.budget ? `${peso(f.budget.remainingCents)} left in your budget this month.` : `You’ve spent ${peso(f.totalCents)} this month.`;
    }
  },
  react: (r) => r.pushedOver ? `${r.categoryLabel} is now over its limit.` : r.categoryLeftCents !== null ? `${peso(r.categoryLeftCents)} left in ${r.categoryLabel}.` : `Added to ${r.categoryLabel}.`,
  answer: (text) => text,
  challenge: (expenses, today) => ({ title: 'Log 5 days this week', detail: 'Record at least one expense on 5 of the last 7 days.', icon: 'notebook-check-outline', goal: 5, progress: Math.min(5, daysWith(expenses, lastDays(today, 7)).size) }),
};

const mom: AdviserPersona = {
  id: 'mom',
  name: 'Strict Mom',
  tagline: 'Loves you. Hates your spending.',
  icon: 'pot-steam',
  accent: '#FCE1DC',
  sample: '₱420 on takeout?! There is rice at home!',
  say: (f, seed) => {
    switch (f.situation) {
      case 'empty': return pick(['No expenses yet? Good. Keep it that way.', 'Nothing spent this month? That’s my child!'], seed);
      case 'over': return f.over[0]
        ? pick([`${f.over[0].label} is ${peso(f.over[0].overCents)} over the limit. Who raised you like this?`, `${peso(f.over[0].overCents)} over on ${f.over[0].label}! Your cousin is saving for a house, you know.`], seed)
        : pick([`Over budget by ${peso(f.budget?.remainingCents ?? 0)}. I am not angry. Just disappointed.`], seed);
      case 'jump': return pick([`${f.changePercent}% more than last month?! Money doesn’t grow on trees, anak.`, `Spending up ${f.changePercent}%. Are you feeding the whole barangay?`], seed);
      case 'near': return pick([`${f.near[0].label} is at ${f.near[0].usedPercent}%. Stop now before I find out.`, `${f.near[0].usedPercent}% of ${f.near[0].label} gone. There is food at home!`], seed);
      case 'improving': return pick([`${Math.abs(f.changePercent ?? 0)}% less than last month. Okay… I’m a little proud. A little.`, 'Spending less than last month. Finally you listen to your mother.'], seed);
      default: return f.top
        ? pick([`${f.top.percent}% of your money goes to ${f.top.label}. Hmm. We need to talk.`, `${peso(f.totalCents)} this month. Don’t think I’m not watching.`], seed)
        : `${peso(f.totalCents)} this month. I’m watching.`;
    }
  },
  react: (r, seed) => r.pushedOver
    ? pick([`${r.categoryLabel} is now OVER the limit. Because of ${r.merchant}?!`, `There goes the ${r.categoryLabel} budget. I hope ${r.merchant} was worth it.`], seed)
    : r.big ? pick([`${peso(r.amountCents)} on ${r.merchant}?! You have one at home!`, `${peso(r.amountCents)}?! When I was your age that was a month of groceries.`], seed)
    : r.small ? pick(['Small one. Okay, I allow it.', 'Fine. But only because it’s cheap.'], seed)
    : pick([`${peso(r.amountCents)} on ${r.merchant}. Did you really need it? Think about it.`, `Another ${r.categoryLabel} expense. I’m writing this down.`], seed),
  answer: (text, seed) => `${pick(['Listen to your mother:', 'Ay, you ask me now?', 'Sit down.'], seed)} ${text} ${pick(['Now go save money.', 'Don’t make me ask twice.', 'I say this because I love you.'], seed + 1)}`,
  challenge: (expenses, today, f) => ({
    title: f.top ? `No ${f.top.label} for 3 days` : 'Eat at home for 3 days',
    detail: 'Mom is counting. Skip your biggest category for three days straight.',
    icon: 'silverware-fork-knife',
    goal: 3,
    progress: daysSinceCategory(expenses, today, topCategoryId(expenses, today), 3),
  }),
};

const chill: AdviserPersona = {
  id: 'chill',
  name: 'Chill Guy',
  tagline: 'No stress. Just vibes and a budget.',
  icon: 'sunglasses',
  accent: '#DCEBFA',
  sample: 'Bit heavy on takeout this week, no biggie. Maybe cook twice?',
  say: (f, seed) => {
    switch (f.situation) {
      case 'empty': return pick(['Clean slate this month. Vibes are immaculate.', 'Nothing logged yet. We cruising.'], seed);
      case 'over': return f.over[0] ? pick([`${f.over[0].label} slid ${peso(f.over[0].overCents)} past the limit. It happens. Let’s ease off a bit, yeah?`, `Went a little over on ${f.over[0].label}. All good, we just chill on it for a while.`], seed) : 'Budget’s a bit past the line. Deep breath, we’ll sort it.';
      case 'jump': return pick([`Spending’s up ${f.changePercent}% from last month. Not panicking, just noticing.`, `Little spike this month, about ${f.changePercent}%. Maybe slow the roll?`], seed);
      case 'near': return pick([`${f.near[0].label} is at ${f.near[0].usedPercent}%. Easy does it, my guy.`, `Heads up, ${f.near[0].label} is almost tapped. No rush, just aware.`], seed);
      case 'improving': return pick([`Spending’s down ${Math.abs(f.changePercent ?? 0)}%. Look at you. Smooth.`, 'Less than last month. Respect.'], seed);
      default: return f.budget ? pick([`${peso(f.budget.remainingCents)} left with ${f.daysLeft} days to go. We’re good.`, 'Budget’s chillin’. So are we.'], seed) : `${peso(f.totalCents)} this month. Pretty relaxed so far.`;
    }
  },
  react: (r, seed) => r.pushedOver
    ? pick([`That nudged ${r.categoryLabel} over the limit. No stress, just maybe pause it there.`], seed)
    : r.big ? pick([`${peso(r.amountCents)} at ${r.merchant}. Treat yourself… once.`, 'Big one. Hope it sparks joy.'], seed)
    : pick(['Logged. Easy.', `Got it. ${r.categoryLeftCents !== null ? `${peso(r.categoryLeftCents)} left in ${r.categoryLabel}.` : 'We cool.'}`, 'Noted, my guy.'], seed),
  answer: (text, seed) => `${pick(['So, ', 'Alright, ', 'Okay so, '], seed)}${text.charAt(0).toLowerCase()}${text.slice(1)} ${pick(['No stress.', 'All good.', 'Easy.'], seed + 1)}`,
  challenge: (expenses, today) => ({ title: 'Log 5 days this week', detail: 'Just keep tabs. Record something on 5 of the last 7 days.', icon: 'notebook-check-outline', goal: 5, progress: Math.min(5, daysWith(expenses, lastDays(today, 7)).size) }),
};

const bestie: AdviserPersona = {
  id: 'bestie',
  name: 'Hype Bestie',
  tagline: 'Your biggest fan. Even of your savings.',
  icon: 'party-popper',
  accent: '#FADFE2',
  sample: 'WAIT you stayed under budget?? Main character energy 💅',
  say: (f, seed) => {
    switch (f.situation) {
      case 'empty': return pick(['New month, new us!! Let’s gooo', 'Fresh start bestie, we are SO ready.'], seed);
      case 'over': return f.over[0] ? pick([`Okay bestie, ${f.over[0].label} is ${peso(f.over[0].overCents)} over. Not a slay. Comeback arc starts NOW`, `${f.over[0].label} went over but I still believe in you!! Reset time.`], seed) : 'We went over a lil. Villain era is over, savings era begins!';
      case 'jump': return pick([`Spending’s up ${f.changePercent}%… babe, we talked about this`, `${f.changePercent}% more than last month?? Let’s be so for real.`], seed);
      case 'near': return pick([`${f.near[0].label} is at ${f.near[0].usedPercent}%! Hold the line queen`], seed);
      case 'improving': return pick([`${Math.abs(f.changePercent ?? 0)}% less than last month?!? ICONIC. Obsessed.`, 'Spending LESS than last month. Main character energy'], seed);
      default: return f.budget ? pick([`${peso(f.budget.remainingCents)} still left! You’re literally thriving.`, 'Budget looking cute today'], seed) : `${peso(f.totalCents)} this month and you’re still serving.`;
    }
  },
  react: (r, seed) => r.pushedOver
    ? pick([`NOOO ${r.categoryLabel} just went over It’s okay, we bounce back.`], seed)
    : r.big ? pick([`${peso(r.amountCents)}?! Bestie… was it at least cute?`, `Okay big spender at ${r.merchant}!! Let’s chill after this one.`], seed)
    : r.small ? pick(['Tiny spend, huge discipline. Slay.', 'Smallest purchase ever, I’m so proud'], seed)
    : pick(['Logged!! You’re so organized it’s hot.', `${r.categoryLeftCents !== null ? `${peso(r.categoryLeftCents)} left in ${r.categoryLabel}, ` : ''}we’re doing amazing sweetie.`], seed),
  answer: (text, seed) => `${pick(['Okay bestie!!', 'Omg ok so', 'Spill time:'], seed)} ${text} ${pick(['Slay.', 'You got this.', 'Love that for you.'], seed + 1)}`,
  challenge: (expenses, today) => {
    const week = lastDays(today, 7);
    const wins = expenses.filter((item) => week.includes(item.transactionDate) && item.amountCents <= 20_000).length;
    return { title: '3 tiny wins this week', detail: 'Keep three purchases under ₱200. Small wins = big slay.', icon: 'star-shooting-outline', goal: 3, progress: Math.min(3, wins) };
  },
};

const sergeant: AdviserPersona = {
  id: 'sergeant',
  name: 'Drill Sergeant',
  tagline: 'Discipline. Is. Freedom.',
  icon: 'whistle',
  accent: '#DDEBDD',
  sample: 'BUDGET BREACH IN SECTOR: FOOD. Drop and give me a no-spend day!',
  say: (f, seed) => {
    switch (f.situation) {
      case 'empty': return 'NO EXPENSES LOGGED. Either you’re a machine or you’re hiding receipts, recruit!';
      case 'over': return f.over[0] ? pick([`BUDGET BREACH IN SECTOR: ${f.over[0].label.toUpperCase()}. ${peso(f.over[0].overCents)} OVER. Drop and give me a no-spend day!`], seed) : 'YOU ARE OVER BUDGET, RECRUIT. Lock it down!';
      case 'jump': return `SPENDING UP ${f.changePercent}%. That is NOT the mission. Tighten up!`;
      case 'near': return pick([`${f.near[0].label.toUpperCase()} AT ${f.near[0].usedPercent}%. Hold your position!`], seed);
      case 'improving': return `Spending DOWN ${Math.abs(f.changePercent ?? 0)}%. Outstanding work, soldier. Don’t get comfortable.`;
      default: return f.budget ? `${peso(f.budget.remainingCents)} IN RESERVE. ${f.daysLeft} DAYS TO HOLD THE LINE.` : `${peso(f.totalCents)} DEPLOYED THIS MONTH. Report all spending!`;
    }
  },
  react: (r, seed) => r.pushedOver
    ? `${r.categoryLabel.toUpperCase()} LINE BREACHED! Ceasefire on spending, NOW!`
    : r.big ? pick([`${peso(r.amountCents)}?! Was that in the mission brief, recruit?`, `${peso(r.amountCents)} AT ${r.merchant.toUpperCase()}. Explain yourself!`], seed)
    : pick(['Logged. Dismissed.', `Expense recorded. ${r.categoryLeftCents !== null ? `${peso(r.categoryLeftCents)} remaining in ${r.categoryLabel}.` : 'Stay sharp.'}`], seed),
  answer: (text, seed) => `${pick(['LISTEN UP!', 'REPORT:', 'AT EASE.'], seed)} ${text} ${pick(['Dismissed.', 'Now move!', 'Stay disciplined.'], seed + 1)}`,
  challenge: (expenses, today) => ({ title: 'No-spend drill: 3 days', detail: 'Three days this week with zero spending. Hut hut!', icon: 'calendar-check', goal: 3, progress: noSpendDays(expenses, today, 3) }),
};

const butler: AdviserPersona = {
  id: 'butler',
  name: 'The Butler',
  tagline: 'Impeccably polite. Quietly judging.',
  icon: 'bow-tie',
  accent: '#E6E4F3',
  sample: 'I see we’ve acquired yet another subscription. How… ambitious.',
  say: (f, seed) => {
    switch (f.situation) {
      case 'empty': return 'A pristine ledger. Most refreshing.';
      case 'over': return f.over[0] ? pick([`I regret to inform you that ${f.over[0].label} has exceeded its allowance by ${peso(f.over[0].overCents)}.`, `${f.over[0].label} is ${peso(f.over[0].overCents)} over. Shall I fetch the smelling salts?`], seed) : 'The budget, I’m afraid, has been… surpassed.';
      case 'jump': return `Expenditure has risen ${f.changePercent}% on last month. How very… ambitious.`;
      case 'near': return `${f.near[0].label} stands at ${f.near[0].usedPercent}%. Perhaps restraint, just this once?`;
      case 'improving': return `Spending is down ${Math.abs(f.changePercent ?? 0)}%. Splendid. I shall polish the silver in celebration.`;
      default: return f.budget ? `${peso(f.budget.remainingCents)} remains in the coffers, with ${f.daysLeft} days to go.` : `${peso(f.totalCents)} spent this month, duly noted.`;
    }
  },
  react: (r, seed) => r.pushedOver
    ? `Ah. ${r.categoryLabel} is now over budget. I shall pretend I didn’t see that.`
    : r.big ? pick([`${peso(r.amountCents)} at ${r.merchant}. A bold choice, if I may say.`, `${peso(r.amountCents)}. I trust it was… essential.`], seed)
    : pick(['Duly recorded.', `Very good. ${r.categoryLeftCents !== null ? `${peso(r.categoryLeftCents)} remains for ${r.categoryLabel}.` : ''}`.trim()], seed),
  answer: (text, seed) => `${pick(['If I may:', 'Allow me.', 'Certainly.'], seed)} ${text} ${pick(['Will that be all?', 'At your service.', 'Most prudent to ask.'], seed + 1)}`,
  challenge: (expenses, today) => {
    const days = lastDays(today, 7);
    const modest = days.filter((day) => expenses.filter((item) => item.transactionDate === day).reduce((sum, item) => sum + item.amountCents, 0) <= 30_000).length;
    return { title: 'Four modest days', detail: 'Keep four of the last seven days under ₱300. Refinement is restraint.', icon: 'diamond-stone', goal: 4, progress: Math.min(4, modest) };
  },
};

function topCategoryId(expenses: Expense[], today: string) {
  const totals = new Map<string, number>();
  expenses.filter((item) => item.transactionDate.startsWith(today.slice(0, 7))).forEach((item) => totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amountCents));
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export const ADVISER_PERSONAS: AdviserPersona[] = [classic, mom, chill, bestie, sergeant, butler];
export const DEFAULT_ADVISER: AdviserPersonaId = 'classic';
export const isAdviserPersonaId = (value: unknown): value is AdviserPersonaId => ADVISER_PERSONAS.some((persona) => persona.id === value);
export const adviserPersona = (id: AdviserPersonaId) => ADVISER_PERSONAS.find((persona) => persona.id === id) ?? classic;

/** Situations where the adviser is delivering bad news. */
export const isHarshSituation = (situation: AdviserSituation) => situation === 'over' || situation === 'jump' || situation === 'near';

/** Changes a few times a day so lines vary without flickering on every render. */
export const adviserSeed = (salt = 0) => Math.floor(Date.now() / (1000 * 60 * 60 * 3)) + salt;
