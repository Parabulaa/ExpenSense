import type { MonthlyBudget } from '@/features/budget/types';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import type { Expense } from '@/features/expenses/types';

export const ANALYTICS_COLORS = ['#145733', '#367A50', '#669568', '#93B187', '#C4D5B8'] as const;

export type CategorySlice = {
  id: string;
  label: string;
  icon: DashboardCategory['icon'];
  amountCents: number;
  percentage: number;
  color: string;
};

export type DailyTotal = { day: number; amountCents: number };

export type MonthAnalytics = {
  month: string;
  expenses: Expense[];
  totalCents: number;
  categorySlices: CategorySlice[];
  dailyTotals: DailyTotal[];
  averageDailyCents: number;
  highestDay: DailyTotal | null;
};

export type AnalyticsInsight = {
  id: 'top' | 'recurring' | 'unusual' | 'recommendation';
  label: string;
  title: string;
  detail: string;
  icon: DashboardCategory['icon'];
  destination?: '/transactions' | '/budget';
  /**
   * Seeds the Transactions search so the chevron lands on the rows the insight
   * is actually about, rather than the unfiltered list.
   */
  filterQuery?: string;
};

/**
 * A single prior transaction isn't a spending pattern. The previous month needs
 * at least this many expenses before a month-over-month jump is worth calling
 * "unusual" rather than just "the first few entries".
 */
export const MIN_HISTORY_EXPENSES = 3;

export function analyticsForMonth(expenses: Expense[], categories: DashboardCategory[], month: string): MonthAnalytics {
  const selected = expenses.filter((expense) => expense.transactionDate.startsWith(month));
  const totalCents = selected.reduce((sum, expense) => sum + expense.amountCents, 0);
  const byCategory = new Map<string, number>();
  const byDay = new Map<number, number>();
  selected.forEach((expense) => {
    byCategory.set(expense.categoryId, (byCategory.get(expense.categoryId) ?? 0) + expense.amountCents);
    const day = Number(expense.transactionDate.slice(8, 10));
    byDay.set(day, (byDay.get(day) ?? 0) + expense.amountCents);
  });

  const ranked = [...byCategory.entries()]
    .map(([id, amountCents]) => {
      const category = categories.find((item) => item.id === id);
      return { id, label: category?.fullLabel ?? 'Archived category', icon: category?.icon ?? 'shape-outline', amountCents };
    })
    .sort((a, b) => b.amountCents - a.amountCents);
  const visible = ranked.length <= 5 ? ranked : [
    ...ranked.slice(0, 4),
    { id: 'others', label: 'Others', icon: 'shape-outline' as const, amountCents: ranked.slice(4).reduce((sum, item) => sum + item.amountCents, 0) },
  ];
  const categorySlices = visible.map((item, index) => ({
    ...item,
    percentage: totalCents ? (item.amountCents / totalCents) * 100 : 0,
    color: ANALYTICS_COLORS[index],
  }));
  const dailyTotals = [...byDay.entries()].map(([day, amountCents]) => ({ day, amountCents })).sort((a, b) => a.day - b.day);
  const highestDay = dailyTotals.reduce<DailyTotal | null>((highest, item) => !highest || item.amountCents > highest.amountCents ? item : highest, null);
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return { month, expenses: selected, totalCents, categorySlices, dailyTotals, averageDailyCents: Math.round(totalCents / daysInMonth), highestDay };
}

