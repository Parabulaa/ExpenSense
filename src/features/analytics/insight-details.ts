import type { AnalyticsInsight, MonthAnalytics } from '@/features/analytics/analytics';
import type { MonthlyBudget } from '@/features/budget/types';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import type { Expense } from '@/features/expenses/types';
import type { AppAlert } from '@/features/notifications/alerts';
import { formatPeso, percentOf } from '@/lib/format';
import { formatExpenseDate } from '@/features/expenses/validation';

type IconName = DashboardCategory['icon'] | 'alert-circle-outline' | 'trending-up' | 'repeat' | 'receipt-text-outline' | 'lightbulb-on-outline';

export type InsightAction = { label: string; pathname: '/wallet' | '/transactions' | '/analytics' | '/manual-expense'; params?: Record<string, string> };
export type InsightDetail = {
  title: string;
  headline: string;
  icon: IconName;
  tone: 'info' | 'warning' | 'critical';
  stats: { label: string; value: string }[];
  tips: string[];
  actions: InsightAction[];
};

export type InsightContext = {
  expenses: Expense[];
  current: MonthAnalytics;
  previous: MonthAnalytics;
  categories: DashboardCategory[];
  budget?: MonthlyBudget;
  month: string;
  today: string;
};

const peso = (cents: number) => formatPeso(Math.round(cents));
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Days left in the month including today; 0 for a past month, the whole month for a future one. */
function daysLeft(month: string, today: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  if (today.slice(0, 7) > month) return 0;
  if (today.slice(0, 7) < month) return days;
  return days - Number(today.slice(8, 10)) + 1;
}

/** A tidy suggested budget: 10% under what was spent, rounded down to ₱50. */
function suggestedBudget(spentCents: number) {
  const target = Math.floor((spentCents * 0.9) / 5000) * 5000;
  return Math.max(target, 5000);
}

function categoryFacts(ctx: InsightContext, categoryId: string) {
  const category = ctx.categories.find((item) => item.id === categoryId);
  const label = category?.fullLabel ?? 'This category';
  const items = ctx.current.expenses.filter((expense) => expense.categoryId === categoryId);
  const spent = items.reduce((sum, expense) => sum + expense.amountCents, 0);
  const before = ctx.previous.expenses.filter((expense) => expense.categoryId === categoryId).reduce((sum, expense) => sum + expense.amountCents, 0);
  const largest = items.reduce<Expense | null>((top, expense) => !top || expense.amountCents > top.amountCents ? expense : top, null);
  const limit = ctx.budget?.categoryBudgets.find((item) => item.categoryId === categoryId)?.amountCents ?? 0;
  return { category, label, items, spent, before, largest, limit, share: percentOf(spent, ctx.current.totalCents) ?? 0 };
}

/** The part that answers "so what do I do": budget pressure turned into a daily figure. */
function budgetAdvice(ctx: InsightContext, facts: ReturnType<typeof categoryFacts>): { stats: InsightDetail['stats']; tips: string[] } {
  const left = daysLeft(ctx.month, ctx.today);
  if (!facts.limit) {
    const suggestion = suggestedBudget(facts.spent);
    return {
      stats: [],
      tips: [`Set a ${facts.label} budget of about ${peso(suggestion)} — 10% under this month — so you get warned before it runs away.`],
    };
  }
  const remaining = facts.limit - facts.spent;
  const stats = [
    { label: 'Budget', value: peso(facts.limit) },
    { label: remaining < 0 ? 'Over by' : 'Left', value: peso(Math.abs(remaining)) },
  ];
  if (remaining < 0) {
    return {
      stats,
      tips: [
        `You're ${peso(-remaining)} over your ${facts.label} budget. Hold off on non-essential ${facts.label} spending for the rest of the month.`,
        facts.limit < facts.before ? `Last month you spent ${peso(facts.before)} here, more than this budget. If ${peso(facts.limit)} was too tight, raise it to something you can keep.` : `If this month was unusual, keep the budget and treat the overspend as a one-off.`,
      ],
    };
  }
  const tips = left > 0 ? [`To stay within budget, keep ${facts.label} to about ${peso(remaining / left)} a day for the next ${plural(left, 'day')}.`] : [`This month is over — you finished ${peso(remaining)} under your ${facts.label} budget.`];
  if ((percentOf(facts.spent, facts.limit) ?? 0) >= 80 && left > 0) tips.push(`You've already used ${percentOf(facts.spent, facts.limit)}% of it — plan the big ${facts.label} purchases first.`);
  return { stats, tips };
}

function categoryDetail(ctx: InsightContext, categoryId: string, title: string, tone: InsightDetail['tone']): InsightDetail {
  const facts = categoryFacts(ctx, categoryId);
  const advice = budgetAdvice(ctx, facts);
  const change = facts.before ? Math.round(((facts.spent - facts.before) / facts.before) * 100) : null;
  const tips = [...advice.tips];
  if (facts.largest) tips.push(`Your biggest ${facts.label} expense was ${peso(facts.largest.amountCents)} at ${facts.largest.merchant}.`);
  if (change !== null && change >= 20) tips.push(`That's ${change}% more than last month (${peso(facts.before)}). Check whether anything new was added.`);
  if (facts.share >= 50) tips.push(`${facts.label} is more than half of everything you spent this month.`);
  return {
    title,
    headline: `${peso(facts.spent)} on ${facts.label} across ${plural(facts.items.length, 'expense')}.`,
    icon: facts.category?.icon ?? 'shape-outline',
    tone,
    stats: [
      { label: 'Spent', value: peso(facts.spent) },
      { label: 'Share of spending', value: `${facts.share}%` },
      { label: 'Last month', value: facts.before ? peso(facts.before) : '—' },
      { label: 'Per expense', value: facts.items.length ? peso(facts.spent / facts.items.length) : '—' },
      ...advice.stats,
    ],
    tips,
    actions: [
      { label: facts.limit ? `Adjust ${facts.label} budget` : `Set ${facts.label} budget`, pathname: '/wallet' },
      { label: `See ${facts.label} expenses`, pathname: '/transactions', params: { q: facts.label } },
    ],
  };
}

