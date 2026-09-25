import { supabase } from '@/lib/supabase';
import type { BudgetResult, CategoryBudget, MonthlyBudget } from './types';

const LOAD_ERROR = "Couldn't load budgets. Check your connection and try again.";
const SAVE_ERROR = "Couldn't save the budget. Check your connection and try again.";
const BUDGET_FIELDS = 'id,period_month,category_budgets(id,category_id,amount)';

type BudgetRow = { id: string; period_month: string; category_budgets: { id: string; category_id: string; amount: string | number }[] | null };
const mapBudget = (row: BudgetRow): MonthlyBudget => ({ id: row.id, month: row.period_month.slice(0, 7), categoryBudgets: (row.category_budgets ?? []).map((item) => ({ id: item.id, categoryId: item.category_id, amountCents: Math.round(Number(item.amount) * 100) })) });

export async function getBudgets(): Promise<BudgetResult<MonthlyBudget[]>> {
  try {
    const { data, error } = await supabase.from('budgets').select(BUDGET_FIELDS).order('period_month', { ascending: false });
    if (error) return { ok: false, message: LOAD_ERROR };
    return { ok: true, data: (data as BudgetRow[]).map(mapBudget) };
  } catch { return { ok: false, message: LOAD_ERROR }; }
}

/** The month row only groups category limits, so it is created on demand. */
async function ensureMonth(userId: string, month: string): Promise<MonthlyBudget | null> {
  const existing = await supabase.from('budgets').select(BUDGET_FIELDS).eq('period_month', `${month}-01`).maybeSingle();
  if (existing.error) return null;
  if (existing.data) return mapBudget(existing.data as BudgetRow);
  const created = await supabase.from('budgets').insert({ user_id: userId, period_month: `${month}-01`, amount: '0.00' }).select(BUDGET_FIELDS).single();
  if (created.error || !created.data) {
    // Another save created it first; read the winner instead of failing.
    const retry = await supabase.from('budgets').select(BUDGET_FIELDS).eq('period_month', `${month}-01`).maybeSingle();
    return retry.data ? mapBudget(retry.data as BudgetRow) : null;
  }
  return mapBudget(created.data as BudgetRow);
}

export async function saveCategoryBudget(month: string, categoryId: string, amountCents: number): Promise<BudgetResult<{ budget: MonthlyBudget; limit: CategoryBudget }>> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: 'Sign in again before saving this limit.' };
    const budget = await ensureMonth(auth.user.id, month);
    if (!budget) return { ok: false, message: SAVE_ERROR };
    const { data, error } = await supabase.from('category_budgets').upsert({ budget_id: budget.id, user_id: auth.user.id, category_id: categoryId, amount: (amountCents / 100).toFixed(2) }, { onConflict: 'budget_id,category_id' }).select('id,category_id,amount').single();
    if (error || !data) return { ok: false, message: SAVE_ERROR };
    return { ok: true, data: { budget, limit: { id: data.id, categoryId: data.category_id, amountCents: Math.round(Number(data.amount) * 100) } } };
  } catch { return { ok: false, message: SAVE_ERROR }; }
}

export async function removeCategoryBudget(id: string): Promise<BudgetResult<{ id: string }>> {
  try { const { error } = await supabase.from('category_budgets').delete().eq('id', id); return error ? { ok: false, message: SAVE_ERROR } : { ok: true, data: { id } }; }
  catch { return { ok: false, message: SAVE_ERROR }; }
}
