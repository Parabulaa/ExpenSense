export type DashboardPeriod = 'This Month' | 'Last 30 Days' | 'This Year';

export type DashboardCategory = {
  id: string;
  /** Short form, sized for the dashboard grid tile. */
  label: string;
  /** Full name, used wherever there is room for it (detail screen, a11y labels). */
  fullLabel: string;
  budget: number;
  spent: number;
  icon:
    | 'food-fork-drink'
    | 'bus'
    | 'file-document-outline'
    | 'shopping'
    | 'school'
    | 'airplane'
    | 'heart-pulse'
    | 'gamepad-variant-outline'
    | 'cart-outline'
    | 'shape-outline'
    | 'coffee-outline'
    | 'home-outline'
    | 'paw-outline'
    | 'music-note-outline'
    | 'briefcase-outline';
  color?: string;
  custom?: boolean;
  archived?: boolean;
};

/**
 * The dashboard grid is a curated selection, not the full category library —
 * it stays scannable at a glance and never grows past two rows of four.
 */
export const MAX_DASHBOARD_CATEGORIES = 8;

/** Keeps the grid from being emptied entirely. */
export const MIN_DASHBOARD_CATEGORIES = 1;

export type DashboardMonth = {
  id: string;
  label: string;
  spent: number;
  budget: number;
  transactions: number;
  foodChange: number;
  bars: number[];
};

export const dashboardMonths: DashboardMonth[] = [
  {
    id: '2026-09',
    label: 'September 2026',
    spent: 8420,
    budget: 15000,
    transactions: 28,
    foodChange: -18,
    bars: [0.32, 0.46, 0.38, 0.57, 0.72, 0.88],
  },
  {
    id: '2026-08',
    label: 'August 2026',
    spent: 9175,
    budget: 15000,
    transactions: 34,
    foodChange: 7,
    bars: [0.44, 0.39, 0.62, 0.51, 0.81, 0.68],
  },
  {
    id: '2026-07',
    label: 'July 2026',
    spent: 7890,
    budget: 14000,
    transactions: 25,
    foodChange: -9,
    bars: [0.28, 0.42, 0.35, 0.53, 0.61, 0.74],
  },
];

export const dashboardPeriods: DashboardPeriod[] = [
  'This Month',
  'Last 30 Days',
  'This Year',
];

export const categoryLibrary: DashboardCategory[] = [
  { id: 'food', label: 'Food', fullLabel: 'Food & Dining', budget: 3000, spent: 2140, icon: 'food-fork-drink' },
  { id: 'transport', label: 'Transport', fullLabel: 'Transportation', budget: 2000, spent: 1180, icon: 'bus' },
  { id: 'bills', label: 'Bills', fullLabel: 'Bills', budget: 3000, spent: 2320, icon: 'file-document-outline' },
  { id: 'shopping', label: 'Shopping', fullLabel: 'Shopping', budget: 2000, spent: 1450, icon: 'shopping' },
  { id: 'school', label: 'School', fullLabel: 'Education', budget: 1500, spent: 730, icon: 'school' },
  { id: 'travel', label: 'Travel', fullLabel: 'Travel', budget: 2500, spent: 600, icon: 'airplane' },
  { id: 'health', label: 'Health', fullLabel: 'Health', budget: 1200, spent: 430, icon: 'heart-pulse' },
  { id: 'entertainment', label: 'Fun', fullLabel: 'Entertainment', budget: 900, spent: 380, icon: 'gamepad-variant-outline' },
  { id: 'groceries', label: 'Groceries', fullLabel: 'Groceries', budget: 2200, spent: 1290, icon: 'cart-outline' },
];

export const defaultDashboardCategories = categoryLibrary.slice(0, 6);

export function findDashboardCategory(id: string | undefined) {
  if (!id) return null;
  return categoryLibrary.find((category) => category.id === id) ?? null;
}

export function insightForMonth(month: DashboardMonth, period: DashboardPeriod) {
  if (period === 'This Year') {
    return 'You have stayed within budget in 7 of the last 9 months.';
  }

  if (month.foodChange < 0) {
    return `You’re spending ${Math.abs(month.foodChange)}% less on food this week.`;
  }

  if (month.foodChange > 0) {
    return `Food spending is ${month.foodChange}% higher than your usual week.`;
  }

  return 'Your spending is tracking close to your usual monthly pace.';
}
