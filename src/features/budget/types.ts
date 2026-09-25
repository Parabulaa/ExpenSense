export type CategoryBudget = { id: string; categoryId: string; amountCents: number };
/** A month's budget is exactly its category limits; there is no separate total. */
export type MonthlyBudget = { id: string; month: string; categoryBudgets: CategoryBudget[] };
export type BudgetResult<T> = { ok: true; data: T } | { ok: false; message: string };

type Spend = { categoryId: string; amountCents: number };

/**
 * Budget totals derived from category limits. Only spending in categories that
 * have a limit counts against the budget, so an unbudgeted category can never
 * make the budget look overspent.
 */
export function budgetUsage(budget: MonthlyBudget | undefined, expenses: Spend[]) {
  const limits = budget?.categoryBudgets.filter((item) => item.amountCents > 0) ?? [];
  const limited = new Set(limits.map((item) => item.categoryId));
  const limitCents = limits.reduce((sum, item) => sum + item.amountCents, 0);
  const spentCents = expenses.filter((item) => limited.has(item.categoryId)).reduce((sum, item) => sum + item.amountCents, 0);
  return { limitCents, spentCents, remainingCents: limitCents - spentCents, hasBudget: limitCents > 0 };
}
