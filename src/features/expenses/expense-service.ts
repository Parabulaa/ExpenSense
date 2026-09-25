import { supabase } from '@/lib/supabase';
import type { CreateExpenseInput, Expense, ExpenseResult, UpdateExpenseInput } from './types';
import { normalizeTime } from './validation';

type ExpenseRow = {
  id: string;
  user_id: string;
  amount: string | number;
  merchant: string;
  category_id: string;
  wallet_id: string | null;
  transaction_date: string;
  transaction_time: string | null;
  notes: string | null;
  source: 'manual' | 'receipt';
  created_at: string;
  updated_at: string;
};

const EXPENSE_FIELDS = 'id,user_id,amount,merchant,category_id,wallet_id,transaction_date,transaction_time,notes,source,created_at,updated_at';
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
    walletId: row.wallet_id,
    transactionDate: row.transaction_date,
    transactionTime: normalizeTime(row.transaction_time),
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
      .select(EXPENSE_FIELDS)
      .order('transaction_date', { ascending: false })
      .order('transaction_time', { ascending: false, nullsFirst: false })
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
        wallet_id: input.walletId || null,
        transaction_date: input.transactionDate,
        transaction_time: input.transactionTime,
        notes: input.notes || null,
        source: 'manual',
      })
      .select(EXPENSE_FIELDS)
      .single();

    if (error || !data) return { ok: false, message: SAFE_SAVE_ERROR };
    return { ok: true, data: fromRow(data as ExpenseRow) };
  } catch {
    return { ok: false, message: SAFE_SAVE_ERROR };
  }
}

export async function updateExpense(input: UpdateExpenseInput): Promise<ExpenseResult<Expense>> {
  try {
    // The database trigger reverses the old wallet effect before applying the
    // new amount/wallet, so an edit can never double-count.
    const { data, error } = await supabase
      .from('expenses')
      .update({
        amount: (input.amountCents / 100).toFixed(2),
        merchant: input.merchant,
        category_id: input.categoryId,
        wallet_id: input.walletId || null,
        transaction_date: input.transactionDate,
        transaction_time: input.transactionTime,
        notes: input.notes || null,
      })
      .eq('id', input.id)
      .select(EXPENSE_FIELDS)
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
