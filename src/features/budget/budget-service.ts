import { supabase } from '@/lib/supabase';
import type { BudgetResult, MonthlyBudget } from './types';

const LOAD_ERROR = "Couldn't load budgets. Check your connection and try again.";
const SAVE_ERROR = "Couldn't save the budget. Check your connection and try again.";

type BudgetRow = { id: string; period_month: string; amount: string | number; category_budgets: { id: string; category_id: string; amount: string | number }[] | null };
const mapBudget = (row: BudgetRow): MonthlyBudget => ({ id: row.id, month: row.period_month.slice(0, 7), amountCents: Math.round(Number(row.amount) * 100), categoryBudgets: (row.category_budgets ?? []).map((item) => ({ id: item.id, categoryId: item.category_id, amountCents: Math.round(Number(item.amount) * 100) })) });

export async function getBudgets(): Promise<BudgetResult<MonthlyBudget[]>> {
  try {
    const { data, error } = await supabase.from('budgets').select('id,period_month,amount,category_budgets(id,category_id,amount)').order('period_month', { ascending: false });
    if (error) return { ok: false, message: LOAD_ERROR };
    return { ok: true, data: (data as BudgetRow[]).map(mapBudget) };
  } catch { return { ok: false, message: LOAD_ERROR }; }
}

export async function saveMonthlyBudget(month: string, amountCents: number): Promise<BudgetResult<MonthlyBudget>> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: 'Sign in again before saving this budget.' };
    const { data, error } = await supabase.from('budgets').upsert({ user_id: auth.user.id, period_month: `${month}-01`, amount: (amountCents / 100).toFixed(2) }, { onConflict: 'user_id,period_month' }).select('id,period_month,amount,category_budgets(id,category_id,amount)').single();
    if (error || !data) return { ok: false, message: SAVE_ERROR };
    return { ok: true, data: mapBudget(data as BudgetRow) };
  } catch { return { ok: false, message: SAVE_ERROR }; }
}

export async function saveCategoryBudget(budgetId: string, categoryId: string, amountCents: number): Promise<BudgetResult<{ id: string; categoryId: string; amountCents: number }>> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: 'Sign in again before saving this limit.' };
    const { data, error } = await supabase.from('category_budgets').upsert({ budget_id: budgetId, user_id: auth.user.id, category_id: categoryId, amount: (amountCents / 100).toFixed(2) }, { onConflict: 'budget_id,category_id' }).select('id,category_id,amount').single();
    if (error || !data) return { ok: false, message: SAVE_ERROR };
    return { ok: true, data: { id: data.id, categoryId: data.category_id, amountCents: Math.round(Number(data.amount) * 100) } };
  } catch { return { ok: false, message: SAVE_ERROR }; }
}

export async function removeCategoryBudget(id: string): Promise<BudgetResult<{ id: string }>> {
  try { const { error } = await supabase.from('category_budgets').delete().eq('id', id); return error ? { ok: false, message: SAVE_ERROR } : { ok: true, data: { id } }; }
  catch { return { ok: false, message: SAVE_ERROR }; }
}
