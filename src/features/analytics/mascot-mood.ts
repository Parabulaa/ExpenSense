import { assets } from '@/constants/theme';
import type { MonthAnalytics } from '@/features/analytics/analytics';
import { budgetUsage, type MonthlyBudget } from '@/features/budget/types';
import { percentOf } from '@/lib/format';

export type MascotMood = 'scanning' | 'confused' | 'warning' | 'tip' | 'success';

/**
 * How the mascot should feel about the month, from the same numbers the
 * insights use — so its face always agrees with what it is saying.
 */
export function mascotMood({ loading, current, previous, budget }: { loading: boolean; current: MonthAnalytics; previous: MonthAnalytics; budget?: MonthlyBudget }): MascotMood {
  if (loading) return 'scanning';
  if (!current.expenses.length) return 'confused';

  const usage = budgetUsage(budget, current.expenses);
  const categoryUse = (budget?.categoryBudgets ?? []).map((limit) => percentOf(
    current.expenses.filter((expense) => expense.categoryId === limit.categoryId).reduce((sum, expense) => sum + expense.amountCents, 0),
    limit.amountCents,
  ) ?? 0);
  if ((usage.hasBudget && usage.remainingCents < 0) || categoryUse.some((used) => used > 100)) return 'warning';
  // A real jump against a real baseline, same rule as the "unusual" insight.
  if (previous.expenses.length >= 3 && previous.totalCents > 0 && current.totalCents > previous.totalCents * 1.15) return 'warning';
  if (categoryUse.some((used) => used >= 80)) return 'tip';
  if (previous.totalCents > 0 && current.totalCents < previous.totalCents) return 'success';
  return 'tip';
}

export const mascotImage: Record<MascotMood, number> = {
  scanning: assets.mascotScanning,
  confused: assets.mascotConfused,
  warning: assets.mascotWarning,
  tip: assets.mascotTip,
  success: assets.mascotSuccess,
};
