import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import * as service from './finance-service';
import type { FinanceResult, GoalInput, SavingsGoal, Wallet, WalletInput } from './types';

type Value = { wallets: Wallet[]; goals: SavingsGoal[]; loading: boolean; error: string | null; refresh: () => Promise<void>; saveWallet: (v: WalletInput) => Promise<FinanceResult<Wallet>>; archiveWallet: (id: string) => Promise<FinanceResult<{ id: string }>>; saveGoal: (v: GoalInput) => Promise<FinanceResult<SavingsGoal>>; addToGoal: (g: SavingsGoal, cents: number) => Promise<FinanceResult<SavingsGoal>>; archiveGoal: (id: string) => Promise<FinanceResult<{ id: string }>> };
const Context = createContext<Value | null>(null);
export function FinanceProvider({ children }: PropsWithChildren) {
  const { user, initialized } = useAuth(); const [wallets, setWallets] = useState<Wallet[]>([]); const [goals, setGoals] = useState<SavingsGoal[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { if (!user) { setWallets([]); setGoals([]); setLoading(false); return; } setLoading(true); const r = await service.loadFinance(); if (r.ok) { setWallets(r.data.wallets); setGoals(r.data.goals); setError(null); } else setError(r.message); setLoading(false); }, [user]);
  useEffect(() => { if (initialized) { // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  } }, [initialized, refresh]);
  const saveWallet = useCallback(async (v: WalletInput) => { const r = await service.saveWallet(v); if (r.ok) setWallets(c => [r.data, ...c.filter(x => x.id !== r.data.id)].map(x => r.data.isDefault && x.id !== r.data.id ? { ...x, isDefault: false } : x)); return r; }, []);
  const archiveWallet = useCallback(async (id: string) => { const r = await service.archiveWallet(id); if (r.ok) setWallets(c => c.filter(x => x.id !== id)); return r; }, []);
  const saveGoal = useCallback(async (v: GoalInput) => { const r = await service.saveGoal(v); if (r.ok) setGoals(c => [r.data, ...c.filter(x => x.id !== r.data.id)]); return r; }, []);
  const addToGoal = useCallback(async (g: SavingsGoal, n: number) => { const r = await service.addToGoal(g, n); if (r.ok) setGoals(c => c.map(x => x.id === r.data.id ? r.data : x)); return r; }, []);
  const archiveGoal = useCallback(async (id: string) => { const r = await service.archiveGoal(id); if (r.ok) setGoals(c => c.filter(x => x.id !== id)); return r; }, []);
  const value = useMemo(() => ({ wallets, goals, loading, error, refresh, saveWallet, archiveWallet, saveGoal, addToGoal, archiveGoal }), [wallets, goals, loading, error, refresh, saveWallet, archiveWallet, saveGoal, addToGoal, archiveGoal]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useFinance() { const value = useContext(Context); if (!value) throw new Error('useFinance must be used within FinanceProvider'); return value; }
