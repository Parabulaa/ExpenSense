export type ExpenseSource = 'manual' | 'receipt';

export type Expense = {
  id: string;
  userId: string;
  amountCents: number;
  merchant: string;
  categoryId: string;
  walletId: string | null;
  transactionDate: string;
  /** `HH:MM`, or null for rows saved before times were recorded. */
  transactionTime: string | null;
  notes: string | null;
  source: ExpenseSource;
  /** Private storage path of the scanned receipt or attached photo. */
  receiptPath: string | null;
  createdAt: string;
  updatedAt: string;
  /** Saved on this device and not yet uploaded. */
  pending?: boolean;
};

export type CreateExpenseInput = {
  amountCents: number;
  merchant: string;
  categoryId: string;
  transactionDate: string;
  transactionTime: string;
  notes?: string;
  walletId?: string | null;
  /** Already-uploaded photo to keep with a manual expense. */
  receiptPath?: string | null;
};

export type UpdateExpenseInput = CreateExpenseInput & { id: string };

export type ExpenseFormValues = {
  amount: string;
  merchant: string;
  categoryId: string;
  transactionDate: string;
  transactionTime: string;
  notes: string;
  walletId: string;
};

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export type ExpenseResult<T> =
  /** `queued` means it was saved on the device and will sync when back online. */
  | { ok: true; data: T; queued?: boolean }
  /** `offline` means the server could not be reached, so the change is safe to retry. */
  | { ok: false; message: string; offline?: boolean };