export function detailForInsight(insight: AnalyticsInsight, ctx: InsightContext): InsightDetail {
  const top = ctx.current.categorySlices[0];
  if ((insight.id === 'top' || insight.id === 'recommendation') && top && top.id !== 'others') {
    return categoryDetail(ctx, top.id, insight.id === 'top' ? `${top.label} leads your spending` : insight.title, 'info');
  }

  if (insight.id === 'recurring') {
    const groups = new Map<string, { name: string; count: number; total: number }>();
    ctx.current.expenses.forEach((expense) => {
      const key = expense.merchant.trim().toLocaleLowerCase();
      const entry = groups.get(key) ?? { name: expense.merchant.trim(), count: 0, total: 0 };
      groups.set(key, { ...entry, count: entry.count + 1, total: entry.total + expense.amountCents });
    });
    const repeat = [...groups.values()].filter((item) => item.count >= 2).sort((a, b) => b.total - a.total);
    const leader = repeat[0];
    return {
      title: 'Repeat merchants',
      headline: leader ? `You paid ${leader.name} ${plural(leader.count, 'time')} this month, ${peso(leader.total)} in total.` : insight.detail,
      icon: 'repeat',
      tone: 'info',
      stats: repeat.slice(0, 4).map((item) => ({ label: `${item.name} · ${item.count}×`, value: peso(item.total) })),
      tips: leader ? [
        `Each ${leader.name} visit averages ${peso(leader.total / leader.count)}. Skipping one a week would save about ${peso((leader.total / leader.count) * 4)} a month.`,
        'If a repeat cost is essential (like a commute), give its category a budget so it stays planned instead of adding up quietly.',
      ] : [],
      actions: leader ? [{ label: `See ${leader.name} expenses`, pathname: '/transactions', params: { q: leader.name } }] : [],
    };
  }

  if (insight.id === 'unusual') {
    const growth = ctx.categories
      .map((category) => {
        const now = ctx.current.expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amountCents, 0);
        const before = ctx.previous.expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amountCents, 0);
        return { label: category.fullLabel, delta: now - before };
      })
      .filter((item) => item.delta > 0)
      .sort((a, b) => b.delta - a.delta);
    const increase = ctx.current.totalCents - ctx.previous.totalCents;
    return {
      title: 'Spending is up',
      headline: `${peso(ctx.current.totalCents)} this month vs ${peso(ctx.previous.totalCents)} last month — ${peso(increase)} more.`,
      icon: 'trending-up',
      tone: 'warning',
      stats: growth.slice(0, 4).map((item) => ({ label: `${item.label} increase`, value: `+${peso(item.delta)}` })),
      tips: growth[0] ? [
        `Most of the increase came from ${growth[0].label} (+${peso(growth[0].delta)}). Start there.`,
        `Bringing ${growth[0].label} back to last month's level would cut this month's total by ${percentOf(growth[0].delta, ctx.current.totalCents)}%.`,
      ] : [],
      actions: [{ label: 'Open Analytics', pathname: '/analytics' }, ...(growth[0] ? [{ label: `See ${growth[0].label} expenses`, pathname: '/transactions' as const, params: { q: growth[0].label } }] : [])],
    };
  }

  return { title: insight.title, headline: insight.detail, icon: insight.icon, tone: 'info', stats: [], tips: [], actions: [] };
}

export function detailForAlert(alert: AppAlert, ctx: InsightContext): InsightDetail {
  const [kind, second, third, fourth] = alert.id.split(':');
  if (kind === 'category' && second) return categoryDetail(ctx, second, alert.title, alert.tone === 'critical' ? 'critical' : 'warning');
  if (kind === 'insight' && third === ctx.month && fourth) return categoryDetail(ctx, fourth, alert.title, 'info');
  if (kind === 'reminder') {
    const latest = ctx.expenses.reduce<string | null>((newest, expense) => !newest || expense.transactionDate > newest ? expense.transactionDate : newest, null);
    return {
      title: alert.title,
      headline: alert.detail,
      icon: 'receipt-text-outline',
      tone: 'info',
      stats: latest ? [{ label: 'Last expense', value: formatExpenseDate(latest) }] : [],
      tips: [
        'Small cash purchases are the easiest to forget — snacks, fares and top-ups add up.',
        'Scanning a receipt right after paying keeps your budgets accurate without extra effort.',
      ],
      actions: [{ label: 'Add Expense', pathname: '/manual-expense' }],
    };
  }
  return { title: alert.title, headline: alert.detail, icon: 'lightbulb-on-outline', tone: alert.tone === 'critical' ? 'critical' : alert.tone === 'warning' ? 'warning' : 'info', stats: [], tips: [], actions: alert.route ? [{ label: 'Open', pathname: alert.route === '/add-expense' ? '/manual-expense' : alert.route === '/insights' ? '/analytics' : alert.route }] : [] };
}
