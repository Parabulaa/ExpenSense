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
import { readCache, STALE_AFTER_MS, writeCache } from '@/lib/offline/cache';
import { uuid } from '@/lib/offline/network';
import { applyOps, enqueue, useOutbox } from '@/lib/offline/outbox';
import * as expenseService from './expense-service';
import type { CreateExpenseInput, Expense, ExpenseResult, UpdateExpenseInput } from './types';

type ExpensesContextValue = {
  /** Server expenses with any changes still waiting to sync applied on top. */
  expenses: Expense[];
  loading: boolean;
  loadError: string | null;
  /** Always refetches. Use after a change, or for pull-to-refresh. */
  refresh: () => Promise<void>;
  /** Refetches only when the data is stale — for screens coming into view. */
  revalidate: () => Promise<void>;
  createExpense: (input: CreateExpenseInput) => Promise<ExpenseResult<Expense>>;
  updateExpense: (input: UpdateExpenseInput) => Promise<ExpenseResult<Expense>>;
  deleteExpense: (id: string) => Promise<ExpenseResult<{ id: string }>>;
};

const ExpensesContext = createContext<ExpensesContextValue | null>(null);
const CACHE_NAME = 'expenses';

/** How an expense moves its wallet: money leaves the wallet it was paid from. */
const walletEffect = (expense: Pick<Expense, 'walletId' | 'amountCents'> | undefined, sign: 1 | -1): Record<string, number> =>
  expense?.walletId ? { [expense.walletId]: sign * expense.amountCents } : {};
const combine = (...parts: Record<string, number>[]) => parts.reduce<Record<string, number>>((sum, part) => {
  Object.entries(part).forEach(([id, cents]) => { sum[id] = (sum[id] ?? 0) + cents; });
  return sum;
}, {});

export function ExpensesProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [serverExpenses, setServerExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const loadedUserId = useRef<string | null>(null);
  const lastFetched = useRef(0);
  const hasData = useRef(false);
  const ops = useOutbox();

  const store = useCallback((next: Expense[] | ((current: Expense[]) => Expense[])) => {
    setServerExpenses((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (loadedUserId.current) writeCache(loadedUserId.current, CACHE_NAME, value);
      return value;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      loadedUserId.current = null;
      hasData.current = false;
      setServerExpenses([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    if (inFlight.current && loadedUserId.current === user.id) return;
    if (loadedUserId.current !== user.id) {
      loadedUserId.current = user.id;
      hasData.current = false;
      // Show the last saved copy immediately — this is what makes the app
      // usable offline and makes every launch instant.
      const cached = await readCache<Expense[]>(user.id, CACHE_NAME);
      setServerExpenses(cached ?? []);
      if (cached) { hasData.current = true; setLoading(false); }
    }

    const currentRequest = ++requestId.current;
    inFlight.current = true;
    if (!hasData.current) setLoading(true);
    const result = await expenseService.getExpenses();
    inFlight.current = false;
    if (currentRequest !== requestId.current) return;

    if (result.ok) {
      store(result.data);
      hasData.current = true;
      lastFetched.current = Date.now();
      setLoadError(null);
    } else if (!result.offline) {
      setLoadError(result.message);
    }
    setLoading(false);
  }, [store, user]);

  const revalidate = useCallback(async () => {
    if (Date.now() - lastFetched.current < STALE_AFTER_MS && loadedUserId.current === user?.id) return;
    await refresh();
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!initialized) return;
    // `refresh` synchronizes this provider with Supabase when auth identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [initialized, refresh]);

  const expenses = useMemo(
    () => applyOps(serverExpenses, ops, 'expense', (op) => op.kind === 'expense.create' || op.kind === 'expense.update' ? { ...op.expense, pending: true } : null),
    [ops, serverExpenses],
  );
  const findExpense = useCallback((id: string) => expenses.find((item) => item.id === id), [expenses]);

  const createExpense = useCallback(async (input: CreateExpenseInput): Promise<ExpenseResult<Expense>> => {
    const id = uuid();
    const result = await expenseService.createExpense(input, id);
    if (result.ok) {
      store((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
      setLoadError(null);
      return result;
    }
    if (!result.offline || !user) return result;
    const now = new Date().toISOString();
    const expense: Expense = { id, userId: user.id, amountCents: input.amountCents, merchant: input.merchant, categoryId: input.categoryId, walletId: input.walletId || null, transactionDate: input.transactionDate, transactionTime: input.transactionTime, notes: input.notes || null, source: 'manual', createdAt: now, updatedAt: now };
    enqueue({ kind: 'expense.create', expense }, walletEffect(expense, -1));
    return { ok: true, data: { ...expense, pending: true }, queued: true };
  }, [store, user]);

  const updateExpense = useCallback(async (input: UpdateExpenseInput): Promise<ExpenseResult<Expense>> => {
    const previous = findExpense(input.id);
    // Something still waiting to upload is edited in the queue, not on the server.
    const result = previous?.pending ? { ok: false as const, message: '', offline: true } : await expenseService.updateExpense(input);
    if (result.ok) {
      store((current) => current.map((item) => item.id === result.data.id ? result.data : item));
      setLoadError(null);
      return result;
    }
    if (!result.offline || !previous) return result;
    const expense: Expense = { ...previous, amountCents: input.amountCents, merchant: input.merchant, categoryId: input.categoryId, walletId: input.walletId || null, transactionDate: input.transactionDate, transactionTime: input.transactionTime, notes: input.notes || null, updatedAt: new Date().toISOString(), pending: undefined };
    enqueue({ kind: 'expense.update', expense }, combine(walletEffect(previous, 1), walletEffect(expense, -1)));
    return { ok: true, data: { ...expense, pending: true }, queued: true };
  }, [findExpense, store]);

  const deleteExpense = useCallback(async (id: string): Promise<ExpenseResult<{ id: string }>> => {
    const previous = findExpense(id);
    const result = previous?.pending ? { ok: false as const, message: '', offline: true } : await expenseService.deleteExpense(id);
    if (result.ok) {
      store((current) => current.filter((item) => item.id !== id));
      setLoadError(null);
      return result;
    }
    if (!result.offline) return result;
    enqueue({ kind: 'expense.delete', id }, walletEffect(previous, 1));
    return { ok: true, data: { id }, queued: true };
  }, [findExpense, store]);

  const value = useMemo<ExpensesContextValue>(
    () => ({ expenses, loading, loadError, refresh, revalidate, createExpense, updateExpense, deleteExpense }),
    [createExpense, deleteExpense, expenses, loadError, loading, refresh, revalidate, updateExpense],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses must be used within an ExpensesProvider');
  return context;
}
