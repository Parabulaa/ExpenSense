import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import * as service from './budget-service';
import type { BudgetResult, CategoryBudget, MonthlyBudget } from './types';

type BudgetContextValue = {
  budgets: MonthlyBudget[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveCategoryBudget: (month: string, categoryId: string, amountCents: number) => Promise<BudgetResult<{ budget: MonthlyBudget; limit: CategoryBudget }>>;
  removeCategoryBudget: (budgetId: string, id: string) => Promise<BudgetResult<{ id: string }>>;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user) { setBudgets([]); setError(null); setLoading(false); return; }
    setLoading(true);
    const result = await service.getBudgets();
    if (result.ok) { setBudgets(result.data); setError(null); } else setError(result.message);
    setLoading(false);
  }, [user]);
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
  const value = useMemo(() => ({ budgets, loading, error, refresh, saveCategoryBudget, removeCategoryBudget }), [budgets, error, loading, refresh, removeCategoryBudget, saveCategoryBudget]);
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudgets() {
  const value = useContext(BudgetContext);
  if (!value) throw new Error('useBudgets must be used within BudgetProvider');
  return value;
}
