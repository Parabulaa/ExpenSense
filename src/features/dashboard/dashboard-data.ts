export type DashboardPeriod = 'Week' | 'Month' | 'Year';

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

export const dashboardPeriods: DashboardPeriod[] = ['Week', 'Month', 'Year'];

export type PeriodRange = {
  /** Inclusive local dates, `YYYY-MM-DD`. */
  start: string;
  end: string;
  label: string;
  /** The month the period ends in — used for monthly budgets and insights. */
  month: string;
  /** Spark bar buckets: each bucket is an inclusive [start, end] date pair. */
  buckets: [string, string][];
};

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });

/**
 * The dashboard's period, `offset` steps back (negative) or forward from now.
 * Weeks start on Sunday, matching the calendars elsewhere in the app.
 */
export function periodRange(period: DashboardPeriod, offset: number, now = new Date()): PeriodRange {
  if (period === 'Week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offset * 7, 12);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 12);
    const days = Array.from({ length: 7 }, (_, index) => isoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12)));
    const label = offset === 0 ? 'This Week' : offset === -1 ? 'Last Week' : `${shortDate.format(start)} – ${shortDate.format(end)}`;
    return { start: isoDate(start), end: isoDate(end), label, month: isoDate(end).slice(0, 7), buckets: days.map((day) => [day, day]) };
  }
  if (period === 'Year') {
    const year = now.getFullYear() + offset;
    const buckets: [string, string][] = Array.from({ length: 6 }, (_, index) => [
      isoDate(new Date(year, index * 2, 1, 12)),
      isoDate(new Date(year, index * 2 + 2, 0, 12)),
    ]);
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year), month: `${year}-12`, buckets };
  }
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
  const month = isoDate(first).slice(0, 7);
  const buckets: [string, string][] = Array.from({ length: 6 }, (_, index) => {
    const from = index * 5 + 1;
    const to = index === 5 ? last.getDate() : from + 4;
    return [`${month}-${String(from).padStart(2, '0')}`, `${month}-${String(to).padStart(2, '0')}`];
  });
  return {
    start: isoDate(first),
    end: isoDate(last),
    label: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(first),
    month,
    buckets,
  };
}

/**
 * One name per category. `label` and `fullLabel` are deliberately identical so
 * a category reads the same on the dashboard, in pickers, budgets, analytics
 * and the assistant.
 */
export const categoryLibrary: DashboardCategory[] = [
  { id: 'food', label: 'Food', fullLabel: 'Food', budget: 3000, spent: 2140, icon: 'food-fork-drink' },
  { id: 'transport', label: 'Transport', fullLabel: 'Transport', budget: 2000, spent: 1180, icon: 'bus' },
  { id: 'bills', label: 'Bills', fullLabel: 'Bills', budget: 3000, spent: 2320, icon: 'file-document-outline' },
  { id: 'shopping', label: 'Shopping', fullLabel: 'Shopping', budget: 2000, spent: 1450, icon: 'shopping' },
  { id: 'school', label: 'School', fullLabel: 'School', budget: 1500, spent: 730, icon: 'school' },
  { id: 'travel', label: 'Travel', fullLabel: 'Travel', budget: 2500, spent: 600, icon: 'airplane' },
  { id: 'health', label: 'Health', fullLabel: 'Health', budget: 1200, spent: 430, icon: 'heart-pulse' },
  { id: 'entertainment', label: 'Entertainment', fullLabel: 'Entertainment', budget: 900, spent: 380, icon: 'gamepad-variant-outline' },
  { id: 'groceries', label: 'Groceries', fullLabel: 'Groceries', budget: 2200, spent: 1290, icon: 'cart-outline' },
];

export const defaultDashboardCategories = categoryLibrary.slice(0, 6);
