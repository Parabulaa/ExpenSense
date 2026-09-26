import { supabase } from '@/lib/supabase';
import { normalizeTime } from '@/features/expenses/validation';
import { isNetworkError } from '@/lib/offline/network';
import type { FinanceResult, GoalInput, IncomeEntry, IncomeInput, SavingsGoal, TransferInput, Wallet, WalletInput, WalletTransfer, WalletType } from './types';

const ERROR = "Couldn't update your financial tools. Check your connection and try again.";
const cents = (value: string | number) => Math.round(Number(value) * 100);
const money = (valueCents: number) => (valueCents / 100).toFixed(2);
const walletFields = 'id,name,type,current_balance,icon,color,is_default,status';
const goalFields = 'id,name,target_amount,current_amount,target_date,icon,category,status';
const incomeFields = 'id,wallet_id,amount,kind,source,transaction_date,transaction_time,notes,created_at';
const transferFields = 'id,from_wallet_id,to_wallet_id,amount,fee,transaction_date,transaction_time,notes,created_at';
const mapWallet = (r: any): Wallet => ({ id: r.id, name: r.name, type: r.type as WalletType, balanceCents: cents(r.current_balance), icon: r.icon, color: r.color, isDefault: r.is_default, status: r.status });
const mapGoal = (r: any): SavingsGoal => ({ id: r.id, name: r.name, targetCents: cents(r.target_amount), currentCents: cents(r.current_amount), targetDate: r.target_date, icon: r.icon, category: r.category, status: r.status });
const mapIncome = (r: any): IncomeEntry => ({ id: r.id, walletId: r.wallet_id, amountCents: cents(r.amount), kind: r.kind, source: r.source, transactionDate: r.transaction_date, transactionTime: normalizeTime(r.transaction_time), notes: r.notes, createdAt: r.created_at });
const mapTransfer = (r: any): WalletTransfer => ({ id: r.id, fromWalletId: r.from_wallet_id, toWalletId: r.to_wallet_id, amountCents: cents(r.amount), feeCents: cents(r.fee), transactionDate: r.transaction_date, transactionTime: normalizeTime(r.transaction_time), notes: r.notes, createdAt: r.created_at });
// The locally stored session — no network round trip per save. Row-level security re-checks ownership.
async function userId() { const { data } = await supabase.auth.getSession(); return data.session?.user.id ?? null; }
const failure = (error: unknown) => ({ ok: false as const, message: ERROR, offline: isNetworkError(error) });

