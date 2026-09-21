import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import * as expenseService from './expense-service';
import type { CreateExpenseInput, Expense, ExpenseResult, UpdateExpenseInput } from './types';

type ExpensesContextValue = {
  expenses: Expense[];
  loading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  createExpense: (input: CreateExpenseInput) => Promise<ExpenseResult<Expense>>;
  updateExpense: (input: UpdateExpenseInput) => Promise<ExpenseResult<Expense>>;
  deleteExpense: (id: string) => Promise<ExpenseResult<{ id: string }>>;
};

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

export function ExpensesProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const loadedUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      loadedUserId.current = null;
      setExpenses([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    if (inFlight.current && loadedUserId.current === user.id) return;
    if (loadedUserId.current !== user.id) {
      loadedUserId.current = user.id;
      setExpenses([]);
    }

    const currentRequest = ++requestId.current;
    inFlight.current = true;
    setLoading(true);
    const result = await expenseService.getExpenses();
    if (currentRequest !== requestId.current) {
      inFlight.current = false;
      return;
    }

    if (result.ok) {
      setExpenses(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
    }
    setLoading(false);
    inFlight.current = false;
  }, [user]);

  useEffect(() => {
    if (!initialized) return;
    // `refresh` synchronizes this provider with Supabase when auth identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [initialized, refresh]);

  const createExpense = useCallback(async (input: CreateExpenseInput) => {
    const result = await expenseService.createExpense(input);
    if (result.ok) {
      setExpenses((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
      setLoadError(null);
    }
    return result;
  }, []);

  const updateExpense = useCallback(async (input: UpdateExpenseInput) => {
    const result = await expenseService.updateExpense(input);
    if (result.ok) {
      setExpenses((current) => current.map((item) => item.id === result.data.id ? result.data : item));
      setLoadError(null);
    }
    return result;
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    const result = await expenseService.deleteExpense(id);
    if (result.ok) {
      setExpenses((current) => current.filter((item) => item.id !== id));
      setLoadError(null);
    }
    return result;
  }, []);

  const value = useMemo<ExpensesContextValue>(
    () => ({ expenses, loading, loadError, refresh, createExpense, updateExpense, deleteExpense }),
    [createExpense, deleteExpense, expenses, loadError, loading, refresh, updateExpense],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses must be used within an ExpensesProvider');
  return context;
}
