import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { readCache, STALE_AFTER_MS, writeCache } from '@/lib/offline/cache';
import { OFFLINE_MESSAGE, uuid } from '@/lib/offline/network';
import { applyOps, enqueue, pendingWalletDeltas, useOutbox } from '@/lib/offline/outbox';
import * as service from './finance-service';
import type { FinanceResult, GoalInput, IncomeEntry, IncomeInput, SavingsGoal, TransferInput, Wallet, WalletInput, WalletTransfer } from './types';

type Snapshot = { wallets: Wallet[]; goals: SavingsGoal[]; incomeEntries: IncomeEntry[]; transfers: WalletTransfer[] };
type Value = Snapshot & {
  loading: boolean;
  error: string | null;
  /** Always refetches. Use after a change, or for pull-to-refresh. */
  refresh: () => Promise<void>;
  /** Refetches only when the data is stale — for screens coming into view. */
  revalidate: () => Promise<void>;
  saveWallet: (v: WalletInput) => Promise<FinanceResult<Wallet>>;
  archiveWallet: (id: string) => Promise<FinanceResult<{ id: string }>>;
  addIncome: (v: IncomeInput) => Promise<FinanceResult<IncomeEntry>>;
  deleteIncome: (id: string) => Promise<FinanceResult<{ id: string }>>;
  addTransfer: (v: TransferInput) => Promise<FinanceResult<WalletTransfer>>;
  deleteTransfer: (id: string) => Promise<FinanceResult<{ id: string }>>;
  saveGoal: (v: GoalInput) => Promise<FinanceResult<SavingsGoal>>;
  addToGoal: (g: SavingsGoal, cents: number) => Promise<FinanceResult<SavingsGoal>>;
  archiveGoal: (id: string) => Promise<FinanceResult<{ id: string }>>;
};
const Context = createContext<Value | null>(null);
const CACHE_NAME = 'finance';
const EMPTY: Snapshot = { wallets: [], goals: [], incomeEntries: [], transfers: [] };

/** Wallet and goal settings need the server, so offline they say so instead of failing vaguely. */
const onlineOnly = <T,>(result: FinanceResult<T>): FinanceResult<T> => (!result.ok && result.offline ? { ok: false, message: OFFLINE_MESSAGE, offline: true } : result);