export async function loadFinance(): Promise<FinanceResult<{ wallets: Wallet[]; goals: SavingsGoal[]; incomeEntries: IncomeEntry[]; transfers: WalletTransfer[] }>> {
  try {
    // Money-in and transfers are ledger rows every screen derives totals from,
    // so they are loaded in full rather than as a "recent" slice.
    const [w, g, i, t] = await Promise.all([
      supabase.from('wallets').select(walletFields).eq('status', 'active').order('created_at'),
      supabase.from('savings_goals').select(goalFields).eq('status', 'active').order('created_at'),
      supabase.from('wallet_income').select(incomeFields).order('transaction_date', { ascending: false }).order('transaction_time', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('wallet_transfers').select(transferFields).order('transaction_date', { ascending: false }).order('transaction_time', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
    ]);
    if (w.error || g.error || i.error || t.error) return failure(w.error ?? g.error ?? i.error ?? t.error);
    return { ok: true, data: { wallets: (w.data ?? []).map(mapWallet), goals: (g.data ?? []).map(mapGoal), incomeEntries: (i.data ?? []).map(mapIncome), transfers: (t.data ?? []).map(mapTransfer) } };
  } catch (error) { return failure(error); }
}

export async function saveWallet(input: WalletInput): Promise<FinanceResult<Wallet>> {
  try {
    const uid = await userId(); if (!uid) return { ok: false, message: 'Sign in again before saving a wallet.' };
    if (input.isDefault) await supabase.from('wallets').update({ is_default: false }).eq('user_id', uid).eq('is_default', true);
    const payload = { user_id: uid, name: input.name.trim(), type: input.type, current_balance: money(input.balanceCents), color: input.color, is_default: input.isDefault };
    const query = input.id ? supabase.from('wallets').update(payload).eq('id', input.id) : supabase.from('wallets').insert(payload);
    const { data, error } = await query.select(walletFields).single();
    return error || !data ? failure(error) : { ok: true, data: mapWallet(data) };
  } catch (error) { return failure(error); }
}
export async function addIncome(input: IncomeInput, id?: string): Promise<FinanceResult<IncomeEntry>> {
  try {
    const uid = await userId(); if (!uid) return { ok: false, message: 'Sign in again before adding money.' };
    const { data, error } = await supabase.from('wallet_income').insert({ ...(id ? { id } : {}), user_id: uid, wallet_id: input.walletId, amount: money(input.amountCents), kind: input.kind, source: input.source.trim(), transaction_date: input.transactionDate, transaction_time: input.transactionTime, notes: input.notes?.trim() || null }).select(incomeFields).single();
    if (error?.code === '23505' && id) { const existing = await supabase.from('wallet_income').select(incomeFields).eq('id', id).maybeSingle(); if (existing.data) return { ok: true, data: mapIncome(existing.data) }; }
    return error || !data ? failure(error) : { ok: true, data: mapIncome(data) };
  } catch (error) { return failure(error); }
}
export async function deleteIncome(id: string): Promise<FinanceResult<{ id: string }>> {
  try { const { error } = await supabase.from('wallet_income').delete().eq('id', id); return error ? failure(error) : { ok: true, data: { id } }; }
  catch (error) { return failure(error); }
}
export async function addTransfer(input: TransferInput, id?: string): Promise<FinanceResult<WalletTransfer>> {
  try {
    const uid = await userId(); if (!uid) return { ok: false, message: 'Sign in again before moving money.' };
    if (input.fromWalletId === input.toWalletId) return { ok: false, message: 'Choose two different wallets.' };
    const { data, error } = await supabase.from('wallet_transfers').insert({ ...(id ? { id } : {}), user_id: uid, from_wallet_id: input.fromWalletId, to_wallet_id: input.toWalletId, amount: money(input.amountCents), fee: money(input.feeCents), transaction_date: input.transactionDate, transaction_time: input.transactionTime, notes: input.notes?.trim() || null }).select(transferFields).single();
    if (error?.code === '23505' && id) { const existing = await supabase.from('wallet_transfers').select(transferFields).eq('id', id).maybeSingle(); if (existing.data) return { ok: true, data: mapTransfer(existing.data) }; }
    return error || !data ? failure(error) : { ok: true, data: mapTransfer(data) };
  } catch (error) { return failure(error); }
}
export async function deleteTransfer(id: string): Promise<FinanceResult<{ id: string }>> {
  try { const { error } = await supabase.from('wallet_transfers').delete().eq('id', id); return error ? failure(error) : { ok: true, data: { id } }; }
  catch (error) { return failure(error); }
}
export async function archiveWallet(id: string) { const { error } = await supabase.from('wallets').update({ status: 'archived', is_default: false }).eq('id', id); return error ? failure(error) : { ok: true as const, data: { id } }; }

export async function saveGoal(input: GoalInput): Promise<FinanceResult<SavingsGoal>> {
  try {
    const uid = await userId(); if (!uid) return { ok: false, message: 'Sign in again before saving a goal.' };
    const payload: any = { user_id: uid, name: input.name.trim(), target_amount: money(input.targetCents), target_date: input.targetDate || null };
    if (!input.id) payload.current_amount = money(input.currentCents ?? 0);
    const query = input.id ? supabase.from('savings_goals').update(payload).eq('id', input.id) : supabase.from('savings_goals').insert(payload);
    const { data, error } = await query.select(goalFields).single();
    return error || !data ? failure(error) : { ok: true, data: mapGoal(data) };
  } catch (error) { return failure(error); }
}
export async function addToGoal(goal: SavingsGoal, amountCents: number) { const { data, error } = await supabase.from('savings_goals').update({ current_amount: money(goal.currentCents + amountCents) }).eq('id', goal.id).select(goalFields).single(); return error || !data ? failure(error) : { ok: true as const, data: mapGoal(data) }; }
export async function archiveGoal(id: string) { const { error } = await supabase.from('savings_goals').update({ status: 'archived' }).eq('id', id); return error ? failure(error) : { ok: true as const, data: { id } }; }
