import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { readCache, STALE_AFTER_MS, writeCache } from '@/lib/offline/cache';
import * as service from './budget-service';
import type { BudgetResult, CategoryBudget, MonthlyBudget } from './types';

type BudgetContextValue = {
  budgets: MonthlyBudget[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Refetches only when the data is stale — for screens coming into view. */
  revalidate: () => Promise<void>;
  saveCategoryBudget: (month: string, categoryId: string, amountCents: number) => Promise<BudgetResult<{ budget: MonthlyBudget; limit: CategoryBudget }>>;
  removeCategoryBudget: (budgetId: string, id: string) => Promise<BudgetResult<{ id: string }>>;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedUserId = useRef<string | null>(null);
  const lastFetched = useRef(0);
  const refresh = useCallback(async () => {
    if (!user) { loadedUserId.current = null; setBudgets([]); setError(null); setLoading(false); return; }
    if (loadedUserId.current !== user.id) {
      loadedUserId.current = user.id;
      const cached = await readCache<MonthlyBudget[]>(user.id, 'budgets');
      setBudgets(cached ?? []);
      if (cached) setLoading(false);
    }
    setLoading(true);
    const result = await service.getBudgets();
    if (result.ok) { setBudgets(result.data); writeCache(user.id, 'budgets', result.data); lastFetched.current = Date.now(); setError(null); }
    else if (!result.offline) setError(result.message);
    setLoading(false);
  }, [user]);
  const revalidate = useCallback(async () => {
    if (Date.now() - lastFetched.current < STALE_AFTER_MS && loadedUserId.current === user?.id) return;
    await refresh();
  }, [refresh, user?.id]);
  // Local edits keep the saved copy in step with what is on screen.
  useEffect(() => { if (loadedUserId.current && !loading) writeCache(loadedUserId.current, 'budgets', budgets); }, [budgets, loading]);
  useEffect(() => {
    if (!initialized) return;
    // Synchronize the provider after the authenticated identity is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [initialized, refresh]);
  const saveCategoryBudget = useCallback(async (month: string, categoryId: string, amountCents: number) => {
    const result = await service.saveCategoryBudget(month, categoryId, amountCents);
    if (result.ok) {
      const { budget, limit } = result.data;
      setBudgets((current) => {
        const existing = current.find((item) => item.id === budget.id) ?? budget;
        const next = { ...existing, categoryBudgets: [...existing.categoryBudgets.filter((item) => item.categoryId !== categoryId), limit] };
        return [next, ...current.filter((item) => item.id !== budget.id)].sort((a, b) => b.month.localeCompare(a.month));
      });
    }
    return result;
  }, []);
  const removeCategoryBudget = useCallback(async (budgetId: string, id: string) => {
    const result = await service.removeCategoryBudget(id);
    if (result.ok) setBudgets((current) => current.map((budget) => budget.id === budgetId ? { ...budget, categoryBudgets: budget.categoryBudgets.filter((item) => item.id !== id) } : budget));
    return result;
  }, []);
  const value = useMemo(() => ({ budgets, loading, error, refresh, revalidate, saveCategoryBudget, removeCategoryBudget }), [budgets, error, loading, refresh, revalidate, removeCategoryBudget, saveCategoryBudget]);
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudgets() {
  const value = useContext(BudgetContext);
  if (!value) throw new Error('useBudgets must be used within BudgetProvider');
  return value;
}
