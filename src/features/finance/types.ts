export type WalletType = 'cash' | 'gcash' | 'maya' | 'bank' | 'other';
export type Wallet = { id: string; name: string; type: WalletType; balanceCents: number; icon: string | null; color: string | null; isDefault: boolean; status: 'active' | 'archived' };
export type SavingsGoal = { id: string; name: string; targetCents: number; currentCents: number; targetDate: string | null; icon: string | null; category: string | null; status: 'active' | 'archived' };
export type WalletInput = { id?: string; name: string; type: WalletType; balanceCents: number; isDefault: boolean };
export type GoalInput = { id?: string; name: string; targetCents: number; currentCents?: number; targetDate?: string | null };
export type FinanceResult<T> = { ok: true; data: T } | { ok: false; message: string };
