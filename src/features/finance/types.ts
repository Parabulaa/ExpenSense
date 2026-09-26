export type WalletType = 'cash' | 'gcash' | 'maya' | 'bank' | 'other';
export type Wallet = { id: string; name: string; type: WalletType; balanceCents: number; icon: string | null; color: string | null; isDefault: boolean; status: 'active' | 'archived' };
/** Income is earned money; cash-in is a top-up. Both raise a wallet and neither touches a budget. */
export type IncomeKind = 'income' | 'cash_in';
export type IncomeEntry = { id: string; walletId: string; amountCents: number; kind: IncomeKind; source: string; transactionDate: string; transactionTime: string | null; notes: string | null; createdAt: string; pending?: boolean };
/** Source loses amount + fee, destination gains amount. Never spending, never income. */
export type WalletTransfer = { id: string; fromWalletId: string; toWalletId: string; amountCents: number; feeCents: number; transactionDate: string; transactionTime: string | null; notes: string | null; createdAt: string; pending?: boolean };
export type SavingsGoal = { id: string; name: string; targetCents: number; currentCents: number; targetDate: string | null; icon: string | null; category: string | null; status: 'active' | 'archived' };
export type WalletInput = { id?: string; name: string; type: WalletType; balanceCents: number; color: string; isDefault: boolean };
export type IncomeInput = { walletId: string; amountCents: number; kind: IncomeKind; source: string; transactionDate: string; transactionTime: string; notes?: string };
export type TransferInput = { fromWalletId: string; toWalletId: string; amountCents: number; feeCents: number; transactionDate: string; transactionTime: string; notes?: string };
export type GoalInput = { id?: string; name: string; targetCents: number; currentCents?: number; targetDate?: string | null };
/** `queued`: saved on the device, will sync when online. `offline`: the server was unreachable. */
export type FinanceResult<T> = { ok: true; data: T; queued?: boolean } | { ok: false; message: string; offline?: boolean };

export const incomeKindLabels: Record<IncomeKind, string> = { income: 'Income', cash_in: 'Cash-in' };
