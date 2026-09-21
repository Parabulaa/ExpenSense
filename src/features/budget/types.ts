export type CategoryBudget = { id: string; categoryId: string; amountCents: number };
export type MonthlyBudget = { id: string; month: string; amountCents: number; categoryBudgets: CategoryBudget[] };
export type BudgetResult<T> = { ok: true; data: T } | { ok: false; message: string };
