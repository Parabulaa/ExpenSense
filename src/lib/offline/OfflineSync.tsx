import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/common/toast';
import { useAuth } from '@/features/auth/AuthProvider';
import * as expenseService from '@/features/expenses/expense-service';
import { useExpenses } from '@/features/expenses/ExpensesProvider';
import * as financeService from '@/features/finance/finance-service';
import { useFinance } from '@/features/finance/FinanceProvider';
import { flushOutbox, loadOutbox, useOutbox, type FlushOutcome, type OutboxOp } from './outbox';

/** How often to retry while changes are waiting and the app is open. */
const RETRY_MS = 20_000;

type Result = { ok: true } | { ok: false; message: string; offline?: boolean };
const outcomeOf = (result: Result): { outcome: FlushOutcome; message?: string } =>
  result.ok ? { outcome: 'done' } : result.offline ? { outcome: 'offline' } : { outcome: 'failed', message: result.message };

async function execute(op: OutboxOp) {
  switch (op.kind) {
    case 'expense.create': {
      const { expense } = op;
      return outcomeOf(await expenseService.createExpense({ amountCents: expense.amountCents, merchant: expense.merchant, categoryId: expense.categoryId, walletId: expense.walletId, transactionDate: expense.transactionDate, transactionTime: expense.transactionTime ?? '12:00', notes: expense.notes ?? undefined }, expense.id));
    }
    case 'expense.update': {
      const { expense } = op;
      return outcomeOf(await expenseService.updateExpense({ id: expense.id, amountCents: expense.amountCents, merchant: expense.merchant, categoryId: expense.categoryId, walletId: expense.walletId, transactionDate: expense.transactionDate, transactionTime: expense.transactionTime ?? '12:00', notes: expense.notes ?? undefined }));
    }
    case 'expense.delete':
      return outcomeOf(await expenseService.deleteExpense(op.id));
    case 'income.create': {
      const { entry } = op;
      return outcomeOf(await financeService.addIncome({ walletId: entry.walletId, amountCents: entry.amountCents, kind: entry.kind, source: entry.source, transactionDate: entry.transactionDate, transactionTime: entry.transactionTime ?? '12:00', notes: entry.notes ?? undefined }, entry.id));
    }
    case 'income.delete':
      return outcomeOf(await financeService.deleteIncome(op.id));
    case 'transfer.create': {
      const { transfer } = op;
      return outcomeOf(await financeService.addTransfer({ fromWalletId: transfer.fromWalletId, toWalletId: transfer.toWalletId, amountCents: transfer.amountCents, feeCents: transfer.feeCents, transactionDate: transfer.transactionDate, transactionTime: transfer.transactionTime ?? '12:00', notes: transfer.notes ?? undefined }, transfer.id));
    }
    case 'transfer.delete':
      return outcomeOf(await financeService.deleteTransfer(op.id));
  }
}

/**
 * Uploads changes made offline. It runs on launch, whenever the app returns to
 * the foreground, when the browser reports it is back online, and on a slow
 * timer only while something is actually waiting — never on a tight loop, so
 * a long offline stretch cannot turn into a burst of requests.
 */
export function OfflineSync() {
  const { user } = useAuth();
  const { refresh: refreshExpenses } = useExpenses();
  const { refresh: refreshFinance } = useFinance();
  const { showToast } = useToast();
  const ops = useOutbox();
  const announcedOffline = useRef(false);

  useEffect(() => { void loadOutbox(user?.id ?? null); }, [user?.id]);

  const sync = useCallback(async () => {
    if (!user) return;
    const result = await flushOutbox(execute);
    if (result.synced) {
      // Wallet balances are recalculated by the database; one reload each brings them in.
      await Promise.all([refreshExpenses(), refreshFinance()]);
      showToast(`Back online · ${result.synced} change${result.synced === 1 ? '' : 's'} synced.`, { icon: 'cloud-check-outline' });
      announcedOffline.current = false;
    }
    result.dropped.forEach((message) => showToast(`A change made offline couldn't be saved: ${message}`, { tone: 'warning' }));
  }, [refreshExpenses, refreshFinance, showToast, user]);

  // Tell the user once per offline stretch that their changes are safe.
  useEffect(() => {
    if (ops.length && !announcedOffline.current) {
      announcedOffline.current = true;
      showToast("You're offline. Changes are saved on this device and will sync automatically.", { icon: 'cloud-off-outline' });
    }
  }, [ops.length, showToast]);

  useEffect(() => {
    if (!user) return;
    void sync();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    const onOnline = () => { void sync(); };
    const canListen = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    if (canListen) window.addEventListener('online', onOnline);
    return () => {
      appState.remove();
      if (canListen) window.removeEventListener('online', onOnline);
    };
  }, [sync, user]);

  useEffect(() => {
    if (!ops.length) return;
    const timer = setInterval(() => { void sync(); }, RETRY_MS);
    return () => clearInterval(timer);
  }, [ops.length, sync]);

  return null;
}