export function previousMonth(month: string) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildInsights(
  current: MonthAnalytics,
  previous: MonthAnalytics,
  categories: DashboardCategory[],
  budget?: MonthlyBudget,
): AnalyticsInsight[] {
  if (!current.expenses.length) return [];
  const insights: AnalyticsInsight[] = [];
  const top = current.categorySlices[0];
  if (top) insights.push({ id: 'top', label: 'Top Category', title: top.label, detail: `Accounts for ${Math.round(top.percentage)}% of your spending this month.`, icon: top.icon, destination: '/transactions', filterQuery: top.id === 'others' ? undefined : top.label });

  const merchants = new Map<string, { name: string; count: number }>();
  current.expenses.forEach((expense) => {
    const key = expense.merchant.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const value = merchants.get(key);
    merchants.set(key, { name: value?.name ?? expense.merchant.trim(), count: (value?.count ?? 0) + 1 });
  });
  const recurring = [...merchants.values()].filter((item) => item.count >= 2).sort((a, b) => b.count - a.count);
  if (recurring.length) insights.push({ id: 'recurring', label: 'Recurring Expenses', title: `${recurring.length} recurring merchant${recurring.length === 1 ? '' : 's'}`, detail: `${recurring.slice(0, 2).map((item) => item.name).join(' and ')} appeared more than once this month.`, icon: 'cart-outline', destination: '/transactions', filterQuery: recurring[0].name });

  // Needs a real baseline to compare against, not just one prior expense.
  if (previous.expenses.length >= MIN_HISTORY_EXPENSES && previous.totalCents > 0 && current.totalCents > previous.totalCents * 1.15) {
    const increase = Math.round(((current.totalCents - previous.totalCents) / previous.totalCents) * 100);
    insights.push({ id: 'unusual', label: 'Unusual Spending', title: `${increase}% higher`, detail: 'Your total spending is higher than the previous month.', icon: 'shape-outline' });
  }

  const topCategory = categories.find((category) => category.id === top?.id);
  const categoryLimit = budget?.categoryBudgets.find((item) => item.categoryId === top?.id);
  if (top && categoryLimit) {
    const used = Math.round((top.amountCents / categoryLimit.amountCents) * 100);
    insights.push({ id: 'recommendation', label: 'Recommendation', title: `${top.label} budget is ${used}% used`, detail: used >= 100 ? 'This category is over its limit. Review the budget or recent expenses.' : 'Keep an eye on this category as the month continues.', icon: 'briefcase-outline', destination: '/budget' });
  } else if (top) {
    insights.push({ id: 'recommendation', label: 'Recommendation', title: `Set a ${topCategory?.fullLabel ?? top.label} budget`, detail: 'Your largest spending category does not have a category limit yet.', icon: 'briefcase-outline', destination: '/budget' });
  }
  return insights.slice(0, 4);
}

function formatPeso(cents: number) {
  return `₱${Math.round(cents / 100).toLocaleString('en-PH')}`;
}

/**
 * One short line for the dashboard mascot, derived from the same analytics the
 * Insights screen uses so the two can never disagree. Budget pressure outranks
 * the general insights, because an overspent month is the thing worth saying
 * first; otherwise the highest-priority Phase 7 insight is summarised.
 */
export function mascotInsight(
  current: MonthAnalytics,
  previous: MonthAnalytics,
  categories: DashboardCategory[],
  budget?: MonthlyBudget,
): string {
  if (!current.expenses.length) {
    return "Add a few expenses and I'll start spotting spending patterns.";
  }

  const insights = buildInsights(current, previous, categories, budget);

  // An overspend or a near-limit category is the most actionable thing to say.
  if (budget) {
    const remaining = budget.amountCents - current.totalCents;
    if (remaining < 0) return `You’re ${formatPeso(Math.abs(remaining))} over this month’s budget.`;

    const pressured = budget.categoryBudgets
      .map((limit) => {
        const spent = current.expenses
          .filter((expense) => expense.categoryId === limit.categoryId)
          .reduce((sum, expense) => sum + expense.amountCents, 0);
        const category = categories.find((item) => item.id === limit.categoryId);
        return { label: category?.label ?? 'category', percent: limit.amountCents ? Math.round((spent / limit.amountCents) * 100) : 0 };
      })
      .sort((a, b) => b.percent - a.percent)[0];

    if (pressured && pressured.percent >= 70) {
      return `You’ve used ${pressured.percent}% of your ${pressured.label} budget.`;
    }
  }

  const unusual = insights.find((insight) => insight.id === 'unusual');
  if (unusual) return `Your spending is ${unusual.title} than last month.`;

  if (budget) {
    const remaining = budget.amountCents - current.totalCents;
    return `You have ${formatPeso(remaining)} left in this month’s budget.`;
  }

  const top = insights.find((insight) => insight.id === 'top');
  if (top) return `${top.title} is your highest category this month.`;

  const recurring = insights.find((insight) => insight.id === 'recurring');
  if (recurring) return recurring.detail;

  return 'Your spending is tracking close to your usual monthly pace.';
}
