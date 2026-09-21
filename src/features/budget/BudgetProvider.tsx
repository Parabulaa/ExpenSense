import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import * as service from './budget-service';
import type { BudgetResult, MonthlyBudget } from './types';

type BudgetContextValue = {
  budgets: MonthlyBudget[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveMonthlyBudget: (month: string, amountCents: number) => Promise<BudgetResult<MonthlyBudget>>;
  saveCategoryBudget: (budgetId: string, categoryId: string, amountCents: number) => Promise<BudgetResult<{ id: string; categoryId: string; amountCents: number }>>;
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
  const saveMonthlyBudget = useCallback(async (month: string, amountCents: number) => {
    const result = await service.saveMonthlyBudget(month, amountCents);
    if (result.ok) setBudgets((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
    return result;
  }, []);
  const saveCategoryBudget = useCallback(async (budgetId: string, categoryId: string, amountCents: number) => {
    const result = await service.saveCategoryBudget(budgetId, categoryId, amountCents);
    if (result.ok) setBudgets((current) => current.map((budget) => budget.id === budgetId ? { ...budget, categoryBudgets: [...budget.categoryBudgets.filter((item) => item.categoryId !== categoryId), result.data] } : budget));
    return result;
  }, []);
  const removeCategoryBudget = useCallback(async (budgetId: string, id: string) => {
    const result = await service.removeCategoryBudget(id);
    if (result.ok) setBudgets((current) => current.map((budget) => budget.id === budgetId ? { ...budget, categoryBudgets: budget.categoryBudgets.filter((item) => item.id !== id) } : budget));
    return result;
  }, []);
  const value = useMemo(() => ({ budgets, loading, error, refresh, saveMonthlyBudget, saveCategoryBudget, removeCategoryBudget }), [budgets, error, loading, refresh, removeCategoryBudget, saveCategoryBudget, saveMonthlyBudget]);
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudgets() {
  const value = useContext(BudgetContext);
  if (!value) throw new Error('useBudgets must be used within BudgetProvider');
  return value;
}