export function FinanceProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth();
  const [server, setServer] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedUserId = useRef<string | null>(null);
  const lastFetched = useRef(0);
  const ops = useOutbox();

  const store = useCallback((update: (current: Snapshot) => Snapshot) => {
    setServer((current) => {
      const next = update(current);
      if (loadedUserId.current) writeCache(loadedUserId.current, CACHE_NAME, next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) { loadedUserId.current = null; setServer(EMPTY); setLoading(false); return; }
    if (loadedUserId.current !== user.id) {
      loadedUserId.current = user.id;
      const cached = await readCache<Snapshot>(user.id, CACHE_NAME);
      setServer(cached ?? EMPTY);
      if (cached) setLoading(false);
    }
    setLoading(true);
    const r = await service.loadFinance();
    if (r.ok) { store(() => r.data); lastFetched.current = Date.now(); setError(null); }
    else if (!r.offline) setError(r.message);
    setLoading(false);
  }, [store, user]);

  const revalidate = useCallback(async () => {
    if (Date.now() - lastFetched.current < STALE_AFTER_MS && loadedUserId.current === user?.id) return;
    await refresh();
  }, [refresh, user?.id]);

  useEffect(() => { if (initialized) { // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  } }, [initialized, refresh]);

  // What the screens show: server data plus every change still waiting to sync.
  const view = useMemo<Snapshot>(() => {
    const deltas = pendingWalletDeltas(ops);
    return {
      wallets: server.wallets.map((wallet) => deltas[wallet.id] ? { ...wallet, balanceCents: wallet.balanceCents + deltas[wallet.id] } : wallet),
      goals: server.goals,
      incomeEntries: applyOps(server.incomeEntries, ops, 'income', (op) => op.kind === 'income.create' ? { ...op.entry, pending: true } : null),
      transfers: applyOps(server.transfers, ops, 'transfer', (op) => op.kind === 'transfer.create' ? { ...op.transfer, pending: true } : null),
    };
  }, [ops, server]);

  const saveWallet = useCallback(async (v: WalletInput) => { const r = onlineOnly(await service.saveWallet(v)); if (r.ok) store(c => ({ ...c, wallets: [r.data, ...c.wallets.filter(x => x.id !== r.data.id)].map(x => r.data.isDefault && x.id !== r.data.id ? { ...x, isDefault: false } : x) })); return r; }, [store]);
  const archiveWallet = useCallback(async (id: string) => { const r = onlineOnly(await service.archiveWallet(id)); if (r.ok) store(c => ({ ...c, wallets: c.wallets.filter(x => x.id !== id) })); return r; }, [store]);

  const addIncome = useCallback(async (v: IncomeInput): Promise<FinanceResult<IncomeEntry>> => {
    const id = uuid();
    const r = await service.addIncome(v, id);
    // Balances are recalculated by the database, so a synced change reloads them.
    if (r.ok) { await refresh(); return r; }
    if (!r.offline) return r;
    const entry: IncomeEntry = { id, walletId: v.walletId, amountCents: v.amountCents, kind: v.kind, source: v.source.trim(), transactionDate: v.transactionDate, transactionTime: v.transactionTime, notes: v.notes?.trim() || null, createdAt: new Date().toISOString() };
    enqueue({ kind: 'income.create', entry }, { [v.walletId]: v.amountCents });
    return { ok: true, data: { ...entry, pending: true }, queued: true };
  }, [refresh]);

  const deleteIncome = useCallback(async (id: string): Promise<FinanceResult<{ id: string }>> => {
    const entry = view.incomeEntries.find(x => x.id === id);
    const r = entry?.pending ? { ok: false as const, message: '', offline: true } : await service.deleteIncome(id);
    if (r.ok) { await refresh(); return r; }
    if (!r.offline) return r;
    enqueue({ kind: 'income.delete', id }, entry ? { [entry.walletId]: -entry.amountCents } : {});
    return { ok: true, data: { id }, queued: true };
  }, [refresh, view.incomeEntries]);

  const addTransfer = useCallback(async (v: TransferInput): Promise<FinanceResult<WalletTransfer>> => {
    const id = uuid();
    const r = await service.addTransfer(v, id);
    if (r.ok) { await refresh(); return r; }
    if (!r.offline) return r;
    const transfer: WalletTransfer = { id, fromWalletId: v.fromWalletId, toWalletId: v.toWalletId, amountCents: v.amountCents, feeCents: v.feeCents, transactionDate: v.transactionDate, transactionTime: v.transactionTime, notes: v.notes?.trim() || null, createdAt: new Date().toISOString() };
    enqueue({ kind: 'transfer.create', transfer }, { [v.fromWalletId]: -(v.amountCents + v.feeCents), [v.toWalletId]: v.amountCents });
    return { ok: true, data: { ...transfer, pending: true }, queued: true };
  }, [refresh]);

  const deleteTransfer = useCallback(async (id: string): Promise<FinanceResult<{ id: string }>> => {
    const transfer = view.transfers.find(x => x.id === id);
    const r = transfer?.pending ? { ok: false as const, message: '', offline: true } : await service.deleteTransfer(id);
    if (r.ok) { await refresh(); return r; }
    if (!r.offline) return r;
    enqueue({ kind: 'transfer.delete', id }, transfer ? { [transfer.fromWalletId]: transfer.amountCents + transfer.feeCents, [transfer.toWalletId]: -transfer.amountCents } : {});
    return { ok: true, data: { id }, queued: true };
  }, [refresh, view.transfers]);

  const saveGoal = useCallback(async (v: GoalInput) => { const r = onlineOnly(await service.saveGoal(v)); if (r.ok) store(c => ({ ...c, goals: [r.data, ...c.goals.filter(x => x.id !== r.data.id)] })); return r; }, [store]);
  const addToGoal = useCallback(async (g: SavingsGoal, n: number) => { const r = onlineOnly(await service.addToGoal(g, n)); if (r.ok) store(c => ({ ...c, goals: c.goals.map(x => x.id === r.data.id ? r.data : x) })); return r; }, [store]);
  const archiveGoal = useCallback(async (id: string) => { const r = onlineOnly(await service.archiveGoal(id)); if (r.ok) store(c => ({ ...c, goals: c.goals.filter(x => x.id !== id) })); return r; }, [store]);

  const value = useMemo(() => ({ ...view, loading, error, refresh, revalidate, saveWallet, archiveWallet, addIncome, deleteIncome, addTransfer, deleteTransfer, saveGoal, addToGoal, archiveGoal }), [view, loading, error, refresh, revalidate, saveWallet, archiveWallet, addIncome, deleteIncome, addTransfer, deleteTransfer, saveGoal, addToGoal, archiveGoal]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useFinance() { const value = useContext(Context); if (!value) throw new Error('useFinance must be used within FinanceProvider'); return value; }
