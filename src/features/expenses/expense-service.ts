import { supabase } from '@/lib/supabase';
import type { CreateExpenseInput, Expense, ExpenseResult, UpdateExpenseInput } from './types';

type ExpenseRow = {
  id: string;
  user_id: string;
  amount: string | number;
  merchant: string;
  category_id: string;
  transaction_date: string;
  notes: string | null;
  source: 'manual' | 'receipt';
  created_at: string;
  updated_at: string;
};

const SAFE_LOAD_ERROR = "Couldn't load expenses. Check your connection and try again.";
const SAFE_SAVE_ERROR = "Couldn't save expense. Check your connection and try again.";
const SAFE_UPDATE_ERROR = "Couldn't update transaction. Check your connection and try again.";
const SAFE_DELETE_ERROR = "Couldn't delete transaction. Check your connection and try again.";

function fromRow(row: ExpenseRow): Expense {
  const amount = Number(row.amount);
  return {
    id: row.id,
    userId: row.user_id,
    amountCents: Math.round(amount * 100),
    merchant: row.merchant,
    categoryId: row.category_id,
    transactionDate: row.transaction_date,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getExpenses(): Promise<ExpenseResult<Expense[]>> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('id,user_id,amount,merchant,category_id,transaction_date,notes,source,created_at,updated_at')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return { ok: false, message: SAFE_LOAD_ERROR };
    return { ok: true, data: (data as ExpenseRow[]).map(fromRow) };
  } catch {
    return { ok: false, message: SAFE_LOAD_ERROR };
  }
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseResult<Expense>> {
  try {
    // Ownership comes from the verified auth session, never from a form value.
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: 'Sign in again before saving this expense.' };

    const amount = (input.amountCents / 100).toFixed(2);
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: authData.user.id,
        amount,
        merchant: input.merchant,
        category_id: input.categoryId,
        transaction_date: input.transactionDate,
        notes: input.notes || null,
        source: 'manual',
      })
      .select('id,user_id,amount,merchant,category_id,transaction_date,notes,source,created_at,updated_at')
      .single();

    if (error || !data) return { ok: false, message: SAFE_SAVE_ERROR };
    return { ok: true, data: fromRow(data as ExpenseRow) };
  } catch {
    return { ok: false, message: SAFE_SAVE_ERROR };
  }
}

export async function updateExpense(input: UpdateExpenseInput): Promise<ExpenseResult<Expense>> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update({
        amount: (input.amountCents / 100).toFixed(2),
        merchant: input.merchant,
        category_id: input.categoryId,
        transaction_date: input.transactionDate,
        notes: input.notes || null,
      })
      .eq('id', input.id)
      .select('id,user_id,amount,merchant,category_id,transaction_date,notes,source,created_at,updated_at')
      .single();

    if (error || !data) return { ok: false, message: SAFE_UPDATE_ERROR };
    return { ok: true, data: fromRow(data as ExpenseRow) };
  } catch {
    return { ok: false, message: SAFE_UPDATE_ERROR };
  }
}

export async function deleteExpense(id: string): Promise<ExpenseResult<{ id: string }>> {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return { ok: false, message: SAFE_DELETE_ERROR };
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, message: SAFE_DELETE_ERROR };
  }
}
