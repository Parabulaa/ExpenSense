import { supabase } from '@/lib/supabase';
import type { FinanceResult, GoalInput, SavingsGoal, Wallet, WalletInput, WalletType } from './types';

const ERROR = "Couldn't update your financial tools. Check your connection and try again.";
const cents = (value: string | number) => Math.round(Number(value) * 100);
const walletFields = 'id,name,type,current_balance,icon,color,is_default,status';
const goalFields = 'id,name,target_amount,current_amount,target_date,icon,category,status';
const mapWallet = (r: any): Wallet => ({ id: r.id, name: r.name, type: r.type as WalletType, balanceCents: cents(r.current_balance), icon: r.icon, color: r.color, isDefault: r.is_default, status: r.status });
const mapGoal = (r: any): SavingsGoal => ({ id: r.id, name: r.name, targetCents: cents(r.target_amount), currentCents: cents(r.current_amount), targetDate: r.target_date, icon: r.icon, category: r.category, status: r.status });
async function userId() { const { data, error } = await supabase.auth.getUser(); return error ? null : data.user?.id ?? null; }

export async function loadFinance(): Promise<FinanceResult<{ wallets: Wallet[]; goals: SavingsGoal[] }>> {
  try {
    const [w, g] = await Promise.all([
      supabase.from('wallets').select(walletFields).eq('status', 'active').order('created_at'),
      supabase.from('savings_goals').select(goalFields).eq('status', 'active').order('created_at'),
    ]);
    if (w.error || g.error) return { ok: false, message: ERROR };
    return { ok: true, data: { wallets: (w.data ?? []).map(mapWallet), goals: (g.data ?? []).map(mapGoal) } };
  } catch { return { ok: false, message: ERROR }; }
}

export async function saveWallet(input: WalletInput): Promise<FinanceResult<Wallet>> {
  try {
    const uid = await userId(); if (!uid) return { ok: false, message: 'Sign in again before saving a wallet.' };
    if (input.isDefault) await supabase.from('wallets').update({ is_default: false }).eq('user_id', uid).eq('is_default', true);
    const payload = { user_id: uid, name: input.name.trim(), type: input.type, current_balance: (input.balanceCents / 100).toFixed(2), is_default: input.isDefault };
    const query = input.id ? supabase.from('wallets').update(payload).eq('id', input.id) : supabase.from('wallets').insert(payload);
    const { data, error } = await query.select(walletFields).single();
    return error || !data ? { ok: false, message: ERROR } : { ok: true, data: mapWallet(data) };
  } catch { return { ok: false, message: ERROR }; }
}
export async function archiveWallet(id: string) { const { error } = await supabase.from('wallets').update({ status: 'archived', is_default: false }).eq('id', id); return error ? { ok: false as const, message: ERROR } : { ok: true as const, data: { id } }; }

export async function saveGoal(input: GoalInput): Promise<FinanceResult<SavingsGoal>> {
  try {
    const uid = await userId(); if (!uid) return { ok: false, message: 'Sign in again before saving a goal.' };
    const payload: any = { user_id: uid, name: input.name.trim(), target_amount: (input.targetCents / 100).toFixed(2), target_date: input.targetDate || null };
    if (!input.id) payload.current_amount = ((input.currentCents ?? 0) / 100).toFixed(2);
    const query = input.id ? supabase.from('savings_goals').update(payload).eq('id', input.id) : supabase.from('savings_goals').insert(payload);
    const { data, error } = await query.select(goalFields).single();
    return error || !data ? { ok: false, message: ERROR } : { ok: true, data: mapGoal(data) };
  } catch { return { ok: false, message: ERROR }; }
}
export async function addToGoal(goal: SavingsGoal, amountCents: number) { const { data, error } = await supabase.from('savings_goals').update({ current_amount: ((goal.currentCents + amountCents) / 100).toFixed(2) }).eq('id', goal.id).select(goalFields).single(); return error || !data ? { ok: false as const, message: ERROR } : { ok: true as const, data: mapGoal(data) }; }
export async function archiveGoal(id: string) { const { error } = await supabase.from('savings_goals').update({ status: 'archived' }).eq('id', id); return error ? { ok: false as const, message: ERROR } : { ok: true as const, data: { id } }; }
