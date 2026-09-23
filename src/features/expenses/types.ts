export type ExpenseSource = 'manual' | 'receipt';

export type Expense = {
  id: string;
  userId: string;
  amountCents: number;
  merchant: string;
  categoryId: string;
  walletId: string | null;
  transactionDate: string;
  notes: string | null;
  source: ExpenseSource;
  createdAt: string;
  updatedAt: string;
};

export type CreateExpenseInput = {
  amountCents: number;
  merchant: string;
  categoryId: string;
  transactionDate: string;
  notes?: string;
  walletId?: string | null;
};

export type UpdateExpenseInput = CreateExpenseInput & { id: string };

export type ExpenseFormValues = {
  amount: string;
  merchant: string;
  categoryId: string;
  transactionDate: string;
  notes: string;
  walletId: string;
};

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export type ExpenseResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };
