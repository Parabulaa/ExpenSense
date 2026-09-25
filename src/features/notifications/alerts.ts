import type { MonthlyBudget } from '@/features/budget/types';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import type { Expense } from '@/features/expenses/types';
import type { AppSettings } from '@/features/settings/SettingsProvider';

export type AlertTone = 'critical' | 'warning' | 'info';

export type AppAlert = {
  /** Stable across rebuilds so "already seen" survives a refresh. */
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  icon: 'wallet-outline' | 'alert-circle-outline' | 'chart-donut' | 'receipt-text-outline' | 'trending-up';
  route?: '/wallet' | '/insights' | '/transactions' | '/add-expense';
};

const TONE_ORDER: Record<AlertTone, number> = { critical: 0, warning: 1, info: 2 };
const REMINDER_QUIET_DAYS = 3;

function peso(cents: number) {
  return `₱${Math.round(cents / 100).toLocaleString('en-PH')}`;
}

function daysBetween(fromISODate: string, toISODate: string) {
  const from = new Date(`${fromISODate}T00:00:00`);
  const to = new Date(`${toISODate}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Derives the in-app alert feed from data the user already has — budgets they
 * set, expenses they logged, and the thresholds they chose. Nothing here is
 * generated or sampled, so an empty feed genuinely means "nothing to flag".
 */
export function buildAlerts(params: {
  expenses: Expense[];
  budgets: MonthlyBudget[];
  categories: DashboardCategory[];
  settings: AppSettings;
  month: string;
  today: string;
}): AppAlert[] {
  const { expenses, budgets, categories, settings, month, today } = params;
  const alerts: AppAlert[] = [];

  const monthExpenses = expenses.filter((expense) => expense.transactionDate.startsWith(month));
  const budget = budgets.find((item) => item.month === month);
  const threshold = settings.budgetAlertThreshold;

  // Budgets are category limits only, so each limit raises its own alert.
  if (settings.budgetAlerts && budget) {
    budget.categoryBudgets.forEach((limit) => {
      if (limit.amountCents <= 0) return;
      const categorySpent = monthExpenses
        .filter((expense) => expense.categoryId === limit.categoryId)
        .reduce((sum, expense) => sum + expense.amountCents, 0);
      const categoryUsed = Math.round((categorySpent / limit.amountCents) * 100);
      if (categoryUsed < threshold) return;

      const label = categories.find((item) => item.id === limit.categoryId)?.fullLabel ?? 'A category';
      alerts.push({
        id: `category:${limit.categoryId}:${month}:${categoryUsed >= 100 ? 'over' : threshold}`,
        tone: categoryUsed >= 100 ? 'critical' : 'warning',
        title: categoryUsed >= 100 ? `${label} is over its limit` : `${label} at ${categoryUsed}%`,
        detail: `${peso(categorySpent)} spent against a ${peso(limit.amountCents)} limit.`,
        icon: 'wallet-outline',
        route: '/wallet',
      });
    });
  }

  if (settings.spendingInsights && monthExpenses.length > 0) {
    const byCategory = new Map<string, number>();
    monthExpenses.forEach((expense) => {
      byCategory.set(expense.categoryId, (byCategory.get(expense.categoryId) ?? 0) + expense.amountCents);
    });
    const [topId, topAmount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const total = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);

    if (topId && total > 0) {
      const share = Math.round((topAmount / total) * 100);
      const label = categories.find((item) => item.id === topId)?.fullLabel ?? 'A category';
      alerts.push({
        id: `insight:top:${month}:${topId}`,
        tone: 'info',
        title: `${label} leads your spending`,
        detail: `It accounts for ${share}% of what you've spent this month.`,
        icon: 'chart-donut',
        route: '/insights',
      });
    }
  }

  if (settings.transactionReminders) {
    const latest = expenses.reduce<string | null>(
      (newest, expense) => (!newest || expense.transactionDate > newest ? expense.transactionDate : newest),
      null,
    );
    const quietDays = latest ? daysBetween(latest, today) : null;

    if (quietDays !== null && quietDays >= REMINDER_QUIET_DAYS) {
      alerts.push({
        id: `reminder:${today}`,
        tone: 'info',
        title: 'No expenses logged recently',
        detail: `Your last expense was ${quietDays} days ago. Add anything you've missed.`,
        icon: 'receipt-text-outline',
        route: '/add-expense',
      });
    }
  }

  return alerts.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
