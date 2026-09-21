import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  defaultDashboardCategories,
  MAX_DASHBOARD_CATEGORIES,
  MIN_DASHBOARD_CATEGORIES,
  type DashboardCategory,
} from './dashboard-data';
import { useCategories } from '@/features/categories/CategoriesProvider';

type DashboardCategoriesValue = {
  /** The curated dashboard selection, in display order. */
  categories: DashboardCategory[];
  isFull: boolean;
  canRemove: boolean;
  isOnDashboard: (id: string) => boolean;
  /** Returns false when the selection is already at the limit. */
  addCategory: (id: string) => boolean;
  /** Adds the first library category not already selected. */
  addNextAvailable: () => boolean;
  /** Removes from the dashboard selection only — the category itself remains. */
  removeCategory: (id: string) => void;
  /** Trades the dragged category's slot with the one at `target`. */
  swapCategories: (id: string, target: number) => void;
};

const DashboardCategoriesContext = createContext<DashboardCategoriesValue | null>(null);

/**
 * The dashboard's category selection is a curated subset of the full library,
 * and both the dashboard grid and the Categories screen mutate it. Holding it
 * here means the max-8 rule is enforced in exactly one place instead of being
 * re-derived per screen.
 */
export function DashboardCategoriesProvider({ children }: PropsWithChildren) {
  const { categories: categoryLibrary } = useCategories();
  const [categories, setCategories] = useState<DashboardCategory[]>(defaultDashboardCategories);
  const resolvedCategories = useMemo(
    () => categories.map((selected) => categoryLibrary.find((item) => item.id === selected.id) ?? selected),
    [categories, categoryLibrary],
  );

  const isFull = categories.length >= MAX_DASHBOARD_CATEGORIES;
  const canRemove = categories.length > MIN_DASHBOARD_CATEGORIES;

  const isOnDashboard = useCallback(
    (id: string) => categories.some((category) => category.id === id),
    [categories],
  );

  const addCategory = useCallback((id: string) => {
    let added = false;

    setCategories((current) => {
      if (current.length >= MAX_DASHBOARD_CATEGORIES) return current;
      if (current.some((category) => category.id === id)) return current;

      const next = categoryLibrary.find((category) => category.id === id);
      if (!next) return current;

      added = true;
      return [...current, next];
    });

    return added;
  }, [categoryLibrary]);

  const addNextAvailable = useCallback(() => {
    let added = false;

    setCategories((current) => {
      if (current.length >= MAX_DASHBOARD_CATEGORIES) return current;

      const next = categoryLibrary.find(
        (candidate) => !current.some((category) => category.id === candidate.id),
      );
      if (!next) return current;

      added = true;
      return [...current, next];
    });

    return added;
  }, [categoryLibrary]);

  const removeCategory = useCallback((id: string) => {
    setCategories((current) =>
      current.length > MIN_DASHBOARD_CATEGORIES
        ? current.filter((category) => category.id !== id)
        : current,
    );
  }, []);

  // The two tiles trade places. Splicing the dragged tile into the target slot
  // instead would shift every category in between by one, so dropping a tile
  // two slots away visibly reshuffles neighbours the user never touched.
  const swapCategories = useCallback((id: string, target: number) => {
    setCategories((current) => {
      const from = current.findIndex((item) => item.id === id);
      if (from < 0 || from === target) return current;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      next[from] = current[target];
      next[target] = current[from];
      return next;
    });
  }, []);

  const value = useMemo<DashboardCategoriesValue>(
    () => ({
      categories: resolvedCategories,
      isFull,
      canRemove,
      isOnDashboard,
      addCategory,
      addNextAvailable,
      removeCategory,
      swapCategories,
    }),
    [
      resolvedCategories,
      isFull,
      canRemove,
      isOnDashboard,
      addCategory,
      addNextAvailable,
      removeCategory,
      swapCategories,
    ],
  );

  return (
    <DashboardCategoriesContext.Provider value={value}>
      {children}
    </DashboardCategoriesContext.Provider>
  );
}

export function useDashboardCategories() {
  const ctx = useContext(DashboardCategoriesContext);
  if (!ctx) throw new Error('useDashboardCategories must be used within a DashboardCategoriesProvider');
  return ctx;
}
