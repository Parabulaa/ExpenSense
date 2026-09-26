import { supabase } from '@/lib/supabase';
import { isNetworkError } from '@/lib/offline/network';
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
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
};

const EXPENSE_FIELDS = 'id,user_id,amount,merchant,category_id,wallet_id,transaction_date,transaction_time,notes,source,receipt_path,created_at,updated_at';
const SAFE_LOAD_ERROR = "Couldn't load expenses. Check your connection and try again.";
const SAFE_SAVE_ERROR = "Couldn't save expense. Check your connection and try again.";
const SAFE_UPDATE_ERROR = "Couldn't update transaction. Check your connection and try again.";
const SAFE_DELETE_ERROR = "Couldn't delete transaction. Check your connection and try again.";

const failure = (message: string, error: unknown) => ({ ok: false as const, message, offline: isNetworkError(error) });

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
    receiptPath: row.receipt_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The signed-in user from the locally stored session — no network round trip. */
export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getExpenses(): Promise<ExpenseResult<Expense[]>> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select(EXPENSE_FIELDS)
      .order('transaction_date', { ascending: false })
      .order('transaction_time', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) return failure(SAFE_LOAD_ERROR, error);
    return { ok: true, data: (data as ExpenseRow[]).map(fromRow) };
  } catch (error) {
    return failure(SAFE_LOAD_ERROR, error);
  }
}

async function getExpense(id: string): Promise<Expense | null> {
  const { data } = await supabase.from('expenses').select(EXPENSE_FIELDS).eq('id', id).maybeSingle();
  return data ? fromRow(data as ExpenseRow) : null;
}

/**
 * `id` is made on the device. If a retry finds that id already saved (the
 * first attempt reached the server but its reply was lost), that saved row is
 * the answer, so a retry can never create a duplicate.
 */
export async function createExpense(input: CreateExpenseInput, id?: string): Promise<ExpenseResult<Expense>> {
  try {
    // Ownership comes from the session, never from a form value; row-level
    // security re-checks it on the server.
    const userId = await currentUserId();
    if (!userId) return { ok: false, message: 'Sign in again before saving this expense.' };

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...(id ? { id } : {}),
        user_id: userId,
        amount: (input.amountCents / 100).toFixed(2),
        merchant: input.merchant,
        category_id: input.categoryId,
        wallet_id: input.walletId || null,
        transaction_date: input.transactionDate,
        transaction_time: input.transactionTime,
        notes: input.notes || null,
        receipt_path: input.receiptPath || null,
        source: 'manual',
      })
      .select(EXPENSE_FIELDS)
      .single();

    if (error?.code === '23505' && id) {
      const existing = await getExpense(id);
      if (existing) return { ok: true, data: existing };
    }
    if (error || !data) return failure(SAFE_SAVE_ERROR, error);
    return { ok: true, data: fromRow(data as ExpenseRow) };
  } catch (error) {
    return failure(SAFE_SAVE_ERROR, error);
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

    if (error || !data) return failure(SAFE_UPDATE_ERROR, error);
    return { ok: true, data: fromRow(data as ExpenseRow) };
  } catch (error) {
    return failure(SAFE_UPDATE_ERROR, error);
  }
}

export async function deleteExpense(id: string): Promise<ExpenseResult<{ id: string }>> {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return failure(SAFE_DELETE_ERROR, error);
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(SAFE_DELETE_ERROR, error);
  }
}
